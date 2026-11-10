import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export { sql };

export async function initDB() {
  // Create students table
  await sql`
    CREATE TABLE IF NOT EXISTS students (
      id SERIAL PRIMARY KEY,
      roll_number VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  // Create attendance table
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

  // Seed demo data if empty
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
      const statuses: Array<[string, string]> = [
        [stuRows[0].id, 'Present'], [stuRows[1].id, 'Present'],
        [stuRows[2].id, 'Absent'],  [stuRows[3].id, 'Present'],
        [stuRows[4].id, 'Present'],
      ];
      for (const [id, status] of statuses) {
        await sql`INSERT INTO attendance (student_id, attendance_date, status) VALUES (${id}, ${yesterday}, ${status}) ON CONFLICT DO NOTHING`;
      }
      const todayStatuses: Array<[string, string]> = [
        [stuRows[0].id, 'Present'], [stuRows[1].id, 'Present'],
        [stuRows[2].id, 'Present'], [stuRows[3].id, 'Absent'],
        [stuRows[4].id, 'Present'],
      ];
      for (const [id, status] of todayStatuses) {
        await sql`INSERT INTO attendance (student_id, attendance_date, status) VALUES (${id}, ${today}, ${status}) ON CONFLICT DO NOTHING`;
      }
    }
  }
}
