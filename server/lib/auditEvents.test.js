const test = require('node:test');
const assert = require('node:assert');
const { qcResultAuditEvent, qcResultNote } = require('./auditEvents');

test('qcResultAuditEvent: field เคยว่าง (undefined) → resultEntered', () => {
  assert.strictEqual(
    qcResultAuditEvent({ existingFieldValue: undefined }),
    'resultEntered',
  );
});

test('qcResultAuditEvent: field เคยว่าง (empty string) → resultEntered', () => {
  assert.strictEqual(
    qcResultAuditEvent({ existingFieldValue: '' }),
    'resultEntered',
  );
});

test('qcResultAuditEvent: แก้ field ที่เคยมีค่า → resultUpdated', () => {
  assert.strictEqual(
    qcResultAuditEvent({ existingFieldValue: '7.2' }),
    'resultUpdated',
  );
});

test('qcResultAuditEvent: ค่าเดิมเป็นเลข 0 ถือว่ามีค่า → resultUpdated', () => {
  assert.strictEqual(
    qcResultAuditEvent({ existingFieldValue: 0 }),
    'resultUpdated',
  );
});

test('qcResultNote: entered โชว์ พารามิเตอร์ › field + sample', () => {
  assert.strictEqual(
    qcResultNote('resultEntered', { parameterName: 'ความหนาแน่น', fieldLabel: 'ค่าที่ 2', sampleName: 'SP-001' }),
    'QC ใส่ค่า ความหนาแน่น › ค่าที่ 2 (SP-001)',
  );
});

test('qcResultNote: updated มี field ไม่มี sampleName', () => {
  assert.strictEqual(
    qcResultNote('resultUpdated', { parameterName: 'pH', fieldLabel: 'ค่าที่ 1' }),
    'QC แก้ค่า pH › ค่าที่ 1',
  );
});

test('qcResultNote: ไม่มี fieldLabel → โชว์แค่ชื่อพารามิเตอร์', () => {
  assert.strictEqual(
    qcResultNote('resultEntered', { parameterName: 'pH', sampleName: 'SP-001' }),
    'QC ใส่ค่า pH (SP-001)',
  );
});

test('qcResultNote: ไม่มี parameterName ใช้ parameterId แทน', () => {
  assert.strictEqual(
    qcResultNote('resultEntered', { parameterId: 'abc123', fieldLabel: 'ค่าที่ 1', sampleName: '' }),
    'QC ใส่ค่า abc123 › ค่าที่ 1',
  );
});
