const test = require('node:test');
const assert = require('node:assert');
const { sortLatestDensities } = require('./resultDensitySort');

test('sortLatestDensities puts newest Date & time first', () => {
  const rows = sortLatestDensities([
    { 'Sample ID': 'old', 'Date & time': '6/12/2026 9:40 AM' },
    { 'Sample ID': 'new', 'Date & time': '6/12/2026 10:19 AM' },
  ]);

  assert.equal(rows[0]['Sample ID'], 'new');
});
