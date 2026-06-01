/**
 * Import Stock Control Excel into MongoDB.
 *
 * Usage:
 *   node scripts/import-stock.mjs                  # default file in repo root
 *   node scripts/import-stock.mjs <path-to-xlsx>
 *
 * Optional flags:
 *   --reset    Drop existing stock collections before importing
 *   --dry      Parse only, do not write to Mongo
 *
 * Reads MONGODB_URI from server/.env (falls back to mongodb://localhost:27017/LIS-DB).
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const serverDir = path.join(repoRoot, 'server');
const require = createRequire(path.join(serverDir, 'index.js'));

// Load env from server/.env if present
const envPath = path.join(serverDir, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}

const XLSX = require('xlsx');
const mongoose = require('mongoose');

// Resolve models from server (so we get the same schemas the API uses)
const stockModelsPath = pathToFileURL(path.join(serverDir, 'models', 'Stock.js')).href;
const txModelPath = pathToFileURL(path.join(serverDir, 'models', 'StockTransaction.js')).href;
const { StockStandard, StockSolvent, StockGlassware } = require(path.join(serverDir, 'models', 'Stock.js'));
const StockTransaction = require(path.join(serverDir, 'models', 'StockTransaction.js'));

const args = process.argv.slice(2);
const flags = new Set(args.filter(a => a.startsWith('--')));
const positional = args.filter(a => !a.startsWith('--'));

const xlsxFile = positional[0]
  ? path.resolve(positional[0])
  : path.join(repoRoot, 'Stock Control ที่ใช้ในห้องปฏิบัติการเคมีวิเคราะห์.xlsx');

if (!fs.existsSync(xlsxFile)) {
  console.error('❌ Excel file not found:', xlsxFile);
  process.exit(1);
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/LIS-DB';

/* ---------- helpers ---------- */

const isBlank = v => v === null || v === undefined || v === '' || v === '-';
const toNum = v => {
  if (isBlank(v)) return 0;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/[^\d.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const toStr = v => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    const d = v;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }
  return String(v).trim();
};
const toMixed = v => (isBlank(v) ? null : v instanceof Date ? toStr(v) : v);

/* ---------- parse STD sheet ---------- */
// Header is on rows 0+1 (merged). Column layout (0-indexed):
//  0  Code
//  1  Name (รายชื่อ)
//  Primary group:
//   2  qty (จำนวนที่เหลือ)
//   3  ordered
//   4  size mg
//   5  EXP
//   6  uses per bottle
//   7  pricePerUnit
//   8  totalPrice
//  Supplier:
//   9  qty
//  10  size mg
//  11  EXP
//  Working:
//  12  qty
//  13  size mg
//  14  EXP
//  15 usagePerUseMg
//  16 frequency
//  17 storageTemp
//  18 status / หมายเหตุ
//  19 expiryStatus / วันหมดอายุ note

function parseStandards(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  const out = [];
  let lastCode = null;
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const name = toStr(r[1]);
    if (!name) continue;
    let code = r[0];
    if (isBlank(code)) {
      // multi-batch row sharing previous code → append suffix
      if (!lastCode) continue;
      code = `${lastCode}.${i}`;
    } else {
      lastCode = String(code).replace(/\.0$/, '');
      code = lastCode;
    }
    out.push({
      code: String(code),
      name,
      primary: {
        qty: toNum(r[2]),
        ordered: toNum(r[3]),
        sizeMg: toMixed(r[4]),
        exp: toStr(r[5]),
        usesPerBottle: toMixed(r[6]),
        pricePerUnit: toNum(r[7]),
        totalPrice: toMixed(r[8]),
      },
      supplier: {
        qty: toNum(r[9]),
        sizeMg: toMixed(r[10]),
        exp: toStr(r[11]),
      },
      working: {
        qty: toNum(r[12]),
        sizeMg: toMixed(r[13]),
        exp: toStr(r[14]),
      },
      usagePerUseMg: toMixed(r[15]),
      frequency: toStr(r[16]),
      storageTemp: toStr(r[17]),
      status: toStr(r[18]),
      expiryStatus: toStr(r[19]),
    });
  }
  // de-dup by code
  const seen = new Map();
  for (const item of out) {
    if (seen.has(item.code)) {
      item.code = `${item.code}-${seen.get(item.code) + 1}`;
    }
    seen.set(item.code, (seen.get(item.code) ?? 0) + 1);
  }
  return out;
}

/* ---------- parse Solvents sheet (สารเคมี) ---------- */
function parseSolvents(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const name = toStr(r[0]);
    if (!name) continue;
    out.push({
      name,
      sizeLiter: toNum(r[1]),
      qty: toNum(r[2]),
      price: toNum(r[3]),
      note: toStr(r[4]),
    });
  }
  return out;
}

/* ---------- parse Glassware sheet (เครื่องแก้ว) ---------- */
function parseGlassware(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const name = toStr(r[0]);
    if (!name) continue;
    // skip footnote rows (e.g. "** หมายเหตุ ราคาประมาณการ...") — not real items
    if (name.startsWith('**') || name.startsWith('หมายเหตุ')) continue;
    out.push({
      name,
      qty: toNum(r[1]),
      pricePerPiece: toNum(r[2]),
      note: toStr(r[3]),
    });
  }
  return out;
}

/* ---------- main ---------- */

(async () => {
  console.log('📂 Reading:', xlsxFile);
  const wb = XLSX.readFile(xlsxFile, { cellDates: true });

  const stdSheet = wb.Sheets['STD'];
  const solSheet = wb.Sheets['สารเคมี'];
  const glassSheet = wb.Sheets['เครื่องแก้ว'];

  if (!stdSheet || !solSheet || !glassSheet) {
    console.error('❌ Missing required sheet. Found:', Object.keys(wb.Sheets));
    process.exit(1);
  }

  const stds = parseStandards(stdSheet);
  const sols = parseSolvents(solSheet);
  const glasses = parseGlassware(glassSheet);

  console.log(`📊 Parsed: ${stds.length} standards, ${sols.length} solvents, ${glasses.length} glassware`);

  if (flags.has('--dry')) {
    console.log('— DRY RUN — sample rows:');
    console.log(JSON.stringify({ standards: stds.slice(0, 3), solvents: sols.slice(0, 3), glassware: glasses.slice(0, 3) }, null, 2));
    return;
  }

  console.log('🔌 Connecting to', MONGODB_URI);
  await mongoose.connect(MONGODB_URI);

  if (flags.has('--reset')) {
    console.log('🧹 Dropping existing stock collections…');
    for (const M of [StockStandard, StockSolvent, StockGlassware]) {
      try { await M.collection.drop(); } catch (err) { if (err.codeName !== 'NamespaceNotFound') throw err; }
    }
    // Re-sync indexes from the current schemas
    await Promise.all([
      StockStandard.syncIndexes(),
      StockSolvent.syncIndexes(),
      StockGlassware.syncIndexes(),
    ]);
  }

  // Standards: upsert by code
  let stdInserted = 0, stdUpdated = 0;
  for (const s of stds) {
    const existing = await StockStandard.findOne({ code: s.code });
    if (existing) {
      Object.assign(existing, s);
      await existing.save();
      stdUpdated++;
    } else {
      await StockStandard.create(s);
      stdInserted++;
    }
  }

  // Solvents: upsert by name
  let solInserted = 0, solUpdated = 0;
  for (const s of sols) {
    const existing = await StockSolvent.findOne({ name: s.name });
    if (existing) {
      Object.assign(existing, s);
      await existing.save();
      solUpdated++;
    } else {
      await StockSolvent.create(s);
      solInserted++;
    }
  }

  // Glassware: upsert by name
  let glassInserted = 0, glassUpdated = 0;
  for (const g of glasses) {
    const existing = await StockGlassware.findOne({ name: g.name });
    if (existing) {
      Object.assign(existing, g);
      await existing.save();
      glassUpdated++;
    } else {
      await StockGlassware.create(g);
      glassInserted++;
    }
  }

  await StockTransaction.create({
    itemType: 'standard',
    itemId: 'IMPORT',
    action: 'create',
    note: `Bulk import from ${path.basename(xlsxFile)} — STD:${stdInserted}+${stdUpdated} SOL:${solInserted}+${solUpdated} GLASS:${glassInserted}+${glassUpdated}`,
    userEmail: 'system',
    userName: 'import-script',
  });

  console.log(`✅ Standards: +${stdInserted} new, ~${stdUpdated} updated`);
  console.log(`✅ Solvents:  +${solInserted} new, ~${solUpdated} updated`);
  console.log(`✅ Glassware: +${glassInserted} new, ~${glassUpdated} updated`);

  await mongoose.disconnect();
})().catch(err => {
  console.error('❌ Import failed:', err);
  process.exit(1);
});
