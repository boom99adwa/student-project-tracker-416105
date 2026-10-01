# แผนทดสอบ API

| # | Test Case | Method / Endpoint | Expected | สิ่งที่ตรวจ |
|---:|---|---|---:|---|
| 1 | แสดงโครงงานทั้งหมด | `GET /api/projects` | 200 | มี `items` เป็น array และมี `count` |
| 2 | เพิ่มข้อมูลโครงงาน | `POST /api/projects` | 201 | ได้ `id` และรหัสตรงกับข้อมูลที่ส่ง |
| 3 | แสดงโครงงานรายรายการ | `GET /api/projects/{id}` | 200 | ได้โครงงานที่เพิ่งเพิ่ม |
| 4 | แก้ไขโครงงาน | `PUT /api/projects/{id}` | 200 | ชื่อและสถานะเปลี่ยนตามคำขอ |
| 5 | ลบโครงงาน | `DELETE /api/projects/{id}` | 200 | ได้ `deleted: true` และข้อมูลถูกลบ |
| 6 | ปฏิเสธข้อมูลบังคับที่หายไป | `POST /api/projects` | 400 | แจ้ง field ที่ต้องระบุ |
| 7 | ปฏิเสธรหัสโครงงานซ้ำ | `POST /api/projects` | 409 | แจ้ง field `code` |
| 8 | ตรวจสถานะฐานข้อมูล | `GET /api/health` | 200 | `database` เป็น `connected` |
| 9 | ดูรายการอาจารย์ | `GET /api/advisors` | 200 | ได้รายการอาจารย์ตัวอย่าง |
| 10 | ดูรายชื่อนักศึกษา | `GET /api/students` | 200 | ได้รายการนักศึกษาตัวอย่าง |
| 11 | อ่านสมาชิกของโครงงานใหม่ | `GET /api/projects/{id}/members` | 200 | ได้ array ว่างก่อนเพิ่มสมาชิก |
| 12 | เพิ่มความก้าวหน้า | `POST /api/projects/{id}/progress` | 201 | ได้บันทึกใหม่พร้อม `project_id` |
| 13 | อ่านประวัติความก้าวหน้า | `GET /api/projects/{id}/progress` | 200 | ได้บันทึกที่เพิ่งเพิ่ม |
| 14 | อ่านสมาชิกของโครงงานตัวอย่าง | `GET /api/projects/1/members` | 200 | มีรายการสมาชิก |
| 15 | อ่านประวัติโครงงานตัวอย่าง | `GET /api/projects/1/progress` | 200 | มีรายการความก้าวหน้า |

รันชุดทดสอบด้วย `npm run test:api` ขณะเซิร์ฟเวอร์ทำงาน สคริปต์ส่งคำขอจริงไปยัง API และบันทึกเวลาทดสอบ, status code, expected result และ actual result ไว้ใน `evidence/api-test-results.json` โครงงานทดสอบและบันทึกความก้าวหน้าชั่วคราวจะถูกลบเป็นชุดเดียวกันในขั้นตอน cleanup
