function hasText(value) {
  return typeof value === 'string' ? value.trim().length > 0 : value != null && String(value).trim().length > 0;
}

function isValidDateInput(value) {
  if (!hasText(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function isPositiveNumberInput(value) {
  if (!hasText(value)) return false;
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

function isNonNegativeNumberInput(value) {
  if (!hasText(value)) return false;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0;
}

function solventSizeLabel(sizeLiter, fallbackSizeLabel) {
  if (hasText(sizeLiter)) return `${String(sizeLiter).trim()} L`;
  return hasText(fallbackSizeLabel) ? String(fallbackSizeLabel).trim() : "";
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
  if (!hasText(body.purity)) return 'กรุณาระบุ % Purity';
  if (!Array.isArray(body.bottles) || body.bottles.length === 0) return null;
  const missingExp = body.bottles.some((b) => !isValidDateInput(b && b.exp));
  if (missingExp) return 'กรุณาระบุ EXP';
  return null;
}

function validateSolventReceiveInput(body = {}) {
  if (!hasText(body.lotNo)) return 'กรุณาระบุ Lot No';
  if (!isValidDateInput(body.exp)) return 'กรุณาระบุ EXP';
  if (!hasText(body.sizeLiter)) return 'กรุณาระบุขนาด/ขวด';
  if (!isPositiveNumberInput(body.sizeLiter)) return 'ขนาด/ขวดไม่ถูกต้อง';
  if (!hasText(body.price)) return 'กรุณาระบุราคา';
  if (!isNonNegativeNumberInput(body.price)) return 'ราคาไม่ถูกต้อง';
  return null;
}

function composeSolventReceiveNote({ lotNo, exp, sizeLiter, sizeLabel, price, note } = {}) {
  const displaySize = solventSizeLabel(sizeLiter, sizeLabel);
  return [
    hasText(lotNo) ? `lot ${String(lotNo).trim()}` : '',
    hasText(exp) ? `exp ${String(exp).trim()}` : '',
    displaySize ? `ขนาด ${displaySize}` : '',
    hasText(price) ? `ราคา ${String(price).trim()} บาท` : '',
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
