const express = require('express');
const router = express.Router();
const EnvRoomConfig = require('../models/EnvRoomConfig');

// Mirror of src/lib/dailyCheckEnv.ts ENV_ROOMS defaults (boardId default = slug demo).
const ROOM_DEFAULTS = [
  { slug: 'balance',     boardId: 'balance',     tempMin: 15, tempMax: 25, humidityMax: 70 },
  { slug: 'sample-prep', boardId: 'sample-prep', tempMin: 15, tempMax: 25, humidityMax: 70 },
  { slug: 'analysis',    boardId: 'analysis',    tempMin: 15, tempMax: 25, humidityMax: 70 },
];
const ALLOWED_SLUGS = ROOM_DEFAULTS.map((r) => r.slug);

function pick(doc) {
  return {
    slug: doc.slug,
    boardId: doc.boardId || '',
    tempMin: doc.tempMin,
    tempMax: doc.tempMax,
    humidityMax: doc.humidityMax,
  };
}

// Validate thresholds; mirrors validateEnvRoomConfig on the client. Returns
// an error string or null.
function validate(body) {
  const { tempMin, tempMax, humidityMax } = body;
  for (const [field, v] of [['tempMin', tempMin], ['tempMax', tempMax], ['humidityMax', humidityMax]]) {
    if (typeof v !== 'number' || !Number.isFinite(v)) return `${field} ต้องเป็นตัวเลข`;
  }
  if (tempMin > tempMax) return 'อุณหภูมิต่ำสุดต้องไม่เกินสูงสุด';
  if (humidityMax <= 0) return 'ความชื้นสูงสุดต้องมากกว่า 0';
  return null;
}

// GET /api/env-room-config — always returns all 3 rooms (DB doc or default).
router.get('/', async (req, res) => {
  try {
    const docs = await EnvRoomConfig.find().lean();
    const bySlug = new Map(docs.map((d) => [d.slug, d]));
    const data = ROOM_DEFAULTS.map((def) => {
      const d = bySlug.get(def.slug);
      return d ? pick(d) : { ...def };
    });
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/env-room-config/:slug — upsert one room's board + thresholds.
router.put('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    if (!ALLOWED_SLUGS.includes(slug)) {
      return res.status(400).json({ error: 'slug ไม่ถูกต้อง' });
    }
    const err = validate(req.body || {});
    if (err) return res.status(400).json({ error: err });

    const { boardId, tempMin, tempMax, humidityMax } = req.body;
    const doc = await EnvRoomConfig.findOneAndUpdate(
      { slug },
      { slug, boardId: typeof boardId === 'string' ? boardId : '', tempMin, tempMax, humidityMax },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();

    res.json({ data: pick(doc) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
