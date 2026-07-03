const express = require('express');
const router = express.Router();
const { StockSolvent } = require('../models/Stock');
const StockTransaction = require('../models/StockTransaction');
const ChemicalRequisition = require('../models/ChemicalRequisition');
const { buildDeductNote, normalizeReqInput } = require('../lib/chemicalRequisition');

async function logTx(data) {
  try { await StockTransaction.create(data); }
  catch (err) { console.error('logTransaction failed:', err.message); }
}

// GET /chemical-requisitions?room=&date=
router.get('/', async (req, res) => {
  try {
    const { room, date } = req.query;
    const q = {};
    if (room) q.roomSlug = String(room);
    if (date && date !== 'all') q.date = String(date);
    const rows = await ChemicalRequisition.find(q).sort({ createdAt: -1 }).lean();
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /chemical-requisitions — atomic deduct + log + record
router.post('/', async (req, res) => {
  try {
    const norm = normalizeReqInput(req.body);
    if (norm.error) return res.status(400).json({ error: norm.error });
    const v = norm.value;

    const solvent = await StockSolvent.findById(v.solventId);
    if (!solvent) return res.status(404).json({ error: 'ไม่พบสารเคมี' });

    // atomic — guards against negative qty / race
    const updated = await StockSolvent.findOneAndUpdate(
      { _id: v.solventId, qty: { $gte: v.qty } },
      { $inc: { qty: -v.qty } },
      { new: true },
    );
    if (!updated) return res.status(400).json({ error: 'จำนวน stock ไม่พอ' });

    await logTx({
      itemType: 'solvent',
      itemId: solvent._id.toString(),
      itemName: solvent.name,
      action: 'deduct',
      beforeQty: updated.qty + v.qty,
      afterQty: updated.qty,
      delta: -v.qty,
      unit: 'bottle',
      note: buildDeductNote(v.instrumentName, v.note),
      userEmail: v.requestedBy.email,
      userName: v.requestedBy.name,
    });

    const requisition = await ChemicalRequisition.create({
      date: v.date,
      roomSlug: v.roomSlug,
      instrumentId: v.instrumentId,
      instrumentName: v.instrumentName,
      itemType: 'solvent',
      solventId: solvent._id.toString(),
      solventName: solvent.name,
      qty: v.qty,
      unit: 'bottle',
      note: v.note,
      requestedBy: v.requestedBy,
    });

    res.status(201).json({ requisition, solvent: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /chemical-requisitions/:id — soft-delete + restore qty
router.delete('/:id', async (req, res) => {
  try {
    const doc = await ChemicalRequisition.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'ไม่พบรายการ' });

    let restored = null;
    if (doc.solventId) {
      restored = await StockSolvent.findByIdAndUpdate(
        doc.solventId,
        { $inc: { qty: doc.qty } },
        { new: true },
      );
    }
    if (restored) {
      await logTx({
        itemType: 'solvent',
        itemId: doc.solventId,
        itemName: doc.solventName,
        action: 'receive',
        beforeQty: restored.qty - doc.qty,
        afterQty: restored.qty,
        delta: doc.qty,
        unit: 'bottle',
        note: `ยกเลิกเบิก ${doc.instrumentName || '-'}`,
      });
    }
    await doc.softDelete(doc.requestedBy?.name || 'system');
    res.json({ ok: true, solvent: restored || null });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
