// server/scripts/migrate-stockunits-source-to-type.js
// Backfill StockUnit.type ให้ถูกต้อง:
// - kind='working' -> type='working'
// - source='primary' -> type='primary'
// - source='supply' -> type='supplier'
// - ขวด sealed จาก migration เก่าที่ source ว่าง -> แยก primary/supplier
//   ตามลำดับสร้างเดิม เทียบกับ primary.qty ใน StockStandard
// - ขวด sealed อื่น ๆ ที่ยังไม่มี source -> default เป็น primary
//
// Dry-run by default; pass --commit to write.
require('dotenv').config();
const mongoose = require('mongoose');
const StockUnit = require('../models/StockUnit');
const { StockStandard } = require('../models/Stock');

const COMMIT = process.argv.includes('--commit');
const SRC_TO_TYPE = { primary: 'primary', supply: 'supplier' };

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isBlank(v) {
  return v === '' || v === null || v === undefined;
}

function createdByMigration(unit) {
  return unit?.createdBy?.email === 'migration';
}

function sortByLegacyOrder(a, b) {
  return String(a._id).localeCompare(String(b._id));
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/LIS-DB');

  const [units, stds] = await Promise.all([
    StockUnit.find({ $or: [{ type: { $in: ['', null] } }, { type: { $exists: false } }] }).sort({ _id: 1 }),
    StockStandard.find().lean(),
  ]);

  const primaryQtyByCode = new Map(
    stds.map((s) => [String(s.code), Math.max(0, Math.floor(num(s.primary?.qty)))])
  );

  const byCode = new Map();
  for (const unit of units) {
    const code = String(unit.itemCode || '');
    if (!byCode.has(code)) byCode.set(code, []);
    byCode.get(code).push(unit);
  }

  let planned = 0;
  let inferredPrimary = 0;
  let inferredSupplier = 0;
  let inferredWorking = 0;
  const warns = [];

  for (const [code, group] of byCode.entries()) {
    const primaryQty = primaryQtyByCode.get(code) ?? 0;
    const legacySealed = group
      .filter((u) => u.kind === 'sealed' && isBlank(u.source) && createdByMigration(u))
      .sort(sortByLegacyOrder);

    const legacyTypeById = new Map();
    legacySealed.forEach((u, index) => {
      legacyTypeById.set(String(u._id), index < primaryQty ? 'primary' : 'supplier');
    });

    for (const u of group) {
      let type = '';

      if (u.kind === 'working') {
        type = 'working';
        inferredWorking++;
      } else if (SRC_TO_TYPE[u.source]) {
        type = SRC_TO_TYPE[u.source];
        if (type === 'primary') inferredPrimary++;
        if (type === 'supplier') inferredSupplier++;
      } else if (legacyTypeById.has(String(u._id))) {
        type = legacyTypeById.get(String(u._id));
        if (type === 'primary') inferredPrimary++;
        if (type === 'supplier') inferredSupplier++;
      } else {
        type = 'primary';
        inferredPrimary++;
        warns.push(`${u.qrId} (${u.itemCode}) sealed source='${u.source || ''}' -> primary [default]`);
      }

      planned++;
      if (COMMIT) {
        u.type = type;
        await u.save();
      }
    }
  }

  console.log(`${COMMIT ? 'COMMITTED' : 'DRY-RUN'}: ${planned} units -> type`);
  console.log(`  primary: ${inferredPrimary}`);
  console.log(`  supplier: ${inferredSupplier}`);
  console.log(`  working: ${inferredWorking}`);
  if (warns.length) {
    console.log(`WARN (${warns.length}) ต้องตรวจสอบ:`);
    warns.forEach((w) => console.log('  - ' + w));
  }
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
