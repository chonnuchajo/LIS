const test = require('node:test');
const assert = require('node:assert');
const ChemicalRequisition = require('./ChemicalRequisition');

test('valid doc validates + applies defaults (unit=bottle, itemType=solvent)', async () => {
  const doc = new ChemicalRequisition({
    date: '2026-07-03', roomSlug: 'analysis',
    instrumentId: 'LD-004', instrumentName: 'GC 8890',
    solventId: 's1', solventName: 'Methanol', qty: 1,
  });
  await doc.validate();
  assert.strictEqual(doc.unit, 'bottle');
  assert.strictEqual(doc.itemType, 'solvent');
});

test('rejects when required fields missing', async () => {
  const doc = new ChemicalRequisition({ roomSlug: 'analysis' });
  await assert.rejects(() => doc.validate());
});

test('rejects invalid itemType', async () => {
  const doc = new ChemicalRequisition({
    date: '2026-07-03', roomSlug: 'analysis', instrumentId: 'LD-004',
    solventId: 's1', qty: 1, itemType: 'standard',
  });
  await assert.rejects(() => doc.validate());
});

test('softDelete method exists (from plugin)', () => {
  const doc = new ChemicalRequisition({
    date: '2026-07-03', roomSlug: 'analysis', instrumentId: 'LD-004', solventId: 's1', qty: 1,
  });
  assert.strictEqual(typeof doc.softDelete, 'function');
});
