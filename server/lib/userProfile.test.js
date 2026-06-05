const test = require('node:test');
const assert = require('node:assert');
const { resolveHrField } = require('./userProfile');

// Root cause regression guard for the "department/position shows Unassigned" bug:
// the Microsoft sync endpoint hardcoded 'Unassigned' and never pulled real values,
// so every Microsoft user's แผนก/ตำแหน่ง stayed 'Unassigned'. The fix syncs
// department + jobTitle from Microsoft Graph. This helper decides the value to
// persist so a fresh Graph value wins, an admin-set value is never wiped by an
// empty Graph value, and 'Unassigned' is only the last resort.

test('uses the fresh Graph value when present', () => {
  assert.strictEqual(resolveHrField('Lab/วิเคราะห์', 'Unassigned'), 'Lab/วิเคราะห์');
});

test('trims whitespace from the fresh value', () => {
  assert.strictEqual(resolveHrField('  QC  ', undefined), 'QC');
});

test('keeps the existing value when Graph returns empty (does not wipe admin edits)', () => {
  assert.strictEqual(resolveHrField('', 'Production'), 'Production');
  assert.strictEqual(resolveHrField(undefined, 'Production'), 'Production');
  assert.strictEqual(resolveHrField('   ', 'Production'), 'Production');
});

test('falls back to Unassigned only when nothing is known', () => {
  assert.strictEqual(resolveHrField('', ''), 'Unassigned');
  assert.strictEqual(resolveHrField(undefined, undefined), 'Unassigned');
  assert.strictEqual(resolveHrField(null, null), 'Unassigned');
});
