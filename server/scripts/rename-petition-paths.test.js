const test = require('node:test');
const assert = require('node:assert');
const { renamePath, renamePaths } = require('./rename-petition-paths');

test('renames the bare list path', () => {
  assert.strictEqual(renamePath('/petitions'), '/petition');
});

test('renames the timeline list + detail to /petition', () => {
  assert.strictEqual(renamePath('/petition-timeline'), '/petition');
  assert.strictEqual(renamePath('/petition-timeline/:id'), '/petition/:id');
});

test('renames /petitions sub-routes to /petitions-old', () => {
  assert.strictEqual(renamePath('/petitions/assign'), '/petitions-old/assign');
  assert.strictEqual(renamePath('/petitions/new'), '/petitions-old/new');
  assert.strictEqual(renamePath('/petitions/:id'), '/petitions-old/:id');
  assert.strictEqual(renamePath('/petitions/:id/edit'), '/petitions-old/:id/edit');
});

test('leaves group ids and unrelated paths untouched', () => {
  assert.strictEqual(renamePath('samples'), 'samples');
  assert.strictEqual(renamePath('others'), 'others');
  assert.strictEqual(renamePath('/report'), '/report');
  assert.strictEqual(renamePath('deny:/report/oee'), 'deny:/report/oee');
});

test('is idempotent (re-running does not double-rename)', () => {
  assert.strictEqual(renamePath('/petition'), '/petition');
  assert.strictEqual(renamePath('/petitions-old/:id'), '/petitions-old/:id');
  assert.strictEqual(renamePath('/petition/:id'), '/petition/:id');
});

test('renamePaths maps and dedupes preserving order', () => {
  assert.deepStrictEqual(renamePaths(['/petitions', '/petition-timeline']), ['/petition']);
  assert.deepStrictEqual(
    renamePaths(['/petitions/:id', '/petitions', '/petition-timeline/:id']),
    ['/petitions-old/:id', '/petition', '/petition/:id'],
  );
});

test('renamePaths tolerates null/undefined', () => {
  assert.deepStrictEqual(renamePaths(null), []);
  assert.deepStrictEqual(renamePaths(undefined), []);
});
