const express = require('express');
const router = express.Router();
const TempHum = require('../models/TempHum');

// How long a click-trigger stays valid before it's considered expired (the
// user gave up / Node-RED never answered).
const TRIGGER_TTL_MS = Number(process.env.TEMPHUM_TRIGGER_TTL_MS || 30000);
// If Node-RED claimed a trigger but hasn't posted a reading back within this
// window, hand the same trigger out again (lets Node-RED retry).
const RECLAIM_MS = Number(process.env.TEMPHUM_RECLAIM_MS || 8000);

// Pending click-triggers, in memory only. Node-RED polls these; the actual
// readings are the only thing that ends up in the DB.
//   id -> { id, board, status: 'pending'|'claimed'|'done'|'expired',
//           requestedAt, claimedAt, doneAt, result }
const requests = new Map();

function newId() {
  return `t_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

// Mark over-age pending/claimed triggers as expired.
function purgeExpired() {
  const now = Date.now();
  for (const r of requests.values()) {
    if ((r.status === 'pending' || r.status === 'claimed') && now - r.requestedAt > TRIGGER_TTL_MS) {
      r.status = 'expired';
    }
  }
}

// ── Click side (LIS app) ──────────────────────────────────────────────

// POST /api/temphum/trigger — the user clicked "capture". Records a pending
// trigger and returns its id; the client then polls /status/:id.
router.post('/trigger', (req, res) => {
  const board = req.body && req.body.board;
  const id = newId();
  requests.set(id, { id, board, status: 'pending', requestedAt: Date.now() });
  res.json({ id, status: 'pending' });
});

// GET /api/temphum/status/:id — client polls this until status is 'done'.
router.get('/status/:id', (req, res) => {
  purgeExpired();
  const r = requests.get(req.params.id);
  if (!r) return res.status(404).json({ status: 'unknown' });
  res.json({ status: r.status, result: r.result || null, requestedAt: r.requestedAt, doneAt: r.doneAt || null });
});

// ── Node-RED side ─────────────────────────────────────────────────────

// GET /api/temphum/trigger — Node-RED polls this. Hands out the oldest
// pending trigger (or a claimed one that's gone stale, for retry).
router.get('/trigger', (req, res) => {
  purgeExpired();
  const now = Date.now();
  const candidates = [...requests.values()]
    .filter(r => r.status === 'pending' || (r.status === 'claimed' && now - r.claimedAt > RECLAIM_MS))
    .sort((a, b) => a.requestedAt - b.requestedAt);
  const r = candidates[0];
  if (!r) return res.json({ pending: false });
  r.status = 'claimed';
  r.claimedAt = now;
  res.json({ pending: true, id: r.id, board: r.board });
});

// POST /api/temphum — Node-RED posts the reading it just took. Saves it to
// the DB and resolves the matching trigger. Body: { id?, board, hum, temp }.
router.post('/', async (req, res) => {
  try {
    const { id, board, hum, temp } = req.body || {};
    if (!board) return res.status(400).json({ error: 'board required' });
    const doc = await TempHum.create({
      board,
      hum: hum != null ? Number(hum) : undefined,
      temp: temp != null ? Number(temp) : undefined,
      receivedAt: new Date().toISOString(),
    });

    // Resolve the trigger: prefer the echoed id, else the oldest open trigger
    // for this board, else any oldest open trigger.
    let r = id ? requests.get(id) : null;
    if (!r) {
      const open = [...requests.values()]
        .filter(x => x.status === 'pending' || x.status === 'claimed')
        .sort((a, b) => a.requestedAt - b.requestedAt);
      r = open.find(x => x.board === board) || open[0];
    }
    if (r) {
      r.status = 'done';
      r.doneAt = Date.now();
      r.result = doc;
    }
    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── History ───────────────────────────────────────────────────────────

// GET /api/temphum — saved readings, newest first.
router.get('/', async (req, res) => {
  try {
    const records = await TempHum.find().sort({ createdAt: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/temphum/:id — remove a saved record.
router.delete('/:id', async (req, res) => {
  try {
    await TempHum.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
