const express = require('express');
const router = express.Router();

// Push model: Node-RED POSTs each room's reading roughly every minute. We keep
// only the latest reading per board IN MEMORY — nothing is written to the DB
// here. A row is persisted only when the user saves a daily check (EnvCheck);
// see routes/env-checks.js. Server restart drops the cache, which is fine since
// Node-RED repopulates it within a minute.
//   board -> { board, temp, hum, receivedAt }
const latest = new Map();

// POST /api/temphum — Node-RED pushes a reading. Body: { board, hum, temp }.
router.post('/', (req, res) => {
  const { board, hum, temp } = req.body || {};
  if (!board) return res.status(400).json({ error: 'board required' });
  const reading = {
    board,
    hum: hum != null ? Number(hum) : null,
    temp: temp != null ? Number(temp) : null,
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
