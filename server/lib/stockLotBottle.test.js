const { buildLotBottleNumbers } = require('./stockLotBottle');

describe('stock lot bottle numbering', () => {
  test('starts new lots at bottle 1', () => {
    expect(buildLotBottleNumbers(0, 3)).toEqual([1, 2, 3]);
  });

  test('continues numbering after existing bottles in the same lot', () => {
    expect(buildLotBottleNumbers(2, 2)).toEqual([3, 4]);
  });
});
