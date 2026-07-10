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

test('resolveLabelTolerance abs mode (BE mirror)', () => {
  const std = { substance: 'ABAMECTIN', mode: 'abs', autoAbs: 0.05, headAbs: 0.1 };
  const r = resolveLabelTolerance(std, 'ABAMECTIN 1.8% W/V EC', 1.8);
  assert.strictEqual(r.center, 1.8);
  assert.deepStrictEqual(r.autoRange, [1.75, 1.85]);
  assert.deepStrictEqual(r.headRange, [1.7, 1.9]);
  assert.strictEqual(resolveLabelTolerance(std, 'ABAMECTIN 1.8%', 1.85).status, 'pass');
  assert.strictEqual(resolveLabelTolerance(std, 'ABAMECTIN 1.8%', 1.9).status, 'review');
  assert.strictEqual(resolveLabelTolerance(std, 'ABAMECTIN 1.8%', 1.91).status, 'fail');
  assert.strictEqual(resolveLabelTolerance(std, 'ABAMECTIN 480 G/L', 1.8).status, 'none');
  assert.deepStrictEqual(resolveLabelTolerance({ ...std, autoAbs: 0 }, 'ABAMECTIN 1.8%', 1.8), {
    status: 'none',
    center: 1.8,
    autoRange: null,
    headRange: null,
  });

  const noHead = { substance: 'A', mode: 'abs', autoAbs: 0.05, headAbs: null };
  assert.strictEqual(resolveLabelTolerance(noHead, 'A 1.8%', 1.86).status, 'fail');
  assert.strictEqual(resolveLabelTolerance(noHead, 'A 1.8%', 1.8).headRange, null);

  // autoPct/headPct ค้างจากโหมด percent ต้องถูกละเลย
  const stale = { substance: 'A', mode: 'abs', autoPct: 50, headPct: 90, autoAbs: 0.05, headAbs: 0.1 };
  assert.strictEqual(resolveLabelTolerance(stale, 'A 1.8%', 1.86).status, 'review');
  assert.strictEqual(isLabelToleranceAbnormal(std, 'ABAMECTIN 1.8%', 1.86), true);
});

test('resolveLabelTolerance split mode derives pass % from head band (BE mirror)', () => {
  const std = { substance: 'A', autoMode: 'percent', headMode: 'abs', autoPct: 50, headAbs: 0.1 };
  const r = resolveLabelTolerance(std, 'A 1.8%', 1.8);
  assert.deepStrictEqual(r.autoRange, [1.75, 1.85]);
  assert.deepStrictEqual(r.headRange, [1.7, 1.9]);
  assert.strictEqual(resolveLabelTolerance(std, 'A 1.8%', 1.86).status, 'review');
});

test('resolveLabelTolerance split pass percent insets from head band edges (BE mirror)', () => {
  const std = { substance: 'A', autoMode: 'percent', headMode: 'percent', autoPct: 25, headPct: 15 };
  const r = resolveLabelTolerance(std, 'A 1%', 1);
  assert.deepStrictEqual(r.headRange, [0.85, 1.15]);
  assert.deepStrictEqual(r.autoRange, [0.8875, 1.1125]);
  assert.strictEqual(resolveLabelTolerance(std, 'A 1%', 0.8875).status, 'pass');
  assert.strictEqual(resolveLabelTolerance(std, 'A 1%', 1.1125).status, 'pass');
  assert.strictEqual(resolveLabelTolerance(std, 'A 1%', 0.88).status, 'review');
  assert.strictEqual(resolveLabelTolerance(std, 'A 1%', 1.12).status, 'review');
});

test('resolveLabelTolerance split range modes (BE mirror)', () => {
  const std = {
    substance: 'A',
    autoMode: 'range',
    headMode: 'range',
    passLow: 1.75,
    passHigh: 1.85,
    failLow: 1.7,
    failHigh: 1.9,
  };
  const r = resolveLabelTolerance(std, 'A 1.8%', 1.8);
  assert.deepStrictEqual(r.autoRange, [1.75, 1.85]);
  assert.deepStrictEqual(r.headRange, [1.7, 1.9]);
  assert.strictEqual(resolveLabelTolerance(std, 'A 1.8%', 1.85).status, 'pass');
  assert.strictEqual(resolveLabelTolerance(std, 'A 1.8%', 1.86).status, 'review');
  assert.strictEqual(resolveLabelTolerance(std, 'A 1.8%', 1.91).status, 'fail');
});

test('resolveLabelTolerance supports head-only split mode when autoMode is none (BE mirror)', () => {
  const std = { substance: 'A', autoMode: 'none', headMode: 'abs', headAbs: 0.1 };
  const r = resolveLabelTolerance(std, 'A 1.8%', 1.8);

  assert.strictEqual(r.autoRange, null);
  assert.deepStrictEqual(r.headRange, [1.7, 1.9]);
  assert.strictEqual(r.status, 'review');
  assert.strictEqual(resolveLabelTolerance(std, 'A 1.8%', 1.91).status, 'fail');
  assert.strictEqual(isLabelToleranceAbnormal(std, 'A 1.8%', 1.8), true);
});

test('resolveLabelTolerance returns none when split auto band is missing even if head band exists', () => {
  const std = { substance: 'A', autoMode: 'abs', headMode: 'abs', autoAbs: null, headAbs: 0.1 };
  const r = resolveLabelTolerance(std, 'A 1.8%', 1.8);

  assert.deepStrictEqual(r, {
    status: 'none',
    center: 1.8,
    autoRange: null,
    headRange: null,
  });
  assert.deepStrictEqual(resolveLabelTolerance(std, 'A 1.8%', 1.91), {
    status: 'none',
    center: 1.8,
    autoRange: null,
    headRange: null,
  });
});

test('resolveLabelTolerance supports auto-only split mode when headMode is none (BE mirror)', () => {
  const std = { substance: 'A', autoMode: 'abs', headMode: 'none', autoAbs: 0.05 };
  const r = resolveLabelTolerance(std, 'A 1.8%', 1.8);

  assert.deepStrictEqual(r.autoRange, [1.75, 1.85]);
  assert.strictEqual(r.headRange, null);
  assert.strictEqual(r.status, 'pass');
  assert.strictEqual(resolveLabelTolerance(std, 'A 1.8%', 1.86).status, 'fail');
});
