const { visibleResultEntries } = require('./coaLifecycle');
const { isAiContentTestItem, aiToleranceCriteriaForCommonName } = require('./aiToleranceCriteria');

const physicalEnglish = {
  'ของเหลวใส': 'Clear liquid', 'ของเหลวขุ่น': 'Cloudy liquid', 'ของเหลวหนืด': 'Viscous liquid',
  'เม็ดทรงกระบอก': 'Cylindrical granules', 'เกล็ด': 'Flakes', 'ผงละเอียด': 'Fine powder',
  'เม็ดทราย': 'Sand granules', 'เม็ดหยาบ': 'Coarse granules', 'เม็ด': 'Granules',
  'ก้อนเล็ก': 'Small blocks', 'ก้อนใหญ่': 'Large blocks',
  'ใส': 'Clear', 'ไม่มีสี': 'Colorless', 'ใสไม่มีสี': 'Colorless',
  'ขาว': 'White', 'ดำ': 'Black', 'แดง': 'Red', 'ส้ม': 'Orange', 'เหลือง': 'Yellow',
  'เขียว': 'Green', 'ฟ้า': 'Light blue', 'น้ำเงิน': 'Blue', 'ม่วง': 'Purple',
  'ชมพู': 'Pink', 'น้ำตาล': 'Brown', 'เทา': 'Gray', 'เหลืองอ่อน': 'Pale yellow',
};

function isEnglishSpecification(value) {
  return typeof value === 'string' && /^[\x20-\x7E]{1,300}$/.test(value) && /[a-z]/i.test(value);
}

function translatedPhysical(values) {
  const translated = values.map((value) => physicalEnglish[value.replace(/^สี/, '')]
    || (isEnglishSpecification(value) ? value : ''));
  return translated.every(Boolean) ? translated.join(', ') : '';
}

function buildCoaFormOptions({ parameters, qcResults, selectedItemSeqs }) {
  const parametersById = new Map(parameters.map((parameter) => [String(parameter._id), parameter]));
  const selected = new Set(selectedItemSeqs.map(Number));
  const options = [];
  for (const result of qcResults) {
    const itemSeq = Number(result.itemSeq);
    const parameter = parametersById.get(String(result.parameterId));
    if (!selected.has(itemSeq) || !parameter) continue;
    const fields = parameter.valueFields || [];
    for (const [rowIndex, row] of visibleResultEntries(result).entries()) {
      const phase = row === result.valuesPhase2 ? 2 : 1;
      const entryIndex = phase === 2 ? 0 : rowIndex;
      const option = (field, kind, value, suggestedEnglish) => ({
        key: JSON.stringify([String(result.parameterId), itemSeq, phase, entryIndex, field]),
        itemSeq, kind, result: value, suggestedEnglish,
        label: parameter.name + ' / ' + field + ' / ขั้นที่ ' + phase + ' ชุดที่ ' + (entryIndex + 1),
      });
      if (/^(กายภาพ|appearance|physical properties)$/i.test(parameter.name || '')) {
        const values = fields.filter((field) => /^(ลักษณะ|สี|appearance|color)$/i.test(field.label))
          .map((field) => row[field.label]).filter((value) => typeof value === 'string' && value.trim())
          .map((value) => value.trim());
        if (values.length) options.push(option('Appearance', 'appearance', values.join(' '), translatedPhysical(values)));
      }
      for (const field of fields) {
        if (!['number', 'float', 'integer'].includes(field.type)) continue;
        const value = row[field.label];
        if (!['number', 'string'].includes(typeof value) || !String(value).trim()) continue;
        const text = String(value).trim();
        if (!Number.isFinite(Number(text.replace(/%$/, '').replace(/,/g, '').trim()))) continue;
        const numericFields = fields.filter((entry) => ['number', 'float', 'integer'].includes(entry.type));
        if (parameter.scope === 'lab' && field.unit === '%' && (isAiContentTestItem(field.label)
          || (isAiContentTestItem(parameter.name) && numericFields.length === 1))) {
          options.push(option(field.label, 'ai', field.unit === '%' && !text.endsWith('%') ? text + '%' : text));
        } else if (/density|ถ\.?\s*พ\.?/i.test(field.label + ' ' + parameter.name) && /^g\/(cm3|cm³|ml)$/i.test(field.unit || '')) {
          options.push(option(field.label, 'density', text));
        }
      }
    }
  }
  return options;
}

function applyCoaFormSelections(snapshots, options, selections) {
  if (!Array.isArray(selections) || selections.length !== snapshots.sampleSnapshots.length
    || new Set(selections.map((selection) => selection?.itemSeq)).size !== selections.length) {
    throw new Error('ต้องเลือกข้อมูล COA ให้ครบทุกตัวอย่างและไม่ซ้ำกัน');
  }
  const results = [];
  const formSelections = [];
  for (const sample of snapshots.sampleSnapshots) {
    const selection = selections.find((entry) => entry?.itemSeq === sample.itemSeq);
    if (!selection || !sample.commonName?.trim()) throw new Error('ไม่พบชื่อสามัญหรือข้อมูลตัวอย่างที่เลือก');
    const find = (kind, key) => options.find((option) => option.itemSeq === sample.itemSeq && option.kind === kind && option.key === key);
    const ai = find('ai', selection.aiKey);
    const appearance = find('appearance', selection.appearanceKey);
    const density = selection.densityKey ? find('density', selection.densityKey) : null;
    if (!ai || !appearance || (selection.densityKey && !density)) throw new Error('ผลพารามิเตอร์ที่เลือกไม่ถูกต้อง กรุณาโหลดข้อมูลใหม่');
    if (appearance.result !== selection.appearanceSource) throw new Error('ผลกายภาพเปลี่ยนแล้ว กรุณาตรวจ Specification ใหม่');
    const specification = typeof selection.appearanceSpecification === 'string' ? selection.appearanceSpecification.trim() : '';
    if (!isEnglishSpecification(specification)) throw new Error('กรอก Specification ภาษาอังกฤษ ไม่เกิน 300 ตัวอักษร');
    if (!['Conform', 'Not conform'].includes(selection.appearanceResult)) throw new Error('กรุณายืนยันผลกายภาพ Conform หรือ Not conform');
    formSelections.push({
      itemSeq: sample.itemSeq, aiKey: ai.key, appearanceKey: appearance.key,
      appearanceSource: appearance.result, appearanceSpecification: specification,
      appearanceResult: selection.appearanceResult, densityKey: density?.key || '',
    });
    results.push(
      { itemSeq: sample.itemSeq, testItem: 'Appearance', criteria: specification, result: selection.appearanceResult },
      { itemSeq: sample.itemSeq, testItem: '%AI content', result: ai.result, criteria: aiToleranceCriteriaForCommonName(sample.commonName) || '-', unit: '%' },
    );
    if (density) results.push({ itemSeq: sample.itemSeq, testItem: 'Density at 30°C (g/cm³)', result: density.result, criteria: '', unit: 'g/cm³' });
  }
  results.push(...snapshots.resultSnapshots.filter((row) => /date\s*of\s*analysis|wax\s*block\s*size/i.test(row.testItem || '')));
  return {
    ...snapshots,
    formSelections,
    resultSnapshots: results,
    trendSnapshots: snapshots.trendSnapshots.map((trend) => {
      const ai = results.find((row) => row.itemSeq === trend.itemSeq && isAiContentTestItem(row.testItem));
      return { ...trend, aiResultText: ai.result, aiResultPercent: Number.parseFloat(ai.result.replace(/,/g, '')) };
    }),
  };
}

module.exports = { buildCoaFormOptions, applyCoaFormSelections };
