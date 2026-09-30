const test = require('node:test');
const assert = require('node:assert/strict');
const { validateAdditionalSampleInput, pendingAdditionalSamples, requiredSampleRoundId, additionalSampleCompletionError, validateSampleScan, requesterAudience } = require('./additionalSamples');

const petition = { status: 'inProgress', qcReceivedAt: new Date(), labReceivedAt: new Date(), submittedBy: { department: 'FG' }, items: [{ seq: 1, sampleName: 'A', batchNo: 'B-1', sendToLab: true }] };
const input = { side: 'qc', reason: 'ตัวอย่างไม่ผ่าน', items: [{ itemSeq: 1, quantity: 2 }] };
const round = { _id: 'round-1', qrCode: 'LIS-EXTRA-test', side: 'qc', status: 'requested', items: input.items, previousResults: [{ itemSeq: 1, parameterId: 'p1', values: { result: 3 } }] };

test('request validates received side, open petition, reason, unique selected items and integer quantity', () => {
  assert.equal(validateAdditionalSampleInput(petition, input), null);
  for (const change of [{ side: 'other' }, { reason: '' }, { reason: ' '.repeat(3) }, { items: [] }, { items: [{ itemSeq: 9, quantity: 1 }] }, { items: [{ itemSeq: 1, quantity: 0 }] }, { items: [{ itemSeq: 1, quantity: 1.5 }] }, { items: [input.items[0], input.items[0]] }]) assert.ok(validateAdditionalSampleInput(petition, { ...input, ...change }));
  assert.ok(validateAdditionalSampleInput({ ...petition, qcReceivedAt: null }, input));
  assert.ok(validateAdditionalSampleInput({ ...petition, status: 'approved' }, input));
  assert.ok(validateAdditionalSampleInput({ ...petition, additionalSampleRequests: [round] }, input));
  assert.equal(validateAdditionalSampleInput({ ...petition, additionalSampleRequests: [{ ...round, side: 'lab' }] }, input), null);
});

test('pending rounds prevent closure but do not stop unaffected side completing', () => {
  const waiting = { ...petition, additionalSampleRequests: [round] };
  assert.equal(pendingAdditionalSamples(waiting).length, 1);
  assert.ok(additionalSampleCompletionError(waiting, 'qc', []));
  assert.equal(additionalSampleCompletionError(waiting, 'lab', []), null);
});

test('received round requires newly recorded results and preserves unrequested item scope', () => {
  const received = { ...petition, additionalSampleRequests: [{ ...round, status: 'received' }] };
  assert.equal(requiredSampleRoundId(received, 'qc', 1), 'round-1');
  assert.equal(requiredSampleRoundId(received, 'lab', 1), '');
  assert.equal(requiredSampleRoundId(received, 'qc', 2), '');
  assert.ok(additionalSampleCompletionError(received, 'qc', round.previousResults));
  assert.equal(additionalSampleCompletionError(received, 'qc', [{ ...round.previousResults[0], sampleRoundId: 'round-1' }]), null);
  assert.ok(additionalSampleCompletionError(received, 'qc', [{ itemSeq: 1, parameterId: 'p1', sampleRoundId: 'round-1', values: {} }]));
});

test('newer rounds supersede only their own side and items', () => {
  const rounds = [{ ...round, status: 'received' }, { ...round, _id: 'round-2', status: 'received', side: 'lab' }, { ...round, _id: 'round-3', status: 'received' }];
  assert.equal(requiredSampleRoundId({ ...petition, additionalSampleRequests: rounds }, 'qc', 1), 'round-3');
  assert.equal(requiredSampleRoundId({ ...petition, additionalSampleRequests: rounds }, 'lab', 1), 'round-2');
});

test('extra QR rejects old code, wrong side, repeated arrival and stale round', () => {
  assert.equal(validateSampleScan(round, 'LIS-EXTRA-test', 'qc', 'receive'), null);
  assert.ok(validateSampleScan(round, 'original-petition', 'qc', 'receive'));
  assert.ok(validateSampleScan(round, 'LIS-EXTRA-test', 'lab', 'receive'));
  assert.ok(validateSampleScan({ ...round, status: 'received' }, 'LIS-EXTRA-test', 'qc', 'receive'));
  assert.ok(validateSampleScan({ ...round, status: 'sent' }, 'LIS-EXTRA-test', 'qc', 'deliver'));
  assert.ok(validateSampleScan(null, 'LIS-EXTRA-test', 'qc', 'receive'));
});

test('department derives from requester instead of generic production form', () => {
  assert.equal(requesterAudience({ dept: 'production', submittedBy: { department: 'R & D' } }), 'rd');
  assert.equal(requesterAudience({ dept: 'production', submittedBy: { department: 'FG' } }), 'fg');
});

test('fresh completion requires all previously filled fields, phases and entries', () => {
  const previous = { itemSeq: 1, parameterId: 'p1', values: { first: 0, second: 2 }, valuesPhase2: { first: 4 }, entries: [{ measured: 3 }] };
  const received = { ...petition, additionalSampleRequests: [{ ...round, status: 'received', previousResults: [previous] }] };
  const current = { ...previous, sampleRoundId: 'round-1' };
  assert.equal(additionalSampleCompletionError(received, 'qc', [current]), null);
  for (const changes of [{ values: { first: 1 } }, { valuesPhase2: {} }, { entries: [] }, { entries: [{ measured: '' }] }, { values: { first: [], second: 1 } }]) {
    assert.ok(additionalSampleCompletionError(received, 'qc', [{ ...current, ...changes }]));
  }
});

test('received rounds with a new running timer cannot finish from Phase 1 alone', () => {
  const received = { ...petition, additionalSampleRequests: [{ ...round, status: 'received', currentPhase: 1, phase2DueAt: new Date('2099-01-01T00:00:00Z') }] };
  assert.ok(additionalSampleCompletionError(received, 'qc', [{ ...round.previousResults[0], sampleRoundId: 'round-1' }]));
});

test('empty optional placeholders in the snapshot do not become new required results', () => {
  const received = { ...petition, additionalSampleRequests: [{ ...round, status: 'received', previousResults: [...round.previousResults, { itemSeq: 1, parameterId: 'optional', values: {}, entries: [{}] }] }] };
  assert.equal(additionalSampleCompletionError(received, 'qc', [{ ...round.previousResults[0], sampleRoundId: 'round-1' }]), null);
});
