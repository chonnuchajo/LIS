// ปิดยอด "การเบิก standard ที่ค้างไม่ปิด" ซึ่งเกิดก่อนเปิดแท็บ "กำลังใช้งานอยู่"
// ถ้าไม่ปิด รายการเก่าเหล่านี้จะโผล่ในแท็บเป็นสีแดงทั้งหมด และกระดิ่งจะเด้งรัวในรอบแรก
// idempotent — แตะเฉพาะรายการที่ยังไม่มี deductionResolution และเก่ากว่าวันที่กำหนด
//
// Usage:
//   node scripts/close-stale-standard-deductions.js                       # dry-run (นับอย่างเดียว)
//   node scripts/close-stale-standard-deductions.js --before=2026-08-03   # กำหนดวันตัด (ดีฟอลต์ = วันนี้)
//   node scripts/close-stale-standard-deductions.js --commit              # เขียนจริง
//
// ⚠️ ดีฟอลต์ของ --before คือ "ตอนนี้" — ถ้ารัน --commit เปล่าๆ (ไม่ระบุ --before) จะปิดแม้แต่
// รายการที่เพิ่งเบิกไปเมื่อกี้นี้ด้วย ในทางปฏิบัติควรระบุ --before=YYYY-MM-DD เจาะจงวันเปิดใช้ฟีเจอร์เสมอ
//
// Note: This script loads server/.env automatically. MONGODB_URI in the environment overrides it.
'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
require('../models/StockTransaction');

const COMMIT = process.argv.includes('--commit');
const beforeArg = (process.argv.find((a) => a.startsWith('--before=')) || '').split('=')[1];
const BEFORE = beforeArg ? new Date(beforeArg) : new Date();
const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/LIS-DB';

async function main() {
  if (Number.isNaN(BEFORE.getTime())) {
    console.error('--before ไม่ใช่วันที่ที่ถูกต้อง (ใช้รูปแบบ YYYY-MM-DD)');
    process.exit(1);
  }
  await mongoose.connect(URI);
  console.log(`ต่อ database: ${mongoose.connection.host}/${mongoose.connection.name}`);

  const col = mongoose.connection.collection('stocktransactions');

  const filter = {
    action: 'deduct',
    itemType: 'standard',
    'deductionResolution.reason': { $exists: false },
    createdAt: { $lt: BEFORE },
  };
  const affected = await col.countDocuments(filter);
  console.log(`การเบิก standard ที่ค้างและเก่ากว่า ${BEFORE.toISOString()}: ${affected}`);

  if (!COMMIT) {
    console.log('DRY-RUN — ยังไม่เขียน. รันซ้ำด้วย --commit เพื่อปิดยอดจริง');
  } else {
    const res = await col.updateMany(filter, {
      $set: {
        deductionResolution: {
          reason: 'other',
          note: 'ปิดยอดค้างก่อนเปิดแท็บกำลังใช้งาน',
          resolvedAt: new Date(),
          resolvedBy: { email: '', name: 'system' },
        },
      },
    });
    console.log(`ปิดยอดเรียบร้อย: matched ${res.matchedCount}, modified ${res.modifiedCount}`);
    console.log('รัน `npm run seed:export` เพื่อ backup ลง git');
  }
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
