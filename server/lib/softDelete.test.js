const test = require('node:test');
const assert = require('node:assert');
const {
  liveFilter,
  softDeleteValues,
  applyLiveFilter,
  QUERY_HOOKS,
  softDeletePlugin,
} = require('./softDelete');

test('liveFilter selects rows that are not deleted', () => {
  assert.deepStrictEqual(liveFilter(), { deletedAt: null });
});

test('softDeleteValues sets deletedAt to the given time and deletedBy', () => {
  const now = new Date('2026-06-08T00:00:00.000Z');
  assert.deepStrictEqual(softDeleteValues('alice', now), {
    deletedAt: now,
    deletedBy: 'alice',
  });
});

test('softDeleteValues falls back to "system" when actor is missing', () => {
  const now = new Date('2026-06-08T00:00:00.000Z');
  assert.strictEqual(softDeleteValues(undefined, now).deletedBy, 'system');
  assert.strictEqual(softDeleteValues('', now).deletedBy, 'system');
});

test('applyLiveFilter adds the not-deleted filter to a normal query', () => {
  const calls = [];
  const fakeQuery = {
    getOptions: () => ({}),
    where(cond) { calls.push(cond); return this; },
  };
  let nextCalled = false;
  applyLiveFilter.call(fakeQuery, () => { nextCalled = true; });
  assert.deepStrictEqual(calls, [{ deletedAt: null }]);
  assert.strictEqual(nextCalled, true);
});

test('applyLiveFilter skips the filter when withDeleted option is set', () => {
  const calls = [];
  const fakeQuery = {
    getOptions: () => ({ withDeleted: true }),
    where(cond) { calls.push(cond); return this; },
  };
  let nextCalled = false;
  applyLiveFilter.call(fakeQuery, () => { nextCalled = true; });
  assert.deepStrictEqual(calls, []);
  assert.strictEqual(nextCalled, true);
});

test('QUERY_HOOKS covers the read/update query types we must filter', () => {
  for (const hook of ['find', 'findOne', 'findOneAndUpdate', 'count', 'countDocuments', 'updateOne', 'updateMany']) {
    assert.ok(QUERY_HOOKS.includes(hook), `missing hook: ${hook}`);
  }
});

test('softDeletePlugin registers fields, hooks, method and static on a schema', () => {
  const registered = { hooks: [], paths: null, methods: {}, statics: {} };
  const fakeSchema = {
    add(def) { registered.paths = def; },
    pre(name) { registered.hooks.push(name); },
    methods: {},
    statics: {},
  };
  softDeletePlugin(fakeSchema);
  assert.ok(registered.paths.deletedAt, 'deletedAt path added');
  assert.ok(registered.paths.deletedBy, 'deletedBy path added');
  for (const hook of QUERY_HOOKS) {
    assert.ok(registered.hooks.includes(hook), `hook not registered: ${hook}`);
  }
  assert.strictEqual(typeof fakeSchema.methods.softDelete, 'function');
  assert.strictEqual(typeof fakeSchema.statics.softDeleteMany, 'function');
});
