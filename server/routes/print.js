const express = require('express');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const router = express.Router();
const PrintConfig = require('../models/PrintConfig');

// docType defaults — mirror ของ src/lib/printConfig.ts PRINT_DOC_TYPES
const DOC_DEFAULTS = [
  { slug: 'sample-label',    printerName: '', copies: 1, paperSize: 'label-6x4' },
  { slug: 'coa',             printerName: '', copies: 1, paperSize: 'A4' },
  { slug: 'service-request', printerName: '', copies: 1, paperSize: 'A4' },
  { slug: 'production-plan', printerName: '', copies: 1, paperSize: 'A4' },
];
const ALLOWED_SLUGS = DOC_DEFAULTS.map((d) => d.slug);

// hosts ที่ Puppeteer ยอมให้โหลด (ฟอนต์ + โลโก้) — request อื่นถูก abort
const ALLOWED_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com', 'i.ibb.co']);

function pick(doc) {
  return {
    slug: doc.slug,
    printerName: doc.printerName || '',
    copies: typeof doc.copies === 'number' ? doc.copies : 1,
    paperSize: doc.paperSize || 'A4',
  };
}

function validate(body) {
  const { printerName, copies, paperSize } = body || {};
  if (typeof printerName !== 'string') return 'printerName ต้องเป็นข้อความ';
  if (copies != null && (typeof copies !== 'number' || !Number.isInteger(copies) || copies < 1)) {
    return 'จำนวนชุดต้องเป็นจำนวนเต็มตั้งแต่ 1';
  }
  if (paperSize != null && !['A4', 'label-6x4'].includes(paperSize)) return 'paperSize ไม่ถูกต้อง';
  return null;
}

// GET /api/print/printers — รายชื่อเครื่องที่เห็น
router.get('/printers', async (req, res) => {
  try {
    const { getPrinters } = require('pdf-to-printer');
    const printers = await getPrinters();
    res.json({ data: printers.map((p) => p.name) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/print/config — คืน config ทั้ง 4 docType (DB หรือ default)
router.get('/config', async (req, res) => {
  try {
    const docs = await PrintConfig.find().lean();
    const bySlug = new Map(docs.map((d) => [d.slug, d]));
    const data = DOC_DEFAULTS.map((def) => {
      const d = bySlug.get(def.slug);
      return d ? pick(d) : { ...def };
    });
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/print/config/:slug — upsert
router.put('/config/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    if (!ALLOWED_SLUGS.includes(slug)) return res.status(400).json({ error: 'slug ไม่ถูกต้อง' });
    const err = validate(req.body || {});
    if (err) return res.status(400).json({ error: err });
    const { printerName, copies, paperSize } = req.body;
    const doc = await PrintConfig.findOneAndUpdate(
      { slug },
      {
        slug,
        printerName: typeof printerName === 'string' ? printerName : '',
        ...(copies != null ? { copies } : {}),
        ...(paperSize != null ? { paperSize } : {}),
      },
      { new: true, upsert: true },
    ).lean();
    res.json({ data: pick(doc) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/print — { docType, html, copies? } → PDF → ส่งเข้าเครื่อง
router.post('/', async (req, res) => {
  const { docType, html, copies: copiesOverride } = req.body || {};
  if (!ALLOWED_SLUGS.includes(docType)) return res.status(400).json({ error: 'docType ไม่ถูกต้อง' });
  if (typeof html !== 'string' || !html.trim()) return res.status(400).json({ error: 'ไม่มีเนื้อหาเอกสาร' });

  let browser;
  let tmpPdf;
  try {
    const cfgDoc = await PrintConfig.findOne({ slug: docType }).lean();
    const cfg = cfgDoc ? pick(cfgDoc) : DOC_DEFAULTS.find((d) => d.slug === docType);
    if (!cfg.printerName) {
      return res.status(400).json({ error: 'ยังไม่ได้ตั้งค่าเครื่องพิมพ์สำหรับเอกสารนี้ (ตั้งค่าที่หน้าตั้งค่าระบบ)' });
    }

    const chromePath = process.env.PRINT_CHROME_PATH;
    if (!chromePath || !fs.existsSync(chromePath)) {
      return res.status(500).json({ error: 'ไม่พบ Chrome สำหรับสร้าง PDF (ตั้งค่า PRINT_CHROME_PATH)' });
    }

    const copies = (Number.isInteger(copiesOverride) && copiesOverride >= 1) ? copiesOverride : cfg.copies;
    tmpPdf = path.join(os.tmpdir(), `lis-print-${crypto.randomUUID()}.pdf`);
    const puppeteer = require('puppeteer-core');
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on('request', (r) => {
      const u = r.url();
      if (u.startsWith('data:')) return r.continue();
      try {
        if (ALLOWED_HOSTS.has(new URL(u).host)) return r.continue();
      } catch (_) { /* fallthrough */ }
      return r.abort();
    });

    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600;700&display=swap" rel="stylesheet">
</head><body>${html}</body></html>`;
    await page.setContent(fullHtml, { waitUntil: 'networkidle0', timeout: 15000 });

    const pdfOpts = cfg.paperSize === 'label-6x4'
      ? { path: tmpPdf, width: '152.4mm', height: '101.6mm', printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } }
      : { path: tmpPdf, format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } };
    await page.pdf(pdfOpts);
    await browser.close();
    browser = null;

    const { print } = require('pdf-to-printer');
    await print(tmpPdf, { printer: cfg.printerName, copies });

    res.json({ ok: true, printer: cfg.printerName, copies });
  } catch (err) {
    res.status(500).json({ error: `พิมพ์ไม่สำเร็จ: ${err.message}` });
  } finally {
    if (browser) { try { await browser.close(); } catch (_) {} }
    if (tmpPdf) fs.promises.unlink(tmpPdf).catch(() => {});
  }
});

module.exports = router;
