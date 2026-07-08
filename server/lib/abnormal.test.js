const test = require('node:test');
const assert = require('node:assert');
const { isEnumAbnormal, parseLabelPercent } = require('./abnormal');
const { resolveLabelTolerance, isLabelToleranceAbnormal } = require('./abnormal');

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

test('parseLabelPercent extracts percent before % sign', () => {
  assert.strictEqual(parseLabelPercent('ABAMECTIN 1.8% W/V EC'), 1.8);
  assert.strictEqual(parseLabelPercent('2,4-D 58% SL'), 58);
  assert.strictEqual(parseLabelPercent('GLYPHOSATE 480 G/L SL'), null);
  assert.strictEqual(parseLabelPercent(''), null);
});

test('resolveLabelTolerance 3-zone (BE mirror)', () => {
  const std = { substance: 'ABAMECTIN', autoPct: 2.5, headPct: 5 };
  assert.strictEqual(resolveLabelTolerance(std, 'ABAMECTIN 1%', 1.0).status, 'pass');
  assert.strictEqual(resolveLabelTolerance(std, 'ABAMECTIN 1%', 1.04).status, 'review');
  assert.strictEqual(resolveLabelTolerance(std, 'ABAMECTIN 1%', 1.2).status, 'fail');
  assert.strictEqual(resolveLabelTolerance(std, 'ABAMECTIN 480 G/L', 1.0).status, 'none');
  assert.strictEqual(isLabelToleranceAbnormal(std, 'ABAMECTIN 1%', 1.04), true);
  assert.strictEqual(isLabelToleranceAbnormal(std, 'ABAMECTIN 1%', 1.0), false);
});
