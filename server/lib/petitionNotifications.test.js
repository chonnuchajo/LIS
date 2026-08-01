const test = require('node:test');
const assert = require('node:assert');
const {
  bellDescribe,
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

test('toNotification: id = audit log id, link ชี้หน้า timeline ของคำขอ', () => {
  const log = { _id: 'log1', event: 'created', createdAt: '2026-08-01T02:00:00.000Z' };
  const desc = { audiences: ['qc'], title: 'T', message: 'M' };
  assert.deepStrictEqual(toNotification(petition, log, desc), {
    id: 'log1',
    petitionNo: 'P-2606-0018',
    title: 'T',
    message: 'M',
    level: 'info',
    link: '/petition/p1',
    createdAt: '2026-08-01T02:00:00.000Z',
  });
});
