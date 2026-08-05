function formatCoaNo(sequence, year) {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error('COA sequence must be a positive integer');
  }
  if (!Number.isInteger(year) || year < 2000) {
    throw new Error('COA year must be a Gregorian year');
  }
  return `${String(sequence).padStart(4, '0')}${String(year)}`;
}

async function nextCoaNumber(now = new Date()) {
  const CoaCounter = require('../models/CoaCounter');
  const year = now.getFullYear();
  const counter = await CoaCounter.findOneAndUpdate(
    { year },
    { $inc: { sequence: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  const sequence = counter.sequence;
  return { coaNo: formatCoaNo(sequence, year), sequence, year };
}

module.exports = { formatCoaNo, nextCoaNumber };
