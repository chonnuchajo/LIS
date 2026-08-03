const test = require('node:test');
const assert = require('node:assert');
const { parseFrequencyInterval, addInterval, computeWorkingLifecycle, dueAtFor } = require('./workingLifecycle');

test('parseFrequencyInterval reads denominator + unit', () => {
  assert.deepStrictEqual(parseFrequencyInterval('1/1 week'), { count: 1, unit: 'week' });
  assert.deepStrictEqual(parseFrequencyInterval('1/2 month'), { count: 2, unit: 'month' });
  assert.deepStrictEqual(parseFrequencyInterval('1/3 days'), { count: 3, unit: 'day' });
  assert.strictEqual(parseFrequencyInterval(''), null);
  assert.strictEqual(parseFrequencyInterval(null), null);
  assert.strictEqual(parseFrequencyInterval('weekly'), null);
});

test('addInterval adds day/week/month', () => {
  assert.deepStrictEqual(addInterval(new Date('2026-01-01'), 7, 'day'), new Date('2026-01-08'));
  assert.deepStrictEqual(addInterval(new Date('2026-01-01'), 2, 'week'), new Date('2026-01-15'));
  assert.deepStrictEqual(addInterval(new Date('2026-01-15'), 1, 'month'), new Date('2026-02-15'));
});

test('addInterval clamps month-end (date-fns addMonths parity)', () => {
  assert.deepStrictEqual(addInterval(new Date('2026-01-31'), 1, 'month'), new Date('2026-02-28'));
});

test('computeWorkingLifecycle: shelf + frequency, both under parent', () => {
  const { exp, frequencyDue } = computeWorkingLifecycle({
    withdrawnAt: new Date('2026-01-01'),
    frequency: '1/1 week',
    shelf: { value: 30, unit: 'day' },
    parentExp: new Date('2026-12-31'),
  });
  assert.deepStrictEqual(exp, new Date('2026-01-31'));        // +30 day
  assert.deepStrictEqual(frequencyDue, new Date('2026-01-08')); // +1 week
});

test('computeWorkingLifecycle: no frequency → frequencyDue null', () => {
  const { frequencyDue } = computeWorkingLifecycle({
    withdrawnAt: new Date('2026-01-01'), frequency: '', shelf: { value: 30, unit: 'day' }, parentExp: null,
  });
  assert.strictEqual(frequencyDue, null);
});

test('computeWorkingLifecycle: shelf 0 → exp = parentExp', () => {
  const { exp } = computeWorkingLifecycle({
    withdrawnAt: new Date('2026-01-01'), frequency: '1/1 week', shelf: { value: 0, unit: 'day' }, parentExp: new Date('2026-06-30'),
  });
  assert.deepStrictEqual(exp, new Date('2026-06-30'));
});

test('computeWorkingLifecycle: caps both at parentExp', () => {
  const { exp, frequencyDue } = computeWorkingLifecycle({
    withdrawnAt: new Date('2026-01-01'), frequency: '1/6 month', shelf: { value: 300, unit: 'day' }, parentExp: new Date('2026-02-01'),
  });
  assert.deepStrictEqual(exp, new Date('2026-02-01'));
  assert.deepStrictEqual(frequencyDue, new Date('2026-02-01'));
});

test('dueAtFor: วันเบิก + ช่วงความถี่', () => {
  assert.deepStrictEqual(dueAtFor(new Date('2026-01-01'), '1/1 week'), new Date('2026-01-08'));
  assert.deepStrictEqual(dueAtFor(new Date('2026-01-01'), '1/2 month'), new Date('2026-03-01'));
});

test('dueAtFor: รองรับข้อมูลเดิมที่เป็นตัวใหญ่', () => {
  assert.deepStrictEqual(dueAtFor(new Date('2026-01-01'), '1/1 Week'), new Date('2026-01-08'));
  assert.deepStrictEqual(dueAtFor(new Date('2026-01-01'), '1/1 Day'), new Date('2026-01-02'));
});

test('dueAtFor: รับ ISO string ได้', () => {
  assert.deepStrictEqual(dueAtFor('2026-01-01T00:00:00.000Z', '1/1 day'), new Date('2026-01-02'));
});

test('dueAtFor: ไม่มี/parse ไม่ได้/วันเบิกเสีย → null', () => {
  assert.strictEqual(dueAtFor(new Date('2026-01-01'), ''), null);
  assert.strictEqual(dueAtFor(new Date('2026-01-01'), 'weekly'), null);
  assert.strictEqual(dueAtFor(null, '1/1 week'), null);
  assert.strictEqual(dueAtFor('ไม่ใช่วันที่', '1/1 week'), null);
});
