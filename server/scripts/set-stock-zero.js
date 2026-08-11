// Set all live stock balances to zero.
//
// Usage:
//   node scripts/set-stock-zero.js            # dry-run only
//   node scripts/set-stock-zero.js --commit   # write changes
//
// Note: This script loads server/.env automatically. MONGODB_URI in the environment overrides it.
'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const { StockStandard, StockSolvent, StockGlassware } = require('../models/Stock');
const StockUnit = require('../models/StockUnit');
const StockTransaction = require('../models/StockTransaction');

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/LIS-DB';
const COMMIT = process.argv.includes('--commit');

async function countStockState(models) {
  const [
    standards,
    standardsNonZero,
    solvents,
    solventsNonZero,
    glassware,
    glasswareNonZero,
    unitsNonDiscarded,
    unitsNonZero,
    unitsActive,
  ] = await Promise.all([
    models.StockStandard.countDocuments({}),
    models.StockStandard.countDocuments({
      $or: [
        { 'primary.qty': { $ne: 0 } },
        { 'supplier.qty': { $ne: 0 } },
        { 'working.qty': { $ne: 0 } },
      ],
    }),
    models.StockSolvent.countDocuments({}),
    models.StockSolvent.countDocuments({ qty: { $ne: 0 } }),
    models.StockGlassware.countDocuments({}),
    models.StockGlassware.countDocuments({ qty: { $ne: 0 } }),
    models.StockUnit.countDocuments({ status: { $ne: 'discarded' } }),
    models.StockUnit.countDocuments({ status: { $ne: 'discarded' }, 'volume.remaining': { $ne: 0 } }),
    models.StockUnit.countDocuments({ status: 'active' }),
  ]);

  return {
    standards,
    standardsNonZero,
    solvents,
    solventsNonZero,
    glassware,
    glasswareNonZero,
    unitsNonDiscarded,
    unitsNonZero,
    unitsActive,
  };
}

async function applyStockZero(models) {
  const [standardResult, solventResult, glasswareResult, unitResult] = await Promise.all([
    models.StockStandard.updateMany(
      {},
      { $set: { 'primary.qty': 0, 'supplier.qty': 0, 'working.qty': 0 } },
    ),
    models.StockSolvent.updateMany({}, { $set: { qty: 0 } }),
    models.StockGlassware.updateMany({}, { $set: { qty: 0 } }),
    models.StockUnit.updateMany(
      { status: { $ne: 'discarded' } },
      { $set: { 'volume.remaining': 0, status: 'empty' } },
    ),
  ]);

  return {
    standardsMatched: standardResult.matchedCount,
    standardsModified: standardResult.modifiedCount,
    solventsMatched: solventResult.matchedCount,
    solventsModified: solventResult.modifiedCount,
    glasswareMatched: glasswareResult.matchedCount,
    glasswareModified: glasswareResult.modifiedCount,
    unitsMatched: unitResult.matchedCount,
    unitsModified: unitResult.modifiedCount,
  };
}

async function logBulkStockZero(models) {
  const note = 'Bulk set all live stock quantities to zero';
  await models.StockTransaction.create([
    { itemType: 'standard', itemId: 'bulk-stock-zero-standards', itemName: 'SET stock zero ทั้งหมด', action: 'update', note, userName: 'system' },
    { itemType: 'solvent', itemId: 'bulk-stock-zero-solvents', itemName: 'SET stock zero ทั้งหมด', action: 'update', note, userName: 'system' },
    { itemType: 'glassware', itemId: 'bulk-stock-zero-glassware', itemName: 'SET stock zero ทั้งหมด', action: 'update', note, userName: 'system' },
  ]);
}

function printJson(label, value) {
  console.log(`${label}: ${JSON.stringify(value, null, 2)}`);
}

async function main() {
  const models = { StockStandard, StockSolvent, StockGlassware, StockUnit, StockTransaction };

  await mongoose.connect(URI);
  console.log(`ต่อ database: ${mongoose.connection.host}/${mongoose.connection.name}`);

  const before = await countStockState(models);
  printJson('Before', before);

  if (!COMMIT) {
    console.log('DRY-RUN — ยังไม่เขียนข้อมูล. รันซ้ำด้วย --commit เพื่อ set stock เป็น 0 จริง');
    await mongoose.disconnect();
    return;
  }

  const updated = await applyStockZero(models);
  await logBulkStockZero(models);
  const after = await countStockState(models);

  printJson('Updated', updated);
  printJson('After', after);

  const failed = after.standardsNonZero
    || after.solventsNonZero
    || after.glasswareNonZero
    || after.unitsNonZero
    || after.unitsActive;

  await mongoose.disconnect();

  if (failed) {
    console.error('ยังพบ stock ที่ไม่เป็นศูนย์หรือขวด active ค้างอยู่');
    process.exit(2);
  }
}

if (require.main === module) {
  main().catch(async (err) => {
    console.error(err);
    try { await mongoose.disconnect(); } catch (_) {}
    process.exit(1);
  });
}

module.exports = {
  applyStockZero,
  countStockState,
  logBulkStockZero,
};
