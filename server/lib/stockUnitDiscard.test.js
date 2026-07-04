const test = require('node:test');
const assert = require('node:assert');
const { resolveCascadeRootId, selectDiscardTargets } = require('./stockUnitDiscard');

test('resolveCascadeRootId: working → parentId', () => {
  assert.strictEqual(resolveCascadeRootId({ _id: 'w1', kind: 'working', parentId: 'p1' }), 'p1');
});
test('resolveCascadeRootId: sealed → own _id', () => {
  assert.strictEqual(resolveCascadeRootId({ _id: 's1', kind: 'sealed', parentId: null }), 's1');
});
test('resolveCascadeRootId: working ไม่มี parent → own _id', () => {
  assert.strictEqual(resolveCascadeRootId({ _id: 'w9', kind: 'working', parentId: null }), 'w9');
});

test('selectDiscardTargets: root + children ที่ยังไม่ทิ้ง', () => {
  const root = { _id: 'p1', status: 'active', qrId: 'a' };
  const children = [
    { _id: 'w1', status: 'active', qrId: 'b' },
    { _id: 'w2', status: 'discarded', qrId: 'c' },
    { _id: 'w3', status: 'empty', qrId: 'd' },
  ];
  const out = selectDiscardTargets({ root, children });
  assert.deepStrictEqual(out.map((u) => u.qrId), ['a', 'b', 'd']); // ตัด discarded ออก
});

test('selectDiscardTargets: root null (ถูกทิ้งไปแล้ว) → เฉพาะ children', () => {
  const out = selectDiscardTargets({ root: { _id: 'p', status: 'discarded', qrId: 'x' }, children: [{ _id: 'w', status: 'active', qrId: 'y' }] });
  assert.deepStrictEqual(out.map((u) => u.qrId), ['y']);
});
