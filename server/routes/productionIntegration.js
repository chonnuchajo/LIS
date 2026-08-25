const crypto = require('crypto');
const express = require('express');
const ProductionIntegrationRequest = require('../models/ProductionIntegrationRequest');

const router = express.Router();

router.use(express.urlencoded({ extended: true, limit: '10mb' }));

function authorized(req) {
  // apiGuard (mount ก่อนหน้านี้ใน server/index.js) เซ็ต req.apiKey ให้เฉพาะตอน verdict อนุมัติ
  // จริง (allow) เท่านั้น — รับเป็น credential ทางเลือกคู่กับ token เดิม เพื่อไม่ให้ขั้นตอนสุดท้าย
  // ของ rollout (ลบ PRODUCTION_INTEGRATION_TOKEN ออกจาก .env) ทำให้ endpoint นี้ตายสำหรับผู้เรียก
  // ที่ย้ายไปส่ง X-API-Key แล้ว
  if (req.apiKey?.scopes?.includes('integration:write')) return true;
  const secret = process.env.PRODUCTION_INTEGRATION_TOKEN;
  if (!secret) return true;
  const header = req.get('authorization') || '';
  const bearer = header.match(/^Bearer\s+(.+)$/i)?.[1];
  return req.get('x-integration-token') === secret || bearer === secret;
}

router.post('/petitions', async (req, res) => {
  try {
    if (!authorized(req)) return res.status(401).json({ error: { message: 'Unauthorized' } });
    const payload = req.body || {};
    const token = crypto.randomBytes(18).toString('base64url');
    await ProductionIntegrationRequest.create({ token, payload });
    const prefix = req.originalUrl.startsWith('/LIS/') ? '/LIS' : '';
    res.status(201).json({
      token,
      redirectUrl: `${prefix}/petitions/ProductionIntegrationPetitionNewPage?integrationToken=${encodeURIComponent(token)}`,
    });
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

router.get('/petitions/:token', async (req, res) => {
  try {
    const token = String(req.params.token || '');
    if (!/^[A-Za-z0-9_-]{16,80}$/.test(token)) {
      return res.status(400).json({ error: { message: 'Invalid token' } });
    }
    const doc = await ProductionIntegrationRequest.findOne({ token }).lean();
    if (!doc) return res.status(404).json({ error: { message: 'Integration request not found' } });
    res.json(doc.payload);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

module.exports = router;
