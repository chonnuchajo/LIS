const express = require('express');
const router = express.Router();
const EquipmentCheck = require('../models/EquipmentCheck');

const todayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// GET /api/equipment-checks
// Query: ?room=<slug> (required) | ?date=YYYY-MM-DD|all | ?from=&to= | ?instrumentId= | ?status=normal|abnormal
// Default date: today
router.get('/', async (req, res) => {
  try {
    const { room, date, from, to, instrumentId, status } = req.query;
    if (!room) return res.status(400).json({ error: 'room ต้องระบุ' });

    const q = { roomSlug: String(room) };

    if (from || to) {
      q.date = {};
      if (from) q.date.$gte = String(from);
      if (to) q.date.$lte = String(to);
    } else if (date === 'all') {
      // no date filter
    } else {
      q.date = date ? String(date) : todayStr();
    }

    if (instrumentId) q.instrumentId = String(instrumentId);
    if (status) q.status = String(status);

    const records = await EquipmentCheck.find(q).sort({ checkedAt: -1 }).lean();
    res.json({ data: records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/equipment-checks
router.post('/', async (req, res) => {
  try {
    const {
      roomSlug, instrumentId, instrumentName, brand,
      status, readings, note,
      recorder, recorderId, recorderEmail,
    } = req.body;

    if (!roomSlug || !instrumentId || !instrumentName) {
      return res.status(400).json({ error: 'roomSlug, instrumentId และ instrumentName ต้องระบุ' });
    }
    if (status !== 'normal' && status !== 'abnormal') {
      return res.status(400).json({ error: 'status ต้องเป็น normal หรือ abnormal' });
    }
    if (!recorder || !String(recorder).trim()) {
      return res.status(400).json({ error: 'recorder ต้องระบุ' });
    }

    let cleanReadings = [];
    if (Array.isArray(readings)) {
      for (const r of readings) {
        if (typeof r.value !== 'number' || Number.isNaN(r.value)) {
          return res.status(400).json({ error: `ค่า ${r.label || r.key} ต้องเป็นตัวเลข` });
        }
        cleanReadings.push({
          key: String(r.key),
          label: r.label ? String(r.label) : '',
          value: r.value,
          unit: r.unit ? String(r.unit) : '',
        });
      }
    }

    const created = await EquipmentCheck.create({
      roomSlug: String(roomSlug),
      instrumentId: String(instrumentId),
      instrumentName: String(instrumentName),
      brand: brand || '',
      status,
      readings: cleanReadings,
      note: note ? String(note) : '',
      recorder: String(recorder).trim(),
      recorderId: recorderId || '',
      recorderEmail: recorderEmail || '',
      date: todayStr(),
      checkedAt: new Date(),
    });

    res.status(201).json({ data: created });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
