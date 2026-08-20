function formatStandardLabelRun(sequence, year) {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error('standard label sequence must be a positive integer');
  }
  if (!Number.isInteger(year) || year < 2000) {
    throw new Error('standard label year must be a Gregorian year');
  }
  return `${String(sequence).padStart(2, '0')}/${year}`;
}

function validLabelRun(unit) {
  return Number.isInteger(unit?.labelRunNo)
    && unit.labelRunNo >= 1
    && Number.isInteger(unit?.labelRunYear)
    && unit.labelRunYear >= 2000;
}

function parseValidDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateFromObjectId(value) {
  const id = String(value || '');
  if (!/^[0-9a-f]{24}$/i.test(id)) return null;
  const seconds = Number.parseInt(id.slice(0, 8), 16);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000);
}

function receiveDateOf(unit) {
  return parseValidDate(unit?.receivedDate)
    || parseValidDate(unit?.createdAt)
    || dateFromObjectId(unit?._id);
}

function isCurrentStandardUnit(unit, now = new Date()) {
  if (unit?.status !== 'active') return false;
  const remaining = unit?.volume?.remaining;
  if (remaining != null && Number(remaining) <= 0) return false;
  const exp = parseValidDate(unit?.exp);
  if (exp && exp.getTime() < now.getTime()) return false;
  return true;
}

function unitSortKey(unit, index) {
  return String(unit?._id || unit?.qrId || index);
}

function normalizeInitialSequences(initialSequencesByYear = {}) {
  const sequences = new Map();
  for (const [yearKey, sequenceValue] of Object.entries(initialSequencesByYear)) {
    const year = Number(yearKey);
    const sequence = Number(sequenceValue);
    if (Number.isInteger(year) && year >= 2000 && Number.isInteger(sequence) && sequence > 0) {
      sequences.set(year, Math.max(sequences.get(year) || 0, sequence));
    }
  }
  return sequences;
}

function buildStandardLabelRunBackfill(units, options = {}) {
  const sequencesByYear = normalizeInitialSequences(options.initialSequencesByYear);
  const groups = new Map();
  const skipped = [];

  units.forEach((unit, index) => {
    if (validLabelRun(unit)) {
      sequencesByYear.set(unit.labelRunYear, Math.max(sequencesByYear.get(unit.labelRunYear) || 0, unit.labelRunNo));
      return;
    }

    const receiveDate = receiveDateOf(unit);
    if (!receiveDate) {
      skipped.push({ unitId: unit?._id, qrId: unit?.qrId, reason: 'missing receive date' });
      return;
    }

    const year = receiveDate.getFullYear();
    const receivedAt = receiveDate.toISOString();
    const groupKey = `${year}|${receivedAt}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, { groupKey, year, receivedAt, sortKey: unitSortKey(unit, index), units: [] });
    }
    const group = groups.get(groupKey);
    group.sortKey = String([group.sortKey, unitSortKey(unit, index)].sort()[0]);
    group.units.push({ unit, index });
  });

  const assignments = [];
  const sortedGroups = [...groups.values()].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    const byDate = a.receivedAt.localeCompare(b.receivedAt);
    if (byDate !== 0) return byDate;
    return a.sortKey.localeCompare(b.sortKey);
  });

  for (const group of sortedGroups) {
    const nextSequence = (sequencesByYear.get(group.year) || 0) + 1;
    sequencesByYear.set(group.year, nextSequence);
    const labelRunLabel = formatStandardLabelRun(nextSequence, group.year);
    for (const { unit } of group.units) {
      assignments.push({
        unitId: unit?._id,
        qrId: unit?.qrId,
        labelRunNo: nextSequence,
        labelRunYear: group.year,
        labelRunLabel,
        receivedAt: group.receivedAt,
        groupKey: group.groupKey,
      });
    }
  }

  const latestSequencesByYear = Object.fromEntries([...sequencesByYear.entries()].sort(([a], [b]) => a - b));
  return { assignments, skipped, latestSequencesByYear };
}

async function nextStandardLabelRun(standardId, now = new Date()) {
  if (!standardId) throw new Error('standardId is required');
  const StockStandardLabelCounter = require('../models/StockStandardLabelCounter');
  const year = now.getFullYear();
  const counter = await StockStandardLabelCounter.findOneAndUpdate(
    { standardId, year },
    { $inc: { sequence: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  const sequence = counter.sequence;
  return {
    labelRunNo: sequence,
    labelRunYear: year,
    labelRunLabel: formatStandardLabelRun(sequence, year),
  };
}

module.exports = { buildStandardLabelRunBackfill, formatStandardLabelRun, isCurrentStandardUnit, nextStandardLabelRun };
