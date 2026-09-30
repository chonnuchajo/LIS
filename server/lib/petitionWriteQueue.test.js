const test = require('node:test');
const assert = require('node:assert/strict');
const { serializePetitionWrite } = require('./petitionWriteQueue');

test('writes and snapshots for one petition wait without blocking another petition', async () => {
  let release;
  const barrier = new Promise(resolve => { release = resolve; });
  const events = [];
  const handler = serializePetitionWrite(async req => {
    events.push(req.body.label);
    if (req.body.label === 'save') await barrier;
  });
  const saved = handler({ body: { petitionId: 'abc', label: 'save' } });
  const snapshot = handler({ params: { id: 'abc' }, body: { label: 'snapshot' } });
  await handler({ params: { id: 'other' }, body: { label: 'other' } });
  assert.deepEqual(events, ['save', 'other']);
  release();
  await Promise.all([saved, snapshot]);
  assert.deepEqual(events, ['save', 'other', 'snapshot']);
});

test('failed writes release queue and uppercase ObjectIds share the same queue', async () => {
  const events = [];
  const handler = serializePetitionWrite(async req => { events.push(req.body.label); if (req.body.label === 'fail') throw new Error('fail'); });
  const first = handler({ params: { id: '507F1F77BCF86CD799439011' }, body: { label: 'fail' } });
  const second = handler({ body: { petitionId: '507f1f77bcf86cd799439011', label: 'next' } });
  await assert.rejects(first, /fail/);
  await second;
  assert.deepEqual(events, ['fail', 'next']);
});
