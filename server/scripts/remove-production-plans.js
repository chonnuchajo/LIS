// ลบฟิลด์ฝัง `productionPlans` ออกจาก petition ทุกใบ — ฟอร์ม "ใบวางแผน-ควบคุมการผลิต"
// เลิกใช้แล้วและถอดออกจาก schema/โค้ดแล้ว ข้อมูลเก่าที่ฝังไว้จึงเป็น orphan
//
// ใช้ native collection (ฟิลด์ไม่อยู่ใน schema แล้ว mongoose จะ strip ตอนอ่าน/เขียน
// ผ่าน model จึง $unset ผ่าน collection ตรงๆ). Idempotent — แตะเฉพาะใบที่ยังมีฟิลด์นี้
// รวม soft-deleted ด้วย (ไม่กรอง deletedAt) เพราะเป็นการล้าง orphan ล้วน
//
// Usage:
//   node scripts/remove-production-plans.js          # dry-run (นับอย่างเดียว)
//   node scripts/remove-production-plans.js --commit  # เขียนจริง
'use strict';

const mongoose = require('mongoose');
require('../models/Petition'); // โหลด model เพื่อให้ collection ผูกกับ connection

const COMMIT = process.argv.includes('--commit');
const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/LIS-DB';

async function main() {
  await mongoose.connect(URI);
  const col = mongoose.connection.collection('petitions');

  const filter = { productionPlans: { $exists: true } };
  const affected = await col.countDocuments(filter);
  console.log(`petition ที่ยังมีฟิลด์ productionPlans: ${affected}`);

  if (!COMMIT) {
    console.log('DRY-RUN — ยังไม่เขียน. รันซ้ำด้วย --commit เพื่อ $unset จริง');
  } else {
    const res = await col.updateMany(filter, { $unset: { productionPlans: '' } });
    console.log(`$unset เรียบร้อย: matched ${res.matchedCount}, modified ${res.modifiedCount}`);
    console.log('รัน `npm run seed:export` เพื่อ backup ลง git');
  }
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
