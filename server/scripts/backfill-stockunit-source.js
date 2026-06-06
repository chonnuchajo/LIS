// เติม source (primary/supply) ให้ขวด sealed ที่ migrate มาก่อนมีฟิลด์ source
// (createdBy.email='migration', source ว่าง) แบบ in-place ตามลำดับ insertion เดิม:
// migration loop สร้าง primary ก่อน แล้ว supplier → เรียงตาม _id แล้วตัวแรก
// primary.qty ใบ = 'primary', ที่เหลือ = 'supply'. ขวด working migration ปล่อยว่าง.
//
// Idempotent: แตะเฉพาะขวด createdBy.email='migration' & kind='sealed' & source ว่าง.
//
// Usage:
//   node scripts/backfill-stockunit-source.js          # dry-run
//   node scripts/backfill-stockunit-source.js --commit  # เขียนจริง
'use strict';

const mongoose = require('mongoose');
const { StockStandard } = require('../models/Stock');
const StockUnit = require('../models/StockUnit');
const { assignSealedSources } = require('../lib/stockSource');

const COMMIT = process.argv.includes('--commit');
const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/LIS-DB';

async function main() {
  await mongoose.connect(URI);
  const stds = await StockStandard.find().lean();

  let stdsTouched = 0;
  let bottlesPrimary = 0;
  let bottlesSupply = 0;

  for (const std of stds) {
    // ขวด sealed จาก migration ที่ source ยังว่าง เรียงตามลำดับสร้าง (primary→supplier)
    const sealed = await StockUnit.find({
      itemCode: std.code,
      kind: 'sealed',
      'createdBy.email': 'migration',
      $or: [{ source: '' }, { source: { $exists: false } }],
    }).sort({ _id: 1 });

    if (sealed.length === 0) continue;

    const sources = assignSealedSources(sealed.length, std.primary && std.primary.qty);
    stdsTouched += 1;
    const p = sources.filter((s) => s === 'primary').length;
    bottlesPrimary += p;
    bottlesSupply += sources.length - p;
    console.log(`  ${std.code} ${std.name} → primary ${p}, supply ${sources.length - p}`);

    if (COMMIT) {
      for (let i = 0; i < sealed.length; i++) {
        sealed[i].source = sources[i];
        await sealed[i].save();
      }
    }
  }

  console.log(`\nสารที่แตะ: ${stdsTouched} | ขวด primary: ${bottlesPrimary} | ขวด supply: ${bottlesSupply}`);
  if (!COMMIT) {
    console.log('DRY-RUN — ยังไม่เขียน. รันซ้ำด้วย --commit เพื่อเขียนจริง');
  } else {
    console.log('เขียนเรียบร้อย. รัน `npm run seed:export` เพื่อ backup ลง git');
  }
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
