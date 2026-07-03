const path = require('path');
const mongoose = require('mongoose');
const xlsx = require('xlsx');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const StandardTime = require('../models/StandardTime');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/LIS-DB';

const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const norm = (v) => clean(v).toUpperCase();
const num = (v) => {
  const s = clean(v).replace(/,/g, '');
  if (!s || s === '-' || /ยังไม่มีข้อมูล/i.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const machineTypeOf = (instrument) => {
  const s = String(instrument).toUpperCase();
  if (s.includes('HPLC')) return 'HPLC';
  if (s.includes('GC')) return 'GC';
  return '';
};
const daysOf = (count, unit) => {
  if (count == null) return null;
  const u = String(unit).toLowerCase();
  if (u === 'day') return count;
  if (u === 'week') return count * 7;
  if (u === 'month') return count * 30;
  return null;
};

function parseWorkbook(filePath) {
  const wb = xlsx.readFile(filePath);
  const sheets = wb.SheetNames.slice(1); // first sheet is the source summary.
  const docs = [];

  for (const sheetName of sheets) {
    const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '', raw: false });
    const instrument = clean(rows[0]?.[2] || sheetName).replace(/\s+/g, '');
    for (let i = 3; i < rows.length; i += 1) {
      const r = rows[i];
      const analysisName = clean(r[1]);
      if (!analysisName) continue;
      const columnDimension = clean(r[2]);
      const standardTimeMin = num(r[17]);
      const frequencyCount = num(r[6]);
      const frequencyUnit = clean(r[7]);
      const doc = {
        sourceFile: path.basename(filePath),
        sourceSheet: sheetName,
        rowNo: i + 1,
        instrument,
        machineType: machineTypeOf(instrument),
        analysisName,
        normalizedAnalysisName: norm(analysisName),
        columnDimension,
        mobilePhaseTopUpMin: num(r[3]),
        samplePrepPerBatchMin: num(r[4]),
        standardPrepMin: num(r[5]),
        stockStdFrequencyCount: frequencyCount,
        stockStdFrequencyUnit: frequencyUnit,
        stockStdFrequencyDays: daysOf(frequencyCount, frequencyUnit),
        instrumentSetupMin: num(r[9]),
        standardCycleMin: num(r[10]),
        totalInjectionsPerBatch: num(r[11]),
        machineRunTotalMin: num(r[12]),
        machineRunText: clean(r[13]),
        dataProcessingMin: num(r[14]),
        recordResultMin: num(r[15]),
        reportingMin: num(r[16]),
        standardTimeMin,
        standardTimeText: clean(r[18]),
        hasData: standardTimeMin != null,
        importedAt: new Date(),
      };
      doc.importKey = `${doc.instrument}|${doc.normalizedAnalysisName}|${doc.columnDimension}`;
      docs.push(doc);
    }
  }
  return docs;
}

async function main() {
  const filePath = path.resolve(process.cwd(), process.argv[2] || 'Capacity Analysis1.2.xlsx');
  const docs = parseWorkbook(filePath);
  if (docs.length === 0) throw new Error('No standard time rows found');

  await mongoose.connect(MONGODB_URI);
  await StandardTime.syncIndexes();
  const result = await StandardTime.bulkWrite(docs.map((doc) => ({
    updateOne: {
      filter: { importKey: doc.importKey },
      update: { $set: doc },
      upsert: true,
    },
  })));
  const withData = docs.filter((d) => d.hasData).length;
  console.log(JSON.stringify({
    source: filePath,
    rows: docs.length,
    withData,
    missingData: docs.length - withData,
    upserted: result.upsertedCount || 0,
    modified: result.modifiedCount || 0,
  }, null, 2));
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch(async (err) => {
    console.error(err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
}

module.exports = { parseWorkbook };
