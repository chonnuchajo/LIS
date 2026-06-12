const test = require('node:test');
const assert = require('node:assert');
const { getByPath, extractReading } = require('./instrumentReading');

test('getByPath reads a top-level key', () => {
  assert.strictEqual(getByPath({ value: 1.2 }, 'value'), 1.2);
});

test('getByPath reads a nested dotted path', () => {
  assert.strictEqual(getByPath({ data: { value: 0.998 } }, 'data.value'), 0.998);
});

test('getByPath reads through array index', () => {
  assert.strictEqual(getByPath({ readings: [{ v: 5 }, { v: 7 }] }, 'readings.1.v'), 7);
});

test('getByPath returns undefined on a missing segment (no throw)', () => {
  assert.strictEqual(getByPath({ data: {} }, 'data.value.deep'), undefined);
  assert.strictEqual(getByPath({}, 'a.b.c'), undefined);
  assert.strictEqual(getByPath(null, 'a'), undefined);
});

test('getByPath with empty path returns the object itself', () => {
  const o = { a: 1 };
  assert.strictEqual(getByPath(o, ''), o);
});

test('extractReading pulls value via responsePath and coerces to number', () => {
  const out = extractReading({ data: { value: '0.998' } }, { responsePath: 'data.value', decimals: 3 });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.value, 0.998);
});

test('extractReading applies decimals rounding', () => {
  const out = extractReading({ v: 0.99812 }, { responsePath: 'v', decimals: 3 });
  assert.strictEqual(out.value, 0.998);
});

test('extractReading without decimals keeps the raw number', () => {
  const out = extractReading({ v: 0.99812 }, { responsePath: 'v' });
  assert.strictEqual(out.value, 0.99812);
});

test('extractReading fails when responsePath misses', () => {
  const out = extractReading({ data: {} }, { responsePath: 'data.value' });
  assert.strictEqual(out.ok, false);
  assert.match(out.error, /ไม่พบค่า|responsePath/);
});

test('extractReading fails when the value is non-numeric', () => {
  const out = extractReading({ v: 'n/a' }, { responsePath: 'v' });
  assert.strictEqual(out.ok, false);
});

test('extractReading reads readingAt from readingAtPath when present', () => {
  const out = extractReading(
    { v: 1.0, measuredAt: '2026-06-12T07:23:00Z' },
    { responsePath: 'v', readingAtPath: 'measuredAt' },
  );
  assert.strictEqual(out.readingAt, '2026-06-12T07:23:00Z');
});
