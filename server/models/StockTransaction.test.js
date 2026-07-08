const StockTransaction = require('./StockTransaction');

describe('StockTransaction schema', () => {
  test('has instrumentGroup enum path with gc/hplc + null default', () => {
    const path = StockTransaction.schema.path('instrumentGroup');
    expect(path).toBeDefined();
    expect(path.instance).toBe('String');
    expect(path.enumValues).toContain('gc');
    expect(path.enumValues).toContain('hplc');
    expect(path.defaultValue).toBeNull();
  });

  test('rejects out-of-enum instrumentGroup', () => {
    const doc = new StockTransaction({ itemType: 'standard', itemId: 'x', action: 'deduct', instrumentGroup: 'lcms' });
    const err = doc.validateSync();
    expect(err && err.errors && err.errors.instrumentGroup).toBeTruthy();
  });
});
