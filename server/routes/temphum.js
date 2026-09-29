const express = require('express');
const router = express.Router();

// Push model: Node-RED POSTs each room's reading roughly every minute. We keep
// only the latest reading per board IN MEMORY — nothing is written to the DB
// here. A row is persisted only when the user saves a daily check (EnvCheck);
// see routes/env-checks.js. Server restart drops the cache, which is fine since
// Node-RED repopulates it within a minute.
//   board -> { board, temp, hum, receivedAt }
const latest = new Map();
const MAX_BOARDS = 1000;
const MIN_TEMP = -100;
const MAX_TEMP = 150;
const MIN_HUM = 0;
const MAX_HUM = 100;

// POST /api/temphum — Node-RED pushes a reading. Body: { board, hum, temp }.
router.post('/', (req, res) => {
  const { board, hum, temp } = req.body || {};
  if (!board || typeof board !== 'string' || board.length > 100) {
    return res.status(400).json({ error: 'board required' });
  }
  const numeric = (value, min, max) => {
    if (value == null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
  };
  const normalizedTemp = numeric(temp, MIN_TEMP, MAX_TEMP);
  const normalizedHum = numeric(hum, MIN_HUM, MAX_HUM);
  if (normalizedTemp === undefined || normalizedHum === undefined) {
    return res.status(400).json({ error: 'ค่าอุณหภูมิหรือความชื้นไม่ถูกต้อง' });
  }
  if (!latest.has(board) && latest.size >= MAX_BOARDS) {
    return res.status(429).json({ error: 'จำนวน board เกินขีดจำกัด' });
  }
  const reading = {
    board,
    hum: normalizedHum,
    temp: normalizedTemp,
    receivedAt: new Date().toISOString(),
  };
  latest.set(board, reading);
  res.json(reading);
});

// GET /api/temphum — latest live reading per board (in-memory snapshot).
router.get('/', (req, res) => {
  res.json([...latest.values()]);
});

module.exports = router;
