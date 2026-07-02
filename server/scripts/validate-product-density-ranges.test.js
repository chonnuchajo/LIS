const { test } = require('node:test');
const assert = require('node:assert');
const { validateEntries } = require('./validate-product-density-ranges');

const good = [
  { commonName: 'CYPERMETHRIN 10% W/V EC', thaiName: 'ไซเปอร์เมทธิน 10% อีซี', category: 'insecticide', sgMin: null, sgMax: null, note: '' },
];

test('accepts a valid array', () => {
  const r = validateEntries(good);
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.errors, []);
});

test('rejects duplicate commonName (case-insensitive)', () => {
  const r = validateEntries([good[0], { ...good[0], thaiName: 'x', commonName: 'cypermethrin 10% w/v ec' }]);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some((e) => /duplicate/i.test(e)));
});

test('rejects Thai characters in commonName', () => {
  const r = validateEntries([{ ...good[0], commonName: 'ไซเปอร์ EC' }]);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some((e) => /thai|uppercase/i.test(e)));
});

test('rejects lowercase commonName', () => {
  const r = validateEntries([{ ...good[0], commonName: 'cypermethrin 10% w/v ec' }]);
  assert.strictEqual(r.ok, false);
});

test('rejects sgMin > sgMax when both set', () => {
  const r = validateEntries([{ ...good[0], sgMin: 1.2, sgMax: 1.0 }]);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some((e) => /sgMin/i.test(e)));
});

test('rejects bad category', () => {
  const r = validateEntries([{ ...good[0], category: 'weedkiller' }]);
  assert.strictEqual(r.ok, false);
});

test('allows both ranges null', () => {
  assert.strictEqual(validateEntries([{ ...good[0], sgMin: null, sgMax: null }]).ok, true);
});
