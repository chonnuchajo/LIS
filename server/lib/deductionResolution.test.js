const {
  buildPendingDeductionFilter,
  normalizeDeductionResolutionInput,
} = require('./deductionResolution');

describe('deduction resolution helpers', () => {
  test('normalizes an empty resolution', () => {
    expect(normalizeDeductionResolutionInput({ reason: 'empty', note: 'used up' })).toEqual({
      value: { reason: 'empty', note: 'used up' },
    });
  });

  test('requires a note when reason is other', () => {
    expect(normalizeDeductionResolutionInput({ reason: 'other', note: '' })).toEqual({
      error: 'กรุณาระบุเหตุผล',
    });
  });

  test('requires a note when reason is ineffective', () => {
    expect(normalizeDeductionResolutionInput({ reason: 'ineffective', note: '' })).toEqual({
      error: 'กรุณาระบุเหตุผล',
    });
  });

  test('rejects glassware for pending deduction lookup', () => {
    expect(buildPendingDeductionFilter({ itemType: 'glassware', itemId: 'g1' })).toEqual({
      error: 'รองรับเฉพาะ Standard และสารเคมี',
    });
  });

  test('builds pending filter for unresolved solvent deductions by instrument', () => {
    expect(buildPendingDeductionFilter({ itemType: 'solvent', itemId: 's1', instrumentId: 'gc-1' })).toEqual({
      value: {
        action: 'deduct',
        itemType: 'solvent',
        itemId: 's1',
        instrumentId: 'gc-1',
        'deductionResolution.reason': { $exists: false },
      },
    });
  });

  test('builds pending filter for unresolved standard deductions and excludes the selected qr', () => {
    expect(
      buildPendingDeductionFilter({
        itemType: 'standard',
        itemCode: 'STD-001',
        instrumentGroup: 'gc',
        excludeQrId: 'u_current',
      }),
    ).toEqual({
      value: {
        action: 'deduct',
        itemType: 'standard',
        itemCode: 'STD-001',
        instrumentGroup: 'gc',
        qrId: { $ne: 'u_current' },
        'deductionResolution.reason': { $exists: false },
      },
    });
  });
});
