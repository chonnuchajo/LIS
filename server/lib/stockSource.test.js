const test = require('node:test');
const assert = require('node:assert');
const {
  RECEIVE_SOURCES,
  UNIT_SOURCES,
  isValidReceiveSource,
  isValidUnitSource,
  tierSourceFor,
  assignSealedSources,
} = require('./stockSource');

test('RECEIVE_SOURCES = primary, supply', () => {
  assert.deepStrictEqual(RECEIVE_SOURCES, ['primary', 'supply']);
});

test('UNIT_SOURCES = primary, supply, blank', () => {
  assert.deepStrictEqual(UNIT_SOURCES, ['primary', 'supply', '']);
});

test('isValidReceiveSource accepts only primary/supply', () => {
  assert.strictEqual(isValidReceiveSource('primary'), true);
  assert.strictEqual(isValidReceiveSource('supply'), true);
  assert.strictEqual(isValidReceiveSource(''), false);
  assert.strictEqual(isValidReceiveSource('supplier'), false);
  assert.strictEqual(isValidReceiveSource(undefined), false);
});

test('isValidUnitSource also accepts blank (clear), rejects junk', () => {
  assert.strictEqual(isValidUnitSource('primary'), true);
  assert.strictEqual(isValidUnitSource('supply'), true);
  assert.strictEqual(isValidUnitSource(''), true);
  assert.strictEqual(isValidUnitSource('supplier'), false);
  assert.strictEqual(isValidUnitSource(undefined), false);
});

test('tierSourceFor maps tier name to source', () => {
  assert.strictEqual(tierSourceFor('primary'), 'primary');
  assert.strictEqual(tierSourceFor('supplier'), 'supply');
  assert.strictEqual(tierSourceFor('working'), '');
  assert.strictEqual(tierSourceFor(undefined), '');
  assert.strictEqual(tierSourceFor(null), '');
});

test('assignSealedSources: first primaryQty are primary, rest supply', () => {
  assert.deepStrictEqual(assignSealedSources(5, 2), ['primary', 'primary', 'supply', 'supply', 'supply']);
  assert.deepStrictEqual(assignSealedSources(3, 0), ['supply', 'supply', 'supply']);
  assert.deepStrictEqual(assignSealedSources(2, 9), ['primary', 'primary']);
  assert.deepStrictEqual(assignSealedSources(0, 3), []);
});

test('assignSealedSources floors/guards primaryQty', () => {
  assert.deepStrictEqual(assignSealedSources(3, 1.9), ['primary', 'supply', 'supply']);
  assert.deepStrictEqual(assignSealedSources(2, -5), ['supply', 'supply']);
  assert.deepStrictEqual(assignSealedSources(2, NaN), ['supply', 'supply']);
});

test('assignSealedSources guards sealedCount', () => {
  assert.deepStrictEqual(assignSealedSources(2.7, 1), ['primary', 'supply']);
  assert.deepStrictEqual(assignSealedSources(-3, 1), []);
});
