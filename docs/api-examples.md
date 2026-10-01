# ตัวอย่าง JSON Request/Response

เซิร์ฟเวอร์ตัวอย่างใช้ `http://127.0.0.1:8765` และตอบข้อมูลเป็น JSON

## ดูโครงงานทั้งหมด

`GET /api/projects`

```json
{
  "items": [
    {
      "id": 1,
      "code": "STU-2026-001",
      "title": "ระบบจองห้องปฏิบัติการ",
      "description": "เว็บสำหรับค้นหาและจองช่วงเวลาใช้ห้องปฏิบัติการ พร้อมติดตามสถานะคำขอ",
      "status": "in_progress",
      "advisor_id": 1,
      "advisor_name": "อ.กมลชนก ใจดี",
      "member_count": 3,
      "progress": 65
    }
  ],
  "count": 4
}
```

ค้นหาด้วย `GET /api/projects?q=จอง` หรือกรองสถานะด้วย `GET /api/projects?status=in_progress` ได้

## ดูโครงงานรายรายการ

`GET /api/projects/1`

Response เพิ่ม `members` และ `progress_updates`:

```json
{
  "id": 1,
  "code": "STU-2026-001",
  "title": "ระบบจองห้องปฏิบัติการ",
  "status": "in_progress",
  "members": [
    { "id": 1, "student_no": "66010001", "name": "กานต์ธีรา พูนผล", "role": "หัวหน้าทีม" }
  ],
  "progress_updates": [
    { "title": "ต้นแบบหน้าจอและ API", "percent_complete": 65, "created_by_name": "กานต์ธีรา พูนผล" }
  ]
}
```

## เพิ่มโครงงาน

`POST /api/projects` · Status `201 Created`

```json
{
  "code": "STU-2026-005",
  "title": "ระบบจัดการยืมคืนอุปกรณ์",
  "description": "จัดการรายการอุปกรณ์และคำขอยืมคืน",
  "status": "planning",
  "advisorId": 1,
  "startDate": "2026-10-01",
  "endDate": "2026-12-15"
}
```

Response เป็นข้อมูลโครงงานที่สร้างแล้ว รวม `id`, `advisor_name`, สมาชิก และความก้าวหน้า

## แก้ไขโครงงาน

`PUT /api/projects/1` · Status `200 OK`

ส่ง object รูปแบบเดียวกับ POST โดยต้องมี `code`, `title`, `advisorId`:

```json
{
  "code": "STU-2026-001",
  "title": "ระบบจองห้องปฏิบัติการ (ฉบับปรับปรุง)",
  "description": "เพิ่มการแจ้งเตือนสถานะคำขอ",
  "status": "in_progress",
  "advisorId": 1,
  "startDate": "2026-09-01",
  "endDate": "2026-12-15"
}
```

## ลบโครงงาน

`DELETE /api/projects/1` · Status `200 OK`

```json
{ "deleted": true, "id": 1 }
```

## เพิ่มความก้าวหน้า

`POST /api/projects/1/progress` · Status `201 Created`

```json
{
  "title": "ทดสอบ API CRUD",
  "detail": "ทดสอบ GET, POST, PUT และ DELETE ผ่านหน้าเว็บ",
  "percentComplete": 75,
  "createdBy": 1
}
```

## ข้อผิดพลาดจากข้อมูลไม่ถูกต้อง

`POST /api/projects` · Status `400 Bad Request`

```json
{
  "error": "code is required.",
  "field": "code"
}
```

รหัสโครงงานซ้ำตอบ `409 Conflict`; รหัสที่ไม่มีอยู่ตอบ `404 Not Found` และคำขอขนาดใหญ่เกิน 1 MB ตอบ `413 Payload Too Large`
