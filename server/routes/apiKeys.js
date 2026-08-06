const express = require('express');
const ApiKey = require('../models/ApiKey');
const ApiRequestLog = require('../models/ApiRequestLog');
const ApiPolicyMode = require('../models/ApiPolicyMode');
const { API_SCOPES, API_POLICIES, POLICY_MODES, policyPublicPath } = require('../lib/apiPolicy');
const { generateApiKey, keyStatus } = require('../lib/apiKeyAuth');
const { modeCache, loadModesFromDb, resolveMode } = require('../lib/policyModes');
const { requireAdminUser } = require('../lib/adminGate');

const router = express.Router();

// ทุก endpoint ในนี้เป็นของ admin เท่านั้น และ /api-keys ต้องไม่ถูกใส่ใน
// apiPolicy.js ตลอดไป → API key เรียก route จัดการ key ไม่ได้ (key ออก key ไม่ได้)
router.use(requireAdminUser);

const SCOPE_IDS = API_SCOPES.map((s) => s.id);

function serializeKey(doc, now = new Date()) {
  return {
    id: String(doc._id),
    name: doc.name,
    keyPrefix: doc.keyPrefix,
    scopes: doc.scopes || [],
    expiresAt: doc.expiresAt ? new Date(doc.expiresAt).toISOString() : null,
    revokedAt: doc.revokedAt ? new Date(doc.revokedAt).toISOString() : null,
    rateLimitPerMinute: doc.rateLimitPerMinute ?? 120,
    lastUsedAt: doc.lastUsedAt ? new Date(doc.lastUsedAt).toISOString() : null,
    usageCount: doc.usageCount ?? 0,
    createdBy: doc.createdBy || '',
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
    status: keyStatus(doc, now),
  };
}

function parseScopes(input) {
  const scopes = Array.isArray(input) ? input.map(String) : [];
  const unknown = scopes.filter((s) => !SCOPE_IDS.includes(s));
  if (unknown.length) throw new Error(`scope ไม่รู้จัก: ${unknown.join(', ')}`);
  return scopes;
}

function parseExpiresAt(input) {
  if (input === undefined || input === null || input === '') return null;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) throw new Error('วันหมดอายุไม่ถูกต้อง');
  return date;
}

// --- routes ที่มี path คงที่ ต้อง register ก่อน '/:id' ---------------------

// GET /api-keys/meta — ทะเบียน scope + endpoint + โหมดปัจจุบัน + สถิติ 7 วัน
router.get('/meta', async (req, res) => {
  try {
    const modes = await loadModesFromDb();
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const stats = await ApiRequestLog.aggregate([
      { $match: { at: { $gte: since }, outcome: 'audit-pass', reason: { $ne: 'ok' } } },
      { $group: { _id: '$policyId', count: { $sum: 1 } } },
    ]);
    const wouldBlock = Object.fromEntries(stats.map((s) => [s._id, s.count]));
    res.json({
      data: {
        scopes: API_SCOPES,
        modes: POLICY_MODES,
        policies: API_POLICIES.map((p) => ({
          id: p.id,
          label: p.label,
          methods: p.methods,
          path: policyPublicPath(p),
          scope: p.scope,
          mode: resolveMode(modes, p),
          legacyEnv: p.legacyEnv || null,
          wouldBlock7d: wouldBlock[p.id] || 0,
        })),
      },
    });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// GET /api-keys/logs?keyId=&outcome=&limit=
router.get('/logs', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const filter = {};
    if (req.query.keyId) filter.keyId = req.query.keyId;
    if (req.query.outcome) filter.outcome = String(req.query.outcome);
    if (req.query.policyId) filter.policyId = String(req.query.policyId);
    const docs = await ApiRequestLog.find(filter).sort({ at: -1 }).limit(limit).lean();
    res.json({
      data: docs.map((d) => ({
        id: String(d._id),
        at: new Date(d.at).toISOString(),
        keyName: d.keyName || '',
        method: d.method,
        path: d.path,
        policyId: d.policyId,
        mode: d.mode,
        outcome: d.outcome,
        reason: d.reason,
        ip: d.ip,
        status: d.status,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// PATCH /api-keys/policy/:policyId — สลับโหมด off/audit/enforce
router.patch('/policy/:policyId', async (req, res) => {
  try {
    const policy = API_POLICIES.find((p) => p.id === req.params.policyId);
    if (!policy) return res.status(404).json({ error: { message: 'ไม่พบ endpoint นี้ในทะเบียน' } });
    const mode = String(req.body?.mode || '');
    if (!POLICY_MODES.includes(mode)) {
      return res.status(400).json({ error: { message: 'โหมดต้องเป็น off / audit / enforce' } });
    }
    await ApiPolicyMode.findOneAndUpdate(
      { policyId: policy.id },
      { $set: { mode, updatedBy: req.adminUser?.email || '' } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    modeCache.invalidate();
    res.json({ data: { policyId: policy.id, mode } });
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

// --- CRUD ของตัว key -------------------------------------------------------

router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const docs = await ApiKey.find().sort({ createdAt: -1 }).lean();
    res.json({ data: docs.map((d) => serializeKey(d, now)) });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api-keys — คืน rawKey ครั้งเดียวเท่านั้น หลังจากนี้ไม่มีที่ไหนเก็บอีก
router.post('/', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: { message: 'ต้องตั้งชื่อ key' } });
    const scopes = parseScopes(req.body?.scopes);
    if (scopes.length === 0) return res.status(400).json({ error: { message: 'ต้องเลือกอย่างน้อย 1 scope' } });
    const { rawKey, keyHash, keyPrefix } = generateApiKey();
    const doc = await ApiKey.create({
      name,
      keyPrefix,
      keyHash,
      scopes,
      expiresAt: parseExpiresAt(req.body?.expiresAt),
      rateLimitPerMinute: Number(req.body?.rateLimitPerMinute ?? 120),
      createdBy: req.adminUser?.email || '',
    });
    res.status(201).json({ data: { ...serializeKey(doc.toObject()), rawKey } });
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const patch = {};
    if (req.body?.name !== undefined) patch.name = String(req.body.name).trim();
    if (req.body?.scopes !== undefined) patch.scopes = parseScopes(req.body.scopes);
    if (req.body?.expiresAt !== undefined) patch.expiresAt = parseExpiresAt(req.body.expiresAt);
    if (req.body?.rateLimitPerMinute !== undefined) {
      patch.rateLimitPerMinute = Number(req.body.rateLimitPerMinute);
    }
    const doc = await ApiKey.findByIdAndUpdate(req.params.id, { $set: patch }, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ error: { message: 'ไม่พบ key นี้' } });
    res.json({ data: serializeKey(doc.toObject()) });
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

router.post('/:id/revoke', async (req, res) => {
  try {
    const doc = await ApiKey.findByIdAndUpdate(
      req.params.id,
      { $set: { revokedAt: new Date(), revokedBy: req.adminUser?.email || '' } },
      { new: true },
    );
    if (!doc) return res.status(404).json({ error: { message: 'ไม่พบ key นี้' } });
    res.json({ data: serializeKey(doc.toObject()) });
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const doc = await ApiKey.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: { message: 'ไม่พบ key นี้' } });
    await doc.softDelete(req.adminUser?.email || '');
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

module.exports = router;
module.exports.serializeKey = serializeKey;
