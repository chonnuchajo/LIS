const express = require('express');
const mongoose = require('mongoose');
const CoaDocument = require('../models/CoaDocument');
const CoaAuditLog = require('../models/CoaAuditLog');
const Petition = require('../models/Petition');
const LabRequest = require('../models/LabRequest');
const QCTestResult = require('../models/QCTestResult');
const Parameter = require('../models/Parameter');
const User = require('../models/User');
const Role = require('../models/Role');
const { nextCoaNumber } = require('../lib/coaNumber');
const { normalizeRoles, primaryRole, unionPermissions } = require('../lib/roles');
const {
  actorFromBody,
  applyCoaLifecycleAction,
  applySupersession,
  assertCanTransition,
  buildCoaSnapshots,
  isQcHead,
  selectedItemsFromPetition,
  writeCoaAuditEvent,
} = require('../lib/coaLifecycle');

const router = express.Router();

function objectId(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new Error('Invalid id');
  return new mongoose.Types.ObjectId(id);
}

function errorWithStatus(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function errorStatus(error) {
  if (error.status) return error.status;
  return error.message.startsWith('QC Head required') ? 403 : 400;
}

function normalizeCoaMatchValue(value) {
  return String(value || '').trim().toLowerCase();
}

function coaHistoryKey(commonName, batchNo) {
  const normalizedCommonName = normalizeCoaMatchValue(commonName);
  const normalizedBatchNo = normalizeCoaMatchValue(batchNo);
  return normalizedCommonName && normalizedBatchNo
    ? `${normalizedCommonName}\u0000${normalizedBatchNo}`
    : null;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function exactTrimmedRegex(value) {
  return new RegExp(`^\\s*${escapeRegex(value)}\\s*$`, 'i');
}

function activeCoaSummary(coa, sample) {
  return {
    coaId: coa._id,
    coaNo: coa.coaNo,
    revision: coa.revision,
    petitionNo: coa.petitionNoSnapshot,
    commonName: sample.commonName,
    batchNo: sample.batchNo,
    productionDate: sample.productionDate,
  };
}

function firstActiveCoaByHistoryKey(coas = []) {
  const activeByHistoryKey = new Map();
  for (const coa of coas) {
    for (const sample of coa.sampleSnapshots || []) {
      const key = coaHistoryKey(sample.commonName, sample.batchNo);
      if (key && !activeByHistoryKey.has(key)) {
        activeByHistoryKey.set(key, activeCoaSummary(coa, sample));
      }
    }
  }
  return activeByHistoryKey;
}

async function permissionsForRoles(roles) {
  const roleDocs = roles.length ? await Role.find({ id: { $in: roles } }).lean() : [];
  const permissions = unionPermissions(roles, Object.fromEntries(roleDocs.map((role) => [role.id, role.permissions || []])));
  return permissions;
}

async function actorFromRequest(body = {}) {
  const requested = body._user || body.actor || {};
  const requestedActor = actorFromBody(body);
  const email = String(requestedActor.email || requested.email || '').trim().toLowerCase();
  if (!email) throw errorWithStatus('COA actor email is required', 400);

  const user = await User.findOne({ email }).lean();
  if (!user) throw errorWithStatus('COA actor must match an active user', 401);
  if (user.status && user.status !== 'active') throw errorWithStatus('Inactive users cannot issue COA documents', 403);

  const roles = normalizeRoles(user);
  const requestedRole = String(requested.activeRole || requested.role || '').trim();
  const activeRole = roles.includes(requestedRole) ? requestedRole : primaryRole(roles);
  const permissions = await permissionsForRoles(roles);

  return {
    name: String(user.name || requestedActor.name || email).trim(),
    email,
    role: activeRole,
    activeRole,
    roles,
    permissions,
    position: user.position,
  };
}

async function assertLabApprovedPetition(petitionId) {
  const petition = await Petition.findById(petitionId).lean();
  if (!petition) throw errorWithStatus('ไม่พบคำร้อง', 404);
  if (!petition.labApprovedAt) throw errorWithStatus('คำร้องนี้ยังไม่ได้อนุมัติผล Lab', 400);
  return petition;
}

async function labRequestsForPetitionIds(petitionIds) {
  if (!petitionIds.length) return [];
  return LabRequest.find({ petitionId: { $in: petitionIds } }).lean();
}

function labSeqSet(labRequests = []) {
  const seqs = new Set();
  for (const request of labRequests) {
    if (request.sampleSeq != null) seqs.add(Number(request.sampleSeq));
  }
  return seqs;
}

async function freezeSnapshots(petitionId, selectedItemSeqs) {
  const petition = await assertLabApprovedPetition(petitionId);
  const labRequests = await LabRequest.find({ petitionId: petition._id }).lean();
  const labSeqs = labSeqSet(labRequests);
  if (labSeqs.size) {
    const nonLabSeqs = selectedItemSeqs.map(Number).filter((seq) => !labSeqs.has(seq));
    if (nonLabSeqs.length) throw errorWithStatus(`COA can include only Lab-approved samples: ${nonLabSeqs.join(', ')}`, 400);
  }
  const qcResults = await QCTestResult.find({
    petitionId: String(petition._id),
    itemSeq: { $in: selectedItemSeqs.map(Number) },
  }).lean();
  const parameterIds = [...new Set(qcResults.map((result) => String(result.parameterId)))];
  const parameters = parameterIds.length
    ? await Parameter.find({ _id: { $in: parameterIds } }).lean()
    : [];
  return buildCoaSnapshots({ petition, labRequests, parameters, qcResults, selectedItemSeqs });
}

async function createCoaDocument(payload, session) {
  if (session) {
    const docs = await CoaDocument.create([payload], { session });
    return docs[0];
  }
  return CoaDocument.create(payload);
}

async function withCoaTransaction(callback) {
  if (mongoose.connection.readyState !== 1) return callback(undefined);
  if (typeof CoaDocument.startSession !== 'function') return callback(undefined);
  const session = await CoaDocument.startSession();
  if (!session || typeof session.withTransaction !== 'function') {
    if (session && typeof session.endSession === 'function') await session.endSession();
    return callback(undefined);
  }
  try {
    let result;
    await session.withTransaction(async () => {
      result = await callback(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = String(req.query.status);
    if (req.query.coaNo) filter.coaNo = new RegExp(String(req.query.coaNo).trim(), 'i');
    if (req.query.petitionNo) filter.petitionNoSnapshot = new RegExp(String(req.query.petitionNo).trim(), 'i');
    if (req.query.needsApproval === '1') {
      filter.status = { $in: ['pendingApproval', 'pendingRevisionApproval'] };
    }
    const items = await CoaDocument.find(filter).sort({ updatedAt: -1 }).limit(200).lean();
    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/eligible-petitions', async (_req, res) => {
  try {
    const petitions = await Petition.find({ labApprovedAt: { $exists: true, $ne: null } })
      .sort({ labApprovedAt: -1 })
      .limit(100)
      .lean();
    const petitionIds = petitions.map((petition) => petition._id);
    const historyPairs = petitions.flatMap((petition) => (petition.items || [])
      .map((item) => ({ commonName: item.commonName, batchNo: item.batchNo }))
      .filter((item) => coaHistoryKey(item.commonName, item.batchNo)));
    const [coas, labRequests] = await Promise.all([
      CoaDocument.find({
        $or: [
          { petitionId: { $in: petitionIds } },
          ...historyPairs.map((item) => ({
            sampleSnapshots: {
              $elemMatch: {
                commonName: exactTrimmedRegex(item.commonName),
                batchNo: exactTrimmedRegex(item.batchNo),
              },
            },
          })),
        ],
        status: { $in: ['approved', 'printed', 'reissued'] },
      }).sort({ updatedAt: -1 }).lean(),
      labRequestsForPetitionIds(petitionIds),
    ]);
    const activeByHistoryKey = firstActiveCoaByHistoryKey(coas);
    const activeByPetitionSeq = new Map();
    for (const coa of coas) {
      for (const seq of coa.selectedItemSeqs || []) {
        const key = `${coa.petitionId}:${seq}`;
        if (!activeByPetitionSeq.has(key)) {
          const sample = (coa.sampleSnapshots || []).find((item) => Number(item.itemSeq) === Number(seq)) || {};
          activeByPetitionSeq.set(key, activeCoaSummary(coa, sample));
        }
      }
    }
    const labSeqsByPetition = new Map();
    for (const labRequest of labRequests) {
      const key = String(labRequest.petitionId);
      if (!labSeqsByPetition.has(key)) labSeqsByPetition.set(key, new Set());
      if (labRequest.sampleSeq != null) labSeqsByPetition.get(key).add(Number(labRequest.sampleSeq));
    }
    res.json({
      items: petitions.map((petition) => {
        const labSeqs = labSeqsByPetition.get(String(petition._id)) || new Set();
        return {
          _id: petition._id,
          petitionNo: petition.petitionNo,
          labApprovedAt: petition.labApprovedAt,
          submittedBy: petition.submittedBy,
          items: (petition.items || [])
            .filter((item) => labSeqs.size === 0 || labSeqs.has(Number(item.seq)))
            .map((item) => ({
              seq: item.seq,
              sampleName: item.sampleName,
              commonName: item.commonName,
              batchNo: item.batchNo,
              lotNo: item.lotNo,
              productionDate: item.productionDate,
              activeCoa: activeByPetitionSeq.get(`${petition._id}:${item.seq}`)
                || activeByHistoryKey.get(coaHistoryKey(item.commonName, item.batchNo))
                || null,
            })),
        };
      }),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const actor = await actorFromRequest(req.body);
    const petition = await assertLabApprovedPetition(req.body.petitionId);
    const selectedItems = selectedItemsFromPetition(petition, req.body.selectedItemSeqs);
    const selectedItemSeqs = selectedItems.map((item) => item.seq);
    const snapshots = await freezeSnapshots(petition._id, selectedItemSeqs);
    const doc = await withCoaTransaction(async (session) => {
      const created = await createCoaDocument({
        petitionId: petition._id,
        petitionNoSnapshot: petition.petitionNo,
        selectedItemSeqs,
        ...snapshots,
        remark: String(req.body.remark || ''),
        status: 'draft',
        createdBy: actor,
        updatedBy: actor,
      }, session);
      await writeCoaAuditEvent(created, 'created', actor, 'สร้างร่าง COA', {
        selectedItemSeqs: created.selectedItemSeqs,
      }, CoaAuditLog, session);
      return created;
    });
    res.status(201).json(doc);
  } catch (error) {
    res.status(errorStatus(error)).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const doc = await CoaDocument.findById(objectId(req.params.id)).lean();
    if (!doc) return res.status(404).json({ error: 'ไม่พบ COA' });
    const audit = await CoaAuditLog.find({ coaId: doc._id }).sort({ createdAt: -1 }).lean();
    res.json({ ...doc, audit });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const actor = await actorFromRequest(req.body);
    const doc = await CoaDocument.findById(objectId(req.params.id));
    if (!doc) return res.status(404).json({ error: 'ไม่พบ COA' });
    assertCanTransition(doc.status, 'update', actor);
    if (req.body.selectedItemSeqs) {
      const petition = await assertLabApprovedPetition(doc.petitionId);
      doc.selectedItemSeqs = selectedItemsFromPetition(petition, req.body.selectedItemSeqs)
        .map((item) => item.seq);
      const snapshots = await freezeSnapshots(doc.petitionId, doc.selectedItemSeqs);
      doc.set(snapshots);
    }
    if (typeof req.body.remark === 'string') doc.remark = req.body.remark;
    doc.updatedBy = actor;
    const updated = await withCoaTransaction(async (session) => {
      await doc.save(session ? { session } : undefined);
      await writeCoaAuditEvent(doc, 'updated', actor, 'แก้ไขร่าง COA', {}, CoaAuditLog, session);
      return doc;
    });
    res.json(updated);
  } catch (error) {
    res.status(errorStatus(error)).json({ error: error.message });
  }
});

router.post('/:id/submit', async (req, res) => {
  try {
    const actor = await actorFromRequest(req.body);
    const doc = await CoaDocument.findById(objectId(req.params.id));
    if (!doc) return res.status(404).json({ error: 'ไม่พบ COA' });
    const snapshots = await freezeSnapshots(doc.petitionId, doc.selectedItemSeqs);
    doc.$locals.allowIssuedSnapshotMutation = true;
    const { doc: updated } = await withCoaTransaction((session) => applyCoaLifecycleAction({
      doc,
      action: 'submit',
      actor,
      note: 'ส่งอนุมัติ COA',
      CoaAuditLogModel: CoaAuditLog,
      session,
      update: { ...snapshots, approval: { ...doc.approval, submittedBy: actor, submittedAt: new Date() } },
    }));
    res.json(updated);
  } catch (error) {
    res.status(errorStatus(error)).json({ error: error.message });
  }
});

router.post('/:id/approve', async (req, res) => {
  try {
    const actor = await actorFromRequest(req.body);
    if (!isQcHead(actor)) return res.status(403).json({ error: 'อนุมัติ COA ได้เฉพาะ QC Head' });
    const doc = await CoaDocument.findById(objectId(req.params.id));
    if (!doc) return res.status(404).json({ error: 'ไม่พบ COA' });
    assertCanTransition(doc.status, 'approve', actor);
    await assertLabApprovedPetition(doc.petitionId);
    const missingSnapshots = !doc.sampleSnapshots?.length || !doc.resultSnapshots?.length || !doc.trendSnapshots?.length;
    const snapshots = missingSnapshots ? await freezeSnapshots(doc.petitionId, doc.selectedItemSeqs) : {};
    const update = {
      ...snapshots,
      approval: { ...doc.approval, approvedBy: actor, approvedAt: new Date() },
    };
    if (!doc.coaNo) Object.assign(update, await nextCoaNumber());
    doc.$locals.allowIssuedSnapshotMutation = true;
    const action = {
      doc,
      action: 'approve',
      actor,
      note: 'อนุมัติ COA',
      CoaAuditLogModel: CoaAuditLog,
      update,
    };
    let updated;
    if (doc.sourceCoaId) {
      const session = await CoaDocument.startSession();
      try {
        await session.withTransaction(async () => {
          if (typeof doc.$session === 'function') doc.$session(session);
          ({ doc: updated } = await applyCoaLifecycleAction({ ...action, session }));
          await applySupersession({
            sourceCoaId: updated.sourceCoaId,
            revisionCoaId: updated._id,
            CoaDocumentModel: CoaDocument,
            CoaAuditLogModel: CoaAuditLog,
            actor,
            note: 'แทนที่ด้วย COA ฉบับแก้ไข',
            session,
          });
        });
      } finally {
        await session.endSession();
      }
    } else {
      ({ doc: updated } = await withCoaTransaction((session) => applyCoaLifecycleAction({ ...action, session })));
    }
    res.json(updated);
  } catch (error) {
    res.status(errorStatus(error)).json({ error: error.message });
  }
});

router.post('/:id/reject', async (req, res) => {
  try {
    const actor = await actorFromRequest(req.body);
    if (!isQcHead(actor)) return res.status(403).json({ error: 'ปฏิเสธ COA ได้เฉพาะ QC Head' });
    const reason = String(req.body.reason || '').trim();
    if (!reason) return res.status(400).json({ error: 'ต้องระบุเหตุผลการปฏิเสธ' });
    const doc = await CoaDocument.findById(objectId(req.params.id));
    if (!doc) return res.status(404).json({ error: 'ไม่พบ COA' });
    const { doc: updated } = await withCoaTransaction((session) => applyCoaLifecycleAction({
      doc,
      action: 'reject',
      actor,
      note: reason,
      CoaAuditLogModel: CoaAuditLog,
      session,
      update: { approval: { ...doc.approval, rejectedBy: actor, rejectedAt: new Date(), rejectReason: reason } },
    }));
    res.json(updated);
  } catch (error) {
    res.status(errorStatus(error)).json({ error: error.message });
  }
});

router.post('/:id/revise', async (req, res) => {
  try {
    const actor = await actorFromRequest(req.body);
    const source = await CoaDocument.findById(objectId(req.params.id)).lean();
    if (!source) return res.status(404).json({ error: 'ไม่พบ COA' });
    assertCanTransition(source.status, 'revise', actor);
    const doc = await withCoaTransaction(async (session) => {
      const created = await createCoaDocument({
        coaNo: source.coaNo,
        coaYear: source.coaYear,
        sequence: source.sequence,
        revision: Number(source.revision || 0) + 1,
        status: 'revisionDraft',
        petitionId: source.petitionId,
        petitionNoSnapshot: source.petitionNoSnapshot,
        selectedItemSeqs: source.selectedItemSeqs,
        customerSnapshot: source.customerSnapshot,
        sampleSnapshots: source.sampleSnapshots,
        resultSnapshots: source.resultSnapshots,
        trendSnapshots: source.trendSnapshots,
        sourceCoaId: source._id,
        remark: source.remark,
        createdBy: actor,
        updatedBy: actor,
      }, session);
      await writeCoaAuditEvent(created, 'revisionCreated', actor, 'สร้างร่างแก้ไข COA', {
        sourceCoaId: source._id,
      }, CoaAuditLog, session);
      return created;
    });
    res.status(201).json(doc);
  } catch (error) {
    res.status(errorStatus(error)).json({ error: error.message });
  }
});

router.post('/:id/cancel', async (req, res) => {
  try {
    const actor = await actorFromRequest(req.body);
    if (!isQcHead(actor)) return res.status(403).json({ error: 'ยกเลิก COA ได้เฉพาะ QC Head' });
    const reason = String(req.body.reason || '').trim();
    if (!reason) return res.status(400).json({ error: 'ต้องระบุเหตุผลการยกเลิก' });
    const doc = await CoaDocument.findById(objectId(req.params.id));
    if (!doc) return res.status(404).json({ error: 'ไม่พบ COA' });
    const { doc: updated } = await withCoaTransaction((session) => applyCoaLifecycleAction({
      doc,
      action: 'cancel',
      actor,
      note: reason,
      CoaAuditLogModel: CoaAuditLog,
      session,
      update: { cancel: { cancelledBy: actor, cancelledAt: new Date(), reason } },
    }));
    res.json(updated);
  } catch (error) {
    res.status(errorStatus(error)).json({ error: error.message });
  }
});

router.post('/:id/print-event', async (req, res) => {
  try {
    const actor = await actorFromRequest(req.body);
    const doc = await CoaDocument.findById(objectId(req.params.id));
    if (!doc) return res.status(404).json({ error: 'ไม่พบ COA' });
    const printedAt = new Date();
    const { doc: updated } = await withCoaTransaction((session) => applyCoaLifecycleAction({
      doc,
      action: 'print',
      actor,
      note: 'บันทึกการพิมพ์ COA',
      CoaAuditLogModel: CoaAuditLog,
      session,
      metadata: { copies: req.body.copies, outputMode: req.body.outputMode },
      update: {
        print: {
          ...doc.print,
          printCount: Number(doc.print?.printCount || 0) + 1,
          lastPrintedAt: printedAt,
          lastPrintedBy: actor,
          printEvents: [
            ...(doc.print?.printEvents || []),
            {
              event: req.body.event || 'printDialogOpened',
              printedAt,
              printedBy: actor,
              copies: Number(req.body.copies || 1),
              outputMode: req.body.outputMode || 'local',
            },
          ],
        },
      },
    }));
    res.json(updated);
  } catch (error) {
    res.status(errorStatus(error)).json({ error: error.message });
  }
});

module.exports = router;
module.exports.freezeSnapshots = freezeSnapshots;
module.exports.actorFromRequest = actorFromRequest;
module.exports.withCoaTransaction = withCoaTransaction;
