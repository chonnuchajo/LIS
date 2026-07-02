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
