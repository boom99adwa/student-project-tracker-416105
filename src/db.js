import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(srcDir, '..');
const defaultDbPath = path.join(projectRoot, 'data', 'project_tracker.sqlite');
export const dbPath = process.env.PROJECT_TRACKER_DB || defaultDbPath;

mkdirSync(path.dirname(dbPath), { recursive: true });
export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
db.exec(readFileSync(path.join(srcDir, 'schema.sql'), 'utf8'));

function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM projects').get().count;
  if (count > 0) return;

  db.exec('BEGIN');
  try {
    const advisor = db.prepare('INSERT INTO advisors (id, name, email, department) VALUES (?, ?, ?, ?)');
    advisor.run(1, 'อ.กมลชนก ใจดี', 'kamonchanok@example.test', 'เทคโนโลยีสารสนเทศ');
    advisor.run(2, 'อ.ธนกฤต วัฒนะ', 'thanakrit@example.test', 'วิทยาการคอมพิวเตอร์');

    const student = db.prepare('INSERT INTO students (id, student_no, name, email, program, year_level) VALUES (?, ?, ?, ?, ?, ?)');
    student.run(1, '66010001', 'กานต์ธีรา พูนผล', 'student01@example.test', 'เทคโนโลยีสารสนเทศ', 3);
    student.run(2, '66010002', 'ณัฐวุฒิ ศรีสุข', 'student02@example.test', 'เทคโนโลยีสารสนเทศ', 3);
    student.run(3, '66010003', 'พิมพ์ชนก สายใจ', 'student03@example.test', 'วิทยาการคอมพิวเตอร์', 3);
    student.run(4, '66010004', 'ธนภัทร แสงทอง', 'student04@example.test', 'เทคโนโลยีสารสนเทศ', 3);
    student.run(5, '66010005', 'ปาริชาติ นาคแก้ว', 'student05@example.test', 'วิทยาการคอมพิวเตอร์', 3);
    student.run(6, '66010006', 'ศุภกร จันทร์ดี', 'student06@example.test', 'เทคโนโลยีสารสนเทศ', 3);

    const project = db.prepare(`INSERT INTO projects
      (id, code, title, description, status, start_date, end_date, advisor_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    project.run(1, 'STU-2026-001', 'ระบบจองห้องปฏิบัติการ', 'เว็บสำหรับค้นหาและจองช่วงเวลาใช้ห้องปฏิบัติการ พร้อมติดตามสถานะคำขอ', 'in_progress', '2026-09-01', '2026-12-15', 1);
    project.run(2, 'STU-2026-002', 'ระบบติดตามงานสหกิจศึกษา', 'จัดเก็บสถานประกอบการ แผนงาน และบันทึกความก้าวหน้ารายสัปดาห์', 'planning', '2026-09-08', '2026-12-20', 2);
    project.run(3, 'STU-2026-003', 'แพลตฟอร์มแลกเปลี่ยนอุปกรณ์เรียน', 'ช่วยให้นักศึกษาลงประกาศและค้นหาอุปกรณ์การเรียนที่ต้องการแลกเปลี่ยน', 'completed', '2026-08-01', '2026-10-01', 1);
    project.run(4, 'STU-2026-004', 'ระบบจัดการกิจกรรมชมรม', 'จัดการปฏิทินกิจกรรม การลงทะเบียน และรายชื่อผู้เข้าร่วม', 'on_hold', '2026-09-15', '2027-01-15', 2);

    const member = db.prepare('INSERT INTO project_members (project_id, student_id, role) VALUES (?, ?, ?)');
    member.run(1, 1, 'หัวหน้าทีม'); member.run(1, 2, 'สมาชิก'); member.run(1, 3, 'สมาชิก');
    member.run(2, 2, 'หัวหน้าทีม'); member.run(2, 4, 'สมาชิก'); member.run(2, 5, 'สมาชิก'); member.run(2, 6, 'สมาชิก');
    member.run(3, 1, 'หัวหน้าทีม'); member.run(3, 4, 'สมาชิก'); member.run(3, 5, 'สมาชิก');
    member.run(4, 3, 'หัวหน้าทีม'); member.run(4, 5, 'สมาชิก'); member.run(4, 6, 'สมาชิก');

    const progress = db.prepare(`INSERT INTO progress_updates
      (project_id, title, detail, percent_complete, recorded_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?)`);
    progress.run(1, 'ต้นแบบหน้าจอและ API', 'ทำหน้าแสดงรายการและเชื่อมต่อ API สำหรับดึงโครงงานแล้ว', 65, '2026-09-26 10:00:00', 1);
    progress.run(2, 'กำหนดขอบเขตงาน', 'รวบรวมความต้องการและร่าง ER Diagram', 25, '2026-09-24 13:30:00', 2);
    progress.run(3, 'ส่งมอบระบบ', 'ทดสอบ CRUD และจัดทำคู่มือเรียบร้อย', 100, '2026-09-28 15:00:00', 1);
    progress.run(4, 'รอทบทวนความต้องการ', 'พักการพัฒนาเพื่อปรับขอบเขตกับผู้ใช้', 10, '2026-09-25 09:00:00', 3);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

seedIfEmpty();

export function projectById(id) {
  return db.prepare(`SELECT p.*, a.name AS advisor_name,
      (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) AS member_count,
      (SELECT percent_complete FROM progress_updates pu WHERE pu.project_id = p.id ORDER BY recorded_at DESC, id DESC LIMIT 1) AS progress
    FROM projects p JOIN advisors a ON a.id = p.advisor_id WHERE p.id = ?`).get(id);
}

export function projectDetails(id) {
  const project = projectById(id);
  if (!project) return undefined;
  project.members = db.prepare(`SELECT s.id, s.student_no, s.name, pm.role
    FROM project_members pm JOIN students s ON s.id = pm.student_id
    WHERE pm.project_id = ? ORDER BY s.student_no`).all(id);
  project.progress_updates = db.prepare(`SELECT pu.id, pu.title, pu.detail, pu.percent_complete, pu.recorded_at,
      s.name AS created_by_name
    FROM progress_updates pu LEFT JOIN students s ON s.id = pu.created_by
    WHERE pu.project_id = ? ORDER BY pu.recorded_at DESC, pu.id DESC`).all(id);
  return project;
}
