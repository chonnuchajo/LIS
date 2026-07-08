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
});
