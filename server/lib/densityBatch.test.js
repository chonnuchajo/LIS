const test = require('node:test');
const assert = require('node:assert');
const { extractDensityBatch, densityBatchForRow, batchMatches } = require('./densityBatch');

test('extractDensityBatch: builds the Batch column value from Sample name', () => {
  assert.equal(extractDensityBatch('26S-FPN5-GMP-009'), '26S-FPN5-GMP-009');
  assert.equal(extractDensityBatch('095'), '095');
  assert.equal(extractDensityBatch('PLAIN'), 'PLAIN');
  assert.equal(extractDensityBatch('Pyraclostrobin 25% EC B.YN2026WM201-P2'), 'B.YN2026WM201');
  assert.equal(extractDensityBatch('Acetmiprid 2.85% EC 2026061001 P2'), '2026061001');
  assert.equal(extractDensityBatch(''), null);
  assert.equal(extractDensityBatch(null), null);
  assert.equal(extractDensityBatch(undefined), null);
});

test('extractDensityBatch: strips density repeat/position suffixes from Batch', () => {
  assert.equal(extractDensityBatch('26S-ACT50-095 bottom'), '26S-ACT50-095');
  assert.equal(extractDensityBatch('26S-ACT50-095 TOP'), '26S-ACT50-095');
  assert.equal(extractDensityBatch('  26S-X-12  extra words '), '26S-X-12');
  assert.equal(extractDensityBatch('26S-ANF18+PPN36-008(B)'), '26S-ANF18+PPN36-008(B)');
  assert.equal(extractDensityBatch('26S-ANF18+PPN36-006(B)-2'), '26S-ANF18+PPN36-006(B)-2');
  assert.equal(extractDensityBatch('26S-OMT50-288 TOP'), '26S-OMT50-288');
});

test('densityBatchForRow: uses explicit Batch column before Sample name fallback', () => {
  assert.equal(densityBatchForRow({ Batch: 'B-EXPLICIT', 'Sample name': 'Sample B-FALLBACK-P1' }), 'B-EXPLICIT');
  assert.equal(densityBatchForRow({ 'Sample name': 'Pyraclostrobin 25% EC B.YN2026WM201-P2' }), 'B.YN2026WM201');
});

test('batchMatches: matches against the Batch column value ignoring letter case', () => {
  assert.equal(batchMatches('26S-FPN5-GMP-009', '26S-FPN5-GMP-009'), true);
  assert.equal(batchMatches('26S-GLY48-056', '26S-Gly48-056'), true);
  assert.equal(batchMatches('B.YN2026WM201-P2', 'Pyraclostrobin 25% EC B.YN2026WM201-P2'), true);
  assert.equal(batchMatches('B.YN2026WM201', 'Pyraclostrobin 25% EC B.YN2026WM201-P2'), true);
  assert.equal(batchMatches('B.YN2026WM201', 'Pyraclostrobin 25% EC B.YN2026WM201-P1'), true);
  assert.equal(batchMatches('YN2026WM201', 'Pyraclostrobin 25% EC B.YN2026WM201-P1'), true);
  assert.equal(batchMatches('20260427', 'Pretilachlor30%EC 20260427-P2'), true);
  assert.equal(batchMatches('26S-ACT50-095', '26S-ACT50-095 bottom'), true);
  assert.equal(batchMatches('009', '26S-FPN5-GMP-009'), false);
  assert.equal(batchMatches('9', '26S-FPN5-GMP-009'), false);
  assert.equal(batchMatches('009', '009'), true);
  assert.equal(batchMatches('9', '009'), false);
  assert.equal(batchMatches('095', '26S-ACT50-095 bottom'), false);
  assert.equal(batchMatches('26S-ACT50-095 bottom', '26S-ACT50-095 bottom'), false);
  assert.equal(batchMatches('008', '26S-ANF18+PPN36-008(B)'), false);
  assert.equal(batchMatches('26S-ANF18+PPN36-008(B)', '26S-ANF18+PPN36-008(B)'), true);
  assert.equal(batchMatches('', '009'), false);
  assert.equal(batchMatches(null, '009'), false);
  assert.equal(batchMatches('9', '26S-X-9a'), false);
});
