// ตัดสินใจว่า QC field-write หนึ่งครั้งควร log audit event อะไร (หรือไม่ log)
// - isNew: QCTestResult doc ของพารามิเตอร์นี้เพิ่งถูกสร้าง (field แรกของพารามิเตอร์)
// - existingFieldValue: ค่าเดิมของ fieldLabel นี้ "ก่อน" เขียน (undefined ถ้า field/doc ยังไม่มี)
// คืน 'resultEntered' | 'resultUpdated' | null
function qcResultAuditEvent({ isNew, existingFieldValue }) {
  if (isNew) return 'resultEntered';
  if (existingFieldValue != null && existingFieldValue !== '') return 'resultUpdated';
  return null; // เติม field ว่างในพารามิเตอร์เดิม → ไม่ log (ครอบด้วย resultEntered แรกแล้ว)
}

// สร้างข้อความ note ระดับพารามิเตอร์ (ไม่ใส่ตัวเลขค่าตาม design)
function qcResultNote(event, { parameterName, parameterId, sampleName } = {}) {
  const name = parameterName || parameterId || '';
  const verb = event === 'resultEntered' ? 'QC ใส่ค่า' : 'QC แก้ค่า';
  return `${verb} ${name}${sampleName ? ` (${sampleName})` : ''}`.trim();
}

module.exports = { qcResultAuditEvent, qcResultNote };
