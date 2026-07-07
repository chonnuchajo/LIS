// server/scripts/migrate-stockunits-source-to-type.js
// Map StockUnit.source (primary/supply) → StockUnit.type (primary/supplier/working).
// Dry-run by default; pass --commit to write. Idempotent (skips units already typed).
require('dotenv').config();
const mongoose = require('mongoose');
const StockUnit = require('../models/StockUnit');

const COMMIT = process.argv.includes('--commit');
const SRC_TO_TYPE = { primary: 'primary', supply: 'supplier' };

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/LIS-DB');
  const units = await StockUnit.find({ $or: [{ type: { $in: ['', null] } }, { type: { $exists: false } }] });
  let planned = 0;
  const warns = [];
  for (const u of units) {
    let type = SRC_TO_TYPE[u.source];
    if (!type) { type = 'primary'; warns.push(`${u.qrId} (${u.itemCode}) source='${u.source||''}' kind='${u.kind||''}' → primary [ตรวจสอบ]`); }
    planned++;
    if (COMMIT) { u.type = type; await u.save(); }
  }
  console.log(`${COMMIT ? 'COMMITTED' : 'DRY-RUN'}: ${planned} units → type`);
  if (warns.length) { console.log(`WARN (${warns.length}) ต้องยืนยันประเภท:`); warns.forEach((w) => console.log('  - ' + w)); }
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
