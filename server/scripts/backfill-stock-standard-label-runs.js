// เติมเลขรันฉลาก standard ให้ StockUnit เดิมที่รับเข้าก่อนมี labelRunNo/labelRunYear
//
// หลักการ:
// - จัดกลุ่มตาม standard + ปีที่รับเข้า + receivedDate เดียวกัน (รับเข้าหลายขวดครั้งเดียวใช้เลขเดียวกัน)
// - ไม่ overwrite ขวดที่มี labelRunNo/labelRunYear อยู่แล้ว
// - dry-run เป็นค่าเริ่มต้น; ใส่ --commit เพื่อเขียนจริง
//
// Usage:
//   node scripts/backfill-stock-standard-label-runs.js
//   node scripts/backfill-stock-standard-label-runs.js --commit
'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const { StockStandard } = require('../models/Stock');
const StockUnit = require('../models/StockUnit');
const StockStandardLabelCounter = require('../models/StockStandardLabelCounter');
const { buildStandardLabelRunBackfill, isCurrentStandardUnit } = require('../lib/stockStandardLabelRun');

const COMMIT = process.argv.includes('--commit');
const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/LIS-DB';
const NOW = new Date();

function labelForStandard(std) {
  return `${std.code || '-'} ${std.name || ''}`.trim();
}

function groupAssignments(assignments) {
  const groups = new Map();
  for (const assignment of assignments) {
    const key = `${assignment.labelRunLabel}|${assignment.receivedAt}`;
    if (!groups.has(key)) {
      groups.set(key, { ...assignment, count: 0 });
    }
    groups.get(key).count += 1;
  }
  return [...groups.values()];
}

async function loadCounterSequences(standardId) {
  const counters = await StockStandardLabelCounter.find({ standardId }).lean();
  return Object.fromEntries(
    counters
      .filter((counter) => Number.isInteger(counter.year) && Number.isInteger(counter.sequence))
      .map((counter) => [counter.year, counter.sequence]),
  );
}

async function updateUnits(assignments) {
  if (assignments.length === 0) return;
  await StockUnit.bulkWrite(assignments.map((assignment) => ({
    updateOne: {
      filter: {
        _id: assignment.unitId,
        $or: [
          { labelRunNo: null },
          { labelRunNo: { $exists: false } },
          { labelRunYear: null },
          { labelRunYear: { $exists: false } },
        ],
      },
      update: {
        $set: {
          labelRunNo: assignment.labelRunNo,
          labelRunYear: assignment.labelRunYear,
        },
      },
    },
  })));
}

async function updateCounters(standardId, latestSequencesByYear) {
  for (const [yearText, sequence] of Object.entries(latestSequencesByYear)) {
    const year = Number(yearText);
    if (!Number.isInteger(year) || !Number.isInteger(sequence) || sequence < 1) continue;
    await StockStandardLabelCounter.findOneAndUpdate(
      { standardId, year },
      { $max: { sequence } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
}

async function main() {
  await mongoose.connect(URI);

  const standards = await StockStandard.find().sort({ code: 1, name: 1 }).lean();
  let touchedStandards = 0;
  let assignmentCount = 0;
  let skippedCount = 0;

  for (const std of standards) {
    const units = await StockUnit.find({
      itemCode: std.code,
    }).sort({ receivedDate: 1, createdAt: 1, _id: 1 }).lean();

    if (units.length === 0) continue;

    const currentUnits = units.filter((unit) => isCurrentStandardUnit(unit, NOW));
    if (currentUnits.length === 0) continue;

    const initialSequencesByYear = await loadCounterSequences(std._id);
    const result = buildStandardLabelRunBackfill(currentUnits, { initialSequencesByYear });
    if (result.assignments.length === 0 && result.skipped.length === 0) continue;

    touchedStandards += 1;
    assignmentCount += result.assignments.length;
    skippedCount += result.skipped.length;

    console.log(`\n${labelForStandard(std)}`);
    for (const group of groupAssignments(result.assignments)) {
      console.log(`  ${group.labelRunLabel} · ${group.receivedAt} · ${group.count} ขวด`);
    }
    for (const skipped of result.skipped) {
      console.log(`  SKIP ${skipped.qrId || skipped.unitId || '-'} · ${skipped.reason}`);
    }

    if (COMMIT) {
      await updateUnits(result.assignments);
      await updateCounters(std._id, result.latestSequencesByYear);
    }
  }

  console.log(`\nสารที่มีปัจจุบัน: ${touchedStandards} | ขวดปัจจุบันที่จะเติมเลข: ${assignmentCount} | ขวดที่ข้าม: ${skippedCount}`);
  if (!COMMIT) {
    console.log('DRY-RUN — ยังไม่เขียน. รันซ้ำด้วย --commit เพื่อเขียนจริง');
  } else {
    console.log('เขียนเรียบร้อย');
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
