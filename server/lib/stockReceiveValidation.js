function hasText(value) {
  return typeof value === 'string' ? value.trim().length > 0 : value != null && String(value).trim().length > 0;
}

function isValidDateInput(value) {
  if (!hasText(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function normalizePhotoUrls(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.startsWith('/LIS/uploads/qc-photos/') || item.startsWith('/uploads/qc-photos/'));
}

function normalizeBottlePhotoUrls(bottle) {
  return normalizePhotoUrls(bottle && bottle.photoUrls);
}

function validateStandardUnitReceiveInput(body = {}) {
  if (!hasText(body.lotNo)) return 'กรุณาระบุ Lot No';
  if (!Array.isArray(body.bottles) || body.bottles.length === 0) return null;
  const missingExp = body.bottles.some((b) => !isValidDateInput(b && b.exp));
  if (missingExp) return 'กรุณาระบุ EXP';
  return null;
}

function validateSolventReceiveInput(body = {}) {
  if (!hasText(body.lotNo)) return 'กรุณาระบุ Lot No';
  if (!isValidDateInput(body.exp)) return 'กรุณาระบุ EXP';
  return null;
}

function composeSolventReceiveNote({ lotNo, exp, sizeLabel, note } = {}) {
  return [
    hasText(lotNo) ? `lot ${String(lotNo).trim()}` : '',
    hasText(exp) ? `exp ${String(exp).trim()}` : '',
    hasText(sizeLabel) ? `ขนาด ${String(sizeLabel).trim()}` : '',
    hasText(note) ? String(note).trim() : '',
  ].filter(Boolean).join(' · ');
}

module.exports = {
  validateStandardUnitReceiveInput,
  validateSolventReceiveInput,
  composeSolventReceiveNote,
  normalizePhotoUrls,
  normalizeBottlePhotoUrls,
};
