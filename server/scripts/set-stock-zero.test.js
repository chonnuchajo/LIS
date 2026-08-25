const { applyStockZero } = require('./set-stock-zero');

function makeModel() {
  return {
    updateMany: jest.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1 }),
  };
}

test('applyStockZero zeros live stock summary quantities and non-discarded bottle remaining values', async () => {
  const models = {
    StockStandard: makeModel(),
    StockSolvent: makeModel(),
    StockGlassware: makeModel(),
    StockUnit: makeModel(),
  };

  const result = await applyStockZero(models);

  expect(models.StockStandard.updateMany).toHaveBeenCalledWith(
    {},
    { $set: { 'primary.qty': 0, 'supplier.qty': 0, 'working.qty': 0 } },
  );
  expect(models.StockSolvent.updateMany).toHaveBeenCalledWith({}, { $set: { qty: 0 } });
  expect(models.StockGlassware.updateMany).toHaveBeenCalledWith({}, { $set: { qty: 0 } });
  expect(models.StockUnit.updateMany).toHaveBeenCalledWith(
    { status: { $ne: 'discarded' } },
    { $set: { 'volume.remaining': 0, status: 'empty' } },
  );
  expect(result).toEqual({
    standardsMatched: 1,
    standardsModified: 1,
    solventsMatched: 1,
    solventsModified: 1,
    glasswareMatched: 1,
    glasswareModified: 1,
    unitsMatched: 1,
    unitsModified: 1,
  });
});
