const express = require('express');
const router = express.Router();
const DashboardLayoutConfig = require('../models/DashboardLayoutConfig');
const { DASHBOARDS, validate, normalizeSections, normalizeKpis } = require('../lib/dashboardLayout');

function pick(doc) {
  return {
    dashboard: doc.dashboard,
    roleId: doc.roleId,
    sections: (doc.sections || []).map((s) => ({ id: s.id, enabled: !!s.enabled, order: s.order })),
    kpis: normalizeKpis(doc.kpis),
  };
}

// GET /api/dashboard-layout?dashboard=lab — stored configs for that dashboard.
// Missing roles fall back to the catalog default on the client.
router.get('/', async (req, res) => {
  try {
    const { dashboard } = req.query;
    if (!DASHBOARDS.includes(dashboard)) return res.status(400).json({ error: 'dashboard ไม่ถูกต้อง' });
    const docs = await DashboardLayoutConfig.find({ dashboard }).lean();
    res.json({ data: docs.map(pick) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/dashboard-layout/:dashboard/:roleId — upsert one role's layout.
router.put('/:dashboard/:roleId', async (req, res) => {
  try {
    const { dashboard, roleId } = req.params;
    if (!DASHBOARDS.includes(dashboard)) return res.status(400).json({ error: 'dashboard ไม่ถูกต้อง' });
    if (!roleId) return res.status(400).json({ error: 'roleId จำเป็น' });
    const err = validate(req.body || {});
    if (err) return res.status(400).json({ error: err });

    const sections = normalizeSections((req.body || {}).sections);
    const kpis = normalizeKpis((req.body || {}).kpis);
    const doc = await DashboardLayoutConfig.findOneAndUpdate(
      { dashboard, roleId },
      { dashboard, roleId, sections, kpis },
      { new: true, upsert: true },
    ).lean();
    res.json({ data: pick(doc) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
