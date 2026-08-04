const express = require('express');
const mongoose = require('mongoose');
const CoaDocument = require('../models/CoaDocument');
const CoaAuditLog = require('../models/CoaAuditLog');
const Petition = require('../models/Petition');
const LabRequest = require('../models/LabRequest');
const QCTestResult = require('../models/QCTestResult');
const Parameter = require('../models/Parameter');
const { nextCoaNumber } = require('../lib/coaNumber');
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

function actorFromRequest(body = {}) {
  const actor = actorFromBody(body);
  const user = body._user || body.actor || {};
  return {
    ...actor,
    role: actor.role || String(user.activeRole || user.position || '').trim(),
    activeRole: user.activeRole,
    permissions: user.permissions,
  };
}

function errorStatus(error) {
  return error.message.startsWith('QC Head required') ? 403 : 400;
}

async function freezeSnapshots(petitionId, selectedItemSeqs) {
  const petition = await Petition.findById(petitionId).lean();
  if (!petition) throw new Error('ไม่พบคำร้อง');
  const labRequests = await LabRequest.find({ petitionId: petition._id }).lean();
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
    const coas = await CoaDocument.find({
      petitionId: { $in: petitionIds },
      status: { $in: ['approved', 'printed', 'reissued'] },
    }).lean();
    const activeByPetitionSeq = new Map();
    for (const coa of coas) {
      for (const seq of coa.selectedItemSeqs || []) {
        activeByPetitionSeq.set(`${coa.petitionId}:${seq}`, {
          coaId: coa._id,
          coaNo: coa.coaNo,
          revision: coa.revision,
        });
      }
    }
    res.json({
      items: petitions.map((petition) => ({
        _id: petition._id,
        petitionNo: petition.petitionNo,
        labApprovedAt: petition.labApprovedAt,
        submittedBy: petition.submittedBy,
        items: (petition.items || []).map((item) => ({
          seq: item.seq,
          sampleName: item.sampleName,
          commonName: item.commonName,
          batchNo: item.batchNo,
          lotNo: item.lotNo,
          activeCoa: activeByPetitionSeq.get(`${petition._id}:${item.seq}`) || null,
        })),
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const actor = actorFromRequest(req.body);
    const petition = await Petition.findById(req.body.petitionId).lean();
    if (!petition) return res.status(404).json({ error: 'ไม่พบคำร้อง' });
    if (!petition.labApprovedAt) return res.status(400).json({ error: 'คำร้องนี้ยังไม่ได้อนุมัติผล Lab' });
    const selectedItems = selectedItemsFromPetition(petition, req.body.selectedItemSeqs);
    const doc = await CoaDocument.create({
      petitionId: petition._id,
      petitionNoSnapshot: petition.petitionNo,
      selectedItemSeqs: selectedItems.map((item) => item.seq),
      remark: String(req.body.remark || ''),
      status: 'draft',
      createdBy: actor,
      updatedBy: actor,
    });
    await writeCoaAuditEvent(doc, 'created', actor, 'สร้างร่าง COA', {
      selectedItemSeqs: doc.selectedItemSeqs,
    }, CoaAuditLog);
    res.status(201).json(doc);
  } catch (error) {
    res.status(400).json({ error: error.message });
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
    const actor = actorFromRequest(req.body);
    const doc = await CoaDocument.findById(objectId(req.params.id));
    if (!doc) return res.status(404).json({ error: 'ไม่พบ COA' });
    assertCanTransition(doc.status, 'update', actor);
    if (req.body.selectedItemSeqs) {
      const petition = await Petition.findById(doc.petitionId).lean();
      if (!petition) return res.status(404).json({ error: 'ไม่พบคำร้อง' });
      doc.selectedItemSeqs = selectedItemsFromPetition(petition, req.body.selectedItemSeqs)
        .map((item) => item.seq);
    }
    if (typeof req.body.remark === 'string') doc.remark = req.body.remark;
    doc.updatedBy = actor;
    await doc.save();
    await writeCoaAuditEvent(doc, 'updated', actor, 'แก้ไขร่าง COA', {}, CoaAuditLog);
    res.json(doc);
  } catch (error) {
    res.status(errorStatus(error)).json({ error: error.message });
  }
});

router.post('/:id/submit', async (req, res) => {
  try {
    const actor = actorFromRequest(req.body);
    const doc = await CoaDocument.findById(objectId(req.params.id));
    if (!doc) return res.status(404).json({ error: 'ไม่พบ COA' });
    const { doc: updated } = await applyCoaLifecycleAction({
      doc,
      action: 'submit',
      actor,
      note: 'ส่งอนุมัติ COA',
      CoaAuditLogModel: CoaAuditLog,
      update: { approval: { ...doc.approval, submittedBy: actor, submittedAt: new Date() } },
    });
    res.json(updated);
  } catch (error) {
    res.status(errorStatus(error)).json({ error: error.message });
  }
});

router.post('/:id/approve', async (req, res) => {
  try {
    const actor = actorFromRequest(req.body);
    if (!isQcHead(actor)) return res.status(403).json({ error: 'อนุมัติ COA ได้เฉพาะ QC Head' });
    const doc = await CoaDocument.findById(objectId(req.params.id));
    if (!doc) return res.status(404).json({ error: 'ไม่พบ COA' });
    assertCanTransition(doc.status, 'approve', actor);
    const snapshots = await freezeSnapshots(doc.petitionId, doc.selectedItemSeqs);
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
      ({ doc: updated } = await applyCoaLifecycleAction(action));
    }
    res.json(updated);
  } catch (error) {
    res.status(errorStatus(error)).json({ error: error.message });
  }
});

router.post('/:id/reject', async (req, res) => {
  try {
    const actor = actorFromRequest(req.body);
    if (!isQcHead(actor)) return res.status(403).json({ error: 'ปฏิเสธ COA ได้เฉพาะ QC Head' });
    const reason = String(req.body.reason || '').trim();
    if (!reason) return res.status(400).json({ error: 'ต้องระบุเหตุผลการปฏิเสธ' });
    const doc = await CoaDocument.findById(objectId(req.params.id));
    if (!doc) return res.status(404).json({ error: 'ไม่พบ COA' });
    const { doc: updated } = await applyCoaLifecycleAction({
      doc,
      action: 'reject',
      actor,
      note: reason,
      CoaAuditLogModel: CoaAuditLog,
      update: { approval: { ...doc.approval, rejectedBy: actor, rejectedAt: new Date(), rejectReason: reason } },
    });
    res.json(updated);
  } catch (error) {
    res.status(errorStatus(error)).json({ error: error.message });
  }
});

router.post('/:id/revise', async (req, res) => {
  try {
    const actor = actorFromRequest(req.body);
    const source = await CoaDocument.findById(objectId(req.params.id)).lean();
    if (!source) return res.status(404).json({ error: 'ไม่พบ COA' });
    assertCanTransition(source.status, 'revise', actor);
    const doc = await CoaDocument.create({
      coaNo: source.coaNo,
      coaYear: source.coaYear,
      sequence: source.sequence,
      revision: Number(source.revision || 0) + 1,
      status: 'revisionDraft',
      petitionId: source.petitionId,
      petitionNoSnapshot: source.petitionNoSnapshot,
      selectedItemSeqs: source.selectedItemSeqs,
      sourceCoaId: source._id,
      remark: source.remark,
      createdBy: actor,
      updatedBy: actor,
    });
    await writeCoaAuditEvent(doc, 'revisionCreated', actor, 'สร้างร่างแก้ไข COA', {
      sourceCoaId: source._id,
    }, CoaAuditLog);
    res.status(201).json(doc);
  } catch (error) {
    res.status(errorStatus(error)).json({ error: error.message });
  }
});

router.post('/:id/cancel', async (req, res) => {
  try {
    const actor = actorFromRequest(req.body);
    if (!isQcHead(actor)) return res.status(403).json({ error: 'ยกเลิก COA ได้เฉพาะ QC Head' });
    const reason = String(req.body.reason || '').trim();
    if (!reason) return res.status(400).json({ error: 'ต้องระบุเหตุผลการยกเลิก' });
    const doc = await CoaDocument.findById(objectId(req.params.id));
    if (!doc) return res.status(404).json({ error: 'ไม่พบ COA' });
    const { doc: updated } = await applyCoaLifecycleAction({
      doc,
      action: 'cancel',
      actor,
      note: reason,
      CoaAuditLogModel: CoaAuditLog,
      update: { cancel: { cancelledBy: actor, cancelledAt: new Date(), reason } },
    });
    res.json(updated);
  } catch (error) {
    res.status(errorStatus(error)).json({ error: error.message });
  }
});

router.post('/:id/print-event', async (req, res) => {
  try {
    const actor = actorFromRequest(req.body);
    const doc = await CoaDocument.findById(objectId(req.params.id));
    if (!doc) return res.status(404).json({ error: 'ไม่พบ COA' });
    const printedAt = new Date();
    const { doc: updated } = await applyCoaLifecycleAction({
      doc,
      action: 'print',
      actor,
      note: 'บันทึกการพิมพ์ COA',
      CoaAuditLogModel: CoaAuditLog,
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
    });
    res.json(updated);
  } catch (error) {
    res.status(errorStatus(error)).json({ error: error.message });
  }
});

module.exports = router;
module.exports.freezeSnapshots = freezeSnapshots;
