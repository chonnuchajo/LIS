const test = require('node:test');
const assert = require('node:assert');
const { findGroupForBackfill, findOrphanBackfillPaths } = require('./accessGroups');

// Root cause regression guard for the "can't move Simple Method between groups"
// bug: ensureGroups() used to force /simple-method (+ /machines) back into the
// 'stock' group on every request, so any regrouping snapped back on reload.
// The backfill must only target pages that no group claims yet.

test('backfills pages that no group claims yet (legacy DB)', () => {
  const groups = [{ id: 'stock', paths: ['/stock'] }];
  assert.deepStrictEqual(findOrphanBackfillPaths(groups), [
    '/simple-method',
    '/machines',
  ]);
});

test('does NOT re-flag a page once an admin moved it to another group', () => {
  const groups = [
    { id: 'stock', paths: ['/stock'] },
    { id: 'inventory', paths: ['/simple-method'] }, // admin moved it here
  ];
  // /simple-method is already claimed → must not be forced back into 'stock'.
  assert.deepStrictEqual(findOrphanBackfillPaths(groups), ['/machines']);
});

test('flags nothing when every page already has a home', () => {
  const groups = [{ id: 'stock', paths: ['/simple-method', '/machines'] }];
  assert.deepStrictEqual(findOrphanBackfillPaths(groups), []);
});

test('tolerates groups with missing or null paths arrays', () => {
  const groups = [{ id: 'others' }, { id: 'stock', paths: null }];
  assert.deepStrictEqual(findOrphanBackfillPaths(groups), [
    '/simple-method',
    '/machines',
  ]);
});

test('findOrphanBackfillPaths detects petition timeline paths only when unclaimed', () => {
  const groups = [{ id: 'samples', paths: ['/petitions'] }];
  assert.deepStrictEqual(findOrphanBackfillPaths(groups, ['/petition-timeline', '/petition-timeline/:id']), [
    '/petition-timeline',
    '/petition-timeline/:id',
  ]);
});

test('findOrphanBackfillPaths adds only the missing timeline detail path', () => {
  const groups = [{ id: 'samples', paths: ['/petition-timeline'] }];
  assert.deepStrictEqual(findOrphanBackfillPaths(groups, ['/petition-timeline', '/petition-timeline/:id']), [
    '/petition-timeline/:id',
  ]);
});

test('findGroupForBackfill prefers the anchor path owner and falls back to a group id', () => {
  const groups = [
    { id: 'legacy-home', paths: ['/home', '/petitions'] },
    { id: 'stock', paths: ['/stock'] },
    { id: 'samples', paths: ['/physical-inspection'] },
  ];
  assert.strictEqual(findGroupForBackfill(groups, 'samples', '/petitions'), 'legacy-home');
  assert.strictEqual(findGroupForBackfill(groups, 'stock', '/missing-anchor'), 'stock');
});
