/**
 * import-data.js  (the "seed" script)
 * -----------------------------------
 * Rebuild the database on THIS machine from the JSON files in server/seed-data/.
 * Run this after pulling the repo on a fresh machine and it will have the same
 * data as the machine that ran `npm run seed:export`.
 *
 *   - Creates any collection that is missing (with the same indexes).
 *   - Inserts only the documents that are missing (matched by _id).
 *   - NEVER overwrites or deletes existing data — safe to re-run.
 *
 * Usage (PowerShell):
 *   cd C:\Project\LIS\server
 *   npm run seed:import
 *   npm run seed:import -- --only samples,petitions
 *   npm run seed:import -- --target "mongodb://localhost:27017/LIS-DB"
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const { EJSON } = require('bson');

function getArg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('--')) {
    return process.argv[idx + 1];
  }
  return undefined;
}

const TARGET_URI = getArg('target') || process.env.MONGODB_URI || 'mongodb://localhost:27017/LIS-DB';
const ONLY = (getArg('only') || '').split(',').map(s => s.trim()).filter(Boolean);
const IN_DIR = path.join(__dirname, 'seed-data');
const BATCH_SIZE = 1000;

function dbNameFromUri(uri) {
  const m = uri.match(/\/([^/?]+)(\?|$)/);
  return m ? m[1] : null;
}

(async () => {
  const dbName = dbNameFromUri(TARGET_URI);
  if (!dbName) {
    console.error('❌ Could not read the database name from the target URI.');
    process.exit(1);
  }
  if (!fs.existsSync(IN_DIR)) {
    console.error(`❌ No seed-data folder at ${IN_DIR}. Run "npm run seed:export" on the source machine first.`);
    process.exit(1);
  }

  let files = fs.readdirSync(IN_DIR)
    .filter(f => f.endsWith('.json') && f !== '_manifest.json');
  if (ONLY.length) {
    files = files.filter(f => ONLY.includes(path.basename(f, '.json')));
  }

  console.log('📥 Importing seed data into MongoDB (non-destructive)');
  console.log(`   TARGET: ${TARGET_URI}`);
  console.log(`   IN:     ${IN_DIR}`);
  if (ONLY.length) console.log(`   ONLY:   ${ONLY.join(', ')}`);
  console.log('');

  if (files.length === 0) {
    console.log('Nothing to import (no matching JSON files).');
    return;
  }

  const client = new MongoClient(TARGET_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
    const db = client.db(dbName);

    const existing = new Set(
      (await db.listCollections({ type: 'collection' }).toArray()).map(c => c.name)
    );

    let grandTotal = 0;
    for (const file of files) {
      const raw = fs.readFileSync(path.join(IN_DIR, file), 'utf8');
      const payload = EJSON.parse(raw, { relaxed: false });
      const name = payload.collection || path.basename(file, '.json');
      const docs = payload.documents || [];

      // Only seed collections that are missing or empty. A collection that
      // already holds data is left untouched — re-importing into it caused
      // duplicates (seed docs carry fixed _ids that don't match the _ids the
      // app generated locally, so by-_id upserts insert a second copy).
      // Gate on doc count, not mere existence: server boot auto-creates every
      // collection empty, so an existence check alone would skip everything.
      const col = db.collection(name);
      if (existing.has(name)) {
        const have = await col.countDocuments();
        if (have > 0) {
          console.log(`  ⏭ ${name}: already has ${have} doc(s) — skipped`);
          continue;
        }
      }

      // create collection + indexes if missing
      if (!existing.has(name)) {
        await db.createCollection(name);
        console.log(`  📦 created collection "${name}"`);
      }
      for (const ix of payload.indexes || []) {
        const { key, name: ixName, v, ns, background, ...opts } = ix;
        try {
          await col.createIndex(key, { name: ixName, ...opts });
        } catch (e) {
          console.warn(`     ⚠ index "${ixName}" on "${name}": ${e.message}`);
        }
      }

      // insert only missing docs (by _id); $setOnInsert => never overwrite
      let inserted = 0;
      let dupSkipped = 0;
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = docs.slice(i, i + BATCH_SIZE);
        if (batch.length === 0) continue;
        const ops = batch.map(doc => ({
          updateOne: {
            filter: { _id: doc._id },
            update: { $setOnInsert: doc },
            upsert: true,
          },
        }));
        try {
          const res = await col.bulkWrite(ops, { ordered: false });
          inserted += res.upsertedCount;
        } catch (e) {
          // A doc whose _id is missing here but whose business key already exists
          // (e.g. seeded with a different _id on another machine) trips a unique
          // index. With ordered:false the non-conflicting ops still apply — treat
          // E11000 as "already exists, skip" instead of failing the whole import.
          const dupErrors = (e.writeErrors || []).filter(we => we.code === 11000);
          if (e.code === 11000 || (dupErrors.length && dupErrors.length === (e.writeErrors || []).length)) {
            inserted += e.result?.upsertedCount ?? e.result?.nUpserted ?? 0;
            dupSkipped += dupErrors.length || 1;
          } else {
            throw e;
          }
        }
      }
      grandTotal += inserted;
      const dupNote = dupSkipped ? `, dup-key skipped=${dupSkipped}` : '';
      console.log(`  ✅ ${name}: file=${docs.length}, inserted=${inserted} (skipped existing=${docs.length - inserted - dupSkipped}${dupNote})`);
    }

    console.log('');
    console.log(`🎉 Done. Inserted ${grandTotal} new document(s) total.`);
  } catch (err) {
    console.error('❌ Import failed:', err.message);
    process.exitCode = 1;
  } finally {
    await client.close().catch(() => {});
  }
})();
