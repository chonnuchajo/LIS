const test = require('node:test');
const assert = require('node:assert');
const Parameter = require('./Parameter');

function build(optionOutputs, options = ['ใส', 'ขุ่น']) {
  return new Parameter({
    name: 'ทดสอบ',
    valueFields: [{ label: 'ลักษณะ', type: 'enum', options, optionOutputs }],
  });
}

test('accepts a valid optionOutputs map', async () => {
  const doc = build({ 'ใส': { kind: 'normal' }, 'ขุ่น': { kind: 'abnormal' } });
  await doc.validate(); // must not throw
  assert.strictEqual(doc.valueFields[0].optionOutputs.get('ขุ่น').kind, 'abnormal');
});

test('drops orphan keys not present in options', async () => {
  const doc = build({ 'ใส': { kind: 'normal' }, 'ghost': { kind: 'abnormal' } });
  await doc.validate();
  assert.strictEqual(doc.valueFields[0].optionOutputs.has('ghost'), false);
  assert.strictEqual(doc.valueFields[0].optionOutputs.has('ใส'), true);
});

test('rejects text kind with blank text', async () => {
  const doc = build({ 'ใส': { kind: 'text', text: '  ' }, 'ขุ่น': { kind: 'normal' } });
  await assert.rejects(() => doc.validate(), /ข้อความ/);
});

test('rejects an invalid kind', async () => {
  const doc = build({ 'ใส': { kind: 'bogus' } });
  await assert.rejects(() => doc.validate());
});

test('collapses an all-orphan optionOutputs map to undefined (legacy fallback)', async () => {
  const doc = build({ 'ghost': { kind: 'abnormal' } }, ['ใส', 'ขุ่น']);
  await doc.validate();
  assert.ok(!doc.valueFields[0].optionOutputs || doc.valueFields[0].optionOutputs.size === 0
    ? doc.valueFields[0].optionOutputs == null
    : false, 'all-orphan map should collapse to undefined');
});

test('persists substanceMode + substanceStandards (not stripped by strict mode)', () => {
  const doc = new Parameter({
    name: 'ทดสอบสาร',
    valueFields: [{
      label: 'AI content', type: 'number', unit: 'g/L',
      substanceMode: true,
      substanceStandards: [{ substance: 'ABAMECTIN', operator: 'gte', value: 1.8, value2: null }],
    }],
  });
  const f = doc.valueFields[0];
  assert.strictEqual(f.substanceMode, true);
  assert.strictEqual(f.substanceStandards.length, 1);
  assert.strictEqual(f.substanceStandards[0].substance, 'ABAMECTIN');
  assert.strictEqual(f.substanceStandards[0].operator, 'gte');
  assert.strictEqual(f.substanceStandards[0].value, 1.8);
});

test('persists conditionalMode + conditionalStandards incl nested conditions (string & numeric values)', () => {
  const doc = new Parameter({
    name: 'ทดสอบเงื่อนไข',
    valueFields: [{
      label: 'ความหนืด', type: 'number', unit: 'cP',
      conditionalMode: true,
      conditionalStandards: [{
        label: 'ก้อนใหญ่',
        conditions: [
          { sourceParameterId: null, sourceFieldLabel: 'ชนิดสินค้า', op: 'eq', value: 'powder' },
          { sourceParameterId: null, sourceFieldLabel: 'น้ำหนัก', op: 'gte', value: 5, value2: null },
        ],
        operator: 'between', value: 10, value2: 20,
      }],
    }],
  });
  const f = doc.valueFields[0];
  assert.strictEqual(f.conditionalMode, true);
  assert.strictEqual(f.conditionalStandards.length, 1);
  const rule = f.conditionalStandards[0];
  assert.strictEqual(rule.label, 'ก้อนใหญ่');
  assert.strictEqual(rule.operator, 'between');
  assert.strictEqual(rule.value, 10);
  assert.strictEqual(rule.value2, 20);
  assert.strictEqual(rule.conditions.length, 2);
  assert.strictEqual(rule.conditions[0].value, 'powder'); // string preserved (Mixed)
  assert.strictEqual(rule.conditions[1].value, 5);        // number preserved (Mixed)
});

test('rejects a field with both substanceMode and conditionalMode', async () => {
  const doc = new Parameter({
    name: 'ทดสอบขัดกัน',
    valueFields: [{ label: 'x', type: 'number', unit: 'g', substanceMode: true, conditionalMode: true }],
  });
  await assert.rejects(() => doc.validate());
});

test('rejects multiple + substanceMode', async () => {
  const doc = new Parameter({
    name: 'ทดสอบ multiple',
    valueFields: [{ label: 'x', type: 'number', unit: 'g', multiple: true, substanceMode: true }],
  });
  await assert.rejects(() => doc.validate(), /กรอกหลายค่า/);
});

test('persists conditionalResult=output with outputText/outputKind', async () => {
  const doc = new Parameter({
    name: 'ทดสอบ output',
    valueFields: [{
      label: 'ขนาดก้อน', type: 'number', unit: 'mm',
      conditionalMode: true, conditionalResult: 'output',
      conditionalStandards: [
        { label: 'เล็ก', conditions: [{ sourceFieldLabel: 'ขนาดก้อน', op: 'between', value: 5.5, value2: 6.5 }], outputText: 'ก้อนเล็ก', outputKind: 'normal' },
        { label: 'ใหญ่', conditions: [{ sourceFieldLabel: 'ขนาดก้อน', op: 'between', value: 23.5, value2: 26 }], outputText: 'ก้อนใหญ่', outputKind: 'abnormal' },
      ],
    }],
  });
  await doc.validate();
  assert.strictEqual(doc.valueFields[0].conditionalResult, 'output');
  assert.strictEqual(doc.valueFields[0].conditionalStandards[0].outputText, 'ก้อนเล็ก');
  assert.strictEqual(doc.valueFields[0].conditionalStandards[1].outputKind, 'abnormal');
});

test('defaults conditionalResult to standard', async () => {
  const doc = new Parameter({
    name: 'ทดสอบ default',
    valueFields: [{ label: 'ค่า', type: 'number', unit: '%', conditionalMode: true, conditionalStandards: [] }],
  });
  await doc.validate();
  assert.strictEqual(doc.valueFields[0].conditionalResult, 'standard');
});

test('rejects output rule with no text and no label', async () => {
  const doc = new Parameter({
    name: 'ทดสอบ blank',
    valueFields: [{
      label: 'ค่า', type: 'number', unit: '%',
      conditionalMode: true, conditionalResult: 'output',
      conditionalStandards: [{ label: '', conditions: [], outputText: '', outputKind: 'normal' }],
    }],
  });
  await assert.rejects(() => doc.validate(), /ข้อความผลลัพธ์/);
});

test('rejects output mode combined with multiple', async () => {
  const doc = new Parameter({
    name: 'ทดสอบ multiple',
    valueFields: [{
      label: 'ค่า', type: 'number', unit: '%', multiple: true,
      conditionalMode: true, conditionalResult: 'output',
      conditionalStandards: [{ label: 'ok', conditions: [], outputText: 'ok', outputKind: 'normal' }],
    }],
  });
  await assert.rejects(() => doc.validate(), /กรอกหลายค่า/);
});

test('persists labelToleranceMode + labelToleranceStandards (not stripped by strict mode)', () => {
  const doc = new Parameter({
    name: 'ทดสอบ %สาร',
    valueFields: [{
      label: '%w/v', type: 'number', unit: '%',
      labelToleranceMode: true,
      labelToleranceStandards: [{ substance: 'ABAMECTIN', autoPct: 2.5, headPct: 5 }],
    }],
  });
  const f = doc.valueFields[0];
  assert.strictEqual(f.labelToleranceMode, true);
  assert.strictEqual(f.labelToleranceStandards.length, 1);
  assert.strictEqual(f.labelToleranceStandards[0].substance, 'ABAMECTIN');
  assert.strictEqual(f.labelToleranceStandards[0].autoPct, 2.5);
  assert.strictEqual(f.labelToleranceStandards[0].headPct, 5);
});

test('rejects labelToleranceMode together with substanceMode (mutually exclusive)', async () => {
  const doc = new Parameter({
    name: 'x',
    valueFields: [{ label: 'v', type: 'number', unit: '%', substanceMode: true, labelToleranceMode: true }],
  });
  await assert.rejects(() => doc.validate());
});

test('rejects labelTolerance autoPct <= 0', async () => {
  const doc = new Parameter({
    name: 'x',
    valueFields: [{ label: 'v', type: 'number', unit: '%', labelToleranceMode: true,
      labelToleranceStandards: [{ substance: 'A', autoPct: 0, headPct: null }] }],
  });
  await assert.rejects(() => doc.validate(), /autoPct|มากกว่า 0/);
});

test('rejects labelTolerance headPct < autoPct', async () => {
  const doc = new Parameter({
    name: 'x',
    valueFields: [{ label: 'v', type: 'number', unit: '%', labelToleranceMode: true,
      labelToleranceStandards: [{ substance: 'A', autoPct: 5, headPct: 3 }] }],
  });
  await assert.rejects(() => doc.validate(), /headPct|หัวหน้า/);
});

test('rejects multiple + labelToleranceMode', async () => {
  const doc = new Parameter({
    name: 'x',
    valueFields: [{ label: 'v', type: 'number', unit: '%', multiple: true, labelToleranceMode: true,
      labelToleranceStandards: [{ substance: 'A', autoPct: 2, headPct: null }] }],
  });
  await assert.rejects(() => doc.validate());
});
