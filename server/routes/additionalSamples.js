const express = require('express');
const mongoose = require('mongoose');
const { randomUUID } = require('node:crypto');
const Petition = require('../models/Petition');
const User = require('../models/User');
const Parameter = require('../models/Parameter');
const QCTestResult = require('../models/QCTestResult');
const PetitionAuditLog = require('../models/PetitionAuditLog');
const { getLisSessionUserId } = require('../lib/lisSessionCookie');
const { normalizeRoles } = require('../lib/roles');
const { serializePetitionWrite } = require('../lib/petitionWriteQueue');
const { computeAbnormalFlags } = require('../lib/abnormalFlags');
const { notifyPetitionEvent } = require('../lib/lineNotify');
const { validateAdditionalSampleInput, validateSampleScan, requiredSampleRoundId, requesterAudience } = require('../lib/additionalSamples');
const { resolveEmployeeActor } = require('../lib/employeeResolver');

const router = express.Router();
const fail = (res, status, message) => res.status(status).json({ error: { message } });

async function currentUser(req) {
  const sessionId = getLisSessionUserId(req);
  const email = String(req.get?.('X-LIS-User') || '').trim().toLowerCase();
  const user = sessionId ? await User.findById(sessionId).lean() : email ? await User.findOne({ email }).lean() : null;
  return user && user.status !== 'inactive' ? user : null;
}

function actorOf(user) {
  return { name: user.name || user.email, email: user.email, employeeId: user.employeeId };
}

function canTestSide(user, petition, side) {
  const roles = normalizeRoles(user);
  if (roles.includes('admin') || roles.includes(side + '-head')) return true;
  if (side === 'qc') return roles.includes('qc-staff');
  return roles.includes('lab-analyze') && Boolean(user.employeeId) && user.employeeId === petition.assignedTo?.employeeId;
}

function canDeliver(user, petition) {
  if (normalizeRoles(user).includes('admin')) return true;
  if (user.employeeId && [petition.submittedBy?.employeeId, petition.deliveredBy?.employeeId].includes(user.employeeId)) return true;
  if (user.email && petition.productionWorkflow?.requesterEmail?.toLowerCase() === user.email.toLowerCase()) return true;
  const audience = requesterAudience({ submittedBy: { department: user.department } });
  return Boolean(audience && audience === requesterAudience(petition));
}

async function notify(petition, type, round, user) {
  const payload = {
    event: 'updated', toStatus: petition.status, actor: user.name || user.email,
    note: type === 'additionalSampleRequested' ? 'ขอตัวอย่างเพิ่ม: ' + round.reason : type === 'additionalSampleSent' ? 'นำส่งตัวอย่างเพิ่ม' : 'รับตัวอย่างเพิ่ม',
    metadata: { type, side: round.side, additionalSampleId: String(round._id), reason: round.reason, items: round.items },
  };
  await PetitionAuditLog.create({ petitionId: petition._id, petitionNo: petition.petitionNo, ...payload });
  await notifyPetitionEvent(petition, payload);
}

router.post('/:id/additional-samples', serializePetitionWrite(async (req, res) => {
  try {
    const user = await currentUser(req);
    if (!user) return fail(res, 401, 'กรุณาเข้าสู่ระบบ');
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'รหัสคำขอไม่ถูกต้อง');
    const petition = await Petition.findById(req.params.id).lean();
    if (!petition) return fail(res, 404, 'ไม่พบคำขอ');
    const input = req.body || {};
    const error = validateAdditionalSampleInput(petition, input);
    if (error) return fail(res, 409, error);
    if (!canTestSide(user, petition, input.side)) return fail(res, 403, 'ไม่มีสิทธิ์ขอตัวอย่างเพิ่มให้ฝ่ายนี้');
    const selectedSeqs = input.items.map(item => item.itemSeq);
    const results = await QCTestResult.find({ petitionId: String(petition._id), itemSeq: { $in: selectedSeqs } }).lean();
    const params = await Parameter.find({ _id: { $in: results.map(result => result.parameterId) } }).lean();
    const scopeOf = param => param?.scope === 'lab' ? 'lab' : 'qc';
    const byId = new Map(params.map(param => [String(param._id), param]));
    const currentResults = results.filter(result => String(result.sampleRoundId || '') === requiredSampleRoundId(petition, scopeOf(byId.get(String(result.parameterId))), result.itemSeq));
    const previousResults = currentResults.filter(result => byId.has(String(result.parameterId)) && scopeOf(byId.get(String(result.parameterId))) === input.side);
    const phase1Params = params.map(param => ({ ...param, valueFields: scopeOf(param) === input.side ? (param.valueFields || []).filter(field => !param.hasPhases || field.phase !== 'after') : [] }));
    const phase2Params = params.map(param => ({ ...param, valueFields: scopeOf(param) === input.side && param.hasPhases ? (param.valueFields || []).filter(field => field.phase !== 'before') : [] }));
    const phase2Results = currentResults.map(result => byId.get(String(result.parameterId))?.hasPhases ? { ...result, values: result.valuesPhase2 || {} } : result);
    const options = { petitions: [petition], includeRestricted: true };
    const failed = computeAbnormalFlags({ ...options, docs: currentResults, params: phase1Params })[String(petition._id)] || computeAbnormalFlags({ ...options, docs: phase2Results, params: phase2Params })[String(petition._id)];
    if (!failed) return fail(res, 409, 'ต้องบันทึกผลที่ไม่ผ่านของรายการที่เลือกก่อนขอตัวอย่างเพิ่ม');
    const round = {
      _id: new mongoose.Types.ObjectId(), qrCode: 'LIS-EXTRA-' + randomUUID(),
      side: input.side, reason: input.reason.trim(), items: input.items.map(item => ({ itemSeq: item.itemSeq, quantity: item.quantity, ...(item.weights ? { weights: item.weights } : {}) })),
      requestedAt: new Date(), requestedBy: actorOf(user), status: 'requested', previousResults,
    };
    const reset = { status: 'inProgress', completedAt: null, [input.side + 'CompletedAt']: null, [input.side + 'CompletedBy']: null };
    if (input.side === 'lab') Object.assign(reset, { labApprovedAt: null, labApprovedBy: null });
    const updated = await Petition.findOneAndUpdate({
      _id: petition._id,
      status: petition.status,
      __v: petition.__v == null ? { $exists: false } : petition.__v,
      additionalSampleRequests: { $not: { $elemMatch: { side: input.side, status: { $ne: 'received' } } } },
    }, { $push: { additionalSampleRequests: round }, $set: reset, $inc: { __v: 1 } }, { new: true, runValidators: true });
    if (!updated) return fail(res, 409, 'คำขอเปลี่ยนแปลงแล้ว กรุณาโหลดใหม่');
    try {
      await notify(updated, 'additionalSampleRequested', round, user);
    } catch (error) {
      console.error('[additional-samples] notification failed:', error.message);
      return res.status(201).json({ ...updated.toObject(), additionalSampleNotificationWarning: 'บันทึกคำขอแล้ว แต่แจ้งเตือนไม่สำเร็จ กรุณาติดต่อผู้ขอ' });
    }
    return res.status(201).json(updated);
  } catch (error) {
    return fail(res, 400, error.message);
  }
}));

async function changeAdditionalSampleState(req, res, petition, action) {
  const user = await currentUser(req);
  if (!user) return fail(res, 401, 'กรุณาเข้าสู่ระบบ');
  const round = (petition.additionalSampleRequests || []).find(entry => String(entry._id) === String(req.body?.additionalSampleId || ''));
  const side = req.body?.side;
  const error = validateSampleScan(round, req.body?.additionalSampleCode, side, action);
  if (error) return fail(res, 409, error);
  if (['approved', 'rejected'].includes(petition.status)) return fail(res, 409, 'คำขอนี้ปิดแล้ว');
  if (action === 'receive' ? !canTestSide(user, petition, round.side) : !canDeliver(user, petition)) return fail(res, 403, 'ไม่มีสิทธิ์ดำเนินการกับรอบตัวอย่างนี้');
  const now = new Date();
  const update = { 'additionalSampleRequests.$.status': action === 'receive' ? 'received' : 'sent' };
  if (action === 'deliver' && req.body?.deliveredBy?.name) {
    update.deliveredBy = await resolveEmployeeActor(req.body.deliveredBy);
  }
  if (action === 'receive') {
    update['additionalSampleRequests.$.receivedAt'] = now;
    update['additionalSampleRequests.$.receivedBy'] = actorOf(user);
  }
  if (action === 'deliver' || !round.sentAt) {
    update['additionalSampleRequests.$.sentAt'] = now;
    update['additionalSampleRequests.$.sentBy'] = actorOf(user);
  }
  const updated = await Petition.findOneAndUpdate({
    _id: petition._id, status: { $nin: ['approved', 'rejected'] },
    additionalSampleRequests: { $elemMatch: { _id: round._id, qrCode: round.qrCode, status: round.status } },
  }, { $set: update, $inc: { __v: 1 } }, { new: true, runValidators: true });
  if (!updated) return fail(res, 409, 'รอบนี้ถูกดำเนินการแล้ว กรุณาโหลดใหม่');
  try {
    await notify(updated, action === 'receive' ? 'additionalSampleReceived' : 'additionalSampleSent', round, user);
  } catch (error) {
    console.error('[additional-samples] notification failed:', error.message);
  }
  return res.json(updated);
}

module.exports = { router, changeAdditionalSampleState, currentUser, canTestSide, canDeliver };
