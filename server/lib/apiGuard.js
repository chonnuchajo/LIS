const { API_POLICIES, matchPolicy, normalizePath } = require('./apiPolicy');
const { hashApiKey, evaluateKey, checkRateLimit } = require('./apiKeyAuth');
const { resolveMode, modeCache } = require('./policyModes');
const ApiKey = require('../models/ApiKey');
const ApiRequestLog = require('../models/ApiRequestLog');

// รับ credential จาก header เท่านั้น — รวม header เดิมของ production-integration
// (x-integration-token) และ n8n (x-lis-ingest-key) ไว้ด้วย เพื่อให้ token เดิมยังทำงาน
// ระหว่างช่วงย้าย ⚠️ ห้ามรับผ่าน query string (?key=): หลุดเข้า access log ของ
// web server / browser history / Referer header ได้ ซึ่งไม่ได้อยู่ใต้การควบคุมของเรา
function extractCredential(req) {
  const bearer = (req.get('authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1];
  return (
    req.get('x-api-key') ||
    bearer ||
    req.get('x-integration-token') ||
    req.get('x-lis-ingest-key') ||
    ''
  );
}

function createApiGuard({
  policies = API_POLICIES,
  getModes,
  findKeyByHash,
  logRequest,
  touchKey,
  readEnv = (name) => process.env[name],
  rateState = new Map(),
  now = () => new Date(),
}) {
  return async function apiGuard(req, res, next) {
    const policy = matchPolicy(policies, req.method, req.originalUrl || req.url);
    if (!policy) return next(); // traffic ของหน้าเว็บทั้งหมดออกทางนี้

    let modes = {};
    try {
      modes = await getModes();
    } catch {
      modes = {}; // DB มีปัญหา → ใช้ defaultMode (audit) ไม่บล็อกใคร
    }
    const mode = resolveMode(modes, policy);
    if (mode === 'off') return next();

    const at = now();
    const path = normalizePath(req.originalUrl || req.url);
    const credential = String(extractCredential(req) || '');
    const legacyToken = policy.legacyEnv ? readEnv(policy.legacyEnv) : '';
    const isLegacy = Boolean(legacyToken && credential && credential === legacyToken);

    let keyDoc = null;
    let verdict = { decision: 'allow', reason: 'ok', status: 200 };
    let rate = { allowed: true, count: 0 };

    if (isLegacy) {
      verdict = { decision: 'allow', reason: 'legacy-token', status: 200 };
    } else {
      if (credential) {
        try {
          keyDoc = await findKeyByHash(hashApiKey(credential));
        } catch {
          keyDoc = null; // DB มีปัญหา → ถือเหมือนหา key ไม่เจอ (unknown-key) ไม่ทำให้ request พัง
        }
      }
      verdict = evaluateKey({ rawKeyPresented: Boolean(credential), keyDoc, policy, now: at });
      if (verdict.decision === 'allow') {
        rate = checkRateLimit(rateState, String(keyDoc._id), keyDoc.rateLimitPerMinute, at.getTime());
        if (!rate.allowed) verdict = { decision: 'deny', reason: 'rate-limited', status: 429 };
      }
    }

    const enforcing = mode === 'enforce';
    const blocked = enforcing && verdict.decision === 'deny';
    let outcome;
    if (isLegacy) outcome = 'legacy-token';
    else if (!enforcing) outcome = 'audit-pass';
    else if (verdict.decision === 'deny') outcome = verdict.reason === 'rate-limited' ? 'rate-limited' : 'denied';
    else outcome = 'allowed';

    const log = {
      at,
      keyId: keyDoc?._id || null,
      keyName: keyDoc?.name || '',
      method: req.method,
      path,
      policyId: policy.id,
      mode,
      outcome,
      reason: verdict.reason,
      ip: req.ip || '',
      status: blocked ? verdict.status : 200,
    };
    Promise.resolve()
      .then(() => logRequest(log))
      .catch(() => {}); // log ล่มต้องไม่ทำให้ request ล่ม

    if (keyDoc && (verdict.decision === 'allow' || !enforcing)) {
      Promise.resolve().then(() => touchKey(keyDoc._id)).catch(() => {});
    }

    if (blocked) {
      return res.status(verdict.status).json({ error: { message: `API key ไม่ผ่าน: ${verdict.reason}` } });
    }
    if (keyDoc) req.apiKey = { id: String(keyDoc._id), name: keyDoc.name, scopes: keyDoc.scopes || [] };
    return next();
  };
}

// ตัวที่ต่อ model จริง — ใช้ใน server/index.js
const apiGuard = createApiGuard({
  policies: API_POLICIES,
  getModes: () => modeCache.get(),
  findKeyByHash: (keyHash) => ApiKey.findOne({ keyHash }).lean(),
  logRequest: (doc) => ApiRequestLog.create(doc),
  touchKey: (id) => ApiKey.updateOne({ _id: id }, { $set: { lastUsedAt: new Date() }, $inc: { usageCount: 1 } }),
});

module.exports = { extractCredential, createApiGuard, apiGuard };
