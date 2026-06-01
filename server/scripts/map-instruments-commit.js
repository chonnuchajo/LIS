// Commit: map GC/HPLC instruments onto the simple-methods collection from the
// two method ODS files. Backs up the existing collection first, then upserts.
//
// Usage:
//   node scripts/map-instruments-commit.js          (dry summary, no write)
//   node scripts/map-instruments-commit.js --commit (writes to DB)
'use strict';

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const SimpleMethod = require('../models/SimpleMethod');
const { mapItem } = require('./map-instruments-lib');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/LIS-DB';
const MASTER_URL = 'https://n8n-plant.icpladda.com/webhook/API/Item-production';
const COMMON_KEYS = ['common_name', 'commonname', 'commonName', 'item_name2', 'itemType'];
const NO_KEYS = ['item_no', 'itemNo', 'item_code', 'code', 'Code', 'ITEM_CODE'];
const COMMIT = process.argv.includes('--commit');

function pick(item, keys) {
  for (const k of keys) {
    const v = item && item[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

(async () => {
  console.log('connecting:', MONGODB_URI);
  await mongoose.connect(MONGODB_URI);
  console.log('connected. mode:', COMMIT ? 'COMMIT (will write)' : 'DRY (no write)');

  // 1. backup existing collection
  const existing = await SimpleMethod.find().lean();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(__dirname, `backup-simplemethods-${stamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(existing, null, 2));
  console.log(`backed up ${existing.length} existing simple-method docs -> ${backupPath}`);

  // 2. fetch masters & compute
  const items = await fetch(MASTER_URL).then((r) => r.json());
  console.log('master items fetched:', items.length);

  const ops = [];
  let gcSlots = 0, hplcSlots = 0, bothSlots = 0, blankSlots = 0, skipped = 0;
  const writtenItemNos = [];
  for (const it of items) {
    const itemNo = pick(it, NO_KEYS);
    const cn = pick(it, COMMON_KEYS);
    if (!itemNo || !cn) { skipped++; continue; }
    const { instruments } = mapItem(cn);
    const filled = instruments.filter((x) => x === 'GC' || x === 'HPLC' || x === 'BOTH').length;
    if (filled === 0) { skipped++; continue; } // no method -> leave for manual
    instruments.forEach((x) => {
      if (x === 'GC') gcSlots++;
      else if (x === 'HPLC') hplcSlots++;
      else if (x === 'BOTH') bothSlots++;
      else blankSlots++;
    });
    writtenItemNos.push(itemNo);
    ops.push({
      updateOne: {
        filter: { itemNo },
        update: { $set: { instruments } },
        upsert: true,
      },
    });
  }

  console.log('\n=== PLAN ===');
  console.log('itemNos to upsert :', ops.length);
  console.log('skipped (no method/no key):', skipped);
  console.log('instrument slots  : GC=' + gcSlots + ' HPLC=' + hplcSlots + ' BOTH=' + bothSlots + ' blank=' + blankSlots);

  if (!COMMIT) {
    console.log('\nDRY RUN — pass --commit to write. (backup already saved)');
    await mongoose.disconnect();
    return;
  }

  // 3. write in chunks
  let matched = 0, upserted = 0, modified = 0;
  const CHUNK = 500;
  for (let i = 0; i < ops.length; i += CHUNK) {
    const res = await SimpleMethod.bulkWrite(ops.slice(i, i + CHUNK), { ordered: false });
    matched += res.matchedCount || 0;
    upserted += (res.upsertedIds && Object.keys(res.upsertedIds).length) || 0;
    modified += res.modifiedCount || 0;
  }
  const after = await SimpleMethod.countDocuments();
  console.log('\n=== WRITE RESULT ===');
  console.log('matched :', matched, ' upserted :', upserted, ' modified :', modified);
  console.log('total simple-method docs now:', after);
  await mongoose.disconnect();
  console.log('done.');
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
