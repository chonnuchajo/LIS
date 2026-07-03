const mongoose = require('mongoose');

// A LINE chat (group / room / 1:1) that receives LIS notifications, tagged by the
// "audience" it represents. Notification routing (server/lib/lineNotify.js) resolves
// each petition event to one or more audiences, then pushes to every enabled group
// bound to those audiences (plus any 'all' group).
//
// audience:
//   qc          → กลุ่มงาน QC (รับตัวอย่าง / ตรวจ QC / อนุมัติ)
//   lab         → กลุ่มงาน Lab (วิเคราะห์ / อนุมัติ Lab)
//   production  → แผนกผลิต (ผู้ยื่นคำขอ)
//   rm          → แผนก RM (วัตถุดิบ)
//   fg          → แผนก FG (สินค้าสำเร็จรูป)
//   all         → รับทุกเหตุการณ์ (กลุ่มรวม/แอดมิน)
const AUDIENCES = ['qc', 'lab', 'production', 'rm', 'fg', 'all'];

const LineGroupSchema = new mongoose.Schema(
  {
    // LINE source id — groupId (Cxxxx), roomId (Rxxxx), หรือ userId (Uxxxx)
    groupId: { type: String, required: true, unique: true, index: true },
    audience: { type: String, enum: AUDIENCES, required: true, index: true },
    name: String, // ชื่อกลุ่มที่ผู้ดูแลตั้งไว้ (แสดงในหน้า admin)
    enabled: { type: Boolean, default: true },
    boundBy: String, // ผู้ผูกกลุ่ม (ชื่อ LINE ที่พิมพ์คำสั่ง หรือ 'admin')
  },
  { timestamps: true },
);

module.exports = mongoose.model('LineGroup', LineGroupSchema);
module.exports.AUDIENCES = AUDIENCES;
