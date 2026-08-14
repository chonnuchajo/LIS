const { StockStandard, StockSolvent, StockGlassware } = require('./Stock');

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
});
