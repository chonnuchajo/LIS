// Drop collection `standardconfigs` — feature StandardConfig ถูกถอดออกทั้งชุดแล้ว
// (FE page/tests/lib, BE model/route, nav, api, seed json ลบหมด) collection จึงเป็น orphan
//
// ต้อง drop จริงเพื่อไม่ให้ `seed:export` (ดึงทุก collection แบบ dynamic ผ่าน listCollections)
// สร้างไฟล์ seed-data/standardconfigs.json + manifest entry กลับมาเองในรอบ auto-sync ถัดไป
//
// ใช้ native collection ตรงๆ (model ถูกลบไปแล้ว mongoose ผูก collection ไม่ได้)
// Backup ก่อน drop: dump ทุก doc ลง scripts/backup-standardconfigs-<ISO>.json กันเหนียว
//
// Usage:
//   node scripts/drop-standardconfigs.js           # dry-run (นับ + ไม่แตะอะไร)
//   node scripts/drop-standardconfigs.js --commit   # backup แล้ว drop จริง
'use strict';

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const COMMIT = process.argv.includes('--commit');
const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/LIS-DB';
const COLLECTION = 'standardconfigs';

async function main() {
  await mongoose.connect(URI);
  const db = mongoose.connection.db;

  const exists = (await db.listCollections({ name: COLLECTION }).toArray()).length > 0;
  if (!exists) {
    console.log(`collection '${COLLECTION}' ไม่มีอยู่แล้ว — ไม่ต้องทำอะไร`);
    await mongoose.disconnect();
    return;
  }

  const col = db.collection(COLLECTION);
  const docs = await col.find({}).toArray();
  console.log(`collection '${COLLECTION}': ${docs.length} docs`);

  if (!COMMIT) {
    console.log('DRY-RUN — ยังไม่ลบ. รันซ้ำด้วย --commit เพื่อ backup + drop จริง');
    await mongoose.disconnect();
    return;
  }

  // backup ก่อน drop
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(__dirname, `backup-standardconfigs-${stamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(docs, null, 2), 'utf8');
  console.log(`backup -> ${backupPath}`);

  await db.dropCollection(COLLECTION);
  console.log(`dropped collection '${COLLECTION}'`);
  console.log('ต่อไปรัน `npm run seed:export` เพื่อยืนยันว่า standardconfigs.json ไม่ถูกสร้างกลับมา');

  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
