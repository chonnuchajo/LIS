const test = require('node:test');
const assert = require('node:assert');
const {
  assigneeSide,
  petitionStatusText,
  audiencesForEvent,
  describeEvent,
} = require('./lineNotify');

const labItem = { batchNo: '326', sampleName: 'OMETHOATE' }; // ends in 6 → lab batch
const qcOnlyItem = { batchNo: '320', sampleName: 'FOO' };    // ends in 0 → not lab

test('assigneeSide: lab dept/position → lab, else qc', () => {
  assert.strictEqual(assigneeSide({ department: 'Lab วิเคราะห์' }), 'lab');
  assert.strictEqual(assigneeSide({ position: 'นักวิเคราะห์' }), 'lab');
  assert.strictEqual(assigneeSide({ department: 'QC' }), 'qc');
  assert.strictEqual(assigneeSide(null), null);
});

test('petitionStatusText: both tested, lab not approved → รอตรวจ', () => {
  const p = { status: 'inProgress', qcCompletedAt: 'T', labCompletedAt: 'T' };
  assert.strictEqual(petitionStatusText(p), 'รอตรวจ');
});

test('petitionStatusText: Lab tested, waiting for result → รอออกผล', () => {
  const p = { status: 'inProgress', labCompletedAt: 'T' };
  assert.strictEqual(petitionStatusText(p), 'รอออกผล');
});

test('petitionStatusText: qc only → รอส่วนอื่น', () => {
  assert.strictEqual(
    petitionStatusText({ status: 'inProgress', qcCompletedAt: 'T' }),
    'QC ตรวจครบ · รอส่วนอื่น',
  );
});

test('audiencesForEvent: created → qc only', () => {
  assert.deepStrictEqual(
    audiencesForEvent({ items: [labItem] }, { event: 'created' }),
    ['qc'],
  );
});

test('audiencesForEvent: success with lab item → qc + lab', () => {
  assert.deepStrictEqual(
    audiencesForEvent({ items: [labItem] }, { event: 'statusChanged', toStatus: 'success' }),
    ['qc', 'lab'],
  );
});

test('audiencesForEvent: success without lab item → qc only', () => {
  assert.deepStrictEqual(
    audiencesForEvent({ items: [qcOnlyItem] }, { event: 'statusChanged', toStatus: 'success' }),
    ['qc'],
  );
});

test('audiencesForEvent: success notifies the requester dept too', () => {
  assert.deepStrictEqual(
    audiencesForEvent({ dept: 'rm', items: [labItem] }, { event: 'statusChanged', toStatus: 'success' }),
    ['qc', 'lab', 'rm'],
  );
  assert.deepStrictEqual(
    audiencesForEvent({ dept: 'fg', items: [qcOnlyItem] }, { event: 'statusChanged', toStatus: 'approved' }),
    ['qc', 'fg'],
  );
});

test('audiencesForEvent: assigned routes to the assignee side', () => {
  assert.deepStrictEqual(
    audiencesForEvent(
      { items: [labItem] },
      { event: 'assigned', metadata: { assignee: { department: 'Lab' } } },
    ),
    ['lab'],
  );
});

test('audiencesForEvent: approved → qc only; unknown status → none', () => {
  assert.deepStrictEqual(
    audiencesForEvent({ items: [labItem] }, { event: 'statusChanged', toStatus: 'approved' }),
    ['qc'],
  );
  assert.deepStrictEqual(
    audiencesForEvent({ items: [labItem] }, { event: 'statusChanged', toStatus: 'inProgress' }),
    [],
  );
});

test('audiencesForEvent: updated with side → that side only, without side → none', () => {
  assert.deepStrictEqual(
    audiencesForEvent({ items: [labItem] }, { event: 'updated', metadata: { side: 'lab' } }),
    ['lab'],
  );
  assert.deepStrictEqual(
    audiencesForEvent({ items: [labItem] }, { event: 'updated', metadata: {} }),
    [],
  );
});

test('describeEvent: created builds message + audiences', () => {
  const d = describeEvent(
    { petitionNo: 'P-2606-0018', dept: 'rm', items: [labItem], submittedBy: { name: 'สมชาย' } },
    { event: 'created' },
  );
  assert.deepStrictEqual(d.audiences, ['qc']);
  assert.match(d.text, /คำขอใหม่ P-2606-0018/);
  assert.match(d.text, /สมชาย/);
});

test('describeEvent: rejected includes reason note', () => {
  const d = describeEvent(
    { petitionNo: 'P-1', items: [qcOnlyItem] },
    { event: 'statusChanged', toStatus: 'rejected', note: 'ผลไม่ผ่าน' },
  );
  assert.deepStrictEqual(d.audiences, ['qc']);
  assert.match(d.text, /ถูกส่งกลับให้แก้ไข/);
  assert.match(d.text, /ผลไม่ผ่าน/);
});

test('describeEvent: unhandled event → null', () => {
  assert.strictEqual(describeEvent({ items: [] }, { event: 'reviewed' }), null);
  assert.strictEqual(
    describeEvent({ items: [] }, { event: 'updated', metadata: { side: 'lab' } }),
    null, // no note → nothing to say
  );
});
