// Usage:
//   node scripts/migrate-simplemethod-to-methods.js          # dry-run (no writes)
//   node scripts/migrate-simplemethod-to-methods.js --commit # apply
'use strict';

const mongoose = require('mongoose');
const SimpleMethod = require('../models/SimpleMethod');

const COMMIT = process.argv.includes('--commit');
const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/LIS-DB';

// instruments[i] (string) → methods[i] (string[]): GC/HPLC→[x], ""→[], BOTH→[] (drop either-or).
function toMethods(instruments) {
  return (instruments || []).map((v) => {
    const t = String(v || '').trim().toUpperCase();
    return t && t !== 'BOTH' ? [t] : [];
  });
}

async function main() {
  await mongoose.connect(URI);
  const docs = await SimpleMethod.find().lean();
  let changed = 0;
  let bothCleared = 0;
  const ops = [];
  for (const doc of docs) {
    if (Array.isArray(doc.methods)) continue; // already migrated
    const bothCount = (doc.instruments || []).filter((v) => String(v).toUpperCase() === 'BOTH').length;
    bothCleared += bothCount;
    const methods = toMethods(doc.instruments);
    changed += 1;
    if (bothCount > 0) console.log(`  BOTH cleared: ${doc.itemNo} (${bothCount} slot)`);
    ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: { methods } } } });
  }
  console.log(`\nDocs to migrate: ${changed}, BOTH slots cleared: ${bothCleared}`);
  if (!COMMIT) {
    console.log('DRY-RUN — no writes. Re-run with --commit to apply.');
  } else if (ops.length) {
    const res = await SimpleMethod.bulkWrite(ops);
    console.log(`Committed. modified=${res.modifiedCount}`);
  }
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
