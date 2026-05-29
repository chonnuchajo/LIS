const express = require('express');
const StandardOverride = require('../models/StandardOverride');

const router = express.Router();

const UNITS = new Set(StandardOverride.UNITS);
const MATCH_TYPES = new Set(StandardOverride.MATCH_TYPES);
const SCOPES = new Set(StandardOverride.SCOPES);
const MAX_SLOTS = 20;
const MAX_SLOT_VALUE = 10000;
const MAX_VAL_LEN = 200;

function validateInstrument(payload, fieldPrefix) {
  if (!payload || typeof payload !== 'object') {
    return { ok: { enabled: false, unit: 'ml', slots: [] } };
  }
  const enabled = Boolean(payload.enabled);
  const unit = String(payload.unit || 'ml');
  if (!UNITS.has(unit)) return { message: `${fieldPrefix}.unit invalid`, field: `${fieldPrefix}.unit` };
  const slotsRaw = Array.isArray(payload.slots) ? payload.slots : [];
  if (slotsRaw.length > MAX_SLOTS) return { message: `${fieldPrefix}.slots > ${MAX_SLOTS}`, field: `${fieldPrefix}.slots` };
  const slots = [];
  for (const v of slotsRaw) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0 || n > MAX_SLOT_VALUE) {
      return { message: `${fieldPrefix}.slots invalid value`, field: `${fieldPrefix}.slots` };
    }
    slots.push(n);
  }
  if (enabled && slots.length < 1) return { message: `${fieldPrefix}.slots required when enabled`, field: `${fieldPrefix}.slots` };
  return { ok: { enabled, unit, slots } };
}

function buildBody(body, requireMatchType) {
  const errors = [];
  if (requireMatchType) {
    const mt = String(body && body.matchType || '');
    if (!MATCH_TYPES.has(mt)) errors.push({ message: 'matchType invalid', field: 'matchType' });
  }
  const matchValue = String((body && body.matchValue) || '').trim();
  if (!matchValue) errors.push({ message: 'matchValue required', field: 'matchValue' });
  if (matchValue.length > MAX_VAL_LEN) errors.push({ message: 'matchValue too long', field: 'matchValue' });
  const scope = String((body && body.scope) || 'substanceOnly');
  if (!SCOPES.has(scope)) errors.push({ message: 'scope invalid', field: 'scope' });
  const priority = Number(body && body.priority);
  if (body && body.priority !== undefined && !Number.isFinite(priority)) {
    errors.push({ message: 'priority must be a number', field: 'priority' });
  }
  const gc = validateInstrument(body && body.gc, 'gc');
  if (gc.message) errors.push(gc);
  const hplc = validateInstrument(body && body.hplc, 'hplc');
  if (hplc.message) errors.push(hplc);
  if (errors.length) return { error: errors[0] };
  return {
    value: {
      matchValue,
      matchValueLower: matchValue.toLowerCase(),
      scope,
      note: String((body && body.note) || ''),
      priority: Number.isFinite(priority) ? priority : 0,
      gc: gc.ok,
      hplc: hplc.ok,
    },
  };
}

router.get('/', async (_req, res) => {
  try {
    const docs = await StandardOverride.find().sort({ priority: -1, createdAt: 1 }).lean();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const built = buildBody(req.body, true);
    if (built.error) return res.status(400).json(built.error);
    const matchType = String(req.body.matchType);
    const doc = await StandardOverride.create({ matchType, ...built.value });
    res.status(201).json(doc.toObject());
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ message: 'duplicate rule (same matchType + matchValue)' });
    }
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const built = buildBody(req.body, false);
    if (built.error) return res.status(400).json(built.error);
    // matchType is immutable — never updated
    const doc = await StandardOverride.findByIdAndUpdate(
      req.params.id,
      { $set: built.value },
      { new: true },
    ).lean();
    if (!doc) return res.status(404).json({ message: 'not found' });
    res.json(doc);
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ message: 'duplicate rule' });
    }
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const doc = await StandardOverride.findByIdAndDelete(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
