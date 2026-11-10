import { NextRequest, NextResponse } from 'next/server';
import {
  fetchAttendanceData,
  addStudent,
  deleteStudent,
  markSingle,
  bulkMark,
  saveAll,
} from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const date = /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : new Date().toISOString().split('T')[0];

    const data = await fetchAttendanceData(date);

    return NextResponse.json({
      success: true,
      date,
      summary: data.summary,
      students: data.students,
    });
  } catch (err: unknown) {
    console.error('API GET error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let body: Record<string, any> = {};

    if (contentType.includes('application/json')) {
      body = await request.json();
    } else {
      const formData = await request.formData();
      formData.forEach((value, key) => {
        body[key] = value;
      });
    }

    const action = body.action as string;

    switch (action) {
      case 'add_student': {
        const name = (body.name as string || '').trim();
        const roll = (body.roll_number as string || '').trim();
        if (!name) {
          return NextResponse.json({ success: false, error: 'Student name is required.' });
        }

        const student = await addStudent(name, roll);
        return NextResponse.json({
          success: true,
          message: `Student '${name}' (${student.roll_number}) added successfully.`,
          student,
        });
      }

      case 'delete_student': {
        const studentId = parseInt(body.id as string || '0', 10);
        if (studentId <= 0) {
          return NextResponse.json({ success: false, error: 'Invalid student ID.' });
        }
        await deleteStudent(studentId);
        return NextResponse.json({ success: true, message: 'Student removed successfully.' });
      }

      case 'mark_single': {
        const studentId = parseInt(body.student_id as string || '0', 10);
        const date = (body.date as string) || new Date().toISOString().split('T')[0];
        const status = body.status as 'Present' | 'Absent';

        if (studentId <= 0 || !['Present', 'Absent'].includes(status)) {
          return NextResponse.json({ success: false, error: 'Invalid student ID or status.' });
        }

        await markSingle(studentId, date, status);
        return NextResponse.json({ success: true, message: `Attendance updated to ${status}.` });
      }

      case 'bulk_mark': {
        const date = (body.date as string) || new Date().toISOString().split('T')[0];
        const status = body.status as 'Present' | 'Absent';

        if (!['Present', 'Absent'].includes(status)) {
          return NextResponse.json({ success: false, error: 'Invalid status.' });
        }

        await bulkMark(date, status);
        return NextResponse.json({ success: true, message: `Marked all students as ${status}.` });
      }

      case 'save_all': {
        const date = (body.date as string) || new Date().toISOString().split('T')[0];
        const records = body.records || [];

        if (Array.isArray(records) && records.length > 0) {
          await saveAll(date, records);
        }

        return NextResponse.json({ success: true, message: 'All attendance records saved successfully.' });
      }

      default:
        return NextResponse.json({ success: false, error: 'Unknown action.' });
    }
  } catch (err: unknown) {
    console.error('API POST error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
