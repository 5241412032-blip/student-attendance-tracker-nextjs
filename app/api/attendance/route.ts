import { NextRequest, NextResponse } from 'next/server';
import { sql, initDB } from '@/lib/db';

let dbInitialized = false;

async function ensureDB() {
  if (!dbInitialized) {
    await initDB();
    dbInitialized = true;
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureDB();
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const date = /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : new Date().toISOString().split('T')[0];

    const students = await sql`
      SELECT
        s.id,
        s.roll_number,
        s.name,
        a.status AS current_status,
        COUNT(hist.id)::int AS total_marked_days,
        COALESCE(SUM(CASE WHEN hist.status = 'Present' THEN 1 ELSE 0 END), 0)::int AS total_present_days
      FROM students s
      LEFT JOIN attendance a ON s.id = a.student_id AND a.attendance_date = ${date}
      LEFT JOIN attendance hist ON s.id = hist.student_id
      GROUP BY s.id, s.roll_number, s.name, a.status
      ORDER BY s.roll_number ASC, s.name ASC
    `;

    let presentCount = 0, absentCount = 0, unmarkedCount = 0;
    const formattedStudents = students.map((stu) => {
      const status = stu.current_status ?? 'Unmarked';
      if (status === 'Present') presentCount++;
      else if (status === 'Absent') absentCount++;
      else unmarkedCount++;

      const totalDays = stu.total_marked_days || 0;
      const presentDays = stu.total_present_days || 0;
      const historicalPct = totalDays > 0 ? Math.round((presentDays / totalDays) * 1000) / 10 : 100.0;

      return {
        id: stu.id,
        roll_number: stu.roll_number,
        name: stu.name,
        status,
        total_days: totalDays,
        present_days: presentDays,
        historical_percentage: historicalPct,
      };
    });

    const totalStudents = formattedStudents.length;
    const livePercentage = totalStudents > 0
      ? Math.round((presentCount / totalStudents) * 1000) / 10
      : 0.0;

    return NextResponse.json({
      success: true,
      date,
      summary: { total_students: totalStudents, present_count: presentCount, absent_count: absentCount, unmarked_count: unmarkedCount, live_percentage: livePercentage },
      students: formattedStudents,
    });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDB();
    const contentType = request.headers.get('content-type') || '';
    let body: Record<string, unknown> = {};

    if (contentType.includes('application/json')) {
      body = await request.json();
    } else {
      const formData = await request.formData();
      formData.forEach((value, key) => { body[key] = value; });
    }

    const action = body.action as string;

    switch (action) {
      case 'add_student': {
        const name = (body.name as string || '').trim();
        const roll = (body.roll_number as string || '').trim();
        if (!name) return NextResponse.json({ success: false, error: 'Student name is required.' });

        let finalRoll = roll;
        if (!finalRoll) {
          const maxResult = await sql`SELECT MAX(id) as max_id FROM students`;
          const nextId = (maxResult[0].max_id || 100) + 1;
          finalRoll = `STU-${nextId}`;
        }

        const existing = await sql`SELECT id FROM students WHERE roll_number = ${finalRoll}`;
        if (existing.length > 0) {
          return NextResponse.json({ success: false, error: `Roll number '${finalRoll}' already exists.` });
        }

        const result = await sql`INSERT INTO students (roll_number, name) VALUES (${finalRoll}, ${name}) RETURNING id`;
        return NextResponse.json({
          success: true,
          message: `Student '${name}' (${finalRoll}) added successfully.`,
          student: { id: result[0].id, roll_number: finalRoll, name },
        });
      }

      case 'delete_student': {
        const studentId = parseInt(body.id as string || '0');
        if (studentId <= 0) return NextResponse.json({ success: false, error: 'Invalid student ID.' });
        await sql`DELETE FROM students WHERE id = ${studentId}`;
        return NextResponse.json({ success: true, message: 'Student removed successfully.' });
      }

      case 'mark_single': {
        const studentId = parseInt(body.student_id as string || '0');
        const date = body.date as string || new Date().toISOString().split('T')[0];
        const status = body.status as string;
        if (studentId <= 0 || !['Present', 'Absent'].includes(status)) {
          return NextResponse.json({ success: false, error: 'Invalid student ID or status.' });
        }
        await sql`
          INSERT INTO attendance (student_id, attendance_date, status)
          VALUES (${studentId}, ${date}, ${status})
          ON CONFLICT (student_id, attendance_date) DO UPDATE SET status = EXCLUDED.status, updated_at = CURRENT_TIMESTAMP
        `;
        return NextResponse.json({ success: true, message: `Attendance updated to ${status}.` });
      }

      case 'bulk_mark': {
        const date = body.date as string || new Date().toISOString().split('T')[0];
        const status = body.status as string;
        if (!['Present', 'Absent'].includes(status)) {
          return NextResponse.json({ success: false, error: 'Invalid status.' });
        }
        const students = await sql`SELECT id FROM students`;
        for (const stu of students) {
          await sql`
            INSERT INTO attendance (student_id, attendance_date, status)
            VALUES (${stu.id}, ${date}, ${status})
            ON CONFLICT (student_id, attendance_date) DO UPDATE SET status = EXCLUDED.status, updated_at = CURRENT_TIMESTAMP
          `;
        }
        return NextResponse.json({ success: true, message: `Marked all students as ${status}.` });
      }

      case 'save_all': {
        const date = body.date as string || new Date().toISOString().split('T')[0];
        const records = body.records as Array<{ student_id: number; status: string }>;
        if (Array.isArray(records) && records.length > 0) {
          for (const item of records) {
            const sId = parseInt(String(item.student_id || 0));
            const st = item.status;
            if (sId > 0 && ['Present', 'Absent'].includes(st)) {
              await sql`
                INSERT INTO attendance (student_id, attendance_date, status)
                VALUES (${sId}, ${date}, ${st})
                ON CONFLICT (student_id, attendance_date) DO UPDATE SET status = EXCLUDED.status, updated_at = CURRENT_TIMESTAMP
              `;
            }
          }
        }
        return NextResponse.json({ success: true, message: 'All attendance records saved successfully.' });
      }

      default:
        return NextResponse.json({ success: false, error: 'Unknown action.' });
    }
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
