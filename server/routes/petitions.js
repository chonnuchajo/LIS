const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Petition = require('../models/Petition');
const Sample = require('../models/Sample');
const PhysicalResult = require('../models/PhysicalResult');
const Approval = require('../models/Approval');
const RealtimeDensity = require('../models/RealtimeDensity');

function sampleIdsFromPetition(petition) {
  if (!petition || !Array.isArray(petition.items)) return [];
  return petition.items
    .map((item) => item.sampleId || `${petition.petitionNo}-${item.seq}`)
    .filter(Boolean);
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
    const search = (req.query.search || '').trim();

    const q = {};
    if (status) q.status = status;
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      q.$or = [
        { petitionNo: rx },
        { 'requester.fullName': rx },
        { 'requester.department': rx },
      ];
    }

    const [items, total] = await Promise.all([
      Petition.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Petition.countDocuments(q),
    ]);
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

// GET /api/petitions/:id
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const doc = mongoose.Types.ObjectId.isValid(id)
      ? await Petition.findById(id).lean()
      : await Petition.findOne({ petitionNo: id }).lean();
    if (!doc) return res.status(404).json({ error: { message: 'ไม่พบคำร้อง' } });
    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

// POST /api/petitions
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.requester?.fullName || !body.requester?.department) {
      return badRequest(res, 'กรุณากรอกชื่อ-นามสกุลและแผนก');
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return badRequest(res, 'ต้องมีตัวอย่างอย่างน้อย 1 รายการ');
    }
    const petitionNo = await nextPetitionNo();
    const doc = await Petition.create({
      ...body,
      petitionNo,
      status: 'deliveringQC',
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
    const doc = await Petition.findOneAndUpdate(q, { status: 'sampleSent' }, { new: true });
    if (!doc) return res.status(404).json({ error: { message: 'ไม่พบคำร้อง' } });
    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

// PATCH /api/petitions/:id/assign
router.patch('/:id/assign', async (req, res) => {
  try {
    const { employeeId, name, department, position, assignedBy } = req.body || {};
    if (!employeeId || !name) return badRequest(res, 'กรุณาเลือกเจ้าหน้าที่');

    const q = mongoose.Types.ObjectId.isValid(req.params.id)
      ? { _id: req.params.id }
      : { petitionNo: req.params.id };

    const doc = await Petition.findOne(q);
    if (!doc) return res.status(404).json({ error: { message: 'ไม่พบคำร้อง' } });

    doc.assignedTo = {
      employeeId: String(employeeId).trim(),
      name: String(name).trim(),
      department: department ? String(department).trim() : undefined,
      position: position ? String(position).trim() : undefined,
      assignedAt: new Date(),
      assignedBy: assignedBy ? String(assignedBy).trim() : undefined,
    };
    if (doc.status === 'pendingReview') doc.status = 'inProgress';

    await doc.save();
    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

// PATCH /api/petitions/:id  (general update; only allowed when status === deliveringQC for end users)
router.patch('/:id', async (req, res) => {
  try {
    const updates = { ...req.body };
    delete updates.petitionNo;
    delete updates._id;
    const doc = await Petition.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!doc) return res.status(404).json({ error: { message: 'ไม่พบคำร้อง' } });
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
