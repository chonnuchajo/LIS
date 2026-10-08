const test = require('node:test');
const assert = require('node:assert/strict');
const {
  batchSimilarity,
  lotSnapshot,
  physicalFromQc,
  resultRowsFromQc,
} = require('./coaErp');

test('LOT No. FGYYMMDD-NNN supplies the COA batch and production date', () => {
  assert.deepEqual(lotSnapshot('FG260902-008'), {
    lotNo: 'FG260902-008',
    batchNo: 'FG260902-008',
    productionDate: '2026-09-02',
  });
});

test('batch matching ranks the exact number first and nearby numbers above unrelated batches', () => {
  assert.equal(batchSimilarity('26S-GLY48-005', '26S-GLY48-005'), 1);
  assert.ok(batchSimilarity('26S-GLY48-005', '26S-GLY48-006') > batchSimilarity('26S-GLY48-005', '26S-OMT50-515'));
});

test('physical QC values are translated to English and preserve unknown values for review', () => {
  assert.deepEqual(physicalFromQc({ values: { 'ลักษณะ': 'ของเหลวใส', 'สี': 'สีส้ม' } }), {
    raw: 'ของเหลวใส สีส้ม',
    english: 'Clear liquid, Orange',
    complete: true,
  });
  assert.equal(physicalFromQc({ values: { 'ลักษณะ': 'ของเหลวใส', 'สี': 'สีที่ยังไม่ได้แปล' } }).complete, false);
});

test('QC results become COA rows with common-name criteria and density', () => {
  const rows = resultRowsFromQc([
    { parameterName: 'กายภาพ', values: { 'ลักษณะ': 'ของเหลวใส', 'สี': 'ขาว' }, updatedAt: '2026-09-04T03:19:13.206Z' },
    { parameterName: '%AI', values: { '%AI::glyphosate': '48.35' } },
    { parameterName: 'ค่า ถพ.', entries: [{ 'ค่าถพ.::glyphosate': 1.158 }] },
  ], 'GLYPHOSATE 48% W/V SL');
  assert.deepEqual(rows.rows.map((row) => row.testItem), ['Appearance', '%AI content', 'Density at 30°C (g/cm³)', 'Date of analysis']);
  assert.equal(rows.rows[1].result, '48.35%');
  assert.equal(rows.rows[1].criteria, '48% ± 2.40');
  assert.equal(rows.rows[2].result, '1.158');
});

test('AI results prefer the substance-specific value over a generic total', () => {
  const rows = resultRowsFromQc([
    { parameterName: '%AI', values: { '%AI': '1', '%AI::fipronil': '0.2650' } },
  ], 'FIPRONIL 0.3% GR');
  assert.equal(rows.ai.result, '0.2650%');
});
