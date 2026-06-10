// Centralized document-number generation driven by DocumentNumberConfig.
// next*No() functions in routes call nextDocumentNumber(); when no config row
// exists the DEFAULTS below reproduce the original hardcoded formats exactly.

const DEFAULTS = {
  petition:      { docType: 'petition',      prefix: 'P',   yearFormat: 'yy',   includeMonth: true,  seqPadding: 4, separator: '-' },
  sampleReceipt: { docType: 'sampleReceipt', prefix: 'RCV', yearFormat: 'yyyy', includeMonth: false, seqPadding: 4, separator: '-' },
  labRequest:    { docType: 'labRequest',    prefix: 'L',   yearFormat: 'yy',   includeMonth: true,  seqPadding: 4, separator: '-' },
};

const DOC_TYPES = Object.keys(DEFAULTS);
const YEAR_FORMATS = ['none', 'yy', 'yyyy'];

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Build the non-sequence portion of the number (the part used to scan for the
// last issued number). Sequence is appended by the caller.
function buildScanPrefix(cfg, now) {
  const sep = cfg.separator == null ? '' : String(cfg.separator);
  const yyyy = String(now.getFullYear());
  const yy = yyyy.slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');

  let datePart = '';
  if (cfg.yearFormat === 'yyyy') datePart += yyyy;
  else if (cfg.yearFormat === 'yy') datePart += yy;
  if (cfg.includeMonth) datePart += mm;

  const segments = [];
  if (cfg.prefix) segments.push(cfg.prefix);
  if (datePart) segments.push(datePart);
  let prefix = segments.join(sep);
  if (segments.length > 0) prefix += sep; // trailing separator before sequence
  return prefix;
}

// Returns an error string (Thai) or null. Mirrors validateDocNumberConfig in
// src/lib/documentNumberConfig.ts — keep the two in sync.
function validateDocNumberConfig(input) {
  if (typeof input.prefix !== 'string') return 'prefix ต้องเป็นข้อความ';
  if (!YEAR_FORMATS.includes(input.yearFormat)) return 'yearFormat ไม่ถูกต้อง';
  if (typeof input.includeMonth !== 'boolean') return 'includeMonth ต้องเป็น boolean';
  if (typeof input.separator !== 'string' || input.separator.length > 3) return 'ตัวคั่นต้องเป็นข้อความไม่เกิน 3 ตัว';
  if (!Number.isInteger(input.seqPadding) || input.seqPadding < 1 || input.seqPadding > 10) return 'จำนวนหลัก running ต้องเป็นจำนวนเต็ม 1–10';
  const hasPrefix = input.prefix.trim().length > 0;
  const hasYear = input.yearFormat !== 'none';
  if (!hasPrefix && !hasYear) return 'ต้องมี prefix หรือปี อย่างน้อย 1 อย่าง (กันเลขเดินผิด)';
  return null;
}

// docType: 'petition'|'sampleReceipt'|'labRequest'; Model: the Mongoose model;
// numField: the document's number field name (e.g. 'petitionNo').
async function nextDocumentNumber(docType, Model, numField) {
  const DocumentNumberConfig = require('../models/DocumentNumberConfig');
  const saved = await DocumentNumberConfig.findOne({ docType }).lean();
  const cfg = saved || DEFAULTS[docType];
  const now = new Date();
  const scanPrefix = buildScanPrefix(cfg, now);
  const last = await Model.findOne({ [numField]: new RegExp(`^${escapeRegex(scanPrefix)}`) })
    .sort({ [numField]: -1 })
    .lean();
  const nextSeq = last ? Number(last[numField].slice(scanPrefix.length)) + 1 : 1;
  return `${scanPrefix}${String(nextSeq).padStart(cfg.seqPadding, '0')}`;
}

module.exports = {
  DEFAULTS,
  DOC_TYPES,
  YEAR_FORMATS,
  escapeRegex,
  buildScanPrefix,
  validateDocNumberConfig,
  nextDocumentNumber,
};
