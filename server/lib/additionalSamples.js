const { requiresQcTrack, isResearchAndDevelopmentDepartment } = require('./petitionSubmissionRules');
const { shouldSendItemToLab } = require('./petitionStatusLog');

function pendingAdditionalSamples(petition, side) {
  return (petition?.additionalSampleRequests || []).filter(round => round.status !== 'received' && (!side || round.side === side));
}

function validateAdditionalSampleInput(petition, input) {
  if (!['qc', 'lab'].includes(input?.side)) return 'กรุณาระบุฝ่าย QC หรือ LAB';
  if (!petition || !['pendingReview', 'inProgress', 'success'].includes(petition.status)) return 'คำขอนี้ยังไม่รับตัวอย่างหรือปิดงานแล้ว';
  if (!petition[input.side + 'ReceivedAt'] && !(petition.receivedAt && !petition.qcReceivedAt && !petition.labReceivedAt)) return 'ฝ่ายที่ขอต้องรับตัวอย่างก่อน';
  if (input.side === 'qc' && !requiresQcTrack(petition)) return 'คำขอนี้ไม่ต้องตรวจ QC';
  if (pendingAdditionalSamples(petition, input.side).length) return 'ฝ่ายนี้มีคำขอตัวอย่างเพิ่มที่ยังไม่ได้รับ';
  if (typeof input.reason !== 'string' || !input.reason.trim() || input.reason.length > 2000) return 'กรุณาระบุเหตุผลไม่เกิน 2000 ตัวอักษร';
  if (!Array.isArray(input.items) || !input.items.length || input.items.length > (petition.items || []).length) return 'กรุณาเลือกรายการตัวอย่าง';
  const seen = new Set();
  for (const item of input.items) {
    if (!item || !Number.isInteger(item.itemSeq) || seen.has(item.itemSeq)) return 'รายการตัวอย่างซ้ำหรือไม่ถูกต้อง';
    const source = petition.items.find(entry => entry.seq === item.itemSeq);
    if (!source) return 'ไม่พบรายการตัวอย่างในคำขอ';
    if (input.side === 'lab' && !isResearchAndDevelopmentDepartment(petition.submittedBy?.department) && !shouldSendItemToLab(source)) return 'รายการนี้ไม่ได้ส่ง LAB';
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000) return 'จำนวนตัวอย่างต้องเป็นจำนวนเต็ม 1–1000';
    if (item.weights !== undefined && (!Array.isArray(item.weights) || item.weights.length !== item.quantity || item.weights.some(weight => ![100, 250, 500].includes(weight)))) return 'กรุณาเลือกน้ำหนัก 100, 250 หรือ 500 กรัมให้ครบทุกตัวอย่าง';
    seen.add(item.itemSeq);
  }
  return null;
}

function requiredSampleRoundId(petition, side, itemSeq) {
  const rounds = petition?.additionalSampleRequests || [];
  for (let index = rounds.length - 1; index >= 0; index--) {
    const round = rounds[index];
    if (round.side === side && round.status === 'received' && round.items.some(item => item.itemSeq === Number(itemSeq))) return String(round._id);
  }
  return '';
}

function filled(value) {
  return Array.isArray(value) ? value.length > 0 && value.every(filled) : value != null && String(value).trim() !== '';
}

function hasResultValues(result) {
  return [result.values, result.valuesPhase2, ...(result.entries || [])].some(values => values && Object.values(values).some(filled));
}

function hasFreshFields(previous, current) {
  if (!current) return false;
  const containers = [[previous.values, current.values], [previous.valuesPhase2, current.valuesPhase2], ...(previous.entries || []).map((entry, index) => [entry, current.entries?.[index]])];
  return containers.every(([before, after]) => Object.entries(before || {}).every(([key, value]) => !filled(value) || filled(after?.[key])));
}

function additionalSampleCompletionError(petition, side, results) {
  if (pendingAdditionalSamples(petition, side).length) return 'ยังรอรับตัวอย่างเพิ่ม ไม่สามารถยืนยันผลได้';
  for (const round of petition.additionalSampleRequests || []) {
    if (round.side !== side || round.status !== 'received') continue;
    for (const item of round.items) {
      if (requiredSampleRoundId(petition, side, item.itemSeq) !== String(round._id)) continue;
      if (round.phase2DueAt && round.currentPhase !== 2) return 'กรุณารอ Phase 2 ของตัวอย่างรอบใหม่ก่อนยืนยันผล';
      const previous = (round.previousResults || []).filter(result => result.itemSeq === item.itemSeq && hasResultValues(result));
      const current = results.filter(result => result.itemSeq === item.itemSeq && String(result.sampleRoundId || '') === String(round._id) && hasResultValues(result));
      if (!current.length || previous.some(result => !hasFreshFields(result, current.find(entry => String(entry.parameterId) === String(result.parameterId))))) return 'กรุณาบันทึกผลตรวจตัวอย่างรอบใหม่ให้ครบก่อนยืนยันผล';
    }
  }
  return null;
}

function validateSampleScan(round, code, side, action) {
  if (!round || typeof code !== 'string' || code !== round.qrCode) return 'QR ไม่ตรงกับรอบตัวอย่างเพิ่ม';
  if (action === 'receive' && side !== round.side) return 'ตัวอย่างเพิ่มนี้ส่งให้ฝ่าย ' + round.side.toUpperCase();
  if (round.status === 'received') return 'รับตัวอย่างรอบนี้แล้ว';
  if (action === 'deliver' && round.status !== 'requested') return 'นำส่งตัวอย่างรอบนี้แล้ว';
  return null;
}

function requesterAudience(petition) {
  const department = String(petition?.submittedBy?.department || '').replace(/\s+/g, '').toLowerCase();
  if (['r&d', 'rd', 'researchanddevelopment'].includes(department)) return 'rd';
  if (/fg|สำเร็จรูป/.test(department)) return 'fg';
  if (/rm|วัตถุดิบ/.test(department)) return 'rm';
  if (/production|ผลิต/.test(department)) return 'production';
  return ['production', 'rm', 'fg'].includes(petition?.dept) ? petition.dept : null;
}

module.exports = { validateAdditionalSampleInput, pendingAdditionalSamples, requiredSampleRoundId, additionalSampleCompletionError, validateSampleScan, requesterAudience };
