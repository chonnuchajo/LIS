const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCoaSnapshots } = require('./coaLifecycle');
const { buildCoaFormOptions, applyCoaFormSelections } = require('./coaForm');

const source = {
  petition: { petitionNo: 'P-1', items: [{ seq: 1, commonName: 'Glyphosate 48% SL' }] },
  selectedItemSeqs: [1],
  parameters: [
    { _id: 'ai', name: '%AI', scope: 'lab', valueFields: [{ label: '%AI', type: 'float', unit: '%' }] },
    { _id: 'physical', name: 'กายภาพ', scope: 'qc', valueFields: [{ label: 'ลักษณะ', type: 'enum' }, { label: 'สี', type: 'text' }, { label: 'รูปกายภาพ', type: 'photo' }] },
    { _id: 'density', name: 'ค่า ถพ.', scope: 'qc', valueFields: [{ label: 'ค่าถพ.', type: 'float', unit: 'g/cm3' }, { label: 'อุณหภูมิ', type: 'float', unit: 'C' }] },
  ],
  qcResults: [
    { itemSeq: 1, parameterId: 'ai', parameterName: '%AI', entries: [{ '%AI': 48.1 }, { '%AI': 48.2 }], valuesPhase2: { '%AI': 48.3 } },
    { itemSeq: 1, parameterId: 'physical', values: { 'ลักษณะ': 'ของเหลวใส', 'สี': 'สีส้ม', 'รูปกายภาพ': ['private-photo'], __note: 'private' } },
    { itemSeq: 1, parameterId: 'density', values: { 'ค่าถพ.': 1.182, 'อุณหภูมิ': 30 } },
    { itemSeq: 2, parameterId: 'ai', values: { '%AI': 99 } },
  ],
};
const options = buildCoaFormOptions(source);
const snapshots = buildCoaSnapshots(source);
const selection = {
  itemSeq: 1,
  aiKey: options.find((option) => option.result === '48.3%').key,
  appearanceKey: options.find((option) => option.kind === 'appearance').key,
  appearanceSource: 'ของเหลวใส สีส้ม',
  appearanceSpecification: 'Clear orange liquid',
  appearanceResult: 'Conform',
  densityKey: options.find((option) => option.kind === 'density').key,
};

test('offers only selected, configured AI, physical and density values with safe English suggestions', () => {
  assert.equal(options.length, 5);
  assert.ok(options.every((option) => option.itemSeq === 1));
  assert.equal(options.find((option) => option.kind === 'appearance').suggestedEnglish, 'Clear liquid, Orange');
  assert.equal(JSON.stringify(options).includes('private'), false);
  assert.equal(JSON.stringify(options).includes('อุณหภูมิ'), false);
  const changed = structuredClone(source);
  changed.qcResults[1].values['สี'] = 'สีที่ยังไม่ได้แปล';
  assert.equal(buildCoaFormOptions(changed).find((option) => option.kind === 'appearance').suggestedEnglish, '');
});

test('keeps phase-two source keys stable when more phase-one entries are added', () => {
  const changed = structuredClone(source);
  changed.qcResults[0].entries.push({ '%AI': 48.4 });
  assert.equal(buildCoaFormOptions(changed).find((option) => option.result === '48.3%').key, selection.aiKey);
});

test('does not present AI from QC or measurements with incompatible units as report values', () => {
  const changed = structuredClone(source);
  changed.parameters[0].scope = 'qc';
  changed.parameters[2].valueFields[0].unit = 'kg/m3';
  assert.deepEqual(buildCoaFormOptions(changed).map((option) => option.kind), ['appearance']);
});

test('recognizes a density parameter with a generic numeric field without selecting temperature', () => {
  const changed = structuredClone(source);
  changed.parameters[2].name = 'Density';
  changed.parameters[2].valueFields[0].label = 'Value';
  changed.qcResults[2].values = { Value: 1.182, 'อุณหภูมิ': 30 };
  assert.deepEqual(buildCoaFormOptions(changed).filter((option) => option.kind === 'density').map((option) => option.result), ['1.182']);
});

test('freezes selected database values, English appearance and matching trend without density tolerance', () => {
  const result = applyCoaFormSelections(snapshots, options, [{ ...selection, aiResult: '999' }]);
  assert.deepEqual(result.resultSnapshots, [
    { itemSeq: 1, testItem: 'Appearance', criteria: 'Clear orange liquid', result: 'Conform' },
    { itemSeq: 1, testItem: '%AI content', result: '48.3%', criteria: '48% ± 2.40', unit: '%' },
    { itemSeq: 1, testItem: 'Density at 30°C (g/cm³)', result: '1.182', criteria: '', unit: 'g/cm³' },
  ]);
  assert.equal(result.trendSnapshots[0].aiResultPercent, 48.3);
  assert.deepEqual(result.formSelections, [selection]);
  assert.equal(snapshots.resultSnapshots[0].result, '48.1');
});

test('requires complete selections, valid sources, English text and explicit physical confirmation', () => {
  for (const invalid of [undefined, [], [selection, selection], [{ ...selection, itemSeq: 2 }]]) {
    assert.throws(() => applyCoaFormSelections(snapshots, options, invalid));
  }
  for (const change of [
    { aiKey: 'not-a-source' }, { appearanceKey: 'not-a-source' }, { densityKey: 'not-a-source' },
    { appearanceSource: 'เปลี่ยนข้อมูลเอง' }, { appearanceResult: '' }, { appearanceResult: 'ผ่าน' },
    { appearanceSpecification: '' }, { appearanceSpecification: 'ของเหลวใส' }, { appearanceSpecification: 'a'.repeat(301) },
  ]) {
    assert.throws(() => applyCoaFormSelections(snapshots, options, [{ ...selection, ...change }]));
  }
});

test('preserves Not conform and allows omitting a density result', () => {
  const result = applyCoaFormSelections(snapshots, options, [{ ...selection, densityKey: '', appearanceResult: 'Not conform' }]);
  assert.equal(result.resultSnapshots[0].result, 'Not conform');
  assert.equal(result.resultSnapshots.length, 2);
});
