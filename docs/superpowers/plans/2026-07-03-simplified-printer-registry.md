# Simplified Printer Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the per-document-type printer configuration with a small printer registry of two kinds — A4 and Sticker — each holding only CUPS printer URLs that can be added freely.

**Architecture:** Documents no longer store their own printer. Each document type maps to a printer *kind* (`a4` or `sticker`) via one shared table (mirrored client + server). A new `PrinterConfig` collection stores printer destinations (`kind`, `label`, `cupsPrinterUrl`, `isDefault`). At print time the server resolves the default printer of the document's kind. Paper size / media stays derived from the document type inside the existing print pipeline, so a single sticker printer still receives correct media per job. Local (`pdf-to-printer`) printing is removed — CUPS only.

**Tech Stack:** Express 4 + Mongoose 8 (server), React 18 + TypeScript + TanStack Query + shadcn/ui (client), Jest (server tests), Vitest (client tests), `ipp` + `puppeteer-core` (existing print pipeline).

## Global Constraints

- Backend mounts every route twice (`/api/*` and `/LIS/api/*`) via `mountApi()` — do not change mounting; `server/routes/print.js` is already mounted at `/print`.
- Soft-delete convention: config-like models apply `softDeletePlugin` from `server/lib/softDelete.js`; queries auto-filter `deletedAt: null`.
- Explicit-add UI convention: repeatable rows are added only via an explicit "+ เพิ่ม…" action — never auto-append a trailing blank row.
- Mirror rule: `server/lib/printerRouting.js` and `src/lib/printConfig.ts` must keep the same `docType → kind` map and the same CUPS URL validation rules.
- CUPS URL is valid only if it parses, uses `http`/`https`/`ipp`/`ipps`, and contains a `/printers/<queue>` (or `/classes/<queue>`) segment.
- Server tests run with **Jest** from `server/` (`.test.js` in `server/lib/`). Client tests run with **Vitest** (`src/**/*.test.ts(x)`). Do NOT put a `.test.js` in `server/models/` (that dir is `require()`-scanned at boot).
- Type-check with `npx tsc -p tsconfig.app.json --noEmit` (the root `npx tsc --noEmit` is a no-op in this repo).
- Do NOT run `npm run build`. Use `npx tsc -p tsconfig.app.json --noEmit`.

---

### Task 1: Server pure routing + validation lib

**Files:**
- Create: `server/lib/printerRouting.js`
- Test: `server/lib/printerRouting.test.js`

**Interfaces:**
- Produces (CommonJS exports):
  - `PRINTER_KINDS: string[]` = `['a4', 'sticker']`
  - `DOC_TYPE_KIND: Record<string,string>`
  - `PRINT_DOC_TYPES: string[]` (the 5 doc-type slugs = `Object.keys(DOC_TYPE_KIND)`)
  - `kindForDocType(docType: string): 'a4'|'sticker'|null`
  - `paperSizeForSlug(slug: string): 'A4'|'label-100x50'|'label-6x4'`
  - `validatePrinterInput(input: {kind, cupsPrinterUrl}, opts?: {requireUrl?: boolean}): string|null`
  - `pickDefault(configs: Array<{kind,isDefault}>, kind: string): object|null`

- [ ] **Step 1: Write the failing test**

Create `server/lib/printerRouting.test.js`:

```js
const {
  PRINTER_KINDS,
  DOC_TYPE_KIND,
  PRINT_DOC_TYPES,
  kindForDocType,
  paperSizeForSlug,
  validatePrinterInput,
  pickDefault,
} = require('./printerRouting');

describe('printerRouting kinds/map', () => {
  test('two kinds', () => {
    expect(PRINTER_KINDS).toEqual(['a4', 'sticker']);
  });
  test('all five doc types map to a kind', () => {
    expect(PRINT_DOC_TYPES).toEqual([
      'sample-label', 'stock-label', 'coa', 'service-request', 'daily-check-report',
    ]);
    expect(kindForDocType('sample-label')).toBe('sticker');
    expect(kindForDocType('stock-label')).toBe('sticker');
    expect(kindForDocType('coa')).toBe('a4');
    expect(kindForDocType('service-request')).toBe('a4');
    expect(kindForDocType('daily-check-report')).toBe('a4');
    expect(kindForDocType('nope')).toBeNull();
  });
  test('paper size derives from slug', () => {
    expect(paperSizeForSlug('sample-label')).toBe('label-100x50');
    expect(paperSizeForSlug('stock-label')).toBe('label-6x4');
    expect(paperSizeForSlug('coa')).toBe('A4');
    expect(paperSizeForSlug('anything-else')).toBe('A4');
  });
});

describe('validatePrinterInput', () => {
  const ok = 'https://192.168.0.237:631/printers/HP-A4';
  test('accepts a valid CUPS URL', () => {
    expect(validatePrinterInput({ kind: 'a4', cupsPrinterUrl: ok })).toBeNull();
    expect(validatePrinterInput({ kind: 'sticker', cupsPrinterUrl: 'ipps://host:631/classes/labels' })).toBeNull();
  });
  test('rejects bad kind', () => {
    expect(validatePrinterInput({ kind: 'a3', cupsPrinterUrl: ok })).toMatch(/kind/);
  });
  test('rejects missing url when required', () => {
    expect(validatePrinterInput({ kind: 'a4', cupsPrinterUrl: '' })).toMatch(/CUPS printer URL/);
  });
  test('allows empty url when requireUrl false', () => {
    expect(validatePrinterInput({ kind: 'a4', cupsPrinterUrl: '' }, { requireUrl: false })).toBeNull();
  });
  test('rejects non-url', () => {
    expect(validatePrinterInput({ kind: 'a4', cupsPrinterUrl: 'not a url' })).toMatch(/ไม่ถูกต้อง/);
  });
  test('rejects wrong protocol', () => {
    expect(validatePrinterInput({ kind: 'a4', cupsPrinterUrl: 'ftp://host/printers/x' })).toMatch(/http/);
  });
  test('rejects url with no queue', () => {
    expect(validatePrinterInput({ kind: 'a4', cupsPrinterUrl: 'https://192.168.0.237:631/' })).toMatch(/queue/);
  });
});

describe('pickDefault', () => {
  const list = [
    { id: '1', kind: 'a4', isDefault: false },
    { id: '2', kind: 'a4', isDefault: true },
    { id: '3', kind: 'sticker', isDefault: false },
  ];
  test('returns the explicit default of the kind', () => {
    expect(pickDefault(list, 'a4').id).toBe('2');
  });
  test('falls back to the first of the kind when none flagged', () => {
    expect(pickDefault(list, 'sticker').id).toBe('3');
  });
  test('null when kind absent or list empty', () => {
    expect(pickDefault(list, 'nope')).toBeNull();
    expect(pickDefault([], 'a4')).toBeNull();
    expect(pickDefault(undefined, 'a4')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest printerRouting`
Expected: FAIL — `Cannot find module './printerRouting'`.

- [ ] **Step 3: Write the implementation**

Create `server/lib/printerRouting.js`:

```js
// Pure routing + validation for the printer registry.
// Mirror of the client copy in src/lib/printConfig.ts — keep the map and the
// URL validation rules identical.

const PRINTER_KINDS = ['a4', 'sticker'];

// Which physical printer kind each document type prints to.
const DOC_TYPE_KIND = {
  'sample-label': 'sticker',
  'stock-label': 'sticker',
  'coa': 'a4',
  'service-request': 'a4',
  'daily-check-report': 'a4',
};

const PRINT_DOC_TYPES = Object.keys(DOC_TYPE_KIND);

function kindForDocType(docType) {
  return DOC_TYPE_KIND[docType] || null;
}

// Media/paper size is derived from the document type, never stored per printer.
function paperSizeForSlug(slug) {
  if (slug === 'sample-label') return 'label-100x50';
  if (slug === 'stock-label') return 'label-6x4';
  return 'A4';
}

// Returns an error string, or null when valid.
function validatePrinterInput(input, opts) {
  const requireUrl = !opts || opts.requireUrl !== false;
  const { kind, cupsPrinterUrl } = input || {};
  if (!PRINTER_KINDS.includes(kind)) return 'kind ต้องเป็น a4 หรือ sticker';
  const raw = typeof cupsPrinterUrl === 'string' ? cupsPrinterUrl.trim() : '';
  if (!raw) return requireUrl ? 'ต้องระบุ CUPS printer URL' : null;
  let url;
  try {
    url = new URL(raw);
  } catch (_) {
    return 'CUPS URL ไม่ถูกต้อง';
  }
  if (!['http:', 'https:', 'ipp:', 'ipps:'].includes(url.protocol)) {
    return 'CUPS URL ต้องเป็น http, https, ipp หรือ ipps';
  }
  const parts = url.pathname.split('/').filter(Boolean);
  const qi = parts.findIndex((p) => p === 'printers' || p === 'classes');
  if (qi < 0 || !parts[qi + 1]) {
    return 'CUPS URL ต้องระบุ queue เช่น https://192.168.0.237:631/printers/PRINTER_NAME';
  }
  return null;
}

// Pure: the printer used for a kind — the explicit default, else the first.
function pickDefault(configs, kind) {
  const ofKind = (configs || []).filter((c) => c.kind === kind);
  return ofKind.find((c) => c.isDefault) || ofKind[0] || null;
}

module.exports = {
  PRINTER_KINDS,
  DOC_TYPE_KIND,
  PRINT_DOC_TYPES,
  kindForDocType,
  paperSizeForSlug,
  validatePrinterInput,
  pickDefault,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest printerRouting`
Expected: PASS (all tests green).

- [ ] **Step 5: Commit**

```bash
git add server/lib/printerRouting.js server/lib/printerRouting.test.js
git commit -m "feat(print): pure printer routing + validation lib"
```

---

### Task 2: PrinterConfig model

**Files:**
- Create: `server/models/PrinterConfig.js`

**Interfaces:**
- Produces: Mongoose model `PrinterConfig` with fields `{ kind: 'a4'|'sticker', label: string, cupsPrinterUrl: string, isDefault: boolean, timestamps, softDelete fields }`.

- [ ] **Step 1: Write the model**

Create `server/models/PrinterConfig.js`:

```js
const mongoose = require('mongoose');
const { softDeletePlugin } = require('../lib/softDelete');

// A printer destination. Documents route to one of these by "kind"
// (see server/lib/printerRouting.js). CUPS-only — the URL carries the queue.
const PrinterConfigSchema = new mongoose.Schema({
  kind: { type: String, enum: ['a4', 'sticker'], required: true, index: true },
  label: { type: String, default: '' },            // display name, optional
  cupsPrinterUrl: { type: String, default: '' },   // e.g. https://192.168.0.237:631/printers/HP-A4
  isDefault: { type: Boolean, default: false },    // the printer used when printing this kind
}, { timestamps: true });

PrinterConfigSchema.plugin(softDeletePlugin);
module.exports = mongoose.model('PrinterConfig', PrinterConfigSchema);
```

- [ ] **Step 2: Verify the model loads (no dedicated unit test — it is a thin schema)**

Run: `cd server && node -e "require('./models/PrinterConfig'); console.log('ok')"`
Expected: prints `ok` with no error.

- [ ] **Step 3: Commit**

```bash
git add server/models/PrinterConfig.js
git commit -m "feat(print): PrinterConfig model (kind + CUPS url + default)"
```

---

### Task 3: Rewrite the print route (registry CRUD + kind-based print resolution)

**Files:**
- Modify (full rewrite): `server/routes/print.js`
- Delete: `server/models/PrintConfig.js`

**Interfaces:**
- Consumes: `server/lib/printerRouting.js` (Task 1), `server/models/PrinterConfig.js` (Task 2).
- Produces (HTTP, mounted at `/print` and `/LIS/api/print`):
  - `GET /print/printers-config` → `{ data: PrinterConfig[] }`
  - `POST /print/printers-config` body `{ kind, label?, cupsPrinterUrl }` → `201 { data: PrinterConfig }`
  - `PUT /print/printers-config/:id` body `{ label?, cupsPrinterUrl? }` → `{ data: PrinterConfig }`
  - `PUT /print/printers-config/:id/default` → `{ data: PrinterConfig }`
  - `DELETE /print/printers-config/:id` → `{ ok: true }`
  - `POST /print` body `{ docType, html, copies? }` → `{ ok, printer, copies }` (unchanged shape)
  - JSON printer shape: `{ id, kind, label, cupsPrinterUrl, isDefault }`
- Removed: `GET /print/printers`, `GET /print/config`, `PUT /print/config/:slug`, the `pdf-to-printer` print branch, `inferredCupsPrinterUrl`.

- [ ] **Step 1: Replace the whole file**

Overwrite `server/routes/print.js` with:

```js
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

function cupsTargetFromUrl(cupsPrinterUrl) {
  const raw = String(cupsPrinterUrl || '').trim();
  if (!raw) return null;
  const url = new URL(raw);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const queuePrefixIndex = pathParts.findIndex((p) => p === 'printers' || p === 'classes');
  const queueName = queuePrefixIndex >= 0 ? pathParts[queuePrefixIndex + 1] : '';
  const destination = decodeURIComponent(queueName || '').trim();
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
  const target = cupsTargetFromUrl(cfg.cupsPrinterUrl);
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
  const target = cupsTargetFromUrl(cfg.cupsPrinterUrl);
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

// POST /api/print — { docType, html, copies? } → PDF/PNG → CUPS
router.post('/', async (req, res) => {
  const { docType, html, copies: copiesOverride } = req.body || {};
  if (!ALLOWED_SLUGS.includes(docType)) return res.status(400).json({ error: 'docType ไม่ถูกต้อง' });
  if (typeof html !== 'string' || !html.trim()) return res.status(400).json({ error: 'ไม่มีเนื้อหาเอกสาร' });

  let browser;
  let tmpPdf;
  try {
    const kind = kindForDocType(docType);
    const printers = await PrinterConfig.find({ kind }).lean();
    const chosen = pickDefault(printers, kind);
    if (!chosen || !chosen.cupsPrinterUrl) {
      return res.status(400).json({ error: 'ยังไม่ได้ตั้งค่าเครื่องพิมพ์สำหรับเอกสารนี้ (ตั้งค่าที่หน้าตั้งค่าระบบ)' });
    }
    const cfg = { slug: docType, cupsPrinterUrl: chosen.cupsPrinterUrl };

    const chromePath = process.env.PRINT_CHROME_PATH;
    if (!chromePath || !fs.existsSync(chromePath)) {
      return res.status(500).json({ error: 'ไม่พบ Chrome สำหรับสร้าง PDF (ตั้งค่า PRINT_CHROME_PATH)' });
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

    res.json({ ok: true, printer: printerTarget, copies });
  } catch (err) {
    res.status(500).json({ error: `พิมพ์ไม่สำเร็จ: ${err.message}` });
  } finally {
    if (browser) { try { await browser.close(); } catch (_) {} }
    if (tmpPdf) fs.promises.unlink(tmpPdf).catch(() => {});
  }
});

module.exports = router;
```

- [ ] **Step 2: Delete the old model**

```bash
git rm server/models/PrintConfig.js
```

- [ ] **Step 3: Smoke-check the route + model load**

Run: `cd server && node -e "require('./routes/print'); console.log('route ok')"`
Expected: prints `route ok` with no error (this also loads `PrinterConfig` and `printerRouting`).

- [ ] **Step 4: Confirm no lingering references to the old model/endpoints**

Run: `git grep -n "models/PrintConfig\|/print/config\|inferredCupsPrinterUrl\|getPrinters" server/`
Expected: no matches in `server/routes/` or `server/models/` (matches only allowed inside `server/seed-data/printconfigs.json`, handled in Task 7).

- [ ] **Step 5: Commit**

```bash
git add server/routes/print.js
git commit -m "feat(print): kind-based printer registry CRUD + CUPS-only resolution"
```

---

### Task 4: Client printConfig lib rewrite

**Files:**
- Modify (full rewrite): `src/lib/printConfig.ts`
- Modify (full rewrite): `src/lib/printConfig.test.ts`

**Interfaces:**
- Produces:
  - types `PrintDocType`, `PaperSize`, `PrinterKind`, `PrinterConfig`, `PrinterConfigInput`, `PrinterKindMeta`, `PrintDocTypeMeta`
  - `PRINTER_KINDS: PrinterKindMeta[]`, `PRINT_DOC_TYPES: PrintDocTypeMeta[]`
  - `docTypeToKind(docType): PrinterKind`
  - `getPrintDocType(slug): PrintDocTypeMeta | undefined`
  - `defaultPrinterFor(configs, kind): PrinterConfig | undefined`
  - `validatePrinterUrl(url): string | null`
- Removed: `PrintConfig`, `PrintConfigInput`, `isPrinterConfigured`, `validatePrintConfig`.

- [ ] **Step 1: Write the failing test**

Overwrite `src/lib/printConfig.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  PRINT_DOC_TYPES,
  PRINTER_KINDS,
  getPrintDocType,
  docTypeToKind,
  defaultPrinterFor,
  validatePrinterUrl,
  type PrinterConfig,
} from "./printConfig";

describe("PRINT_DOC_TYPES", () => {
  it("lists the five doc types with paper defaults", () => {
    expect(PRINT_DOC_TYPES.map((d) => d.slug)).toEqual([
      "sample-label", "coa", "service-request", "stock-label", "daily-check-report",
    ]);
    expect(getPrintDocType("daily-check-report")?.defaultPaper).toBe("A4");
    expect(getPrintDocType("sample-label")?.defaultPaper).toBe("label-100x50");
  });
});

describe("PRINTER_KINDS", () => {
  it("has A4 and Sticker", () => {
    expect(PRINTER_KINDS.map((k) => k.kind)).toEqual(["a4", "sticker"]);
  });
});

describe("docTypeToKind", () => {
  it("routes labels to sticker and docs to a4", () => {
    expect(docTypeToKind("sample-label")).toBe("sticker");
    expect(docTypeToKind("stock-label")).toBe("sticker");
    expect(docTypeToKind("coa")).toBe("a4");
    expect(docTypeToKind("service-request")).toBe("a4");
    expect(docTypeToKind("daily-check-report")).toBe("a4");
  });
});

describe("defaultPrinterFor", () => {
  const list: PrinterConfig[] = [
    { id: "1", kind: "a4", label: "", cupsPrinterUrl: "u1", isDefault: false },
    { id: "2", kind: "a4", label: "", cupsPrinterUrl: "u2", isDefault: true },
    { id: "3", kind: "sticker", label: "", cupsPrinterUrl: "u3", isDefault: false },
  ];
  it("returns the flagged default of the kind", () => {
    expect(defaultPrinterFor(list, "a4")?.id).toBe("2");
  });
  it("falls back to the first of the kind", () => {
    expect(defaultPrinterFor(list, "sticker")?.id).toBe("3");
  });
  it("undefined when none / empty", () => {
    expect(defaultPrinterFor([], "a4")).toBeUndefined();
    expect(defaultPrinterFor(undefined, "a4")).toBeUndefined();
  });
});

describe("validatePrinterUrl", () => {
  it("passes a valid CUPS URL", () => {
    expect(validatePrinterUrl("https://192.168.0.237:631/printers/HP-A4")).toBeNull();
  });
  it("rejects empty", () => {
    expect(validatePrinterUrl("")).toMatch(/CUPS printer URL/);
  });
  it("rejects a non-url", () => {
    expect(validatePrinterUrl("not a url")).toMatch(/ไม่ถูกต้อง/);
  });
  it("rejects wrong protocol", () => {
    expect(validatePrinterUrl("ftp://host/printers/x")).toMatch(/http/);
  });
  it("rejects a url with no queue", () => {
    expect(validatePrinterUrl("https://192.168.0.237:631/")).toMatch(/queue/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/printConfig.test.ts`
Expected: FAIL — exports like `docTypeToKind` / `validatePrinterUrl` do not exist yet.

- [ ] **Step 3: Write the implementation**

Overwrite `src/lib/printConfig.ts`:

```ts
export type PrintDocType = "sample-label" | "coa" | "service-request" | "stock-label" | "daily-check-report";
export type PaperSize = "A4" | "label-100x50" | "label-6x4";
export type PrinterKind = "a4" | "sticker";

export interface PrinterConfig {
  id: string;
  kind: PrinterKind;
  label: string;
  cupsPrinterUrl: string;
  isDefault: boolean;
}

export interface PrinterConfigInput {
  kind: PrinterKind;
  label?: string;
  cupsPrinterUrl: string;
}

export interface PrinterKindMeta {
  kind: PrinterKind;
  label: string;
  hint: string;
}

export const PRINTER_KINDS: PrinterKindMeta[] = [
  { kind: "a4", label: "A4", hint: "COA / ใบคำขอ / รายงาน Daily Check" },
  { kind: "sticker", label: "Sticker (ฉลาก)", hint: "ฉลากตัวอย่าง / ฉลากขวด Standard" },
];

// เอกสารแต่ละชนิดพิมพ์ไปเครื่องชนิดไหน — mirror ของ server/lib/printerRouting.js
const DOC_TYPE_KIND: Record<PrintDocType, PrinterKind> = {
  "sample-label": "sticker",
  "stock-label": "sticker",
  "coa": "a4",
  "service-request": "a4",
  "daily-check-report": "a4",
};

export function docTypeToKind(docType: PrintDocType): PrinterKind {
  return DOC_TYPE_KIND[docType];
}

export interface PrintDocTypeMeta {
  slug: PrintDocType;
  label: string;
  defaultPaper: PaperSize;
}

export const PRINT_DOC_TYPES: PrintDocTypeMeta[] = [
  { slug: "sample-label",    label: "ฉลากตัวอย่าง (sticker 100x50 mm)", defaultPaper: "label-100x50" },
  { slug: "coa",             label: "ใบรายงานผล (COA)",            defaultPaper: "A4" },
  { slug: "service-request", label: "ใบคำขอ (Petition)",            defaultPaper: "A4" },
  { slug: "stock-label",     label: "ฉลากขวด Standard (sticker)", defaultPaper: "label-6x4" },
  { slug: "daily-check-report", label: "รายงานเช็กเครื่องมือ (Daily Check)", defaultPaper: "A4" },
];

export function getPrintDocType(slug: PrintDocType): PrintDocTypeMeta | undefined {
  return PRINT_DOC_TYPES.find((d) => d.slug === slug);
}

// เครื่องที่ระบบใช้พิมพ์ของ kind นั้น — ตัวที่ตั้ง default ไว้ ไม่งั้นตัวแรก
export function defaultPrinterFor(
  configs: PrinterConfig[] | undefined | null,
  kind: PrinterKind,
): PrinterConfig | undefined {
  const ofKind = (configs ?? []).filter((c) => c.kind === kind);
  return ofKind.find((c) => c.isDefault) ?? ofKind[0];
}

// mirror ของ validatePrinterInput ใน server/lib/printerRouting.js
export function validatePrinterUrl(url: string): string | null {
  const raw = (url ?? "").trim();
  if (!raw) return "ต้องระบุ CUPS printer URL";
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "CUPS URL ไม่ถูกต้อง";
  }
  if (!["http:", "https:", "ipp:", "ipps:"].includes(u.protocol)) {
    return "CUPS URL ต้องเป็น http, https, ipp หรือ ipps";
  }
  const parts = u.pathname.split("/").filter(Boolean);
  const qi = parts.findIndex((p) => p === "printers" || p === "classes");
  if (qi < 0 || !parts[qi + 1]) {
    return "CUPS URL ต้องระบุ queue เช่น https://192.168.0.237:631/printers/PRINTER_NAME";
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/printConfig.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/printConfig.ts src/lib/printConfig.test.ts
git commit -m "feat(print): client printer-kind types, routing, url validation"
```

---

### Task 5: Client API layer — printer registry endpoints

**Files:**
- Modify: `src/lib/api.ts` (the import of `@/lib/printConfig` types, and the `// Print` block near line 468-481)

**Interfaces:**
- Consumes: types from `src/lib/printConfig.ts` (Task 4).
- Produces: `api.getPrinterConfigs()`, `api.createPrinterConfig(input)`, `api.updatePrinterConfig(id, input)`, `api.setDefaultPrinterConfig(id)`, `api.deletePrinterConfig(id)`. `api.printDocument(...)` unchanged.
- Removed: `api.getPrinters`, `api.getPrintConfigs`, `api.updatePrintConfig`.

- [ ] **Step 1: Update the printConfig type import**

Find the import from `@/lib/printConfig` in `src/lib/api.ts` (it currently imports `PrintConfig`, `PrintConfigInput`, `PrintDocType`) and change it to:

```ts
import type { PrintDocType, PrinterConfig, PrinterConfigInput } from "@/lib/printConfig";
```

(If `PrintDocType` is imported on a shared line with other names, keep the others; only swap `PrintConfig`/`PrintConfigInput` → `PrinterConfig`/`PrinterConfigInput`.)

- [ ] **Step 2: Replace the Print endpoints block**

Replace this block (currently around lines 468-481):

```ts
  // Print
  getPrinters: () => request<{ data: string[] }>("/print/printers").then((r) => r.data),
  getPrintConfigs: () =>
    request<{ data: PrintConfig[] }>("/print/config").then((r) => r.data),
  updatePrintConfig: (slug: PrintDocType, input: PrintConfigInput) =>
    request<{ data: PrintConfig }>(`/print/config/${slug}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }).then((r) => r.data),
  printDocument: (payload: { docType: PrintDocType; html: string; copies?: number }) =>
    request<{ ok: boolean; printer: string; copies: number }>("/print", {
      method: "POST",
      body: JSON.stringify(payload),
    }).then((r) => ({ printer: r.printer, copies: r.copies })),
```

with:

```ts
  // Print
  getPrinterConfigs: () =>
    request<{ data: PrinterConfig[] }>("/print/printers-config").then((r) => r.data),
  createPrinterConfig: (input: PrinterConfigInput) =>
    request<{ data: PrinterConfig }>("/print/printers-config", {
      method: "POST",
      body: JSON.stringify(input),
    }).then((r) => r.data),
  updatePrinterConfig: (id: string, input: { label?: string; cupsPrinterUrl?: string }) =>
    request<{ data: PrinterConfig }>(`/print/printers-config/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }).then((r) => r.data),
  setDefaultPrinterConfig: (id: string) =>
    request<{ data: PrinterConfig }>(`/print/printers-config/${id}/default`, {
      method: "PUT",
    }).then((r) => r.data),
  deletePrinterConfig: (id: string) =>
    request<{ ok: boolean }>(`/print/printers-config/${id}`, { method: "DELETE" }),
  printDocument: (payload: { docType: PrintDocType; html: string; copies?: number }) =>
    request<{ ok: boolean; printer: string; copies: number }>("/print", {
      method: "POST",
      body: JSON.stringify(payload),
    }).then((r) => ({ printer: r.printer, copies: r.copies })),
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: No new errors referencing `api.ts`, `PrintConfig`, or the print endpoints. (Existing unrelated latent errors elsewhere are acceptable, but there must be no error mentioning `printConfig`, `PrintConfig`, `getPrintConfigs`, `getPrinters`, or `updatePrintConfig`. Consumers `SettingsPage.tsx` / `PrintPreviewDialog.tsx` are fixed in Task 6 — expect errors there until then; note them and continue.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(print): api layer for printer registry CRUD"
```

---

### Task 6: UI — PrinterRegistry component + wire consumers

**Files:**
- Create: `src/components/lis/PrinterRegistry.tsx`
- Delete: `src/components/lis/PrintConfigCard.tsx`
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/components/lis/PrintPreviewDialog.tsx`
- Modify: `src/pages/__tests__/SettingsPage.test.tsx`

**Interfaces:**
- Consumes: `src/lib/printConfig.ts` (Task 4), `src/lib/api.ts` (Task 5).
- Produces: `PrinterRegistry` default export with props
  `{ configs: PrinterConfig[]; saving: boolean; onCreate; onUpdate; onDelete; onSetDefault }`.

- [ ] **Step 1: Create the component**

Create `src/components/lis/PrinterRegistry.tsx`:

```tsx
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Plus, Trash2 } from "lucide-react";
import {
  PRINTER_KINDS,
  validatePrinterUrl,
  type PrinterConfig,
  type PrinterConfigInput,
  type PrinterKind,
} from "@/lib/printConfig";
import { toast } from "sonner";

interface Props {
  configs: PrinterConfig[];
  saving: boolean;
  onCreate: (input: PrinterConfigInput) => void;
  onUpdate: (id: string, input: { label?: string; cupsPrinterUrl?: string }) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
}

export default function PrinterRegistry({ configs, saving, onCreate, onUpdate, onDelete, onSetDefault }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {PRINTER_KINDS.map((meta) => (
        <PrinterKindSection
          key={meta.kind}
          kind={meta.kind}
          title={meta.label}
          hint={meta.hint}
          printers={configs.filter((c) => c.kind === meta.kind)}
          saving={saving}
          onCreate={onCreate}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onSetDefault={onSetDefault}
        />
      ))}
    </div>
  );
}

function PrinterKindSection({
  kind, title, hint, printers, saving, onCreate, onUpdate, onDelete, onSetDefault,
}: {
  kind: PrinterKind;
  title: string;
  hint: string;
  printers: PrinterConfig[];
  saving: boolean;
  onCreate: Props["onCreate"];
  onUpdate: Props["onUpdate"];
  onDelete: Props["onDelete"];
  onSetDefault: Props["onSetDefault"];
}) {
  const [adding, setAdding] = useState(false);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>

        {printers.length === 0 && !adding && (
          <p className="text-xs text-muted-foreground">ยังไม่มีเครื่องพิมพ์</p>
        )}

        {printers.map((p) => (
          <PrinterRow
            key={p.id}
            printer={p}
            saving={saving}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onSetDefault={onSetDefault}
          />
        ))}

        {adding ? (
          <AddPrinterForm
            kind={kind}
            saving={saving}
            onCancel={() => setAdding(false)}
            onCreate={(input) => { onCreate(input); setAdding(false); }}
          />
        ) : (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="mr-1 h-4 w-4" /> เพิ่มเครื่องพิมพ์
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function PrinterRow({
  printer, saving, onUpdate, onDelete, onSetDefault,
}: {
  printer: PrinterConfig;
  saving: boolean;
  onUpdate: Props["onUpdate"];
  onDelete: Props["onDelete"];
  onSetDefault: Props["onSetDefault"];
}) {
  const [label, setLabel] = useState(printer.label);
  const [url, setUrl] = useState(printer.cupsPrinterUrl);
  const dirty = label !== printer.label || url !== printer.cupsPrinterUrl;

  function handleSave() {
    const err = validatePrinterUrl(url);
    if (err) { toast.error(err); return; }
    onUpdate(printer.id, { label, cupsPrinterUrl: url });
  }

  return (
    <div className="space-y-1 rounded-md border p-2">
      <div className="flex items-center gap-2">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="ชื่อเครื่อง (ไม่บังคับ)"
          className="h-8"
        />
        {printer.isDefault ? (
          <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-green-600">
            <Check className="h-3 w-3" /> ค่าเริ่มต้น
          </span>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="whitespace-nowrap"
            onClick={() => onSetDefault(printer.id)}
          >
            ตั้งเป็นค่าเริ่มต้น
          </Button>
        )}
        <Button size="icon" variant="ghost" onClick={() => onDelete(printer.id)} aria-label="ลบเครื่องพิมพ์">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://192.168.0.237:631/printers/PRINTER_NAME"
        className="h-8"
      />
      {dirty && (
        <Button size="sm" onClick={handleSave} disabled={saving}>
          บันทึก
        </Button>
      )}
    </div>
  );
}

function AddPrinterForm({
  kind, saving, onCancel, onCreate,
}: {
  kind: PrinterKind;
  saving: boolean;
  onCancel: () => void;
  onCreate: (input: PrinterConfigInput) => void;
}) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");

  function handleAdd() {
    const err = validatePrinterUrl(url);
    if (err) { toast.error(err); return; }
    onCreate({ kind, label, cupsPrinterUrl: url });
  }

  return (
    <div className="space-y-2 rounded-md border border-dashed p-2">
      <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ชื่อเครื่อง (ไม่บังคับ)" className="h-8" />
      <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://192.168.0.237:631/printers/PRINTER_NAME" className="h-8" />
      <div className="flex gap-2">
        <Button size="sm" onClick={handleAdd} disabled={saving}>เพิ่ม</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>ยกเลิก</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire SettingsPage — imports**

In `src/pages/SettingsPage.tsx`:
- Replace `import PrintConfigCard from "@/components/lis/PrintConfigCard";` with
  `import PrinterRegistry from "@/components/lis/PrinterRegistry";`
- Change the printConfig type import from
  `import type { PrintConfig, PrintConfigInput } from "@/lib/printConfig";` to
  `import type { PrinterConfigInput } from "@/lib/printConfig";`

- [ ] **Step 3: Wire SettingsPage — queries + mutations**

Replace this block (currently lines 54-72):

```tsx
  const { data: printConfigs = [] } = useQuery({
    queryKey: ["print-config"],
    queryFn: api.getPrintConfigs,
  });
  const { data: printers = [] } = useQuery({
    queryKey: ["printers"],
    queryFn: api.getPrinters,
  });
  const savePrintMutation = useMutation({
    mutationFn: ({ slug, input }: { slug: PrintConfig["slug"]; input: PrintConfigInput }) =>
      api.updatePrintConfig(slug, input),
    onSuccess: () => {
      toast.success("บันทึกการตั้งค่าเครื่องพิมพ์แล้ว");
      queryClient.invalidateQueries({ queryKey: ["print-config"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    },
  });
```

with:

```tsx
  const { data: printerConfigs = [] } = useQuery({
    queryKey: ["printer-config"],
    queryFn: api.getPrinterConfigs,
  });
  const invalidatePrinters = () => queryClient.invalidateQueries({ queryKey: ["printer-config"] });
  const onPrinterError = (err: unknown) =>
    toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");

  const createPrinterMutation = useMutation({
    mutationFn: (input: PrinterConfigInput) => api.createPrinterConfig(input),
    onSuccess: () => { toast.success("เพิ่มเครื่องพิมพ์แล้ว"); invalidatePrinters(); },
    onError: onPrinterError,
  });
  const updatePrinterMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: { label?: string; cupsPrinterUrl?: string } }) =>
      api.updatePrinterConfig(id, input),
    onSuccess: () => { toast.success("บันทึกเครื่องพิมพ์แล้ว"); invalidatePrinters(); },
    onError: onPrinterError,
  });
  const deletePrinterMutation = useMutation({
    mutationFn: (id: string) => api.deletePrinterConfig(id),
    onSuccess: () => { toast.success("ลบเครื่องพิมพ์แล้ว"); invalidatePrinters(); },
    onError: onPrinterError,
  });
  const setDefaultPrinterMutation = useMutation({
    mutationFn: (id: string) => api.setDefaultPrinterConfig(id),
    onSuccess: invalidatePrinters,
    onError: onPrinterError,
  });
  const printerSaving =
    createPrinterMutation.isPending ||
    updatePrinterMutation.isPending ||
    deletePrinterMutation.isPending ||
    setDefaultPrinterMutation.isPending;
```

- [ ] **Step 4: Wire SettingsPage — the printers tab body**

Replace the printers `TabsContent` body (currently lines 166-181):

```tsx
        <TabsContent value="printers" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            เลือกเครื่องพิมพ์ปลายทางของเอกสารแต่ละชนิด หรือกำหนด CUPS printer URL จาก https://192.168.0.237:631/
          </p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {printConfigs.map((cfg) => (
              <PrintConfigCard
                key={cfg.slug}
                config={cfg}
                printers={printers}
                saving={savePrintMutation.isPending}
                onSave={(slug, input) => savePrintMutation.mutate({ slug, input })}
              />
            ))}
          </div>
        </TabsContent>
```

with:

```tsx
        <TabsContent value="printers" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            กำหนด CUPS printer URL ของเครื่อง A4 และเครื่องฉลาก (sticker) — เพิ่มได้หลายตัว แล้วเลือกตัวที่ใช้เป็นค่าเริ่มต้น
          </p>
          <PrinterRegistry
            configs={printerConfigs}
            saving={printerSaving}
            onCreate={(input) => createPrinterMutation.mutate(input)}
            onUpdate={(id, input) => updatePrinterMutation.mutate({ id, input })}
            onDelete={(id) => deletePrinterMutation.mutate(id)}
            onSetDefault={(id) => setDefaultPrinterMutation.mutate(id)}
          />
        </TabsContent>
```

- [ ] **Step 5: Update PrintPreviewDialog**

In `src/components/lis/PrintPreviewDialog.tsx`:

Replace the import block (lines 18-22):

```tsx
import {
  getPrintDocType,
  isPrinterConfigured,
  type PrintDocType,
} from "@/lib/printConfig";
```

with:

```tsx
import {
  getPrintDocType,
  docTypeToKind,
  defaultPrinterFor,
  type PrintDocType,
} from "@/lib/printConfig";
```

Replace the query + resolution (lines 99-107):

```tsx
  const { data: configs } = useQuery({
    queryKey: ["print-config"],
    queryFn: api.getPrintConfigs,
    enabled: open,
  });

  const cfg = configs?.find((item) => item.slug === docType);
  const configured = isPrinterConfigured(cfg);
  const printerTarget = cfg?.cupsPrinterUrl?.trim() || cfg?.printerName;
```

with:

```tsx
  const { data: configs } = useQuery({
    queryKey: ["printer-config"],
    queryFn: api.getPrinterConfigs,
    enabled: open,
  });

  const cfg = defaultPrinterFor(configs, docTypeToKind(docType));
  const configured = !!cfg?.cupsPrinterUrl?.trim();
  const printerTarget = cfg?.cupsPrinterUrl?.trim();
```

- [ ] **Step 6: Delete the old card**

```bash
git rm src/components/lis/PrintConfigCard.tsx
```

- [ ] **Step 7: Update SettingsPage test mocks**

In `src/pages/__tests__/SettingsPage.test.tsx`, replace the three print mocks (lines 16-18):

```tsx
    getPrintConfigs: vi.fn().mockResolvedValue([]),
    getPrinters: vi.fn().mockResolvedValue([]),
    updatePrintConfig: vi.fn(),
```

with:

```tsx
    getPrinterConfigs: vi.fn().mockResolvedValue([]),
    createPrinterConfig: vi.fn(),
    updatePrinterConfig: vi.fn(),
    deletePrinterConfig: vi.fn(),
    setDefaultPrinterConfig: vi.fn(),
```

- [ ] **Step 8: Run client tests + type-check**

Run: `npx vitest run src/pages/__tests__/SettingsPage.test.tsx src/lib/printConfig.test.ts`
Expected: PASS.

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: No errors referencing `printConfig`, `PrintConfigCard`, `PrintPreviewDialog`, `SettingsPage`, or the removed `PrintConfig`/`isPrinterConfigured`/`getPrintConfigs` symbols. (Pre-existing unrelated latent errors elsewhere are acceptable.)

- [ ] **Step 9: Confirm no lingering client references**

Run: `git grep -n "PrintConfigCard\|getPrintConfigs\|updatePrintConfig\b\|isPrinterConfigured\|getPrinters\b\|\"print-config\"" src/`
Expected: no matches.

- [ ] **Step 10: Commit**

```bash
git add src/components/lis/PrinterRegistry.tsx src/pages/SettingsPage.tsx src/components/lis/PrintPreviewDialog.tsx src/pages/__tests__/SettingsPage.test.tsx
git commit -m "feat(print): PrinterRegistry UI + wire settings & preview to registry"
```

---

### Task 7: Data cleanup — drop old collection + seed-data

**Files:**
- Delete: `server/seed-data/printconfigs.json`
- Create: `server/scripts/drop-printconfigs.js`

**Interfaces:**
- Produces: a one-off maintenance script `server/scripts/drop-printconfigs.js` (dry-run by default; `--commit` drops the orphaned `printconfigs` collection). Follows the repo's dry-run/`--commit` migration convention.

- [ ] **Step 1: Remove the stale seed-data file**

```bash
git rm server/seed-data/printconfigs.json
```

(The old `PrintConfig` model is gone, so this file would otherwise be an orphan. A fresh `printerconfigs.json` will appear on the next `npm run seed:export`.)

- [ ] **Step 2: Write the drop script**

Create `server/scripts/drop-printconfigs.js`:

```js
// One-off cleanup: the per-document-type printer config was replaced by the
// PrinterConfig registry. The old `printconfigs` collection is now orphaned.
// Dry-run by default; pass --commit to actually drop it.
//
//   node server/scripts/drop-printconfigs.js           # dry-run
//   node server/scripts/drop-printconfigs.js --commit   # drop it
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const COMMIT = process.argv.includes('--commit');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/LIS-DB';

(async () => {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  const names = (await db.listCollections().toArray()).map((c) => c.name);
  if (!names.includes('printconfigs')) {
    console.log('printconfigs collection not present — nothing to do.');
    await mongoose.disconnect();
    return;
  }
  const count = await db.collection('printconfigs').countDocuments();
  if (!COMMIT) {
    console.log(`[dry-run] would drop 'printconfigs' (${count} docs). Re-run with --commit.`);
  } else {
    await db.collection('printconfigs').drop();
    console.log(`Dropped 'printconfigs' (${count} docs).`);
  }
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Run the dry-run to verify it connects and reports**

Run: `cd server && node scripts/drop-printconfigs.js`
Expected: prints either `printconfigs collection not present…` or `[dry-run] would drop 'printconfigs' (N docs)…` with no stack trace.

> The actual `--commit` drop, and `npm run seed:export`, are run by the user on their box (dev + prod) — see the manual checklist in Task 8. This is intentional: destructive data ops are user-run per repo convention.

- [ ] **Step 4: Commit**

```bash
git add server/scripts/drop-printconfigs.js
git rm server/seed-data/printconfigs.json
git commit -m "chore(print): drop-printconfigs cleanup script + remove stale seed-data"
```

---

### Task 8: Full verification + manual E2E checklist

**Files:** none (verification only)

- [ ] **Step 1: Run the whole server test suite**

Run: `cd server && npm test`
Expected: PASS (includes `printerRouting.test.js`; no regressions).

- [ ] **Step 2: Run the whole client test suite**

Run: `npm run test`
Expected: PASS (includes `printConfig.test.ts`, `SettingsPage.test.tsx`).

- [ ] **Step 3: Type-check the app**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: No new errors versus the pre-existing baseline (the repo has ~12 known latent errors; ensure none of the new/changed files — `api.ts`, `printConfig.ts`, `SettingsPage.tsx`, `PrintPreviewDialog.tsx`, `PrinterRegistry.tsx` — appear).

- [ ] **Step 4: Boot smoke test (server)**

Run: `cd server && node -e "require('./index.js')" ` is not appropriate (it starts listening); instead verify model+route load:
Run: `cd server && node -e "require('./models/PrinterConfig'); require('./routes/print'); console.log('boot ok')"`
Expected: prints `boot ok`.

- [ ] **Step 5: Manual E2E (on the user's box — requires running frontend + backend + real CUPS)**

Document these for the user to run; do not automate:

1. Start backend (`cd server && npm run dev`) and frontend (`npm run dev`).
2. Open Settings → **เครื่องพิมพ์เอกสาร**. Confirm two cards: **A4** and **Sticker (ฉลาก)**, each empty with a **"+ เพิ่มเครื่องพิมพ์"** button.
3. Add an A4 printer: label "A4 laser", URL `https://192.168.0.237:631/printers/<A4_QUEUE>`. Confirm it appears and is marked **ค่าเริ่มต้น** automatically.
4. Add a Sticker printer with the label queue URL. Confirm same.
5. Add a second A4 URL; confirm you can switch **ตั้งเป็นค่าเริ่มต้น** between the two, and delete one (if you delete the default, the sibling becomes default).
6. Print flows end-to-end via CUPS:
   - A COA or ใบคำขอ (A4) → prints on the A4 printer.
   - A sample label (`sample-label`, 100×50) → prints on the sticker printer at correct size.
   - A stock/standard bottle label (`stock-label`, 6×4) → prints on the sticker printer at correct size.
7. Remove all printers of a kind and confirm the print button in the preview dialog is disabled with the "ยังไม่ได้ตั้งค่าเครื่องพิมพ์…" message + link to settings.
8. Run the data cleanup + backup:
   - `node server/scripts/drop-printconfigs.js --commit`
   - `cd server && npm run seed:export` then commit the refreshed `server/seed-data/` (a new `printerconfigs.json`, removed `printconfigs.json`).

- [ ] **Step 6: Final commit (if seed-data changed after export)**

```bash
git add server/seed-data
git commit -m "chore(print): refresh seed-data after printer registry migration"
```

---

## Self-Review

**Spec coverage:**
- "Delete all per-doc printer configs" → Task 3 (remove `PrintConfig` model + old endpoints), Task 7 (drop collection + seed-data). ✅
- "Two kinds A4 + Sticker, CUPS URL only" → Task 1 (`PRINTER_KINDS`, validation), Task 2 (model), Task 6 (UI). ✅
- "Able to add URLs" → Task 6 `AddPrinterForm` + `POST /printers-config`. ✅
- "docType → kind mapping, media derived from docType" → Task 1 (`DOC_TYPE_KIND`, `paperSizeForSlug`), Task 3 (`POST /print`). ✅
- "Drop local (`pdf-to-printer`) printing" → Task 3 (removed branch, `GET /printers`). ✅
- Consumer updates (`PrintPreviewDialog`, `SettingsPage`, tests) → Task 6. ✅
- Default-per-kind resolution + delete-promotes-sibling → Task 1 (`pickDefault`), Task 3 (default/delete endpoints). ✅

**Placeholder scan:** No TBD/TODO/"handle errors"/"similar to". Every code step has full code. ✅

**Type consistency:** Printer JSON shape `{ id, kind, label, cupsPrinterUrl, isDefault }` is identical across `pickConfig` (server, Task 3), `PrinterConfig` (client, Task 4), and API return types (Task 5). `validatePrinterInput` (server) and `validatePrinterUrl` (client) share the same rules/messages. `docTypeToKind`/`kindForDocType` share the same map. `defaultPrinterFor` (client) mirrors `pickDefault` (server). ✅
