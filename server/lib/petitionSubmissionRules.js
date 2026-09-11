function isResearchAndDevelopmentDepartment(department) {
  return String(department || '').replace(/\s+/g, '').toLowerCase() === 'r&d';
}

function requiresDeliveryAndBatch(body) {
  return !isResearchAndDevelopmentDepartment(body?.submittedBy?.department);
}

function requiresQcTrack(petition) {
  return !isResearchAndDevelopmentDepartment(petition?.submittedBy?.department);
}

function isLabBatchNo(batchNo) {
  return /[16]$/.test(String(batchNo ?? '').trim());
}

function defaultSendItemToLab(item) {
  return isLabBatchNo(item?.batchNo);
}

function hasSendToLabOverride(item) {
  if (!item || typeof item.sendToLab !== 'boolean') return false;
  return item.sendToLab !== defaultSendItemToLab(item);
}

function labSendOverrideNoteError(items) {
  const missing = (items || []).find((item) => hasSendToLabOverride(item) && !String(item.note ?? '').trim());
  if (!missing) return null;
  const label = missing.seq ? `ลำดับ ${missing.seq}` : missing.sampleName || String(missing.batchNo ?? '').trim() || 'นี้';
  return `ตัวอย่าง${label}: กรุณาระบุหมายเหตุเมื่อเลือกส่ง LAB ต่างจากค่าเริ่มต้น`;
}

function normalizePetitionItems(items, { department, petitionNo } = {}) {
  const isResearchRequest = isResearchAndDevelopmentDepartment(department);
  return (items || []).map((item) => ({
    ...item,
    submissionNo: String(item.submissionNo ?? '').trim() || petitionNo,
    sendToLab: isResearchRequest
      ? true
      : (typeof item.sendToLab === 'boolean' ? item.sendToLab : defaultSendItemToLab(item)),
  }));
}

function validatePetitionSubmission(body) {
  if (!body.dept || !['production', 'rm', 'fg'].includes(body.dept)) {
    return 'กรุณาระบุแผนก (production / rm / fg)';
  }
  if (!body.submittedBy?.name) {
    return 'กรุณาระบุผู้ยื่นคำขอ';
  }
  const needsDeliveryAndBatch = requiresDeliveryAndBatch(body);
  if (needsDeliveryAndBatch && !body.deliveredBy?.name) {
    return 'กรุณาระบุผู้นำส่ง';
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return 'ต้องมีตัวอย่างอย่างน้อย 1 รายการ';
  }
  if (needsDeliveryAndBatch) {
    for (const item of body.items) {
      const batch = String(item.batchNo || '').trim();
      if (!batch) return `ตัวอย่าง "${item.sampleName || item.seq}": กรุณากรอกเลขแบช`;
    }
  }
  const overrideNoteError = labSendOverrideNoteError(body.items);
  if (overrideNoteError) return overrideNoteError;
  return null;
}

module.exports = {
  defaultSendItemToLab,
  hasSendToLabOverride,
  isResearchAndDevelopmentDepartment,
  isLabBatchNo,
  labSendOverrideNoteError,
  normalizePetitionItems,
  requiresDeliveryAndBatch,
  requiresQcTrack,
  validatePetitionSubmission,
};
