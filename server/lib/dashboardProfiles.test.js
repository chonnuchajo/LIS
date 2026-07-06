const test = require('node:test');
const assert = require('node:assert');
const { DASHBOARD_PROFILE_IDS, isValidProfileId } = require('./dashboardProfiles');

test('exposes the nine profile ids', () => {
  assert.deepEqual(DASHBOARD_PROFILE_IDS, [
    'admin', 'lab-analyze', 'lab-config', 'lab-head', 'lab-inventory',
    'qc-staff', 'qc-reviewer', 'qc-head', 'viewer',
  ]);
});

test('isValidProfileId accepts known ids and empty/null (unset), rejects junk', () => {
  assert.equal(isValidProfileId('qc-head'), true);
  assert.equal(isValidProfileId(''), true);      // unset allowed
  assert.equal(isValidProfileId(null), true);    // unset allowed
  assert.equal(isValidProfileId('bogus'), false);
  assert.equal(isValidProfileId(42), false);
});
