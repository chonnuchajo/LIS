const express = require('express');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const router = express.Router();
const PrinterConfig = require('../models/PrinterConfig');
const {
  PRINT_DOC_TYPES,
  kindForDocType,
  paperSizeForSlug,
  printerTargetFromAddress,
  validatePrinterInput,
  pickDefault,
} = require('../lib/printerRouting');

const ALLOWED_SLUGS = PRINT_DOC_TYPES;
const LABEL_100X50 = { widthMm: 100, heightMm: 50, dpi: 203 };

// hosts ที่ Puppeteer ยอมให้โหลด (ฟอนต์ + โลโก้) — request อื่นถูก abort
const ALLOWED_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com', 'i.ibb.co']);

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

function printTargetFromConfig(cfg) {
  try {
    return printerTargetFromAddress(cfg.cupsPrinterUrl);
  } catch (err) {
    throw new Error(`Printer IP / URL ไม่ถูกต้อง: ${err.message}`);
  }
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
  const url = new URL(printerTargetFromAddress(cupsPrinterUrl).printerUri);
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

// CRC32 (PNG polynomial) — needed to author a valid pHYs chunk.
const PNG_CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function pngCrc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = PNG_CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// Puppeteer screenshots carry NO physical-size metadata, so CUPS has to guess
// the DPI and the thermal print comes out shrunk/offset. Inject a pHYs chunk
// (pixels-per-metre) right after IHDR so CUPS prints the raster at exact size.
function pngWithDpi(buffer, dpi) {
  const SIG = 8;
  if (buffer.length < SIG + 25) return buffer;
  if (buffer.toString('ascii', SIG + 4, SIG + 8) !== 'IHDR') return buffer;
  const ihdrEnd = SIG + 25; // 8 sig + (4 len + 4 'IHDR' + 13 data + 4 crc)
  const ppu = Math.round(dpi / 0.0254); // pixels per metre
  const data = Buffer.alloc(9);
  data.writeUInt32BE(ppu, 0);
  data.writeUInt32BE(ppu, 4);
  data.writeUInt8(1, 8); // unit specifier: 1 = metre
  const type = Buffer.from('pHYs', 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(9, 0);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(pngCrc32(Buffer.concat([type, data])), 0);
  return Buffer.concat([buffer.subarray(0, ihdrEnd), len, type, data, crc, buffer.subarray(ihdrEnd)]);
}

// Diagnostic dump (opt-in via PRINT_DEBUG=1) — saves the exact artifact sent to
// the printer plus a metadata sidecar, so a single real print on the prod box
// gives ground-truth evidence about the CUPS pipeline.
function printDebugDump(name, ext, buffer, meta) {
  if (process.env.PRINT_DEBUG !== '1') return;
  try {
    const dir = path.join(os.tmpdir(), 'lis-print-debug');
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const base = path.join(dir, `${name}-${stamp}`);
    if (buffer) fs.writeFileSync(`${base}.${ext}`, buffer);
    if (meta) fs.writeFileSync(`${base}.json`, JSON.stringify(meta, null, 2));
    console.log(`[print-debug] saved ${base}.${ext}`);
  } catch (e) {
    console.warn('[print-debug] dump failed:', e.message);
  }
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
    buffers.push(pngWithDpi(png, LABEL_100X50.dpi));
  }

  if (buffers.length === 0) {
    throw new Error('จับภาพฉลากไม่สำเร็จ');
  }
  return buffers;
}

function printViaCups(tmpPdf, cfg, copies) {
  const target = printTargetFromConfig(cfg);
  const ipp = require('ipp');
  const printer = ipp.Printer(cupsRequestOptions(cfg.cupsPrinterUrl), { uri: target.printerUri, version: '2.0' });
  const paper = paperSpec(paperSizeForSlug(cfg.slug));
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
  if (process.env.PRINT_SCALING) jobAttributes['print-scaling'] = process.env.PRINT_SCALING;
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
  const target = printTargetFromConfig(cfg);
  const ipp = require('ipp');
  const printer = ipp.Printer(cupsRequestOptions(cfg.cupsPrinterUrl), { uri: target.printerUri, version: '2.0' });
  const paper = paperSpec(paperSizeForSlug(cfg.slug));

  const statuses = [];
  const printOne = (buffer, index) => new Promise((resolve, reject) => {
    const jobAttributes = { copies };
    if (!paper.mediaCol) jobAttributes.media = paper.media;
    if (paper.mediaCol) jobAttributes['media-col'] = paper.mediaCol;
    if (paper.orientation) jobAttributes['orientation-requested'] = paper.orientation;
    // Opt-in: forces CUPS scaling behaviour ('none'|'fill'|'fit'|'auto'). Off by
    // default because older `ipp` builds may not know this keyword and would
    // throw at serialize time, breaking every print.
    if (process.env.PRINT_SCALING) jobAttributes['print-scaling'] = process.env.PRINT_SCALING;

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
      statuses.push(res?.statusCode);
      if (res?.statusCode && !String(res.statusCode).startsWith('successful-')) {
        return reject(new Error(`CUPS rejected job: ${res.statusCode}`));
      }
      resolve();
    });
  });

  return buffers.reduce(
    (p, buffer, index) => p.then(() => printOne(buffer, index)),
    Promise.resolve(),
  ).then(() => ({ target: target.display, count: buffers.length, statuses }));
}

// ---- Printer registry CRUD ----

function pickConfig(doc) {
  return {
    id: String(doc._id),
    kind: doc.kind,
    label: doc.label || '',
    cupsPrinterUrl: doc.cupsPrinterUrl || '',
    isDefault: !!doc.isDefault,
  };
}

// GET /api/print/printers-config — list all printer destinations
router.get('/printers-config', async (req, res) => {
  try {
    const docs = await PrinterConfig.find().sort({ kind: 1, createdAt: 1 }).lean();
    res.json({ data: docs.map(pickConfig) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/print/printers-config — add a printer (first of a kind becomes default)
router.post('/printers-config', async (req, res) => {
  try {
    const body = req.body || {};
    const err = validatePrinterInput(body, { requireUrl: true });
    if (err) return res.status(400).json({ error: err });
    const existing = await PrinterConfig.countDocuments({ kind: body.kind });
    const doc = await PrinterConfig.create({
      kind: body.kind,
      label: typeof body.label === 'string' ? body.label.trim() : '',
      cupsPrinterUrl: body.cupsPrinterUrl.trim(),
      isDefault: existing === 0,
    });
    res.status(201).json({ data: pickConfig(doc.toObject()) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/print/printers-config/:id — edit label / url (kind is fixed)
router.put('/printers-config/:id', async (req, res) => {
  try {
    const body = req.body || {};
    const current = await PrinterConfig.findById(req.params.id).lean();
    if (!current) return res.status(404).json({ error: 'ไม่พบเครื่องพิมพ์' });
    const merged = {
      kind: current.kind,
      cupsPrinterUrl: typeof body.cupsPrinterUrl === 'string' ? body.cupsPrinterUrl : current.cupsPrinterUrl,
    };
    const err = validatePrinterInput(merged, { requireUrl: true });
    if (err) return res.status(400).json({ error: err });
    const doc = await PrinterConfig.findByIdAndUpdate(
      req.params.id,
      {
        ...(typeof body.label === 'string' ? { label: body.label.trim() } : {}),
        ...(typeof body.cupsPrinterUrl === 'string' ? { cupsPrinterUrl: body.cupsPrinterUrl.trim() } : {}),
      },
      { new: true },
    ).lean();
    res.json({ data: pickConfig(doc) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/print/printers-config/:id/default — set default for its kind
router.put('/printers-config/:id/default', async (req, res) => {
  try {
    const target = await PrinterConfig.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'ไม่พบเครื่องพิมพ์' });
    await PrinterConfig.updateMany({ kind: target.kind }, { $set: { isDefault: false } });
    target.isDefault = true;
    await target.save();
    res.json({ data: pickConfig(target.toObject()) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/print/printers-config/:id — remove; promote a sibling if it was default
router.delete('/printers-config/:id', async (req, res) => {
  try {
    const target = await PrinterConfig.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'ไม่พบเครื่องพิมพ์' });
    const wasDefault = target.isDefault;
    const kind = target.kind;
    await target.softDelete('system');
    if (wasDefault) {
      const next = await PrinterConfig.findOne({ kind }).sort({ createdAt: 1 });
      if (next) { next.isDefault = true; await next.save(); }
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function choosePrinterForDocType(docType, printerConfigId) {
  const kind = kindForDocType(docType);
  if (printerConfigId) {
    if (typeof printerConfigId !== 'string' || !/^[0-9a-fA-F]{24}$/.test(printerConfigId)) {
      const err = new Error('ไม่พบเครื่องพิมพ์ที่เลือก');
      err.statusCode = 404;
      throw err;
    }
    const selected = await PrinterConfig.findById(printerConfigId).lean();
    if (!selected) {
      const err = new Error('ไม่พบเครื่องพิมพ์ที่เลือก');
      err.statusCode = 404;
      throw err;
    }
    if (selected.kind !== kind) {
      const err = new Error('เครื่องพิมพ์ที่เลือกไม่ตรงกับชนิดเอกสาร');
      err.statusCode = 400;
      throw err;
    }
    return selected;
  }
  const printers = await PrinterConfig.find({ kind }).lean();
  return pickDefault(printers, kind);
}

function missingPrinterConfigError() {
  const err = new Error('ยังไม่ได้ตั้งค่าเครื่องพิมพ์สำหรับเอกสารนี้ (ตั้งค่าที่หน้าตั้งค่าระบบ)');
  err.statusCode = 400;
  return err;
}

async function printHtmlJob({ docType, html, copiesOverride, printerConfig }) {
  let browser;
  let tmpPdf;
  try {
    if (!printerConfig || !printerConfig.cupsPrinterUrl) {
      throw missingPrinterConfigError();
    }

    const cfg = { slug: docType, cupsPrinterUrl: printerConfig.cupsPrinterUrl };
    const chromePath = process.env.PRINT_CHROME_PATH;
    if (!chromePath || !fs.existsSync(chromePath)) {
      throw new Error('ไม่พบ Chrome สำหรับสร้าง PDF (ตั้งค่า PRINT_CHROME_PATH)');
    }

    const copies = (Number.isInteger(copiesOverride) && copiesOverride >= 1 && copiesOverride <= 99) ? copiesOverride : 1;
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

    const paperUsed = paperSpec(paperSizeForSlug(docType));
    let printerTarget = cfg.cupsPrinterUrl;
    if (docType === 'sample-label') {
      const pngBuffers = await renderSampleLabelPngBuffers(page);
      await browser.close();
      browser = null;
      pngBuffers.forEach((buf, i) => printDebugDump(`${docType}-${i}`, 'png', buf, {
        slug: docType, copies, via: 'cups-png', cups: cfg.cupsPrinterUrl,
        media: paperUsed.media, mediaCol: paperUsed.mediaCol,
        printScaling: process.env.PRINT_SCALING || '(unset)', pngBytes: buf.length,
      }));
      const result = await printBuffersViaCups(pngBuffers, cfg, copies, 'image/png');
      console.log(`[print] ${docType} via cups-png →`, JSON.stringify(result));
      printerTarget = result.target;
    } else {
      const spec = paperUsed.pdf;
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

      printDebugDump(docType, 'pdf', fs.readFileSync(tmpPdf), {
        slug: docType, copies, via: 'cups-pdf', cups: cfg.cupsPrinterUrl,
        media: paperUsed.media, mediaCol: paperUsed.mediaCol, pdf: spec,
        printScaling: process.env.PRINT_SCALING || '(unset)',
      });
      const result = await printViaCups(tmpPdf, cfg, copies);
      console.log(`[print] ${docType} via cups-pdf → ${result.target} status=${result.response?.statusCode}`);
      printerTarget = result.target;
    }

    return { printer: printerTarget, copies };
  } finally {
    if (browser) { try { await browser.close(); } catch (_) {} }
    if (tmpPdf) fs.promises.unlink(tmpPdf).catch(() => {});
  }
}

function escapeHtmlText(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function testPrintHtml(config) {
  const now = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
  const label = escapeHtmlText(config.label || 'Printer');
  const target = escapeHtmlText(config.cupsPrinterUrl || '-');
  if (config.kind === 'sticker') {
    return `<div style="font-family:'Kanit',sans-serif;width:152mm;height:101mm;box-sizing:border-box;padding:8mm;color:#000;border:1px solid #000;"><div style="font-size:18pt;font-weight:700;margin-bottom:4mm;">LIS Test Print</div><div style="font-size:14pt;line-height:1.5;">Printer: <b>${label}</b></div><div>Kind: sticker</div><div style="word-break:break-all;">Target: ${target}</div><div>${escapeHtmlText(now)}</div></div>`;
  }
  return `<main style="font-family:'Kanit',sans-serif;padding:18mm;color:#000;"><h1>LIS Test Print</h1><p>Printer: <b>${label}</b></p><p>Kind: a4</p><p style="word-break:break-all;">Target: ${target}</p><p>${escapeHtmlText(now)}</p></main>`;
}

router.post('/printers-config/:id/test', async (req, res) => {
  try {
    const printerConfig = await PrinterConfig.findById(req.params.id).lean();
    if (!printerConfig) return res.status(404).json({ error: 'ไม่พบเครื่องพิมพ์' });
    const docType = printerConfig.kind === 'sticker' ? 'stock-label' : 'service-request';
    const result = await printHtmlJob({ docType, html: testPrintHtml(printerConfig), copiesOverride: 1, printerConfig });
    res.json({ ok: true, printer: result.printer, copies: result.copies });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: `พิมพ์ทดสอบไม่สำเร็จ: ${err.message} หากเครื่องพิมพ์ IP ตรงไม่รองรับ IPP ให้ตั้งผ่าน CUPS URL แทน` });
  }
});

// POST /api/print/pdf — { docType, html } → PDF blob for browser preview/download
router.post('/pdf', async (req, res) => {
  const { docType, html } = req.body || {};
  if (!ALLOWED_SLUGS.includes(docType)) return res.status(400).json({ error: 'docType ไม่ถูกต้อง' });
  if (typeof html !== 'string' || !html.trim()) return res.status(400).json({ error: 'ไม่มีเนื้อหาเอกสาร' });

  let browser;
  try {
    const chromePath = process.env.PRINT_CHROME_PATH;
    if (!chromePath || !fs.existsSync(chromePath)) {
      return res.status(500).json({ error: 'ไม่พบ Chrome สำหรับสร้าง PDF (ตั้งค่า PRINT_CHROME_PATH)' });
    }

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

    const pdf = await page.pdf({
      ...paperSpec(paperSizeForSlug(docType)).pdf,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="lis-${docType}.pdf"`);
    res.send(Buffer.from(pdf));
  } catch (err) {
    res.status(500).json({ error: `สร้าง PDF ไม่สำเร็จ: ${err.message}` });
  } finally {
    if (browser) { try { await browser.close(); } catch (_) {} }
  }
});

// POST /api/print — { docType, html, copies?, printerConfigId? } → PDF/PNG → CUPS
router.post('/', async (req, res) => {
  const { docType, html, copies: copiesOverride, printerConfigId } = req.body || {};
  if (!ALLOWED_SLUGS.includes(docType)) return res.status(400).json({ error: 'docType ไม่ถูกต้อง' });
  if (typeof html !== 'string' || !html.trim()) return res.status(400).json({ error: 'ไม่มีเนื้อหาเอกสาร' });

  try {
    const printerConfig = await choosePrinterForDocType(docType, printerConfigId);
    const result = await printHtmlJob({ docType, html, copiesOverride, printerConfig });
    res.json({ ok: true, printer: result.printer, copies: result.copies });
  } catch (err) {
    const status = err.statusCode || 500;
    const fallback = printerConfigId ? ' หากเครื่องพิมพ์ IP ตรงไม่รองรับ IPP ให้ตั้งผ่าน CUPS URL แทน' : '';
    res.status(status).json({ error: `พิมพ์ไม่สำเร็จ: ${err.message}${fallback}` });
  }
});

module.exports = router;
