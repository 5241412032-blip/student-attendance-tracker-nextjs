import { neon } from '@neondatabase/serverless';

export interface Student {
  id: number;
  roll_number: string;
  name: string;
  created_at?: string;
}

export interface AttendanceRecord {
  id: number;
  student_id: number;
  attendance_date: string;
  status: 'Present' | 'Absent';
}

export interface FormattedStudent {
  id: number;
  roll_number: string;
  name: string;
  status: 'Present' | 'Absent' | 'Unmarked';
  total_days: number;
  present_days: number;
  historical_percentage: number;
}

// In-Memory store for when DATABASE_URL is not set or invalid
const memoryStore = {
  nextStudentId: 106,
  nextAttendanceId: 20,
  students: [
    { id: 1, roll_number: 'STU-101', name: 'Alex Johnson' },
    { id: 2, roll_number: 'STU-102', name: 'Sophia Davis' },
    { id: 3, roll_number: 'STU-103', name: 'Liam Miller' },
    { id: 4, roll_number: 'STU-104', name: 'Emma Wilson' },
    { id: 5, roll_number: 'STU-105', name: 'Noah Brown' },
  ] as Student[],
  attendance: [] as AttendanceRecord[],
};

// Seed initial memory attendance
(() => {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  memoryStore.attendance.push(
    { id: 1, student_id: 1, attendance_date: yesterday, status: 'Present' },
    { id: 2, student_id: 2, attendance_date: yesterday, status: 'Present' },
    { id: 3, student_id: 3, attendance_date: yesterday, status: 'Absent' },
    { id: 4, student_id: 4, attendance_date: yesterday, status: 'Present' },
    { id: 5, student_id: 5, attendance_date: yesterday, status: 'Present' },
    { id: 6, student_id: 1, attendance_date: today, status: 'Present' },
    { id: 7, student_id: 2, attendance_date: today, status: 'Present' },
    { id: 8, student_id: 3, attendance_date: today, status: 'Present' },
    { id: 9, student_id: 4, attendance_date: today, status: 'Absent' },
    { id: 10, student_id: 5, attendance_date: today, status: 'Present' },
  );
})();

function isValidDbUrl(url?: string): boolean {
  if (!url) return false;
  return url.startsWith('postgres://') || url.startsWith('postgresql://');
}

function getSql() {
  const dbUrl = process.env.DATABASE_URL;
  if (!isValidDbUrl(dbUrl)) return null;
  try {
    return neon(dbUrl!);
  } catch {
    return null;
  }
}

let dbInitialized = false;

export async function initDB() {
  const sql = getSql();
  if (!sql || dbInitialized) return;

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        roll_number VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        attendance_date DATE NOT NULL,
        status VARCHAR(10) NOT NULL DEFAULT 'Present' CHECK (status IN ('Present', 'Absent')),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(student_id, attendance_date)
      )
    `;

    const countResult = await sql`SELECT COUNT(*) as count FROM students`;
    if (parseInt(countResult[0].count) === 0) {
      const demoStudents = [
        ['STU-101', 'Alex Johnson'],
        ['STU-102', 'Sophia Davis'],
        ['STU-103', 'Liam Miller'],
        ['STU-104', 'Emma Wilson'],
        ['STU-105', 'Noah Brown'],
      ];
      for (const [roll, name] of demoStudents) {
        await sql`INSERT INTO students (roll_number, name) VALUES (${roll}, ${name}) ON CONFLICT DO NOTHING`;
      }

      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const stuRows = await sql`SELECT id FROM students ORDER BY id`;

      if (stuRows.length >= 5) {
        const pastStatuses = ['Present', 'Present', 'Absent', 'Present', 'Present'];
        const todayStatuses = ['Present', 'Present', 'Present', 'Absent', 'Present'];
        for (let i = 0; i < 5; i++) {
          await sql`INSERT INTO attendance (student_id, attendance_date, status) VALUES (${stuRows[i].id}, ${yesterday}, ${pastStatuses[i]}) ON CONFLICT DO NOTHING`;
          await sql`INSERT INTO attendance (student_id, attendance_date, status) VALUES (${stuRows[i].id}, ${today}, ${todayStatuses[i]}) ON CONFLICT DO NOTHING`;
        }
      }
    }
    dbInitialized = true;
  } catch (err) {
    console.warn('Neon DB init failed, using in-memory store:', err);
  }
}

// Unified Data Access Layer
export async function fetchAttendanceData(date: string) {
  const sql = getSql();
  if (sql) {
    try {
      await initDB();
      const rows = await sql`
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

      return formatStudentRows(rows);
    } catch (e) {
      console.warn('SQL fetch failed, falling back to memory:', e);
    }
  }

  // Memory fallback
  const formattedStudents: FormattedStudent[] = memoryStore.students
    .slice()
    .sort((a, b) => a.roll_number.localeCompare(b.roll_number))
    .map((s) => {
      const todayRecord = memoryStore.attendance.find(
        (a) => a.student_id === s.id && a.attendance_date === date
      );
      const studentHistory = memoryStore.attendance.filter((a) => a.student_id === s.id);
      const totalDays = studentHistory.length;
      const presentDays = studentHistory.filter((a) => a.status === 'Present').length;
      const historicalPct = totalDays > 0 ? Math.round((presentDays / totalDays) * 1000) / 10 : 100.0;

      return {
        id: s.id,
        roll_number: s.roll_number,
        name: s.name,
        status: (todayRecord ? todayRecord.status : 'Unmarked') as 'Present' | 'Absent' | 'Unmarked',
        total_days: totalDays,
        present_days: presentDays,
        historical_percentage: historicalPct,
      };
    });

  return computeSummary(formattedStudents);
}

function formatStudentRows(rows: any[]) {
  const formatted: FormattedStudent[] = rows.map((stu) => {
    const status = stu.current_status ?? 'Unmarked';
    const totalDays = Number(stu.total_marked_days || 0);
    const presentDays = Number(stu.total_present_days || 0);
    const historicalPct = totalDays > 0 ? Math.round((presentDays / totalDays) * 1000) / 10 : 100.0;

    return {
      id: Number(stu.id),
      roll_number: String(stu.roll_number),
      name: String(stu.name),
      status: status as 'Present' | 'Absent' | 'Unmarked',
      total_days: totalDays,
      present_days: presentDays,
      historical_percentage: historicalPct,
    };
  });

  return computeSummary(formatted);
}

function computeSummary(students: FormattedStudent[]) {
  let presentCount = 0;
  let absentCount = 0;
  let unmarkedCount = 0;

  for (const s of students) {
    if (s.status === 'Present') presentCount++;
    else if (s.status === 'Absent') absentCount++;
    else unmarkedCount++;
  }

  const totalStudents = students.length;
  const livePercentage = totalStudents > 0
    ? Math.round((presentCount / totalStudents) * 1000) / 10
    : 0.0;

  return {
    summary: {
      total_students: totalStudents,
      present_count: presentCount,
      absent_count: absentCount,
      unmarked_count: unmarkedCount,
      live_percentage: livePercentage,
    },
    students,
  };
}

export async function addStudent(name: string, rollNumber?: string) {
  let roll = (rollNumber || '').trim();
  const sql = getSql();

  if (sql) {
    try {
      await initDB();
      if (!roll) {
        const maxResult = await sql`SELECT MAX(id) as max_id FROM students`;
        const nextId = (maxResult[0]?.max_id || 100) + 1;
        roll = `STU-${nextId}`;
      }
      const existing = await sql`SELECT id FROM students WHERE roll_number = ${roll}`;
      if (existing.length > 0) {
        throw new Error(`Roll number '${roll}' already exists.`);
      }
      const result = await sql`INSERT INTO students (roll_number, name) VALUES (${roll}, ${name}) RETURNING id`;
      return { id: result[0].id, roll_number: roll, name };
    } catch (e) {
      if ((e as Error).message.includes('already exists')) throw e;
      console.warn('SQL addStudent failed, using memory:', e);
    }
  }

  // Memory fallback
  if (!roll) {
    roll = `STU-${memoryStore.nextStudentId++}`;
  }
  if (memoryStore.students.some((s) => s.roll_number.toLowerCase() === roll.toLowerCase())) {
    throw new Error(`Roll number '${roll}' already exists.`);
  }

  const newStudent: Student = {
    id: memoryStore.students.length > 0 ? Math.max(...memoryStore.students.map((s) => s.id)) + 1 : 1,
    roll_number: roll,
    name,
  };
  memoryStore.students.push(newStudent);
  return newStudent;
}

export async function deleteStudent(studentId: number) {
  const sql = getSql();
  if (sql) {
    try {
      await initDB();
      await sql`DELETE FROM students WHERE id = ${studentId}`;
      return true;
    } catch (e) {
      console.warn('SQL deleteStudent failed, using memory:', e);
    }
  }

  memoryStore.students = memoryStore.students.filter((s) => s.id !== studentId);
  memoryStore.attendance = memoryStore.attendance.filter((a) => a.student_id !== studentId);
  return true;
}

export async function markSingle(studentId: number, date: string, status: 'Present' | 'Absent') {
  const sql = getSql();
  if (sql) {
    try {
      await initDB();
      await sql`
        INSERT INTO attendance (student_id, attendance_date, status)
        VALUES (${studentId}, ${date}, ${status})
        ON CONFLICT (student_id, attendance_date) 
        DO UPDATE SET status = EXCLUDED.status, updated_at = CURRENT_TIMESTAMP
      `;
      return true;
    } catch (e) {
      console.warn('SQL markSingle failed, using memory:', e);
    }
  }

  // Memory fallback
  const existing = memoryStore.attendance.find(
    (a) => a.student_id === studentId && a.attendance_date === date
  );
  if (existing) {
    existing.status = status;
  } else {
    memoryStore.attendance.push({
      id: memoryStore.nextAttendanceId++,
      student_id: studentId,
      attendance_date: date,
      status,
    });
  }
  return true;
}

export async function bulkMark(date: string, status: 'Present' | 'Absent') {
  const sql = getSql();
  if (sql) {
    try {
      await initDB();
      const students = await sql`SELECT id FROM students`;
      for (const s of students) {
        await sql`
          INSERT INTO attendance (student_id, attendance_date, status)
          VALUES (${s.id}, ${date}, ${status})
          ON CONFLICT (student_id, attendance_date)
          DO UPDATE SET status = EXCLUDED.status, updated_at = CURRENT_TIMESTAMP
        `;
      }
      return true;
    } catch (e) {
      console.warn('SQL bulkMark failed, using memory:', e);
    }
  }

  for (const s of memoryStore.students) {
    const existing = memoryStore.attendance.find(
      (a) => a.student_id === s.id && a.attendance_date === date
    );
    if (existing) {
      existing.status = status;
    } else {
      memoryStore.attendance.push({
        id: memoryStore.nextAttendanceId++,
        student_id: s.id,
        attendance_date: date,
        status,
      });
    }
  }
  return true;
}

export async function saveAll(date: string, records: Array<{ student_id: number; status: 'Present' | 'Absent' }>) {
  for (const r of records) {
    if (r.student_id > 0 && ['Present', 'Absent'].includes(r.status)) {
      await markSingle(r.student_id, date, r.status);
    }
  }
  return true;
}
