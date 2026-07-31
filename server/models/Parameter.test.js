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

test('persists productTypes and RM/FG categories on substanceStandards', async () => {
  const doc = new Parameter({
    name: 'substance selectors',
    valueFields: [{
      label: 'AI content', type: 'number', unit: '%',
      substanceMode: true,
      substanceStandards: [{
        substance: 'ABAMECTIN',
        operator: 'gte',
        value: 95,
        value2: null,
        productTypes: ['water'],
        categories: ['RM'],
      }],
    }],
  });

  await doc.validate();

  const std = doc.valueFields[0].substanceStandards[0];
  assert.deepStrictEqual(std.productTypes, ['water']);
  assert.deepStrictEqual(std.categories, ['RM']);
});

test('persists regulatoryTypes on substanceStandards', async () => {
  const doc = new Parameter({
    name: 'substance regulatory selectors',
    valueFields: [{
      label: 'AI content', type: 'number', unit: '%',
      substanceMode: true,
      substanceStandards: [{
        substance: 'CHLORFENAPYR',
        operator: 'gte',
        value: 95,
        value2: null,
        regulatoryTypes: ['GMP', 'BIO', 'LS'],
        categories: ['RM', 'FG'],
      }],
    }],
  });

  await doc.validate();

  const std = doc.valueFields[0].substanceStandards[0];
  assert.deepStrictEqual(std.regulatoryTypes, ['GMP', 'BIO', 'LS']);
  assert.deepStrictEqual(std.categories, ['RM', 'FG']);
});

test('rejects unsupported productTypes and categories on substanceStandards', async () => {
  const doc = new Parameter({
    name: 'bad substance selectors',
    valueFields: [{
      label: 'AI content', type: 'number', unit: '%',
      substanceMode: true,
      substanceStandards: [{
        substance: 'ABAMECTIN',
        operator: 'gte',
        value: 95,
        productTypes: ['gel'],
        categories: ['PACK'],
      }],
    }],
  });

  await assert.rejects(() => doc.validate(), /productTypes|categories|unsupported|ไม่รองรับ/);
});

test('rejects unsupported regulatoryTypes on substanceStandards', async () => {
  const doc = new Parameter({
    name: 'bad substance regulatory selectors',
    valueFields: [{
      label: 'AI content', type: 'number', unit: '%',
      substanceMode: true,
      substanceStandards: [{
        substance: 'CHLORFENAPYR',
        operator: 'gte',
        value: 95,
        regulatoryTypes: ['NMP'],
      }],
    }],
  });

  await assert.rejects(() => doc.validate(), /regulatoryTypes|ไม่รองรับ/);
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

test('accepts labelTolerance abs mode and persists autoAbs/headAbs', async () => {
  const doc = new Parameter({
    name: 'x',
    valueFields: [{ label: 'v', type: 'number', unit: 'g/L', labelToleranceMode: true,
      labelToleranceStandards: [{ substance: 'A', mode: 'abs', autoAbs: 0.05, headAbs: 0.1 }] }],
  });
  await doc.validate();
  const s = doc.valueFields[0].labelToleranceStandards[0];
  assert.strictEqual(s.mode, 'abs');
  assert.strictEqual(s.autoAbs, 0.05);
  assert.strictEqual(s.headAbs, 0.1);
});

test('rejects labelTolerance abs autoAbs <= 0', async () => {
  const doc = new Parameter({
    name: 'x',
    valueFields: [{ label: 'v', type: 'number', unit: '%', labelToleranceMode: true,
      labelToleranceStandards: [{ substance: 'A', mode: 'abs', autoAbs: 0, headAbs: null }] }],
  });
  await assert.rejects(() => doc.validate(), /autoAbs|มากกว่า 0/);
});

test('rejects labelTolerance abs headAbs < autoAbs', async () => {
  const doc = new Parameter({
    name: 'x',
    valueFields: [{ label: 'v', type: 'number', unit: '%', labelToleranceMode: true,
      labelToleranceStandards: [{ substance: 'A', mode: 'abs', autoAbs: 0.05, headAbs: 0.02 }] }],
  });
  await assert.rejects(() => doc.validate(), /headAbs|หัวหน้า/);
});

test('accepts split modes where pass percent is derived from head reviewer band', async () => {
  const doc = new Parameter({
    name: 'x',
    valueFields: [{ label: 'v', type: 'number', unit: '%', labelToleranceMode: true,
      labelToleranceStandards: [{ substance: 'A', autoMode: 'percent', headMode: 'abs', autoPct: 50, headAbs: 0.1 }] }],
  });
  await assert.doesNotReject(() => doc.validate());
});

test('rejects split percent pass when head reviewer band is missing', async () => {
  const doc = new Parameter({
    name: 'x',
    valueFields: [{ label: 'v', type: 'number', unit: '%', labelToleranceMode: true,
      labelToleranceStandards: [{ substance: 'A', autoMode: 'percent', autoPct: 50 }] }],
  });
  await assert.rejects(() => doc.validate(), /หัวหน้าตรวจสอบ/);
});

test('rejects split percent pass when head reviewer band is explicitly none', async () => {
  const doc = new Parameter({
    name: 'x',
    valueFields: [{ label: 'v', type: 'number', unit: '%', labelToleranceMode: true,
      labelToleranceStandards: [{ substance: 'A', autoMode: 'percent', headMode: 'none', autoPct: 50 }] }],
  });

  await assert.rejects(() => doc.validate(), /หัวหน้าตรวจสอบ|headMode|head reviewer band/);
});

test('accepts split range modes for labelTolerance pass and head bands', async () => {
  const doc = new Parameter({
    name: 'x',
    valueFields: [{ label: 'v', type: 'number', unit: '%', labelToleranceMode: true,
      labelToleranceStandards: [{
        substance: 'A',
        autoMode: 'range',
        headMode: 'range',
        passLow: 1.75,
        passHigh: 1.85,
        failLow: 1.7,
        failHigh: 1.9,
      }] }],
  });
  await assert.doesNotReject(() => doc.validate());
});

test('rejects split range pass outside head range', async () => {
  const doc = new Parameter({
    name: 'x',
    valueFields: [{ label: 'v', type: 'number', unit: '%', labelToleranceMode: true,
      labelToleranceStandards: [{
        substance: 'A',
        autoMode: 'range',
        headMode: 'range',
        passLow: 1.65,
        passHigh: 1.85,
        failLow: 1.7,
        failHigh: 1.9,
      }] }],
  });
  await assert.rejects(() => doc.validate(), /passLow/);
});

test('accepts labelTolerance autoMode none with a valid head reviewer band', async () => {
  const doc = new Parameter({
    name: 'x',
    valueFields: [{ label: 'v', type: 'number', unit: '%', labelToleranceMode: true,
      labelToleranceStandards: [{ substance: 'A', autoMode: 'none', headMode: 'abs', headAbs: 0.1 }] }],
  });

  await assert.doesNotReject(() => doc.validate());
  const s = doc.valueFields[0].labelToleranceStandards[0];
  assert.strictEqual(s.autoMode, 'none');
  assert.strictEqual(s.headMode, 'abs');
});

test('accepts labelTolerance headMode none with a valid automatic pass band', async () => {
  const doc = new Parameter({
    name: 'x',
    valueFields: [{ label: 'v', type: 'number', unit: '%', labelToleranceMode: true,
      labelToleranceStandards: [{ substance: 'A', autoMode: 'abs', headMode: 'none', autoAbs: 0.05 }] }],
  });

  await assert.doesNotReject(() => doc.validate());
  const s = doc.valueFields[0].labelToleranceStandards[0];
  assert.strictEqual(s.autoMode, 'abs');
  assert.strictEqual(s.headMode, 'none');
});

test('rejects labelTolerance when both split bands are none', async () => {
  const doc = new Parameter({
    name: 'x',
    valueFields: [{ label: 'v', type: 'number', unit: '%', labelToleranceMode: true,
      labelToleranceStandards: [{ substance: 'A', autoMode: 'none', headMode: 'none' }] }],
  });

  await assert.rejects(() => doc.validate(), /อย่างน้อยหนึ่งช่วง|usable threshold|หัวหน้าตรวจสอบ|ผ่าน/);
});

test('rejects multiple + labelToleranceMode', async () => {
  const doc = new Parameter({
    name: 'x',
    valueFields: [{ label: 'v', type: 'number', unit: '%', multiple: true, labelToleranceMode: true,
      labelToleranceStandards: [{ substance: 'A', autoPct: 2, headPct: null }] }],
  });
  await assert.rejects(() => doc.validate());
});

test('rejects labelTolerance autoMode none when head band is missing', async () => {
  const doc = new Parameter({
    name: 'x',
    valueFields: [{ label: 'v', type: 'number', unit: '%', labelToleranceMode: true,
      labelToleranceStandards: [{ substance: 'A', autoMode: 'none' }] }],
  });

  await assert.rejects(() => doc.validate(), /เธ•เนเธญเธเธ•เนเธฑเธเธเนเธงเธ|เธชเธฒเธฃ|head|usable threshold/);
});

test('rejects labelTolerance headMode none when auto band is missing', async () => {
  const doc = new Parameter({
    name: 'x',
    valueFields: [{ label: 'v', type: 'number', unit: '%', labelToleranceMode: true,
      labelToleranceStandards: [{ substance: 'A', headMode: 'none' }] }],
  });

  await assert.rejects(() => doc.validate(), /เธ•เนเธญเธเธ•เนเธฑเธเธเนเธงเธ|เธชเธฒเธฃ|auto|usable threshold/);
});

test('persists percent + productType labelTolerance rules without substance', () => {
  const doc = new Parameter({
    name: 'เปอร์เซ็นต์รวม',
    valueFields: [{
      label: '%AI', type: 'number', unit: '%', labelToleranceMode: true,
      labelToleranceStandards: [{ substance: '', labelPercent: 1, productTypes: ['water'], autoPct: 11.25, headPct: 15 }],
    }],
  });
  const f = doc.valueFields[0];
  assert.strictEqual(f.labelToleranceStandards[0].substance, '');
  assert.strictEqual(f.labelToleranceStandards[0].labelPercent, 1);
  assert.deepStrictEqual(f.labelToleranceStandards[0].productTypes, ['water']);
});

test('rejects labelTolerance rule with no selector at all', async () => {
  const doc = new Parameter({
    name: 'x',
    valueFields: [{ label: 'v', type: 'number', unit: '%', labelToleranceMode: true,
      labelToleranceStandards: [{ substance: '', autoPct: 2, headPct: null }] }],
  });
  await assert.rejects(() => doc.validate(), /อย่างน้อย 1 อย่าง/);
});

test('accepts custom range labelTolerance rule', async () => {
  const doc = new Parameter({
    name: 'x',
    valueFields: [{ label: 'v', type: 'number', unit: '%', labelToleranceMode: true,
      labelToleranceStandards: [{ substance: '', labelPercent: 0.3, productTypes: ['sand'], mode: 'range', failLow: 0.225, passLow: 0.2438, passHigh: 0.3563, failHigh: 0.375 }] }],
  });
  await assert.doesNotReject(() => doc.validate());
});

test('rejects custom range labelTolerance rule with unsorted bounds', async () => {
  const doc = new Parameter({
    name: 'x',
    valueFields: [{ label: 'v', type: 'number', unit: '%', labelToleranceMode: true,
      labelToleranceStandards: [{ substance: '', labelPercent: 0.3, productTypes: ['sand'], mode: 'range', failLow: 0.3, passLow: 0.25, passHigh: 0.3563, failHigh: 0.375 }] }],
  });
  await assert.rejects(() => doc.validate(), /failLow/);
});

test('persists master item context on substance and labelTolerance standards', async () => {
  const doc = new Parameter({
    name: 'master item context',
    valueFields: [
      {
        label: 'AI content', type: 'number', unit: '%',
        substanceMode: true,
        substanceStandards: [{
          substance: 'ABAMECTIN 1.8% EC',
          operator: 'gte',
          value: 95,
          itemNo: 'RM-001',
          packSize: '100 ml',
          masterItemName: 'ABAMECTIN A',
          masterCommonName: 'ABAMECTIN 1.8% EC',
          masterRaw: { item_no: 'RM-001', desc2: '100 ml' },
        }],
      },
      {
        label: '%AI', type: 'number', unit: '%',
        labelToleranceMode: true,
        labelToleranceStandards: [{
          substance: 'ABAMECTIN 1.8% EC',
          labelPercent: 1.8,
          autoPct: 25,
          headPct: 30,
          itemNo: 'RM-001',
          packSize: '100 ml',
          masterItemName: 'ABAMECTIN A',
          masterCommonName: 'ABAMECTIN 1.8% EC',
          masterRaw: { item_no: 'RM-001', desc2: '100 ml' },
        }],
      },
    ],
  });

  await doc.validate();

  const substanceStd = doc.valueFields[0].substanceStandards[0];
  assert.strictEqual(substanceStd.itemNo, 'RM-001');
  assert.strictEqual(substanceStd.packSize, '100 ml');
  assert.strictEqual(substanceStd.masterItemName, 'ABAMECTIN A');
  assert.strictEqual(substanceStd.masterCommonName, 'ABAMECTIN 1.8% EC');
  assert.strictEqual(substanceStd.masterRaw.item_no, 'RM-001');

  const labelStd = doc.valueFields[1].labelToleranceStandards[0];
  assert.strictEqual(labelStd.itemNo, 'RM-001');
  assert.strictEqual(labelStd.packSize, '100 ml');
  assert.strictEqual(labelStd.masterItemName, 'ABAMECTIN A');
  assert.strictEqual(labelStd.masterCommonName, 'ABAMECTIN 1.8% EC');
  assert.strictEqual(labelStd.masterRaw.item_no, 'RM-001');
});
