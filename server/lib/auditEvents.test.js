const test = require('node:test');
const assert = require('node:assert');
const { qcResultAuditEvent, qcResultNote } = require('./auditEvents');

test('qcResultAuditEvent: doc ใหม่ → resultEntered', () => {
  assert.strictEqual(
    qcResultAuditEvent({ isNew: true, existingFieldValue: undefined }),
    'resultEntered',
  );
});

test('qcResultAuditEvent: แก้ field ที่เคยมีค่า → resultUpdated', () => {
  assert.strictEqual(
    qcResultAuditEvent({ isNew: false, existingFieldValue: '7.2' }),
    'resultUpdated',
  );
});

test('qcResultAuditEvent: เติม field ว่างในพารามิเตอร์เดิม → null (ไม่ log)', () => {
  assert.strictEqual(
    qcResultAuditEvent({ isNew: false, existingFieldValue: undefined }),
    null,
  );
  assert.strictEqual(
    qcResultAuditEvent({ isNew: false, existingFieldValue: '' }),
    null,
  );
});

test('qcResultAuditEvent: ค่าเดิมเป็นเลข 0 ถือว่ามีค่า → resultUpdated', () => {
  assert.strictEqual(
    qcResultAuditEvent({ isNew: false, existingFieldValue: 0 }),
    'resultUpdated',
  );
});

test('qcResultNote: entered มีชื่อพารามิเตอร์ + sample', () => {
  assert.strictEqual(
    qcResultNote('resultEntered', { parameterName: 'pH', sampleName: 'SP-001' }),
    'QC ใส่ค่า pH (SP-001)',
  );
});

test('qcResultNote: updated ไม่มี sampleName', () => {
  assert.strictEqual(
    qcResultNote('resultUpdated', { parameterName: 'ความหนาแน่น' }),
    'QC แก้ค่า ความหนาแน่น',
  );
});

test('qcResultNote: ไม่มี parameterName ใช้ parameterId แทน', () => {
  assert.strictEqual(
    qcResultNote('resultEntered', { parameterId: 'abc123', sampleName: '' }),
    'QC ใส่ค่า abc123',
  );
});
