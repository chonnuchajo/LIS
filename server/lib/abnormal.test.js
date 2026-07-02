const test = require('node:test');
const assert = require('node:assert');
const { isEnumAbnormal } = require('./abnormal');

test('optionOutputs: only abnormal kind is flagged', () => {
  const field = {
    type: 'enum',
    optionOutputs: {
      'ใส': { kind: 'normal' },
      'ขุ่น': { kind: 'abnormal' },
      'ตะกอน': { kind: 'text', text: 'เฝ้าระวัง' },
    },
  };
  assert.strictEqual(isEnumAbnormal(field, 'ใส'), false);
  assert.strictEqual(isEnumAbnormal(field, 'ขุ่น'), true);
  assert.strictEqual(isEnumAbnormal(field, 'ตะกอน'), false);
  assert.strictEqual(isEnumAbnormal(field, 'unknown'), false);
});

test('legacy expectedValues still works when optionOutputs absent', () => {
  const field = { type: 'enum', expectedValues: ['ดี'] };
  assert.strictEqual(isEnumAbnormal(field, 'ดี'), false);
  assert.strictEqual(isEnumAbnormal(field, 'แย่'), true);
  assert.strictEqual(isEnumAbnormal(field, ''), false);
});

test('optionOutputs as a Map exercises the .get branch', () => {
  const field = {
    type: 'enum',
    optionOutputs: new Map([
      ['ใส', { kind: 'normal' }],
      ['ขุ่น', { kind: 'abnormal' }],
    ]),
  };
  assert.strictEqual(isEnumAbnormal(field, 'ขุ่น'), true);
  assert.strictEqual(isEnumAbnormal(field, 'ใส'), false);
  assert.strictEqual(isEnumAbnormal(field, 'unknown'), false);
});
