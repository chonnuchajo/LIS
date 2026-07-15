// Migrate access-control paths after the /petition rename:
//   /petitions          -> /petition            (main list moved to timeline)
//   /petition-timeline   -> /petition
//   /petition-timeline/* -> /petition/*
//   /petitions/*         -> /petitions-old/*     (classic pages, hidden)
// Targets Role.permissions[] (collection `roles`) and AccessGroup.paths[]
// (collection `accessgroups`). Idempotent — safe to re-run.
//
// Usage:
//   node scripts/rename-petition-paths.js          # dry-run (พิมพ์ diff อย่างเดียว)
//   node scripts/rename-petition-paths.js --commit  # เขียนจริง
'use strict';

const mongoose = require('mongoose');

const COMMIT = process.argv.includes('--commit');
const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/LIS-DB';

function renamePath(entry) {
  if (typeof entry !== 'string') return entry;
  if (entry === '/petitions') return '/petition';
  if (entry === '/petition-timeline') return '/petition';
  if (entry.startsWith('/petition-timeline/')) {
    return '/petition/' + entry.slice('/petition-timeline/'.length);
  }
  if (entry.startsWith('/petitions/')) {
    return '/petitions-old/' + entry.slice('/petitions/'.length);
  }
  return entry;
}

function renamePaths(arr) {
  const out = [];
  const seen = new Set();
  for (const entry of arr || []) {
    const renamed = renamePath(entry);
    if (!seen.has(renamed)) {
      seen.add(renamed);
      out.push(renamed);
    }
  }
  return out;
}

async function migrateCollection(colName, field) {
  const col = mongoose.connection.collection(colName);
  const docs = await col.find({}).toArray();
  let changed = 0;
  for (const doc of docs) {
    const before = doc[field] || [];
    const after = renamePaths(before);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      changed += 1;
      console.log(`  ${colName}/${doc.id || doc._id}:`);
      console.log(`    - ${JSON.stringify(before)}`);
      console.log(`    + ${JSON.stringify(after)}`);
      if (COMMIT) {
        await col.updateOne({ _id: doc._id }, { $set: { [field]: after } });
      }
    }
  }
  return changed;
}

async function main() {
  await mongoose.connect(URI);
  console.log(COMMIT ? 'COMMIT mode — เขียนจริง' : 'DRY-RUN — ยังไม่เขียน (ใส่ --commit เพื่อเขียนจริง)');
  const roles = await migrateCollection('roles', 'permissions');
  const groups = await migrateCollection('accessgroups', 'paths');
  console.log(`roles ที่ต้องแก้: ${roles}, accessgroups ที่ต้องแก้: ${groups}`);
  if (COMMIT) {
    console.log('เสร็จ. รัน `npm run seed:export` เพื่อ backup ลง git');
  }
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { renamePath, renamePaths };
