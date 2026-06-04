// Seed CommonNameOverride from confirmed canonical mappings (Appendix A of
// docs/superpowers/specs/2026-06-02-common-name-override-design.md).
//
// IMPORTANT: it does NOT hardcode raw strings (the spec's appendix has some
// truncated ones). Instead it fetches the live ERP common_name list, finds the
// actual raw value(s) per product by matching substance tokens, and upserts an
// override raw->canonical for any raw whose normalized form differs from the
// canonical. This guarantees rawKey matches what the app actually reads.
//
// Usage:
//   node scripts/seed-common-name-overrides.js           (dry: list matches, no write)
//   node scripts/seed-common-name-overrides.js --commit  (upsert into DB)
'use strict';

const mongoose = require('mongoose');
const CommonNameOverride = require('../models/CommonNameOverride');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/LIS-DB';
const MASTER_URL = 'https://n8n-plant.icpladda.com/webhook/API/Item-production';
const COMMON_KEYS = ['common_name', 'commonname', 'commonName', 'item_name2', 'itemType'];
const COMMIT = process.argv.includes('--commit');

// must mirror normalizeKey in routes/commonNameOverrides.js & src/lib/commonNameOverride.ts
function normalizeKey(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function pick(item, keys) {
  for (const k of keys) {
    const v = item && item[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

// hasAll: common_name contains every token (case-insensitive)
function hasAll(cn, tokens) {
  const u = cn.toUpperCase();
  return tokens.every((t) => u.includes(t.toUpperCase()));
}

// CONFIRMED canonicals: positional %-pairing, substance order kept as written
// (user 2026-06-04 — no reordering; all variants still dedup to one canonical).
// `tokens` are the substance base-names used to locate the real ERP raw(s).
const TARGETS = [
  { tokens: ['BIFENTHRIN', 'IMIDACLOPRID'], canonical: 'BIFENTHRIN 5% + IMIDACLOPRID 25% W/V SC' },
  { tokens: ['DIFENOCONAZOLE', 'AZOXYSTROBIN'], canonical: 'DIFENOCONAZOLE 12.5% + AZOXYSTROBIN 20% W/V SC' },
  { tokens: ['DIFENOCONAZOLE', 'PROPICONAZOLE'], canonical: 'DIFENOCONAZOLE 15% + PROPICONAZOLE 15% W/V EC' },
  { tokens: ['DIURON', 'HEXAZINONE'], canonical: 'DIURON 46.8% + HEXAZINONE 13.2% WG' },
  { tokens: ['TRIFLOXYSTROBIN', 'TEBUCONAZOLE'], canonical: 'TRIFLOXYSTROBIN 25% + TEBUCONAZOLE 50% WG' },
  { tokens: ['CYMOXANIL', 'MANCOZEB'], canonical: 'CYMOXANIL 8% + MANCOZEB 64% WP' },
  { tokens: ['MESOTRIONE', 'ATRAZINE'], canonical: 'MESOTRIONE 8% + ATRAZINE 80.8% WG' },
  { tokens: ['QUINCLORAC', 'BENSULFURON'], canonical: 'QUINCLORAC 34% + BENSULFURON-METHYL 2% WP' },
  { tokens: ['TRICYCLAZOLE', 'MANCOZEB'], canonical: 'TRICYCLAZOLE 18% + MANCOZEB 62% WP' },
  { tokens: ['THIAMETHOXAM', 'LAMBDA-CYHALOTHRIN'], canonical: 'THIAMETHOXAM 14.1% + LAMBDA-CYHALOTHRIN 10.6% ZC' },
  // user 2026-06-04: PICLORAM = 11.6%, string จบที่ % ไม่มี unit code ต่อท้าย
  { tokens: ['2,4-D', 'PICLORAM'], canonical: '2,4-D-TRIISOPROPANOLAMINE SALT 45.2% + PICLORAM 11.6%' },
];

const PENDING = [];

(async () => {
  console.log('connecting:', MONGODB_URI);
  await mongoose.connect(MONGODB_URI);
  console.log('connected. mode:', COMMIT ? 'COMMIT (will write)' : 'DRY (no write)');

  const items = await fetch(MASTER_URL).then((r) => r.json());
  console.log('master items fetched:', items.length);

  // distinct common_names
  const cnSet = new Set();
  for (const it of items) {
    const cn = pick(it, COMMON_KEYS);
    if (cn) cnSet.add(cn);
  }
  const commonNames = [...cnSet];
  console.log('distinct common_names:', commonNames.length);

  const ops = [];
  console.log('\n=== CONFIRMED TARGETS ===');
  for (const t of TARGETS) {
    const matches = commonNames.filter((cn) => hasAll(cn, t.tokens) && cn.includes('+'));
    const canonKey = normalizeKey(t.canonical);
    console.log(`\n[${t.tokens.join(' + ')}] -> ${t.canonical}`);
    if (!matches.length) { console.log('  (no ERP common_name matched — check tokens)'); continue; }
    for (const raw of matches) {
      const same = normalizeKey(raw) === canonKey;
      console.log(`  raw: "${raw}"${same ? '  [already canonical, skip]' : '  -> override'}`);
      if (!same) {
        ops.push({
          updateOne: {
            filter: { rawKey: normalizeKey(raw) },
            update: { $set: { raw, canonical: t.canonical, note: 'seed Appendix A 2026-06-04' } },
            upsert: true,
          },
        });
      }
    }
  }

  console.log('\n=== PENDING (not written) ===');
  for (const p of PENDING) {
    const matches = commonNames.filter((cn) => hasAll(cn, p.tokens));
    console.log(`\n[${p.tokens.join(' + ')}] ${p.note}`);
    matches.forEach((raw) => console.log(`  raw: "${raw}"`));
  }

  console.log('\n=== PLAN ===');
  console.log('overrides to upsert:', ops.length);

  if (!COMMIT) {
    console.log('\nDRY RUN — pass --commit to write.');
    await mongoose.disconnect();
    return;
  }

  const res = await CommonNameOverride.bulkWrite(ops, { ordered: false });
  console.log('\n=== WRITE RESULT ===');
  console.log('upserted:', (res.upsertedIds && Object.keys(res.upsertedIds).length) || 0,
    ' modified:', res.modifiedCount || 0, ' matched:', res.matchedCount || 0);
  console.log('total overrides now:', await CommonNameOverride.countDocuments());
  await mongoose.disconnect();
  console.log('done.');
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
