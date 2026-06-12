const express = require('express');
const fs = require('fs');
const XLSX = require('xlsx');

const router = express.Router();

const DEFAULT_WEBHOOK_URL = 'https://n8n-plant.icpladda.com/webhook/API/Item-production';
const WEBHOOK_URL = process.env.MASTER_ITEMS_WEBHOOK_URL || DEFAULT_WEBHOOK_URL;

async function forwardToWebhook(req, res) {
  try {
    const headers = {
      Accept: 'application/json',
    };

    const init = {
      method: req.method,
      headers,
    };

    if (!['GET', 'HEAD'].includes(req.method)) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(req.body || {});
    }

    const target = new URL(WEBHOOK_URL);
    if (req.params.id && !target.searchParams.has('id')) {
      target.searchParams.set('id', req.params.id);
    }
    for (const [key, value] of Object.entries(req.query)) {
      if (Array.isArray(value)) {
        value.forEach((entry) => target.searchParams.append(key, entry));
      } else if (value !== undefined) {
        target.searchParams.set(key, value);
      }
    }

    const response = await fetch(target, init);
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : await response.text();

    if (!response.ok) {
      return res.status(response.status).json({
        message: 'Master item webhook request failed',
        error: payload,
      });
    }

    return res.status(response.status).json(payload);
  } catch (err) {
    return res.status(502).json({
      message: 'Cannot connect to master item webhook',
      error: err.message,
    });
  }
}

// ---- Export (xlsx / pdf) -------------------------------------------------
// Client ส่งแถวที่กรองแล้วมา, server แปลงเป็นไฟล์ดาวน์โหลด (reuse xlsx + puppeteer)

function computeColumns(rows) {
  const seen = [];
  const set = new Set();
  for (const row of rows) {
    if (row && typeof row === 'object') {
      for (const key of Object.keys(row)) {
        if (!set.has(key)) { set.add(key); seen.push(key); }
      }
    }
  }
  return seen;
}

function cellToString(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

router.post('/export', async (req, res) => {
  try {
    const { format, rows, title } = req.body || {};
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'ไม่มีข้อมูลสำหรับ export' });
    }
    if (format !== 'xlsx' && format !== 'pdf') {
      return res.status(400).json({ error: 'format ไม่ถูกต้อง (รองรับ xlsx หรือ pdf)' });
    }

    const columns = computeColumns(rows);
    const baseName = `master-item-${dateStamp()}`;

    if (format === 'xlsx') {
      const data = rows.map((row) => {
        const obj = {};
        for (const col of columns) obj[col] = cellToString(row && row[col]);
        return obj;
      });
      const ws = XLSX.utils.json_to_sheet(data, { header: columns });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Master Item');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${baseName}.xlsx"`);
      return res.send(buf);
    }

    // format === 'pdf'
    const chromePath = process.env.PRINT_CHROME_PATH;
    if (!chromePath || !fs.existsSync(chromePath)) {
      return res.status(400).json({ error: 'ไม่พบ Chrome สำหรับสร้าง PDF (ตั้งค่า PRINT_CHROME_PATH)' });
    }

    const headHtml = columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('');
    const bodyHtml = rows.map((row) => {
      const tds = columns.map((c) => `<td>${escapeHtml(cellToString(row && row[c]))}</td>`).join('');
      return `<tr>${tds}</tr>`;
    }).join('');
    const docTitle = escapeHtml(title || 'Master Item');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600&display=swap" rel="stylesheet">
<style>
  @page { size: A4 landscape; margin: 8mm; }
  * { font-family: 'Kanit', sans-serif; }
  h1 { font-size: 12px; margin: 0 0 4px; }
  .meta { font-size: 8px; color: #555; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; table-layout: auto; }
  thead { display: table-header-group; }
  th, td { border: 1px solid #999; padding: 2px 3px; font-size: 7px; text-align: left; vertical-align: top; word-break: break-word; }
  th { background: #eee; font-weight: 600; }
</style></head><body>
  <h1>${docTitle}</h1>
  <div class="meta">จำนวน ${rows.length} รายการ</div>
  <table><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>
</body></html>`;

    const puppeteer = require('puppeteer-core');
    let browser;
    try {
      browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load', timeout: 20000 });
      await page.evaluateHandle('document.fonts.ready').catch(() => {});
      const pdf = await page.pdf({
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: '8mm', right: '8mm', bottom: '8mm', left: '8mm' },
      });
      await browser.close();
      browser = null;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${baseName}.pdf"`);
      // page.pdf() returns a Uint8Array; wrap in Buffer so Express sends raw bytes
      // (a plain Uint8Array would be JSON-serialized by res.send)
      return res.send(Buffer.from(pdf));
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ---- Slim list (group-membership only) -----------------------------------
// The full master-item payload from the ERP webhook is ~940 KB and is fetched
// on every page that needs item↔group membership (QC testing/approval/assign,
// config pages) via useItemGroupMembership. That hook only reads 3 fields per
// item, so this endpoint returns just those and caches the ERP round-trip for
// a few minutes (the catalog changes rarely). Cuts ~940 KB → ~50 KB and skips
// the upstream fetch on repeat loads.
//
// Key lists MUST stay in sync with src/lib/masterItemFields.ts.
const SLIM_KEYS = {
  itemNo: ['item_no', 'itemCode', 'item_code', 'code', 'Code', 'ITEM_CODE'],
  commonName: ['common_name', 'commonname', 'commonName', 'item_name2', 'itemType'],
  tradeName: ['trade_name', 'tradename', 'tradeName'],
};

function firstValue(item, keys) {
  for (const key of keys) {
    const v = item[key];
    if (v !== undefined && v !== null && v !== '') return String(v).trim();
  }
  return '';
}

function normalizeItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const found = [payload.data, payload.items, payload.result, payload.rows].find(Array.isArray);
    if (Array.isArray(found)) return found;
  }
  return [];
}

let slimCache = null;
let slimCacheAt = 0;
const SLIM_TTL_MS = 5 * 60 * 1000;

router.get('/slim', async (req, res) => {
  try {
    const now = Date.now();
    if (slimCache && now - slimCacheAt < SLIM_TTL_MS) {
      return res.json({ data: slimCache, cached: true });
    }
    const response = await fetch(new URL(WEBHOOK_URL), { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      // Serve stale cache rather than failing the page if the ERP hiccups.
      if (slimCache) return res.json({ data: slimCache, cached: true, stale: true });
      return res.status(response.status).json({ message: 'Master item webhook request failed' });
    }
    const payload = await response.json().catch(() => null);
    const slim = normalizeItems(payload)
      .map((it) => ({
        itemNo: firstValue(it, SLIM_KEYS.itemNo),
        commonName: firstValue(it, SLIM_KEYS.commonName),
        tradeName: firstValue(it, SLIM_KEYS.tradeName),
      }))
      .filter((r) => r.itemNo);
    slimCache = slim;
    slimCacheAt = now;
    return res.json({ data: slim });
  } catch (err) {
    if (slimCache) return res.json({ data: slimCache, cached: true, stale: true });
    return res.status(502).json({ message: 'Cannot connect to master item webhook', error: err.message });
  }
});

router.get('/', forwardToWebhook);
router.post('/', forwardToWebhook);
router.put('/', forwardToWebhook);
router.patch('/', forwardToWebhook);
router.delete('/', forwardToWebhook);
router.get('/:id', forwardToWebhook);
router.put('/:id', forwardToWebhook);
router.patch('/:id', forwardToWebhook);
router.delete('/:id', forwardToWebhook);

module.exports = router;
