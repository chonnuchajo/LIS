const VALID_ITEM_TYPES = new Set(['standard', 'solvent']);
const VALID_REASONS = new Set(['empty', 'ineffective', 'other']);

function cleanString(value) {
  return String(value || '').trim();
}

function normalizeDeductionResolutionInput(input = {}) {
  const reason = cleanString(input.reason);
  const note = cleanString(input.note);
  if (!VALID_REASONS.has(reason)) return { error: 'กรุณาเลือกเหตุผล' };
  if ((reason === 'ineffective' || reason === 'other') && !note) return { error: 'กรุณาระบุเหตุผล' };
  return { value: { reason, note } };
}

function buildPendingDeductionFilter(input = {}) {
  const itemType = cleanString(input.itemType);
  if (!VALID_ITEM_TYPES.has(itemType)) return { error: 'รองรับเฉพาะ Standard และสารเคมี' };

  const filter = {
    action: 'deduct',
    itemType,
    'deductionResolution.reason': { $exists: false },
  };

  const itemId = cleanString(input.itemId);
  const itemCode = cleanString(input.itemCode);
  const instrumentId = cleanString(input.instrumentId);
  const instrumentGroup = cleanString(input.instrumentGroup);
  const excludeQrId = cleanString(input.excludeQrId);

  if (itemId) filter.itemId = itemId;
  if (itemCode) filter.itemCode = itemCode;
  if (instrumentId) filter.instrumentId = instrumentId;
  if (instrumentGroup) filter.instrumentGroup = instrumentGroup;
  if (excludeQrId) filter.qrId = { $ne: excludeQrId };

  return { value: filter };
}

module.exports = {
  buildPendingDeductionFilter,
  normalizeDeductionResolutionInput,
};
