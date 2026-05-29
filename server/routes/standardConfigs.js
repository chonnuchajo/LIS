const express = require('express');
const mongoose = require('mongoose');
const StandardConfig = require('../models/StandardConfig');
const { parseSubstances, substanceKey } = require('../utils/substances');

const router = express.Router();

const UNITS = new Set(StandardConfig.UNITS);
const MAX_SLOTS = 20;
const MAX_SLOT_VALUE = 10000;
const MAX_NAME_LEN = 200;

function validateInstrument(payload, fieldPrefix) {
  if (!payload || typeof payload !== 'object') return null;
  const enabled = Boolean(payload.enabled);
  const unit = String(payload.unit || 'ml');
  if (!UNITS.has(unit)) {
    return { message: `${fieldPrefix}.unit must be one of ${[...UNITS].join(', ')}`, field: `${fieldPrefix}.unit` };
  }
  const slotsRaw = Array.isArray(payload.slots) ? payload.slots : [];
  if (slotsRaw.length > MAX_SLOTS) {
    return { message: `${fieldPrefix}.slots may have at most ${MAX_SLOTS} values`, field: `${fieldPrefix}.slots` };
  }
  const slots = [];
  for (const v of slotsRaw) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0 || n > MAX_SLOT_VALUE) {
      return { message: `${fieldPrefix}.slots must contain positive numbers ≤ ${MAX_SLOT_VALUE}`, field: `${fieldPrefix}.slots` };
    }
    slots.push(n);
  }
  if (enabled && slots.length < 1) {
    return { message: `${fieldPrefix}.slots required when enabled`, field: `${fieldPrefix}.slots` };
  }
  return { ok: { enabled, unit, slots } };
}

function buildBody(body) {
  const errors = [];
  const gc = validateInstrument(body && body.gc, 'gc');
  if (gc && gc.message) errors.push(gc);
  const hplc = validateInstrument(body && body.hplc, 'hplc');
  if (hplc && hplc.message) errors.push(hplc);
  if (errors.length) return { error: errors[0] };
  return {
    value: {
      gc: gc ? gc.ok : { enabled: false, unit: 'ml', slots: [] },
      hplc: hplc ? hplc.ok : { enabled: false, unit: 'ml', slots: [] },
    },
  };
}

router.get('/', async (_req, res) => {
  try {
    const docs = await StandardConfig.find().lean();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const name = String((req.body && req.body.name) || '').trim();
    if (!name) return res.status(400).json({ message: 'name required', field: 'name' });
    if (name.length > MAX_NAME_LEN) return res.status(400).json({ message: `name too long (max ${MAX_NAME_LEN})`, field: 'name' });
    const built = buildBody(req.body);
    if (built.error) return res.status(400).json(built.error);
    const nameLower = name.toLowerCase();
    const existing = await StandardConfig.findOne({ nameLower }).lean();
    if (existing) return res.status(409).json({ message: 'standard already exists', field: 'name' });
    const doc = await StandardConfig.create({
      name,
      nameLower,
      isManual: true,
      gc: built.value.gc,
      hplc: built.value.hplc,
    });
    res.status(201).json(doc.toObject());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:nameLower', async (req, res) => {
  try {
    const nameLower = String(req.params.nameLower || '').trim().toLowerCase();
    if (!nameLower) return res.status(400).json({ message: 'nameLower required' });
    const built = buildBody(req.body);
    if (built.error) return res.status(400).json(built.error);
    const doc = await StandardConfig.findOneAndUpdate(
      { nameLower },
      { $set: { gc: built.value.gc, hplc: built.value.hplc } },
      { new: true },
    ).lean();
    if (!doc) return res.status(404).json({ message: 'not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:nameLower', async (req, res) => {
  try {
    const nameLower = String(req.params.nameLower || '').trim().toLowerCase();
    const doc = await StandardConfig.findOne({ nameLower }).lean();
    if (!doc) return res.status(404).json({ message: 'not found' });
    if (!doc.isManual) return res.status(400).json({ message: 'cannot delete derived standard' });
    await StandardConfig.deleteOne({ nameLower });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /sync — derive StandardConfig rows from master-items webhook + SimpleMethod.
// Fetches master items from the same n8n webhook as GET /api/master-items (server-to-server).
// SimpleMethod.instruments[i] gives the instrument for the i-th substance after parseSubstances().
router.post('/sync', async (_req, res) => {
  try {
    let SimpleMethod;
    try {
      SimpleMethod = mongoose.model('SimpleMethod');
    } catch (err) {
      return res.status(502).json({ message: 'simple-method model unavailable' });
    }

    // Fetch master items from the n8n webhook (same source as GET /api/master-items)
    const WEBHOOK_URL =
      process.env.MASTER_ITEMS_WEBHOOK_URL ||
      'https://n8n-plant.icpladda.com/webhook/API/Item-production';

    let masters;
    try {
      const r = await fetch(WEBHOOK_URL, { headers: { Accept: 'application/json' } });
      if (!r.ok) {
        return res.status(502).json({ message: `master items webhook returned ${r.status}` });
      }
      const payload = await r.json();
      masters = Array.isArray(payload) ? payload : [];
    } catch (err) {
      return res.status(502).json({ message: 'cannot reach master items webhook', error: err.message });
    }

    const simple = await SimpleMethod.find().lean();
    const itemNoKeys = ['item_no', 'itemCode', 'item_code', 'code', 'Code', 'ITEM_CODE'];
    const commonNameKeys = ['common_name', 'commonname', 'commonName', 'item_name2', 'itemType'];

    function pick(obj, keys) {
      for (const k of keys) {
        const v = obj && obj[k];
        if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
      }
      return '';
    }

    const itemNoToInstruments = new Map();
    for (const entry of simple) {
      const itemNo = String(entry.itemNo || '').trim();
      if (!itemNo) continue;
      itemNoToInstruments.set(itemNo, Array.isArray(entry.instruments) ? entry.instruments : []);
    }

    const initial = new Map();
    for (const m of masters) {
      const commonName = pick(m, commonNameKeys);
      const itemNo = pick(m, itemNoKeys);
      if (!commonName) continue;
      const substances = parseSubstances(commonName);
      const instruments = itemNoToInstruments.get(itemNo) || [];
      substances.forEach((sub, i) => {
        const key = substanceKey(sub);
        if (!key) return;
        const prev = initial.get(key) || { name: sub, gc: false, hplc: false };
        const instr = String(instruments[i] || '').toUpperCase();
        if (instr === 'GC') prev.gc = true;
        if (instr === 'HPLC') prev.hplc = true;
        initial.set(key, prev);
      });
    }

    let added = 0;
    let updated = 0;
    for (const [nameLower, info] of initial) {
      const existing = await StandardConfig.findOne({ nameLower }).lean();
      if (!existing) {
        await StandardConfig.create({
          name: info.name,
          nameLower,
          isManual: false,
          gc: { enabled: info.gc, unit: 'ml', slots: [] },
          hplc: { enabled: info.hplc, unit: 'ml', slots: [] },
        });
        added += 1;
        continue;
      }
      if (existing.isManual) continue;
      const patch = {};
      if (info.gc && !existing.gc.enabled) patch['gc.enabled'] = true;
      if (info.hplc && !existing.hplc.enabled) patch['hplc.enabled'] = true;
      if (Object.keys(patch).length) {
        await StandardConfig.updateOne({ nameLower }, { $set: patch });
        updated += 1;
      }
    }

    res.json({ added, updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
