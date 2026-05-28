const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Petition = require('../models/Petition');
const Sample = require('../models/Sample');
const PhysicalResult = require('../models/PhysicalResult');
const Approval = require('../models/Approval');
const RealtimeDensity = require('../models/RealtimeDensity');
const PetitionAuditLog = require('../models/PetitionAuditLog');
const { maybeAdvancePhase } = require('../lib/phaseAdvance');

function sampleIdsFromPetition(petition) {
  if (!petition || !Array.isArray(petition.items)) return [];
  return petition.items
    .map((item) => item.sampleId || `${petition.petitionNo}-${item.seq}`)
    .filter(Boolean);
}

function logAudit(petition, payload) {
  if (!petition) return;
  PetitionAuditLog.create({
    petitionId: petition._id,
    petitionNo: petition.petitionNo,
    ...payload,
  }).catch((err) => {
    console.error('[audit-log] failed to write:', err.message);
  });
}

// Generate next petition number: P-YYMM-#### (resets monthly)
async function nextPetitionNo() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `P-${yy}${mm}-`;
  const last = await Petition.findOne({ petitionNo: new RegExp(`^${prefix}`) })
    .sort({ petitionNo: -1 })
    .lean();
  const nextSeq = last ? Number(last.petitionNo.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

function badRequest(res, message) {
  return res.status(400).json({ error: { message } });
}

// GET /api/petitions?page=1&limit=20&status=&search=
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const status = req.query.status;
    const dept = req.query.dept;
    const search = (req.query.search || '').trim();

    const q = {};
    if (status) {
      const list = String(status).split(',').map((s) => s.trim()).filter(Boolean);
      q.status = list.length > 1 ? { $in: list } : list[0];
    }
    if (dept && ['production', 'rm', 'fg'].includes(String(dept))) q.dept = dept;
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      q.$or = [
        { petitionNo: rx },
        { 'submittedBy.name': rx },
        { 'items.batchNo': rx },
      ];
    }

    const [docs, total] = await Promise.all([
      Petition.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Petition.countDocuments(q),
    ]);
    // Lazy phase advance for petitions whose phase2DueAt has elapsed
    const now = new Date();
    const items = [];
    for (const doc of docs) {
      if (doc.currentPhase === 1 && doc.phase2DueAt && doc.phase2DueAt <= now) {
        await maybeAdvancePhase(doc);
      }
      items.push(doc.toObject());
    }
    res.json({ items, total, page, limit });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// GET /api/petitions/submitted-orders → list of prod_order_no values already submitted
router.get('/submitted-orders', async (_req, res) => {
  try {
    const docs = await Petition.find({ prodOrderNos: { $exists: true, $ne: [] } })
      .select('prodOrderNos')
      .lean();
    const set = new Set();
    for (const d of docs) for (const n of d.prodOrderNos || []) set.add(n);
    res.json(Array.from(set));
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// GET /api/petitions/audit-logs?page=1&limit=20&search=&event=&status=&from=&to=
router.get('/audit-logs', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const search = String(req.query.search || '').trim();
    const event = String(req.query.event || '').trim();
    const status = String(req.query.status || '').trim();
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();

    const q = {};
    if (event) q.event = event;
    if (status) q.toStatus = status;
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      q.$or = [
        { petitionNo: rx },
        { actor: rx },
        { note: rx },
      ];
    }
    if (from || to) {
      q.createdAt = {};
      if (from) {
        const start = new Date(from);
        if (!Number.isNaN(start.getTime())) q.createdAt.$gte = start;
      }
      if (to) {
        const end = new Date(to);
        if (!Number.isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          q.createdAt.$lte = end;
        }
      }
      if (Object.keys(q.createdAt).length === 0) delete q.createdAt;
    }

    const [items, total] = await Promise.all([
      PetitionAuditLog.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      PetitionAuditLog.countDocuments(q),
    ]);
    res.json({ items, total, page, limit });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// GET /api/petitions/returned-flags?petitionIds=id1,id2,...
// Returns map of petitionId → boolean (true if petition is a revision of another
// petition, i.e. its predecessor was sent back from QC for re-submission).
router.get('/returned-flags', async (req, res) => {
  try {
    const raw = String(req.query.petitionIds || '').trim();
    if (!raw) return res.json({});
    const ids = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) return res.json({});

    const objectIds = ids
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const withRevision = await Petition.find({
      _id: { $in: objectIds },
      revisionOf: { $ne: null },
    }).select('_id').lean();
    const set = new Set(withRevision.map((d) => String(d._id)));

    const map = {};
    for (const id of ids) map[id] = set.has(id);
    res.json(map);
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// GET /api/petitions/scan/:code
router.get('/scan/:code', async (req, res) => {
  try {
    const code = decodeURIComponent(req.params.code || '').trim();
    if (!code) return badRequest(res, 'ไม่พบรหัสจาก QR Code');

    const query = [
      { petitionNo: code },
      { 'items.sampleId': code },
    ];
    if (mongoose.Types.ObjectId.isValid(code)) {
      query.unshift({ _id: code });
    }

    const fallbackPetitionNo = code.match(/^(P-\d{4}-\d{4})-\d+$/i)?.[1];
    if (fallbackPetitionNo) query.push({ petitionNo: fallbackPetitionNo });

    const doc = await Petition.findOne({ $or: query }).lean();
    if (!doc) return res.status(404).json({ error: { message: 'ไม่พบคำร้องจาก QR Code นี้' } });
    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

// GET /api/petitions/:id/audit-logs → chronological status/event trail for a petition
router.get('/:id/audit-logs', async (req, res) => {
  try {
    const id = req.params.id;
    const petition = mongoose.Types.ObjectId.isValid(id)
      ? await Petition.findById(id).select('_id petitionNo').lean()
      : await Petition.findOne({ petitionNo: id }).select('_id petitionNo').lean();
    if (!petition) return res.status(404).json({ error: { message: 'ไม่พบคำร้อง' } });
    const logs = await PetitionAuditLog.find({ petitionId: petition._id })
      .sort({ createdAt: 1 })
      .lean();
    res.json({ items: logs });
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

// GET /api/petitions/:id
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    let doc = mongoose.Types.ObjectId.isValid(id)
      ? await Petition.findById(id)
      : await Petition.findOne({ petitionNo: id });
    if (!doc) return res.status(404).json({ error: { message: 'ไม่พบคำร้อง' } });
    // Lazy phase advance: if phase2DueAt has elapsed, transition to Phase 2 on read
    doc = await maybeAdvancePhase(doc);
    res.json(doc.toObject());
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

// PATCH /api/petitions/:id/advance-phase — manual phase advance (admin override)
router.patch('/:id/advance-phase', async (req, res) => {
  try {
    const id = req.params.id;
    const q = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { petitionNo: id };
    const doc = await Petition.findOne(q);
    if (!doc) return res.status(404).json({ error: { message: 'ไม่พบคำร้อง' } });
    if (doc.currentPhase === 2) {
      return badRequest(res, 'คำร้องนี้อยู่ใน Phase 2 แล้ว');
    }
    // Force unlock: set due to now and let maybeAdvancePhase run
    doc.phase2DueAt = new Date();
    const actor = req.body?.actor || 'system';
    const advanced = await maybeAdvancePhase(doc, actor);
    res.json(advanced.toObject());
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

// POST /api/petitions
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.dept || !['production', 'rm', 'fg'].includes(body.dept)) {
      return badRequest(res, 'กรุณาระบุแผนก (production / rm / fg)');
    }
    if (!body.submittedBy?.name) {
      return badRequest(res, 'กรุณาระบุผู้ยื่นคำขอ');
    }
    if (!body.deliveredBy?.name) {
      return badRequest(res, 'กรุณาระบุผู้นำส่ง');
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return badRequest(res, 'ต้องมีตัวอย่างอย่างน้อย 1 รายการ');
    }
    for (const item of body.items) {
      const batch = String(item.batchNo || '').trim();
      if (!batch) return badRequest(res, `ตัวอย่าง "${item.sampleName || item.seq}": กรุณากรอกเลขแบช`);
    }
    if (body.dept === 'production') {
      if (!Array.isArray(body.productionPlans) || body.productionPlans.length === 0) {
        return badRequest(res, 'แผนกผลิตต้องมีใบวางแผนอย่างน้อย 1 รายการ');
      }
      const itemBatches = new Set(body.items.map((it) => String(it.batchNo).trim()));
      for (const plan of body.productionPlans) {
        if (!plan.batchNo || !itemBatches.has(String(plan.batchNo).trim())) {
          return badRequest(res, `ใบวางแผนอ้างถึง batchNo ที่ไม่อยู่ในรายการตัวอย่าง: ${plan.batchNo}`);
        }
      }
    }
    let revisionOf = null;
    if (body.revisionOf) {
      if (!mongoose.Types.ObjectId.isValid(body.revisionOf)) {
        return badRequest(res, 'revisionOf ไม่ใช่รหัสคำร้องที่ถูกต้อง');
      }
      const predecessor = await Petition.findById(body.revisionOf).lean();
      if (!predecessor) {
        return badRequest(res, 'ไม่พบคำร้องต้นทาง');
      }
      if (predecessor.status !== 'rejected') {
        return badRequest(res, 'คำร้องต้นทางไม่ได้ถูกส่งกลับให้แก้ไข');
      }
      const submitterId = body.submittedBy?.employeeId?.trim();
      const predecessorId = predecessor.submittedBy?.employeeId?.trim();
      if (predecessorId && submitterId && predecessorId !== submitterId) {
        return res.status(403).json({ error: { message: 'เฉพาะผู้ยื่นคำร้องเดิมเท่านั้นที่สามารถยื่นแก้ไขได้' } });
      }
      revisionOf = predecessor._id;
    }
    const petitionNo = await nextPetitionNo();
    const doc = await Petition.create({
      ...body,
      petitionNo,
      status: 'deliveringQC',
      revisionOf,
    });
    logAudit(doc, {
      event: 'created',
      toStatus: doc.status,
      actor: body.actor || body.submittedBy?.name || 'system',
      note: revisionOf ? `สร้างคำร้องใหม่ (แก้ไขจาก ${body.revisionOf})` : 'สร้างคำร้องใหม่',
      metadata: revisionOf ? { revisionOf: String(revisionOf) } : undefined,
    });
    res.status(201).json(doc);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

// PATCH /api/petitions/:id/deliver  → mark sample as sent (scan ส่ง)
router.patch('/:id/deliver', async (req, res) => {
  try {
    const id = req.params.id;
    const q = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { petitionNo: id };
    const before = await Petition.findOne(q).lean();
    if (!before) return res.status(404).json({ error: { message: 'ไม่พบคำร้อง' } });
    const update = { status: 'sampleSent' };
    if (!before.sampleSentAt) update.sampleSentAt = new Date();
    const doc = await Petition.findOneAndUpdate(q, update, { new: true });
    if (before.status !== doc.status) {
      logAudit(doc, {
        event: 'statusChanged',
        fromStatus: before.status,
        toStatus: doc.status,
        actor: req.body?.actor || 'system',
        note: 'สแกนส่งตัวอย่าง',
      });
    }
    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

// PATCH /api/petitions/:id/receive  → QC/Lab รับตัวอย่าง (scan รับ)
router.patch('/:id/receive', async (req, res) => {
  try {
    const id = req.params.id;
    const q = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { petitionNo: id };
    const before = await Petition.findOne(q).lean();
    if (!before) return res.status(404).json({ error: { message: 'ไม่พบคำร้อง' } });
    if (before.status !== 'sampleSent') {
      return badRequest(res, `ไม่สามารถรับได้: สถานะปัจจุบันคือ ${before.status}`);
    }
    const actor = req.body?.actor || 'system';
    const update = {
      status: 'pendingReview',
      receivedAt: new Date(),
      receivedBy: actor,
    };
    const doc = await Petition.findOneAndUpdate(q, update, { new: true });
    logAudit(doc, {
      event: 'statusChanged',
      fromStatus: before.status,
      toStatus: doc.status,
      actor,
      note: 'สแกนรับตัวอย่าง',
    });
    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

// PATCH /api/petitions/:id/assign
router.patch('/:id/assign', async (req, res) => {
  try {
    const { employeeId, name, department, position, assignedBy, machines } = req.body || {};
    if (!employeeId || !name) return badRequest(res, 'กรุณาเลือกเจ้าหน้าที่');

    const q = mongoose.Types.ObjectId.isValid(req.params.id)
      ? { _id: req.params.id }
      : { petitionNo: req.params.id };

    const doc = await Petition.findOne(q);
    if (!doc) return res.status(404).json({ error: { message: 'ไม่พบคำร้อง' } });

    const prevStatus = doc.status;
    doc.assignedTo = {
      employeeId: String(employeeId).trim(),
      name: String(name).trim(),
      department: department ? String(department).trim() : undefined,
      position: position ? String(position).trim() : undefined,
      assignedAt: new Date(),
      assignedBy: assignedBy ? String(assignedBy).trim() : undefined,
    };

    if (Array.isArray(machines)) {
      doc.assignedMachines = machines
        .filter((m) => m && m.machineId && m.code && m.name)
        .map((m) => ({
          machineId: String(m.machineId).trim(),
          code: String(m.code).trim(),
          name: String(m.name).trim(),
          location: m.location ? String(m.location).trim() : undefined,
          sampleName: m.sampleName ? String(m.sampleName).trim() : undefined,
          commonName: m.commonName ? String(m.commonName).trim() : undefined,
        }));
    }

    if (doc.status === 'pendingReview') doc.status = 'inProgress';

    await doc.save();
    logAudit(doc, {
      event: 'assigned',
      fromStatus: prevStatus,
      toStatus: doc.status,
      actor: assignedBy || 'system',
      note: `มอบหมายให้ ${doc.assignedTo.name}${doc.assignedMachines?.length ? ` (เครื่อง: ${doc.assignedMachines.map((m) => m.code).join(', ')})` : ''}`,
      metadata: { assignee: doc.assignedTo, machines: doc.assignedMachines },
    });
    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

// PATCH /api/petitions/:id  (general update + approve/reject transitions)
router.patch('/:id', async (req, res) => {
  try {
    const updates = { ...req.body };
    const actor = updates.actor;
    delete updates.actor;
    delete updates.petitionNo;
    delete updates._id;
    delete updates.revisionOf;     // revisionOf is set on create only
    delete updates.approvedAt;     // server-managed
    delete updates.rejectedAt;     // server-managed

    const before = await Petition.findById(req.params.id);
    if (!before) return res.status(404).json({ error: { message: 'ไม่พบคำร้อง' } });

    // Terminal-state guard
    if ((before.status === 'approved' || before.status === 'rejected') && updates.status && updates.status !== before.status) {
      return res.status(409).json({ error: { message: 'คำร้องนี้ปิดแล้ว ไม่สามารถเปลี่ยนสถานะได้' } });
    }

    // Approve transition: success → approved
    if (updates.status === 'approved') {
      if (before.status !== 'success') {
        return res.status(409).json({ error: { message: 'อนุมัติได้เฉพาะคำร้องสถานะ "ทดสอบเสร็จสิ้น"' } });
      }
      before.status = 'approved';
      before.approvedAt = new Date();
      before.reviewHistory.push({
        action: 'approve',
        reviewedBy: actor || 'system',
        reviewedAt: new Date(),
      });
      await before.save();
      logAudit(before, {
        event: 'statusChanged',
        fromStatus: 'success',
        toStatus: 'approved',
        actor: actor || 'system',
        note: 'อนุมัติคำร้อง',
      });
      return res.json(before);
    }

    // Reject transition: success → rejected
    if (updates.status === 'rejected') {
      if (before.status !== 'success') {
        return res.status(409).json({ error: { message: 'ส่งกลับให้แก้ไขได้เฉพาะคำร้องสถานะ "ทดสอบเสร็จสิ้น"' } });
      }
      const note = String(updates.revisionNote || '').trim();
      if (!note) {
        return badRequest(res, 'กรุณาระบุข้อความที่ต้องการให้แก้ไข');
      }
      before.status = 'rejected';
      before.rejectedAt = new Date();
      before.reviewHistory.push({
        action: 'reject',
        reviewedBy: actor || 'system',
        reviewedAt: new Date(),
        note,
      });
      await before.save();
      logAudit(before, {
        event: 'statusChanged',
        fromStatus: 'success',
        toStatus: 'rejected',
        actor: actor || 'system',
        note: `ส่งกลับให้แก้ไข: ${note}`,
      });
      return res.json(before);
    }

    // Generic update path (no terminal transition)
    delete updates.revisionNote;
    const doc = await Petition.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (before.status !== doc.status) {
      logAudit(doc, {
        event: 'statusChanged',
        fromStatus: before.status,
        toStatus: doc.status,
        actor: actor || 'system',
        note: 'อัปเดตคำร้อง',
      });
    } else {
      logAudit(doc, {
        event: 'updated',
        toStatus: doc.status,
        actor: actor || 'system',
        note: 'อัปเดตคำร้อง',
      });
    }
    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

// POST /api/petitions/:id/review  → append a review entry & update status
router.post('/:id/review', async (req, res) => {
  try {
    const { action, reviewedBy, note, specificGravities, status, items } = req.body || {};
    if (!action || !reviewedBy) return badRequest(res, 'ข้อมูลรีวิวไม่ครบ');
    const doc = await Petition.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: { message: 'ไม่พบคำร้อง' } });
    const prevStatus = doc.status;
    doc.reviewHistory.push({
      action,
      reviewedBy,
      reviewedAt: new Date(),
      note,
      specificGravities: specificGravities || [],
    });
    if (status) doc.status = status;
    if (Array.isArray(items)) {
      // merge per-seq
      for (const incoming of items) {
        const target = doc.items.find((it) => it.seq === incoming.seq);
        if (target) Object.assign(target, incoming);
      }
    }
    await doc.save();
    logAudit(doc, {
      event: prevStatus !== doc.status ? 'statusChanged' : 'reviewed',
      fromStatus: prevStatus,
      toStatus: doc.status,
      actor: reviewedBy,
      note: note || `พิจารณา: ${action}`,
      metadata: { action },
    });
    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

// DELETE /api/petitions/:id
router.delete('/:id', async (req, res) => {
  try {
    const doc = await Petition.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: { message: 'ไม่พบคำร้อง' } });
    logAudit(doc, {
      event: 'deleted',
      fromStatus: doc.status,
      actor: req.query.actor || 'system',
      note: 'ลบคำร้อง',
    });
    const sampleIds = sampleIdsFromPetition(doc);
    if (sampleIds.length > 0) {
      await Promise.all([
        Sample.deleteMany({ id: { $in: sampleIds } }),
        PhysicalResult.deleteMany({ sampleId: { $in: sampleIds } }),
        Approval.deleteMany({ sampleId: { $in: sampleIds } }),
        RealtimeDensity.deleteMany({ sampleId: { $in: sampleIds } }),
      ]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

module.exports = router;
