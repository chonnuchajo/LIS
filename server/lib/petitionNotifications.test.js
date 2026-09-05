const test = require('node:test');
const assert = require('node:assert');
const {
  bellDescribe,
  isCollapsibleDuplicate,
  isRelevant,
  levelForEvent,
  toNotification,
} = require('./petitionNotifications');

// batchNo ลงท้าย 1 หรือ 6 = งาน Lab (กติกาเดิมใน petitionStatusLog.isLabBatch)
const labItem = { batchNo: '326', sampleName: 'OMETHOATE' };
const petition = {
  _id: 'p1',
  petitionNo: 'P-2606-0018',
  dept: 'production',
  items: [labItem],
  submittedBy: { name: 'สมชาย', employeeId: 'E100', department: 'Production' },
};

test('bellDescribe: created ใช้ถ้อยคำร่วมกับ LINE และแตกบรรทัดแรกเป็น title', () => {
  const d = bellDescribe(petition, { event: 'created' });
  assert.deepStrictEqual(d.audiences, ['qc']);
  assert.strictEqual(d.title, '📋 คำขอใหม่ P-2606-0018');
  assert.match(d.message, /ผู้ยื่น: สมชาย/);
  assert.match(d.message, / · /); // หลายบรรทัดถูกรวบด้วย " · "
});

test('bellDescribe: received — LINE ไม่ส่ง แต่กระดิ่งส่ง โดยดู side จาก metadata', () => {
  const d = bellDescribe(petition, { event: 'received', metadata: { side: 'lab' } });
  assert.deepStrictEqual(d.audiences, ['lab']);
  assert.strictEqual(d.title, '📥 Lab รับตัวอย่าง P-2606-0018');
});

test('bellDescribe: received ที่ไม่มี side → null', () => {
  assert.strictEqual(bellDescribe(petition, { event: 'received', metadata: {} }), null);
});

test('bellDescribe: resultEntered ไม่มี side → ทั้งสองฝั่งที่งานนี้มี', () => {
  const d = bellDescribe(petition, { event: 'resultEntered', metadata: { parameterName: 'pH' } });
  assert.deepStrictEqual(d.audiences, ['qc', 'lab']);
  assert.strictEqual(d.title, '🧪 เริ่มบันทึกผล P-2606-0018');
  assert.strictEqual(d.message, 'pH');
});

test('bellDescribe: resultUpdated → null เสมอ (แก้ค่าทีละช่องจะเด้งรัว)', () => {
  assert.strictEqual(
    bellDescribe(petition, { event: 'resultUpdated', metadata: { side: 'qc', parameterName: 'pH' } }),
    null,
  );
});

test('bellDescribe: reviewed → null', () => {
  assert.strictEqual(bellDescribe(petition, { event: 'reviewed' }), null);
});

// Finding 3: หัวหน้า QC ส่งกลับ Lab/QC ทดสอบใหม่ — describeEvent ไม่รู้จัก (audiencesForEvent
// map ธรรมดา 'inProgress' เป็น []) จึงต้องมี bell-only fallback เอง
test('bellDescribe: statusChanged toStatus=inProgress ไม่มี metadata.returnTo (ธรรมดา) → null', () => {
  assert.strictEqual(
    bellDescribe(petition, { event: 'statusChanged', toStatus: 'inProgress' }),
    null,
  );
});

test('bellDescribe: statusChanged toStatus=inProgress + returnTo=lab → แจ้งฝั่ง lab ด้วย note เดิม', () => {
  const log = {
    event: 'statusChanged',
    toStatus: 'inProgress',
    note: 'หัวหน้า QC ส่งกลับฝั่ง Labทดสอบใหม่: กลิ่นผิดปกติ',
    metadata: { returnTo: 'lab' },
  };
  const d = bellDescribe(petition, log);
  assert.deepStrictEqual(d.audiences, ['lab']);
  assert.strictEqual(d.title, '🔁 ส่งกลับทดสอบใหม่ P-2606-0018');
  assert.strictEqual(d.message, log.note);
});

test('bellDescribe: statusChanged toStatus=inProgress + returnTo=qc → แจ้งฝั่ง qc', () => {
  const log = {
    event: 'statusChanged',
    toStatus: 'inProgress',
    note: 'หัวหน้า QC ส่งกลับฝั่ง QCทดสอบใหม่: ค่าคลาดเคลื่อน',
    metadata: { returnTo: 'qc' },
  };
  assert.deepStrictEqual(bellDescribe(petition, log).audiences, ['qc']);
});

test('bellDescribe: statusChanged toStatus=inProgress + returnTo=both → แจ้งทั้งสองฝั่งที่งานนี้มี', () => {
  const log = {
    event: 'statusChanged',
    toStatus: 'inProgress',
    note: 'หัวหน้า QC ส่งกลับทั้ง Lab และ QCทดสอบใหม่: ทวนซ้ำทั้งหมด',
    metadata: { returnTo: 'both' },
  };
  assert.deepStrictEqual(bellDescribe(petition, log).audiences, ['qc', 'lab']);
});

test('isRelevant: audience ตัดกัน → true', () => {
  const desc = { audiences: ['qc'], title: 't' };
  assert.strictEqual(isRelevant(desc, petition, { audiences: ['qc'], employeeId: 'E999' }), true);
  assert.strictEqual(isRelevant(desc, petition, { audiences: ['lab'], employeeId: 'E999' }), false);
});

test('isRelevant: งานที่ตัวเองถือ / คำขอที่ตัวเองยื่น → true แม้ audience ไม่ตรง', () => {
  const desc = { audiences: ['qc'], title: 't' };
  const assigned = { ...petition, assignedTo: { employeeId: 'E200', name: 'สมหญิง' } };
  assert.strictEqual(isRelevant(desc, assigned, { audiences: ['lab'], employeeId: 'E200' }), true);
  assert.strictEqual(isRelevant(desc, petition, { audiences: ['lab'], employeeId: 'E100' }), true);
});

test('isRelevant: ไม่มี employeeId → ไม่ผ่านทางงานตัวเอง', () => {
  const desc = { audiences: ['qc'], title: 't' };
  assert.strictEqual(isRelevant(desc, petition, { audiences: ['lab'], employeeId: '' }), false);
});

test('isRelevant: seeAll ผ่านหมด', () => {
  const desc = { audiences: ['qc'], title: 't' };
  assert.strictEqual(isRelevant(desc, petition, { audiences: [], seeAll: true }), true);
});

test('levelForEvent: rejected/success/approved/ผิดปกติ/อื่น', () => {
  assert.strictEqual(levelForEvent({ event: 'statusChanged', toStatus: 'rejected' }), 'error');
  assert.strictEqual(levelForEvent({ event: 'statusChanged', toStatus: 'success' }), 'success');
  assert.strictEqual(levelForEvent({ event: 'statusChanged', toStatus: 'approved' }), 'success');
  assert.strictEqual(levelForEvent({ event: 'updated', note: 'พบค่าผิดปกติ 2 รายการ' }), 'warning');
  assert.strictEqual(levelForEvent({ event: 'created' }), 'info');
});

test('levelForEvent: statusChanged toStatus=inProgress + returnTo → warning (ถูกสั่งให้ทำใหม่)', () => {
  assert.strictEqual(
    levelForEvent({ event: 'statusChanged', toStatus: 'inProgress', metadata: { returnTo: 'lab' } }),
    'warning',
  );
});

test('levelForEvent: statusChanged toStatus=inProgress ไม่มี returnTo → info เหมือนเดิม (ไม่ถูกรบกวน)', () => {
  assert.strictEqual(levelForEvent({ event: 'statusChanged', toStatus: 'inProgress' }), 'info');
});

test('toNotification: id = audit log id, link ชี้หน้า timeline ของคำขอ', () => {
  const log = { _id: 'log1', event: 'created', createdAt: '2026-08-01T02:00:00.000Z' };
  const desc = { audiences: ['qc'], title: 'T', message: 'M' };
  assert.deepStrictEqual(toNotification(petition, log, desc), {
    id: 'log1',
    petitionId: 'p1',
    petitionNo: 'P-2606-0018',
    event: 'created',
    fromStatus: undefined,
    toStatus: undefined,
    title: 'T',
    message: 'M',
    level: 'info',
    link: '/petition/p1',
    createdAt: '2026-08-01T02:00:00.000Z',
  });
});

test('toNotification: statusChanged approved carries final approval metadata for QR popup', () => {
  const log = {
    _id: 'log-approved',
    petitionId: 'p1',
    event: 'statusChanged',
    fromStatus: 'success',
    toStatus: 'approved',
    createdAt: '2026-08-01T02:00:00.000Z',
  };
  const desc = { audiences: ['qc', 'production'], title: 'อนุมัติแล้ว' };

  const notification = toNotification(petition, log, desc);

  assert.strictEqual(notification.petitionId, 'p1');
  assert.strictEqual(notification.event, 'statusChanged');
  assert.strictEqual(notification.fromStatus, 'success');
  assert.strictEqual(notification.toStatus, 'approved');
});

// Finding 1: resultEntered fires once per form field (qcResultAuditEvent logs every
// field), so a burst of rows for one petition must collapse to just the newest — or
// it fills the capped /notifications response and crowds out real milestones.
test('isCollapsibleDuplicate: first resultEntered for a petition → not a duplicate, marks it seen', () => {
  const seen = new Set();
  assert.strictEqual(isCollapsibleDuplicate({ event: 'resultEntered', petitionId: 'p1' }, seen), false);
  assert.ok(seen.has('p1'));
});

test('isCollapsibleDuplicate: second+ resultEntered for the same petition → duplicate', () => {
  const seen = new Set(['p1']);
  assert.strictEqual(isCollapsibleDuplicate({ event: 'resultEntered', petitionId: 'p1' }, seen), true);
});

test('isCollapsibleDuplicate: resultEntered for a different petition → not a duplicate', () => {
  const seen = new Set(['p1']);
  assert.strictEqual(isCollapsibleDuplicate({ event: 'resultEntered', petitionId: 'p2' }, seen), false);
  assert.ok(seen.has('p2'));
});

test('isCollapsibleDuplicate: non-resultEntered events are never collapsed, even for a seen petition', () => {
  const seen = new Set(['p1']);
  assert.strictEqual(
    isCollapsibleDuplicate({ event: 'statusChanged', toStatus: 'rejected', petitionId: 'p1' }, seen),
    false,
  );
});

test('isCollapsibleDuplicate: newest-first loop keeps only the first resultEntered and reaches an older rejected row', () => {
  // Simulates the exact scenario from the finding: 30 resultEntered rows for one
  // petition (newest-first) followed by an older 'rejected' row for the same petition.
  const logs = [
    ...Array.from({ length: 30 }, (_, i) => ({ event: 'resultEntered', petitionId: 'p1', seq: i })),
    { event: 'statusChanged', toStatus: 'rejected', petitionId: 'p1', seq: 30 },
  ];
  const seen = new Set();
  const survivors = logs.filter((log) => !isCollapsibleDuplicate(log, seen));
  assert.strictEqual(survivors.length, 2); // 1 newest resultEntered + the rejected row
  assert.strictEqual(survivors[0].event, 'resultEntered');
  assert.strictEqual(survivors[1].event, 'statusChanged');
});
