/**
 * sync-to-remote.js
 * ------------------
 * One-way, NON-DESTRUCTIVE sync of a MongoDB database from this machine (SOURCE)
 * to another machine (TARGET).
 *
 *   - Creates any collection that is missing on the target (with the same indexes).
 *   - Inserts only the documents that the target does NOT already have (matched by _id).
 *   - NEVER overwrites or deletes existing data on the target.
 *
 * Run it on THIS machine; it pushes to the remote.
 *
 * Usage (PowerShell):
 *   node sync-to-remote.js --target "mongodb://192.168.1.50:27017/LIS-DB"
 *   node sync-to-remote.js --target "..." --dry-run
 *   node sync-to-remote.js --target "..." --only samples,petitions,users
 *
 * Or via env var:
 *   $env:TARGET_MONGODB_URI = "mongodb://192.168.1.50:27017/LIS-DB"; node sync-to-remote.js
 *
 * The SOURCE defaults to MONGODB_URI in .env (mongodb://localhost:27017/LIS-DB).
 * Override with --source "mongodb://..." if needed.
 *
 * NOTE: the remote mongod must accept network connections (bindIp set to the LAN
 * address, not just 127.0.0.1) and the firewall must allow port 27017.
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

// ---- parse CLI args ---------------------------------------------------------
function getArg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('--')) {
    return process.argv[idx + 1];
  }
  return undefined;
}
const hasFlag = (name) => process.argv.includes(`--${name}`);

const SOURCE_URI = getArg('source') || process.env.MONGODB_URI || 'mongodb://localhost:27017/LIS-DB';
const TARGET_URI = getArg('target') || process.env.TARGET_MONGODB_URI;
const DRY_RUN = hasFlag('dry-run');
const ONLY = (getArg('only') || '').split(',').map(s => s.trim()).filter(Boolean);
const BATCH_SIZE = 1000;

if (!TARGET_URI) {
  console.error('❌ Missing target. Pass --target "mongodb://<host>:27017/LIS-DB" or set TARGET_MONGODB_URI.');
  process.exit(1);
}
if (SOURCE_URI === TARGET_URI) {
  console.error('❌ Source and target are identical. Aborting.');
  process.exit(1);
}

// ---- helpers ----------------------------------------------------------------
function dbNameFromUri(uri) {
  // grab the path segment after host (before any query string)
  const m = uri.match(/\/([^/?]+)(\?|$)/);
  return m ? m[1] : null;
}

async function syncCollection(srcDb, dstDb, name, existingTargetNames) {
  const srcCol = srcDb.collection(name);
  const total = await srcCol.countDocuments();

  // 1. create the collection on target if missing (+ copy indexes)
  if (!existingTargetNames.has(name)) {
    if (DRY_RUN) {
      console.log(`  📦 [dry-run] would create collection "${name}"`);
    } else {
      await dstDb.createCollection(name);
      console.log(`  📦 created collection "${name}"`);
    }
  }
  const dstCol = dstDb.collection(name);

  // copy indexes (skip the default _id index)
  if (!DRY_RUN) {
    const idx = await srcCol.indexes();
    for (const ix of idx) {
      if (ix.name === '_id_') continue;
      const { key, name: ixName, v, ns, background, ...opts } = ix;
      try {
        await dstCol.createIndex(key, { name: ixName, ...opts });
      } catch (e) {
        console.warn(`     ⚠ index "${ixName}" on "${name}": ${e.message}`);
      }
    }
  }

  // 2. push only documents the target is missing (matched by _id)
  let scanned = 0;
  let inserted = 0;
  const cursor = srcCol.find({}, { batchSize: BATCH_SIZE });
  let batch = [];

  async function flush() {
    if (batch.length === 0) return;
    scanned += batch.length;
    if (DRY_RUN) {
      const ids = batch.map(d => d._id);
      const present = await dstCol
        .find({ _id: { $in: ids } }, { projection: { _id: 1 } })
        .toArray();
      inserted += batch.length - present.length;
    } else {
      // $setOnInsert => insert if absent, do NOTHING if the _id already exists
      const ops = batch.map(doc => ({
        updateOne: {
          filter: { _id: doc._id },
          update: { $setOnInsert: doc },
          upsert: true,
        },
      }));
      const res = await dstCol.bulkWrite(ops, { ordered: false });
      inserted += res.upsertedCount;
    }
    batch = [];
  }

  for await (const doc of cursor) {
    batch.push(doc);
    if (batch.length >= BATCH_SIZE) await flush();
  }
  await flush();

  const verb = DRY_RUN ? 'would insert' : 'inserted';
  console.log(`  ✅ ${name}: source=${total}, scanned=${scanned}, ${verb}=${inserted} (skipped existing=${scanned - inserted})`);
  return inserted;
}

// ---- main -------------------------------------------------------------------
(async () => {
  const srcName = dbNameFromUri(SOURCE_URI);
  const dstName = dbNameFromUri(TARGET_URI);
  if (!srcName || !dstName) {
    console.error('❌ Could not read the database name from a URI. Make sure both URIs end with "/<dbName>".');
    process.exit(1);
  }

  console.log('🔁 MongoDB one-way sync (non-destructive)');
  console.log(`   SOURCE: ${SOURCE_URI}`);
  console.log(`   TARGET: ${TARGET_URI}`);
  if (DRY_RUN) console.log('   MODE:   DRY RUN (no writes)');
  if (ONLY.length) console.log(`   ONLY:   ${ONLY.join(', ')}`);
  console.log('');

  const srcClient = new MongoClient(SOURCE_URI);
  const dstClient = new MongoClient(TARGET_URI, { serverSelectionTimeoutMS: 10000 });

  try {
    await srcClient.connect();
    await dstClient.connect();
    const srcDb = srcClient.db(srcName);
    const dstDb = dstClient.db(dstName);

    const srcCols = (await srcDb.listCollections({ type: 'collection' }).toArray())
      .map(c => c.name)
      .filter(n => !n.startsWith('system.'))
      .filter(n => ONLY.length === 0 || ONLY.includes(n));

    const existingTargetNames = new Set(
      (await dstDb.listCollections({ type: 'collection' }).toArray()).map(c => c.name)
    );

    if (srcCols.length === 0) {
      console.log('Nothing to sync (no matching collections in source).');
      return;
    }

    console.log(`Found ${srcCols.length} collection(s) to sync:\n`);
    let grandTotal = 0;
    for (const name of srcCols) {
      grandTotal += await syncCollection(srcDb, dstDb, name, existingTargetNames);
    }

    console.log('');
    console.log(`🎉 Done. ${DRY_RUN ? 'Would insert' : 'Inserted'} ${grandTotal} new document(s) total.`);
  } catch (err) {
    console.error('❌ Sync failed:', err.message);
    process.exitCode = 1;
  } finally {
    await srcClient.close().catch(() => {});
    await dstClient.close().catch(() => {});
  }
})();
