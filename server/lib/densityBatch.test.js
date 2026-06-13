const test = require('node:test');
const assert = require('node:assert');
const { extractDensityBatch, batchMatches } = require('./densityBatch');

test('extractDensityBatch: trailing segment after last dash', () => {
  assert.equal(extractDensityBatch('26S-FPN5-GMP-009'), '009');
  assert.equal(extractDensityBatch('26S-ACT50-095 bottom'), '095');
  assert.equal(extractDensityBatch('26S-ACT50-095 TOP'), '095');
  assert.equal(extractDensityBatch('PLAIN'), 'PLAIN');
  assert.equal(extractDensityBatch('  26S-X-12  extra words '), '12');
  assert.equal(extractDensityBatch(''), null);
  assert.equal(extractDensityBatch(null), null);
  assert.equal(extractDensityBatch(undefined), null);
});

test('extractDensityBatch: strips (paren), trailing -N and position suffixes', () => {
  assert.equal(extractDensityBatch('26S-ANF18+PPN36-008(B)'), '008');    // (B) layer suffix
  assert.equal(extractDensityBatch('26S-ANF18+PPN36-006(B)-2'), '006');  // (B)-2 re-sample suffix
  assert.equal(extractDensityBatch('26S-OMT50-288 TOP'), '288');         // space position suffix
});

test('batchMatches: matches across (paren)/suffix sample names', () => {
  assert.equal(batchMatches('008', '26S-ANF18+PPN36-008(B)'), true);
  assert.equal(batchMatches('006', '26S-ANF18+PPN36-006(B)-2'), true);
  assert.equal(batchMatches('288', '26S-OMT50-288 TOP'), true);
});

test('batchMatches: exact and numeric-equal', () => {
  assert.equal(batchMatches('009', '26S-FPN5-GMP-009'), true);
  assert.equal(batchMatches('9', '26S-FPN5-GMP-009'), true);   // 009 == 9
  assert.equal(batchMatches('009', '26S-FPN5-GMP-9'), true);
  assert.equal(batchMatches('095', '26S-ACT50-095 bottom'), true);
  assert.equal(batchMatches('10', '26S-X-009'), false);
  assert.equal(batchMatches('', '26S-X-009'), false);
  assert.equal(batchMatches(null, '26S-X-009'), false);
  assert.equal(batchMatches('009', 'NODASH'), false);          // extract 'NODASH' != '009'
  assert.equal(batchMatches('9a', '26S-X-9a'), true);          // exact string match
  assert.equal(batchMatches('9', '26S-X-9a'), false);          // not numeric-equal (9a not pure digits)
});
