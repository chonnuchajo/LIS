const express = require('express');
const router = express.Router();
const QCTestResult = require('../models/QCTestResult');
const { zScore, linearRegression, consecutiveStreak } = require('../lib/smartRules');
const Petition = require('../models/Petition');
const DailyCheck = require('../models/DailyCheck');
const { isOllamaAvailable, generateStream } = require('../lib/ollamaClient');

// POST /api/ai/outlier-check
// Body: { commonName, parameterId, fieldLabel, value }
// Returns: { warning, zScore?, mean?, stdev?, sampleSize, reason? }
router.post('/outlier-check', async (req, res) => {
  try {
    const { commonName, parameterId, fieldLabel, value } = req.body;
    if (!commonName || !parameterId || !fieldLabel || value == null) {
      return res.json({ warning: false, reason: 'missing_params' });
    }
    const num = typeof value === 'number' ? value : Number(value);
    if (isNaN(num)) return res.json({ warning: false, reason: 'not_numeric' });

    const results = await QCTestResult.find(
      { commonName, parameterId },
      { values: 1, enteredAt: 1 },
    )
      .sort({ enteredAt: -1 })
      .limit(10)
      .lean();

    const historicalValues = results
      .map((r) => {
        const v = r.values?.[fieldLabel];
        return v != null && v !== '' ? Number(v) : NaN;
      })
      .filter((v) => !isNaN(v));

    if (historicalValues.length < 3) {
      return res.json({ warning: false, sampleSize: historicalValues.length, reason: 'insufficient_data' });
    }

    const stats = zScore(historicalValues, num);
    if (!stats) return res.json({ warning: false, sampleSize: historicalValues.length, reason: 'zero_variance' });

    return res.json({
      warning: stats.warning,
      zScore: Math.round(stats.zScore * 100) / 100,
      mean: Math.round(stats.mean * 10000) / 10000,
      stdev: Math.round(stats.stdev * 10000) / 10000,
      sampleSize: historicalValues.length,
    });
  } catch (err) {
    return res.json({ warning: false, reason: 'error' });
  }
});

// GET /api/ai/machine-suggestions?commonName=&dept=
router.get('/machine-suggestions', async (req, res) => {
  try {
    const { commonName, dept } = req.query;
    if (!commonName) return res.json([]);

    const query = { 'items.commonName': String(commonName) };
    if (dept) query.dept = String(dept);

    const petitions = await Petition.find(query, { assignedMachines: 1 })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const counts = {};
    petitions.forEach((p) => {
      (p.assignedMachines || []).forEach((m) => {
        if (!m.code) return;
        if (!counts[m.code]) {
          counts[m.code] = { machineCode: m.code, machineName: m.name || m.code, usageCount: 0 };
        }
        counts[m.code].usageCount++;
      });
    });

    const suggestions = Object.values(counts)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 3);

    res.json(suggestions);
  } catch {
    res.json([]);
  }
});

// GET /api/ai/daily-check-trends?type=consecutive|trend&scaleId=&field=avg100&days=30
router.get('/daily-check-trends', async (req, res) => {
  try {
    const { type, scaleId, field = 'avg100', days = '30' } = req.query;
    if (!scaleId || !type) return res.json({ alert: false, reason: 'missing_params' });

    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - Math.min(Number(days), 90));
    const fromStr = from.toISOString().slice(0, 10);

    const records = await DailyCheck.find(
      { scaleId: String(scaleId), date: { $gte: fromStr } },
      { status: 1, avg100: 1, avg10: 1, date: 1 },
    )
      .sort({ date: -1 })
      .lean();

    if (type === 'consecutive') {
      const streak = consecutiveStreak(records, (r) => r.status === 'fail');
      return res.json({
        alert: streak >= 3,
        streak,
        message: streak >= 3
          ? `Scale ${scaleId} fail ต่อเนื่อง ${streak} วัน — ควรแจ้งซ่อมบำรุง`
          : null,
      });
    }

    if (type === 'trend') {
      const fieldName = String(field);
      const pairs = records
        .filter((r) => r[fieldName] != null)
        .map((r, i) => ({ x: records.length - 1 - i, y: Number(r[fieldName]) }))
        .filter((p) => !isNaN(p.y));

      if (pairs.length < 5) return res.json({ alert: false, reason: 'insufficient_data' });

      const reg = linearRegression(pairs);
      if (!reg) return res.json({ alert: false, reason: 'degenerate' });

      const threshold = fieldName.startsWith('avg') ? 0.01 : 0.5;
      const alert = Math.abs(reg.slope) > threshold;
      const direction = reg.slope > 0 ? 'เพิ่มขึ้น' : 'ลดลง';

      return res.json({
        alert,
        slope: Math.round(reg.slope * 100000) / 100000,
        message: alert
          ? `${fieldName} มีแนวโน้ม${direction} ${Math.abs(reg.slope).toFixed(5)} ต่อวัน — ควรตรวจสอบ`
          : null,
      });
    }

    res.json({ alert: false, reason: 'unknown_type' });
  } catch {
    res.json({ alert: false });
  }
});

// GET /api/ai/ollama-status
router.get('/ollama-status', async (req, res) => {
  const available = await isOllamaAvailable();
  res.json({ available });
});

// POST /api/ai/draft-note
// Body: { petitionId }
// Streams plain-text Thai approval note
router.post('/draft-note', async (req, res) => {
  try {
    const { petitionId } = req.body;
    if (!petitionId) return res.status(400).json({ error: 'petitionId required' });

    if (!(await isOllamaAvailable())) {
      return res.status(503).json({ error: 'Ollama ไม่พร้อมใช้งาน' });
    }

    const petition = await Petition.findById(petitionId).lean();
    if (!petition) return res.status(404).json({ error: 'Petition not found' });

    const results = await QCTestResult.find({ petitionId: String(petitionId) }).lean();

    const itemSummaries = (petition.items || []).map((item) => {
      const itemResults = results.filter((r) => r.itemSeq === item.seq);
      const resultLines = itemResults.map((r) => {
        const vals = Object.entries(r.values || {})
          .filter(([, v]) => v !== null && v !== undefined && v !== '')
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ');
        return vals ? `  ${r.parameterName || r.parameterId}: ${vals}` : null;
      }).filter(Boolean);
      return `- ${item.sampleName} (${item.commonName || ''}) Batch: ${item.batchNo}\n${resultLines.join('\n') || '  (ไม่มีผลทดสอบ)'}`;
    }).join('\n');

    const prompt = `คุณเป็นเจ้าหน้าที่ QC ของบริษัทเคมีภัณฑ์ไทย กรุณาเขียนหมายเหตุการอนุมัติ (approval note) สำหรับคำร้องต่อไปนี้ เป็นภาษาไทย กระชับ 3-5 ประโยค

คำร้องเลขที่: ${petition.petitionNo}
แผนก: ${petition.dept}
วันที่รับ: ${petition.receivedAt ? new Date(petition.receivedAt).toLocaleDateString('th-TH') : '-'}

รายการตัวอย่างและผลทดสอบ:
${itemSummaries || '(ไม่มีรายการ)'}

กรุณาสรุปผลการทดสอบ ระบุว่าผ่านหรือไม่ผ่าน และข้อสังเกตสำคัญ (ถ้ามี)`;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('X-Accel-Buffering', 'no');

    await generateStream(prompt, (chunk) => res.write(chunk));
    res.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/weekly-summary
// Body: { fromDate: "YYYY-MM-DD", toDate: "YYYY-MM-DD" }
// Streams plain-text Thai weekly summary
router.post('/weekly-summary', async (req, res) => {
  try {
    const { fromDate, toDate } = req.body;
    if (!fromDate || !toDate) return res.status(400).json({ error: 'fromDate and toDate required' });

    if (!(await isOllamaAvailable())) {
      return res.status(503).json({ error: 'Ollama ไม่พร้อมใช้งาน' });
    }

    const dateFilter = { date: { $gte: String(fromDate), $lte: String(toDate) } };
    const dailyChecks = await DailyCheck.find(dateFilter).lean();

    // Try to load EnvCheck if model exists
    let envChecks = [];
    try {
      const EnvCheck = require('../models/EnvCheck');
      envChecks = await EnvCheck.find(dateFilter).lean();
    } catch {
      // EnvCheck model not available — skip
    }

    const scaleStats = {};
    dailyChecks.forEach((r) => {
      if (!scaleStats[r.scaleId]) scaleStats[r.scaleId] = { pass: 0, fail: 0 };
      scaleStats[r.scaleId][r.status]++;
    });
    const scaleLines = Object.entries(scaleStats)
      .map(([id, s]) => `- เครื่องชั่ง ${id}: ผ่าน ${s.pass} วัน, ไม่ผ่าน ${s.fail} วัน`)
      .join('\n') || '(ไม่มีข้อมูล)';

    const envStats = {};
    envChecks.forEach((r) => {
      const roomKey = r.room || 'unknown';
      if (!envStats[roomKey]) envStats[roomKey] = { pass: 0, fail: 0 };
      envStats[roomKey][(r.status === 'pass' ? 'pass' : 'fail')]++;
    });
    const envLines = Object.entries(envStats)
      .map(([room, s]) => `- ${room}: ผ่าน ${s.pass} วัน, ไม่ผ่าน ${s.fail} วัน`)
      .join('\n') || '(ไม่มีข้อมูล)';

    const prompt = `คุณเป็นเจ้าหน้าที่ QC กรุณาสรุปผล daily check ประจำสัปดาห์ ${fromDate} ถึง ${toDate} เป็นภาษาไทย 4-6 ประโยค

ผลการสอบเทียบเครื่องชั่ง:
${scaleLines}

ผลการตรวจสอบสภาพแวดล้อม:
${envLines}

กรุณาสรุปภาพรวม ชี้จุดที่ต้องให้ความสนใจ และข้อเสนอแนะ (ถ้ามี)`;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('X-Accel-Buffering', 'no');

    await generateStream(prompt, (chunk) => res.write(chunk));
    res.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

module.exports = router;
