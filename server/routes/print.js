const express = require('express');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const router = express.Router();
const PrintConfig = require('../models/PrintConfig');

// docType defaults — mirror ของ src/lib/printConfig.ts PRINT_DOC_TYPES
const DOC_DEFAULTS = [
  { slug: 'sample-label',    printerName: '', cupsPrinterUrl: '', copies: 1, paperSize: 'label-100x50' },
  { slug: 'coa',             printerName: '', cupsPrinterUrl: '', copies: 1, paperSize: 'A4' },
  { slug: 'service-request', printerName: '', cupsPrinterUrl: '', copies: 1, paperSize: 'A4' },
  { slug: 'production-plan', printerName: '', cupsPrinterUrl: '', copies: 1, paperSize: 'A4' },
  { slug: 'stock-label',     printerName: '', cupsPrinterUrl: '', copies: 1, paperSize: 'label-6x4' },
];
const ALLOWED_SLUGS = DOC_DEFAULTS.map((d) => d.slug);
const LABEL_100X50 = { widthMm: 100, heightMm: 50, dpi: 203 };
const DEFAULT_CUPS_BASE_URL = (process.env.PRINT_CUPS_BASE_URL || 'https://192.168.0.237:631').replace(/\/+$/, '');

// hosts ที่ Puppeteer ยอมให้โหลด (ฟอนต์ + โลโก้) — request อื่นถูก abort
const ALLOWED_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com', 'i.ibb.co']);

function inferredCupsPrinterUrl(printerName, cupsPrinterUrl = '') {
  const explicit = String(cupsPrinterUrl || '').trim();
  if (explicit) return explicit;

  const rawPrinter = String(printerName || '').trim();
  const match = rawPrinter.match(/^(.*?)\s+on\s+https?$/i);
  if (!match) return '';

  const queue = match[1].trim();
  if (!queue) return '';
  return `${DEFAULT_CUPS_BASE_URL}/printers/${encodeURIComponent(queue)}`;
}

function pick(doc) {
  const cupsPrinterUrl = inferredCupsPrinterUrl(doc.printerName, doc.cupsPrinterUrl);
  return {
    slug: doc.slug,
    printerName: doc.printerName || '',
    cupsPrinterUrl,
    copies: typeof doc.copies === 'number' ? doc.copies : 1,
    paperSize: doc.slug === 'sample-label' ? 'label-100x50' : (doc.paperSize || 'A4'),
  };
}

function validate(body) {
  const { printerName, cupsPrinterUrl, copies, paperSize } = body || {};
  if (typeof printerName !== 'string') return 'printerName ต้องเป็นข้อความ';
  if (cupsPrinterUrl != null && typeof cupsPrinterUrl !== 'string') return 'cupsPrinterUrl ต้องเป็น URL';
  if (typeof cupsPrinterUrl === 'string' && cupsPrinterUrl.trim()) {
    let url;
    try {
      url = new URL(cupsPrinterUrl.trim());
    } catch (_) {
      return 'CUPS URL ไม่ถูกต้อง';
    }
    if (!['http:', 'https:', 'ipp:', 'ipps:'].includes(url.protocol)) {
      return 'CUPS URL ต้องเป็น http, https, ipp หรือ ipps';
    }
  }
  if (copies != null && (typeof copies !== 'number' || !Number.isInteger(copies) || copies < 1 || copies > 99)) {
    return 'จำนวนชุดต้องเป็นจำนวนเต็ม 1–99';
  }
  if (paperSize != null && !['A4', 'label-100x50', 'label-6x4'].includes(paperSize)) return 'paperSize ไม่ถูกต้อง';
  return null;
}

function effectivePaperSize(cfg) {
  // Sample labels are designed as 100x50mm in the React template. Force legacy
  // saved configs to the matching media so old DB rows do not print on 6x4.
  if (cfg.slug === 'sample-label') return 'label-100x50';
  return cfg.paperSize || 'A4';
}

function paperSpec(paperSize) {
  if (paperSize === 'label-100x50') {
    return {
      media: 'custom_100x50mm_100x50mm',
      mediaCol: {
        'media-size': { 'x-dimension': 10000, 'y-dimension': 5000 },
        'media-left-margin': 0,
        'media-right-margin': 0,
        'media-top-margin': 0,
        'media-bottom-margin': 0,
      },
      // PDF page is already landscape 100x50 and matches the media exactly, so do
      // NOT request a re-orientation — CUPS would rotate it to 50x100 and scale it
      // down to fit, leaving the label only partially filled.
      pdf: { width: '100mm', height: '50mm' },
    };
  }
  if (paperSize === 'label-6x4') {
    return {
      media: 'custom_6x4in_6x4in',
      mediaCol: {
        'media-size': { 'x-dimension': 15240, 'y-dimension': 10160 },
        'media-left-margin': 0,
        'media-right-margin': 0,
        'media-top-margin': 0,
        'media-bottom-margin': 0,
      },
      pdf: { width: '152.4mm', height: '101.6mm' },
    };
  }
  return {
    media: 'A4',
    pdf: { format: 'A4' },
  };
}

function cupsTargetFromUrl(cupsPrinterUrl, fallbackPrinterName = '') {
  const raw = String(cupsPrinterUrl || '').trim();
  if (!raw) return null;
  const url = new URL(raw);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const queuePrefixIndex = pathParts.findIndex((p) => p === 'printers' || p === 'classes');
  const queueName = queuePrefixIndex >= 0 ? pathParts[queuePrefixIndex + 1] : '';
  const destination = decodeURIComponent(queueName || fallbackPrinterName || '').trim();
  if (!destination) {
    throw new Error('CUPS URL ต้องระบุ queue เช่น https://192.168.0.237:631/printers/PRINTER_NAME');
  }
  const printerUriProtocol = url.protocol === 'https:' ? 'ipps:' : url.protocol === 'http:' ? 'ipp:' : url.protocol;
  return {
    destination,
    printerUri: `${printerUriProtocol}//${url.host}${url.pathname}`,
    display: raw,
  };
}

function isPrivateCupsHost(hostname) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  );
}

function cupsRequestOptions(cupsPrinterUrl) {
  const url = new URL(cupsPrinterUrl);
  const opts = {
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port || undefined,
    path: `${url.pathname}${url.search}`,
  };

  // The plant CUPS server uses a self-signed certificate on the LAN.
  // Keep this exception scoped to private/local hosts unless explicitly disabled.
  if ((url.protocol === 'https:' || url.protocol === 'ipps:') && isPrivateCupsHost(url.hostname)) {
    opts.rejectUnauthorized = process.env.PRINT_CUPS_REJECT_UNAUTHORIZED === 'true';
  }

  return opts;
}

function mmToDots(mm, dpi) {
  return Math.round((mm / 25.4) * dpi);
}

async function renderSampleLabelPngBuffers(page) {
  const widthDots = mmToDots(LABEL_100X50.widthMm, LABEL_100X50.dpi);
  const heightDots = mmToDots(LABEL_100X50.heightMm, LABEL_100X50.dpi);
  const cssWidth = Math.round((LABEL_100X50.widthMm / 25.4) * 96);
  const cssHeight = Math.round((LABEL_100X50.heightMm / 25.4) * 96);
  const scale = widthDots / cssWidth;

  await page.setViewport({
    width: cssWidth + 40,
    height: cssHeight + 40,
    deviceScaleFactor: scale,
  });

  const labels = await page.$$('.label-page');
  if (labels.length === 0) {
    throw new Error('ไม่พบ element .label-page สำหรับฉลาก');
  }

  const buffers = [];
  for (const label of labels) {
    const box = await label.boundingBox();
    if (!box) continue;
    const png = await page.screenshot({
      type: 'png',
      clip: {
        x: Math.max(0, box.x),
        y: Math.max(0, box.y),
        width: box.width,
        height: box.height,
      },
      omitBackground: false,
    });
    buffers.push(png);
  }

  if (buffers.length === 0) {
    throw new Error('จับภาพฉลากไม่สำเร็จ');
  }
  return buffers;
}

function printViaCups(tmpPdf, cfg, copies) {
  const target = cupsTargetFromUrl(cfg.cupsPrinterUrl, cfg.printerName);
  const ipp = require('ipp');
  const printer = ipp.Printer(cupsRequestOptions(cfg.cupsPrinterUrl), { uri: target.printerUri, version: '2.0' });
  const paper = paperSpec(effectivePaperSize(cfg));
  const pdf = fs.readFileSync(tmpPdf);
  const jobAttributes = {
    copies,
  };
  if (!paper.mediaCol) {
    jobAttributes.media = paper.media;
  }
  if (paper.mediaCol) {
    jobAttributes['media-col'] = paper.mediaCol;
  }
  if (paper.orientation) {
    jobAttributes['orientation-requested'] = paper.orientation;
  }
  const msg = {
    'operation-attributes-tag': {
      'requesting-user-name': 'LIS',
      'job-name': `LIS ${cfg.slug || 'print'} ${new Date().toISOString()}`,
      'document-format': 'application/pdf',
    },
    'job-attributes-tag': jobAttributes,
    data: pdf,
  };

  return new Promise((resolve, reject) => {
    printer.execute('Print-Job', msg, (err, res) => {
      if (err) return reject(err);
      if (res?.statusCode && !String(res.statusCode).startsWith('successful-')) {
        return reject(new Error(`CUPS rejected job: ${res.statusCode}`));
      }
      resolve({ target: target.display, response: res });
    });
  });
}

function printBuffersViaCups(buffers, cfg, copies, documentFormat) {
  const target = cupsTargetFromUrl(cfg.cupsPrinterUrl, cfg.printerName);
  const ipp = require('ipp');
  const printer = ipp.Printer(cupsRequestOptions(cfg.cupsPrinterUrl), { uri: target.printerUri, version: '2.0' });
  const paper = paperSpec(effectivePaperSize(cfg));

  const printOne = (buffer, index) => new Promise((resolve, reject) => {
    const jobAttributes = { copies };
    if (!paper.mediaCol) jobAttributes.media = paper.media;
    if (paper.mediaCol) jobAttributes['media-col'] = paper.mediaCol;
    if (paper.orientation) jobAttributes['orientation-requested'] = paper.orientation;

    const msg = {
      'operation-attributes-tag': {
        'requesting-user-name': 'LIS',
        'job-name': `LIS ${cfg.slug || 'print'} ${index + 1}/${buffers.length} ${new Date().toISOString()}`,
        'document-format': documentFormat,
      },
      'job-attributes-tag': jobAttributes,
      data: buffer,
    };

    printer.execute('Print-Job', msg, (err, res) => {
      if (err) return reject(err);
      if (res?.statusCode && !String(res.statusCode).startsWith('successful-')) {
        return reject(new Error(`CUPS rejected job: ${res.statusCode}`));
      }
      resolve();
    });
  });

  return buffers.reduce(
    (p, buffer, index) => p.then(() => printOne(buffer, index)),
    Promise.resolve(),
  ).then(() => ({ target: target.display, count: buffers.length }));
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
    const { printerName, cupsPrinterUrl, copies, paperSize } = req.body;
    const doc = await PrintConfig.findOneAndUpdate(
      { slug },
      {
        slug,
        printerName: typeof printerName === 'string' ? printerName : '',
        cupsPrinterUrl: typeof cupsPrinterUrl === 'string' ? cupsPrinterUrl.trim() : '',
        ...(copies != null ? { copies } : {}),
        paperSize: slug === 'sample-label' ? 'label-100x50' : (paperSize ?? 'A4'),
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
    if (!cfg.printerName && !cfg.cupsPrinterUrl) {
      return res.status(400).json({ error: 'ยังไม่ได้ตั้งค่าเครื่องพิมพ์สำหรับเอกสารนี้ (ตั้งค่าที่หน้าตั้งค่าระบบ)' });
    }

    const chromePath = process.env.PRINT_CHROME_PATH;
    if (!chromePath || !fs.existsSync(chromePath)) {
      return res.status(500).json({ error: 'ไม่พบ Chrome สำหรับสร้าง PDF (ตั้งค่า PRINT_CHROME_PATH)' });
    }

    const copies = (Number.isInteger(copiesOverride) && copiesOverride >= 1 && copiesOverride <= 99) ? copiesOverride : cfg.copies;
    tmpPdf = path.join(os.tmpdir(), `lis-print-${crypto.randomUUID()}.pdf`);
    const puppeteer = require('puppeteer-core');
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
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
    await page.setContent(fullHtml, { waitUntil: 'load', timeout: 15000 });

    let printerTarget = cfg.printerName;
    if (cfg.cupsPrinterUrl && docType === 'sample-label') {
      const pngBuffers = await renderSampleLabelPngBuffers(page);
      await browser.close();
      browser = null;
      const result = await printBuffersViaCups(pngBuffers, cfg, copies, 'image/png');
      printerTarget = result.target;
    } else {
      const spec = paperSpec(effectivePaperSize(cfg)).pdf;
      const pdfOpts = {
        path: tmpPdf,
        ...spec,
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      };
      await page.pdf(pdfOpts);
      await browser.close();
      browser = null;

      if (cfg.cupsPrinterUrl) {
        const result = await printViaCups(tmpPdf, cfg, copies);
        printerTarget = result.target;
      } else {
        const { print } = require('pdf-to-printer');
        await print(tmpPdf, { printer: cfg.printerName, copies });
      }
    }

    res.json({ ok: true, printer: printerTarget, copies });
  } catch (err) {
    res.status(500).json({ error: `พิมพ์ไม่สำเร็จ: ${err.message}` });
  } finally {
    if (browser) { try { await browser.close(); } catch (_) {} }
    if (tmpPdf) fs.promises.unlink(tmpPdf).catch(() => {});
  }
});

module.exports = router;
