function standardLabelCodePrefix(standardCode) {
  const raw = String(standardCode ?? '').trim().toUpperCase();
  if (!raw) return '00';
  const compact = raw.replace(/\s+/g, '');
  if (/^\d+$/.test(compact)) return compact.padStart(2, '0').slice(0, 2);
  const digits = (compact.match(/\d+/g) || []).join('');
  if (digits) return digits.slice(-2).padStart(2, '0');
  const alnum = compact.replace(/[^A-Z0-9]/g, '');
  return (alnum + '00').slice(0, 2);
}

function buddhistYearTwoDigits(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  const year = Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
  return (year + 543) % 100;
}

function toTwoDigitNumber(value, fieldName) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 99) {
    throw new Error(`${fieldName} must be a two-digit number`);
  }
  return String(number).padStart(2, '0');
}

function formatStandardLabelCode(standardCode, buddhistYear, bottleNo) {
  const sequence = Number(bottleNo);
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error('standard label Code bottle number must be a positive integer');
  }
  return `${standardLabelCodePrefix(standardCode)}${toTwoDigitNumber(buddhistYear, 'standard label Code year')}${String(sequence).padStart(2, '0')}`;
}

function parseStandardLabelCode(labelCode, standardCode) {
  const prefix = standardLabelCodePrefix(standardCode);
  const normalized = String(labelCode ?? '').trim().toUpperCase();
  if (!normalized.startsWith(prefix)) return null;
  const suffix = normalized.slice(prefix.length);
  if (!/^\d{4,}$/.test(suffix)) return null;
  const buddhistYear = Number(suffix.slice(0, 2));
  const bottleNo = Number(suffix.slice(2));
  if (!Number.isInteger(bottleNo) || bottleNo < 1) return null;
  return { labelCode: `${prefix}${suffix}`, prefix, buddhistYear, bottleNo };
}

function normalizeDefaultCount(count) {
  const number = Number(count);
  if (!Number.isInteger(number) || number < 1) return 1;
  return Math.min(number, 200);
}

function buildStandardLabelCodeDefaults(standardCode, units = [], options = {}) {
  const prefix = standardLabelCodePrefix(standardCode);
  const buddhistYear = Number.isInteger(options.buddhistYear) ? options.buddhistYear : buddhistYearTwoDigits(options.now);
  const count = normalizeDefaultCount(options.count);
  let maxBottleNo = 0;

  for (const unit of units || []) {
    const parsed = parseStandardLabelCode(unit && unit.labelCode, standardCode);
    if (parsed && parsed.buddhistYear === buddhistYear) {
      maxBottleNo = Math.max(maxBottleNo, parsed.bottleNo);
    }
  }

  const nextBottleNo = maxBottleNo + 1;
  const codes = Array.from({ length: count }, (_, index) => formatStandardLabelCode(prefix, buddhistYear, nextBottleNo + index));
  return { prefix, buddhistYear, nextBottleNo, codes };
}

function normalizeStandardLabelCode(labelCode, standardCode) {
  const parsed = parseStandardLabelCode(labelCode, standardCode);
  return parsed ? parsed.labelCode : '';
}

module.exports = {
  buildStandardLabelCodeDefaults,
  buddhistYearTwoDigits,
  formatStandardLabelCode,
  normalizeStandardLabelCode,
  parseStandardLabelCode,
  standardLabelCodePrefix,
};
