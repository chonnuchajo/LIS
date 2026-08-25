const { StockStandard, StockSolvent, StockGlassware } = require('./Stock');
const StockUnit = require('./StockUnit');

describe('Stock item barcode aliases', () => {
  test('standard stores registered receive barcodes', () => {
    const doc = new StockStandard({ code: 'STD-001', name: 'ABAMECTIN', barcodes: ['654694'] });

    expect(doc.barcodes).toEqual(['654694']);
  });

  test('solvent stores registered receive barcodes', () => {
    const doc = new StockSolvent({ name: 'Methanol', barcodes: ['SOL-001'] });

    expect(doc.barcodes).toEqual(['SOL-001']);
  });

  test('glassware stores registered receive barcodes', () => {
    const doc = new StockGlassware({ name: 'Beaker', barcodes: ['GLA-001'] });

    expect(doc.barcodes).toEqual(['GLA-001']);
  });
  test('stock unit can belong to a solvent item', () => {
    const doc = new StockUnit({
      qrId: 'solvent-unit-1',
      itemType: 'solvent',
      itemId: 'solvent-1',
      itemCode: 'solvent-1',
      itemName: 'Acetone',
      kind: 'sealed',
      volume: { initial: 18000, remaining: 18000, unit: 'ml' },
    });

    expect(doc.itemType).toBe('solvent');
    expect(doc.itemId).toBe('solvent-1');
  });
});
