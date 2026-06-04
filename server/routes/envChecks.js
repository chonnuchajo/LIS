const express = require('express');
const router = express.Router();
const EnvCheck = require('../models/EnvCheck');

const todayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const evalTemp = (t, min, max) => (t >= min && t <= max ? 'pass' : 'fail');
const evalHum = (h, max) => (h <= max ? 'pass' : 'fail');

// GET /api/env-checks
// Query: ?date=YYYY-MM-DD|all | ?from=&to= | ?room= | ?status=pass|fail ; default today
router.get('/', async (req, res) => {
  try {
    const { date, from, to, room, status } = req.query;
    const q = {};
    if (from || to) {
      q.date = {};
      if (from) q.date.$gte = String(from);
      if (to) q.date.$lte = String(to);
    } else if (date === 'all') {
      // no date filter
    } else {
      q.date = date ? String(date) : todayStr();
    }
    if (room) q.room = String(room);
    if (status) q.status = String(status);

    const records = await EnvCheck.find(q).sort({ checkedAt: -1 }).lean();
    res.json({ data: records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/env-checks
router.post('/', async (req, res) => {
  try {
    const {
      room, roomName, temperature, humidity,
      tempMin, tempMax, humidityMax,
      note, recorder, recorderId, recorderEmail,
    } = req.body;

    if (!room || !roomName) {
      return res.status(400).json({ error: 'room และ roomName ต้องระบุ' });
    }
    if (typeof temperature !== 'number' || typeof humidity !== 'number') {
      return res.status(400).json({ error: 'temperature และ humidity ต้องเป็นตัวเลข' });
    }
    if (typeof tempMin !== 'number' || typeof tempMax !== 'number' || typeof humidityMax !== 'number') {
      return res.status(400).json({ error: 'เกณฑ์ tempMin/tempMax/humidityMax ต้องเป็นตัวเลข' });
    }
    if (!recorder || !String(recorder).trim()) {
      return res.status(400).json({ error: 'recorder ต้องระบุ' });
    }

    const tempStatus = evalTemp(temperature, tempMin, tempMax);
    const humidityStatus = evalHum(humidity, humidityMax);
    const status = (tempStatus === 'pass' && humidityStatus === 'pass') ? 'pass' : 'fail';

    const created = await EnvCheck.create({
      room, roomName, temperature, humidity,
      tempMin, tempMax, humidityMax,
      tempStatus, humidityStatus, status,
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

// GET /api/env-checks/summary/today
router.get('/summary/today', async (req, res) => {
  try {
    const date = todayStr();
    const records = await EnvCheck.find({ date }).lean();
    const rooms = [...new Set(records.map(r => r.room))];
    res.json({
      data: {
        date,
        count: records.length,
        rooms,
        allPass: records.length > 0 && records.every(r => r.status === 'pass'),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
