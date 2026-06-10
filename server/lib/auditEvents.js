// ตัดสินใจว่า QC field-write หนึ่งครั้งควร log audit event อะไร (log ทุก field)
// - existingFieldValue: ค่าเดิมของ fieldLabel นี้ "ก่อน" เขียน (undefined ถ้า field/doc ยังไม่มี)
// คืน 'resultUpdated' ถ้า field นี้เคยมีค่าอยู่แล้ว, ไม่งั้น 'resultEntered'
function qcResultAuditEvent({ existingFieldValue }) {
  if (existingFieldValue != null && existingFieldValue !== '') return 'resultUpdated';
  return 'resultEntered';
}

// สร้างข้อความ note ระดับ field (โชว์ ชื่อพารามิเตอร์ › ชื่อ field, ไม่ใส่ตัวเลขค่าตาม design)
function qcResultNote(event, { parameterName, parameterId, fieldLabel, sampleName } = {}) {
  const name = parameterName || parameterId || '';
  const verb = event === 'resultEntered' ? 'QC ใส่ค่า' : 'QC แก้ค่า';
  const target = fieldLabel ? `${name} › ${fieldLabel}` : name;
  return `${verb} ${target}${sampleName ? ` (${sampleName})` : ''}`.trim();
}

module.exports = { qcResultAuditEvent, qcResultNote };
