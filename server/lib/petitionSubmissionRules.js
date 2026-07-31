function isResearchAndDevelopmentDepartment(department) {
  return String(department || '').replace(/\s+/g, '').toLowerCase() === 'r&d';
}

function requiresDeliveryAndBatch(body) {
  return !isResearchAndDevelopmentDepartment(body?.submittedBy?.department);
}

function requiresQcTrack(petition) {
  return !isResearchAndDevelopmentDepartment(petition?.submittedBy?.department);
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
  return null;
}

module.exports = {
  isResearchAndDevelopmentDepartment,
  requiresDeliveryAndBatch,
  requiresQcTrack,
  validatePetitionSubmission,
};
