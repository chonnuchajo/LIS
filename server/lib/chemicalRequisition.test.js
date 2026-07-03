const test = require('node:test');
const assert = require('node:assert');
const { todayStr, buildDeductNote, normalizeReqInput } = require('./chemicalRequisition');

test('todayStr formats YYYY-MM-DD (local)', () => {
  assert.strictEqual(todayStr(new Date(2026, 6, 3)), '2026-07-03');
  assert.strictEqual(todayStr(new Date(2026, 11, 9)), '2026-12-09');
});

test('buildDeductNote embeds instrument + optional note', () => {
  assert.strictEqual(buildDeductNote('GC 8890', ''), 'เบิกให้ GC 8890');
  assert.strictEqual(buildDeductNote('GC 8890', 'lot A'), 'เบิกให้ GC 8890 — lot A');
  assert.strictEqual(buildDeductNote('', ''), 'เบิกให้ -');
});

test('normalizeReqInput rejects bad input', () => {
  assert.ok(normalizeReqInput({ instrumentId: 'x', qty: 1 }).error);   // no solventId
  assert.ok(normalizeReqInput({ solventId: 's', qty: 1 }).error);      // no instrumentId
  assert.ok(normalizeReqInput({ solventId: 's', instrumentId: 'x', qty: 0 }).error);
  assert.ok(normalizeReqInput({ solventId: 's', instrumentId: 'x', qty: -2 }).error);
  assert.ok(normalizeReqInput({ solventId: 's', instrumentId: 'x', qty: 'abc' }).error);
});

test('normalizeReqInput normalizes good input (coerces qty, trims requestedBy)', () => {
  const { value, error } = normalizeReqInput({
    solventId: 's1', instrumentId: 'LD-004', instrumentName: 'GC 8890',
    qty: '2', roomSlug: 'analysis', date: '2026-07-03', note: 'x',
    requestedBy: { email: 'a@b.c', name: 'Ann' },
  });
  assert.strictEqual(error, undefined);
  assert.strictEqual(value.qty, 2);
  assert.strictEqual(value.instrumentName, 'GC 8890');
  assert.strictEqual(value.requestedBy.name, 'Ann');
  assert.strictEqual(value.date, '2026-07-03');
  assert.strictEqual(value.roomSlug, 'analysis');
});

test('normalizeReqInput defaults date to today + roomSlug to analysis', () => {
  const { value } = normalizeReqInput({ solventId: 's', instrumentId: 'x', qty: 1 });
  assert.match(value.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.strictEqual(value.roomSlug, 'analysis');
  assert.strictEqual(value.requestedBy.name, '');
});
