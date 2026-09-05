const test = require('node:test');
const assert = require('node:assert');
const { extractDensityBatch, batchMatches } = require('./densityBatch');

test('extractDensityBatch: keeps the whole Sample name value', () => {
  assert.equal(extractDensityBatch('26S-FPN5-GMP-009'), '26S-FPN5-GMP-009');
  assert.equal(extractDensityBatch('095'), '095');
  assert.equal(extractDensityBatch('PLAIN'), 'PLAIN');
  assert.equal(extractDensityBatch(''), null);
  assert.equal(extractDensityBatch(null), null);
  assert.equal(extractDensityBatch(undefined), null);
});

test('extractDensityBatch: keeps suffixes as part of the value', () => {
  assert.equal(extractDensityBatch('26S-ACT50-095 bottom'), '26S-ACT50-095 bottom');
  assert.equal(extractDensityBatch('26S-ACT50-095 TOP'), '26S-ACT50-095 TOP');
  assert.equal(extractDensityBatch('  26S-X-12  extra words '), '26S-X-12  extra words');
  assert.equal(extractDensityBatch('26S-ANF18+PPN36-008(B)'), '26S-ANF18+PPN36-008(B)');
  assert.equal(extractDensityBatch('26S-ANF18+PPN36-006(B)-2'), '26S-ANF18+PPN36-006(B)-2');
  assert.equal(extractDensityBatch('26S-OMT50-288 TOP'), '26S-OMT50-288 TOP');
});

test('batchMatches: exact or product-prefixed batch matching ignoring letter case', () => {
  assert.equal(batchMatches('26S-FPN5-GMP-009', '26S-FPN5-GMP-009'), true);
  assert.equal(batchMatches('26S-GLY48-056', '26S-Gly48-056'), true);
  assert.equal(batchMatches('B.YN2026WM201-P2', 'Pyraclostrobin 25% EC B.YN2026WM201-P2'), true);
  assert.equal(batchMatches('B.YN2026WM201', 'Pyraclostrobin 25% EC B.YN2026WM201-P2'), true);
  assert.equal(batchMatches('B.YN2026WM201', 'Pyraclostrobin 25% EC B.YN2026WM201-P1'), true);
  assert.equal(batchMatches('20260427', 'Pretilachlor30%EC 20260427-P2'), true);
  assert.equal(batchMatches('009', '26S-FPN5-GMP-009'), false);
  assert.equal(batchMatches('9', '26S-FPN5-GMP-009'), false);
  assert.equal(batchMatches('009', '009'), true);
  assert.equal(batchMatches('009', 'Product 009'), false);
  assert.equal(batchMatches('9', '009'), false);
  assert.equal(batchMatches('095', '26S-ACT50-095 bottom'), false);
  assert.equal(batchMatches('26S-ACT50-095 bottom', '26S-ACT50-095 bottom'), true);
  assert.equal(batchMatches('008', '26S-ANF18+PPN36-008(B)'), false);
  assert.equal(batchMatches('26S-ANF18+PPN36-008(B)', '26S-ANF18+PPN36-008(B)'), true);
  assert.equal(batchMatches('', '009'), false);
  assert.equal(batchMatches(null, '009'), false);
  assert.equal(batchMatches('9', '26S-X-9a'), false);
});
