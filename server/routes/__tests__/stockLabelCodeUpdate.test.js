const { normalizeUnitLabelCodeUpdate } = require('../stock');

describe('normalizeUnitLabelCodeUpdate', () => {
  test('normalizes editable standard Code for unit updates', () => {
    expect(normalizeUnitLabelCodeUpdate(' 016901 ', 'STD-001')).toBe('016901');
  });

  test('allows clearing an editable standard Code', () => {
    expect(normalizeUnitLabelCodeUpdate('', 'STD-001')).toBe('');
  });

  test('rejects changing the fixed standard prefix', () => {
    expect(() => normalizeUnitLabelCodeUpdate('026901', 'STD-001')).toThrow('Code ต้องขึ้นต้นด้วย 01');
  });
});
