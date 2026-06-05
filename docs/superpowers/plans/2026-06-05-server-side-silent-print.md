# Server-side Silent Print Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** กดพิมพ์เอกสาร → เด้ง preview ในแอป (ไม่ใช่ของ browser) → ยืนยัน → server แปลง HTML เป็น PDF ด้วย Puppeteer แล้วส่งเข้า network printer ที่ตั้งค่าไว้ตามประเภทเอกสาร โดยไม่มี print dialog ของ browser

**Architecture:** Backend เพิ่ม `PrintConfig` model (map docType→เครื่อง, pattern เดียวกับ `EnvRoomConfig`) + route `print.js` (list เครื่อง / config / `POST /api/print`). `POST /api/print` รับ HTML จาก client → Puppeteer (`puppeteer-core` ชี้ Chrome ที่เครื่อง prod) render เป็น PDF (ปิด JS + จำกัด network ตาม allowlist) → `pdf-to-printer` ส่งเข้าเครื่องตาม config. Frontend เพิ่ม `printConfig.ts` (types + validation mirror), `print.ts` (serialize + POST), `PrintPreviewDialog`, section ตั้งค่าใน Settings และปรับ 4 จุดเดิมให้เลิก `window.print()`.

**Tech Stack:** Express 4 + Mongoose 8, `puppeteer-core`, `pdf-to-printer` (Windows/SumatraPDF). Frontend React 18 + TS + TanStack Query + shadcn/ui. Tests: Vitest (client), Playwright (e2e). Server ไม่มี test runner → route verify แบบ manual (ตาม pattern repo เดิม เช่น `envRoomConfig.js`).

---

## File Structure

**สร้างใหม่ (backend):**
- `server/models/PrintConfig.js` — Mongoose model, 1 doc ต่อ docType
- `server/routes/print.js` — printers list / config GET-PUT / POST print

**แก้ (backend):**
- `server/index.js` — `mountApi('/print', ...)`
- `server/package.json` — เพิ่ม deps (ผ่าน `npm install`)
- `server/.env` — `PRINT_CHROME_PATH`

**สร้างใหม่ (frontend):**
- `src/lib/printConfig.ts` — types, docType metadata, validation mirror
- `src/lib/printConfig.test.ts` — Vitest
- `src/lib/print.ts` — `serializeForPrint` + `printDocument`
- `src/lib/print.test.ts` — Vitest
- `src/components/lis/PrintPreviewDialog.tsx` — modal preview + ยืนยันพิมพ์
- `src/components/lis/PrintConfigCard.tsx` — การ์ดตั้งค่าใน Settings

**แก้ (frontend):**
- `src/lib/api.ts` — endpoints `getPrinters` / `getPrintConfigs` / `updatePrintConfig` / `printDocument`
- `src/pages/SettingsPage.tsx` — เพิ่ม section "เครื่องพิมพ์เอกสาร"
- `src/components/lis/COADialog.tsx` — ใช้ PrintPreviewDialog (docType `coa`)
- `src/pages/petitions/ProductionPetitionNewPage.tsx` — labels → PrintPreviewDialog (`sample-label`)
- `src/pages/PetitionDetailPage.tsx` — ใบคำขอ → PrintPreviewDialog (`service-request`)
- caller ของ `ProductionPlanPrintTemplate.tsx` → (`production-plan`, ข้ามได้ถ้าถูกลบ)
- `tests/e2e/service-request-print.spec.ts`, `tests/e2e/production-plan-print.spec.ts`

---

## Task 1: ติดตั้ง dependencies + ตั้งค่า Chrome path

**Files:**
- Modify: `server/package.json` (ผ่าน npm)
- Modify: `server/.env`

- [ ] **Step 1: ติดตั้ง deps ฝั่ง server**

Run (จาก repo root):
```bash
cd server && npm install puppeteer-core pdf-to-printer
```
Expected: `package.json` มี `puppeteer-core` และ `pdf-to-printer` ใน dependencies, ติดตั้งสำเร็จ ไม่มี error

- [ ] **Step 2: หา path ของ Chrome/Brave ที่เครื่อง dev**

Run (Windows PowerShell):
```powershell
(Get-Command chrome -ErrorAction SilentlyContinue).Source; Test-Path "C:\Program Files\Google\Chrome\Application\chrome.exe"; Test-Path "C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe"
```
Expected: เจอ path ของ chrome.exe หรือ brave.exe อย่างน้อยหนึ่งอัน — จดไว้

- [ ] **Step 3: เพิ่ม `PRINT_CHROME_PATH` ใน `server/.env`**

เพิ่มบรรทัด (ใช้ path ที่เจอใน Step 2; escape backslash ไม่ต้องใน .env):
```
PRINT_CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
```
Expected: ไฟล์ `server/.env` มีบรรทัดนี้ (ไม่ commit `.env`)

- [ ] **Step 4: Commit (package.json + lock เท่านั้น — ไม่รวม .env)**

```bash
git add server/package.json server/package-lock.json
git commit -m "build: add puppeteer-core + pdf-to-printer for server-side printing" -- server/package.json server/package-lock.json
```

---

## Task 2: PrintConfig model

**Files:**
- Create: `server/models/PrintConfig.js`

- [ ] **Step 1: เขียน model**

`server/models/PrintConfig.js`:
```js
const mongoose = require('mongoose');

const PrintConfigSchema = new mongoose.Schema({
  slug: {
    type: String,
    enum: ['sample-label', 'coa', 'service-request', 'production-plan'],
    required: true,
    unique: true,
    index: true,
  },
  printerName: { type: String, default: '' }, // '' = ยังไม่ตั้ง → บล็อกการพิมพ์
  copies: { type: Number, default: 1 },
  paperSize: { type: String, enum: ['A4', 'label-6x4'], default: 'A4' },
}, { timestamps: true });

module.exports = mongoose.model('PrintConfig', PrintConfigSchema);
```

- [ ] **Step 2: ตรวจว่า model ถูกโหลดอัตโนมัติ**

`loadAllModels()` ใน `server/index.js` โหลดทุกไฟล์ใน `server/models/` อยู่แล้ว — เปิด `server/index.js` ยืนยันว่ามี glob/loop โหลด models โดยไม่ต้อง require รายตัว ถ้าเป็นการ require รายตัว ให้เพิ่ม `require('./models/PrintConfig')` ในจุดเดียวกับ models อื่น

Run:
```bash
cd server && node -e "require('./models/PrintConfig'); console.log('ok')"
```
Expected: พิมพ์ `ok` ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add server/models/PrintConfig.js
git commit -m "feat: add PrintConfig model" -- server/models/PrintConfig.js
```

---

## Task 3: print route — config + printers + POST print

**Files:**
- Create: `server/routes/print.js`

- [ ] **Step 1: เขียน route**

`server/routes/print.js`:
```js
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
  const tmpPdf = path.join(os.tmpdir(), `lis-print-${crypto.randomUUID()}.pdf`);
  let browser;
  try {
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
    fs.promises.unlink(tmpPdf).catch(() => {});
  }
});

module.exports = router;
```

- [ ] **Step 2: Mount route ใน `server/index.js`**

เพิ่มบรรทัด (วางถัดจาก `mountApi('/env-room-config', ...)` ที่บรรทัด ~49):
```js
mountApi('/print', require('./routes/print'));
```

- [ ] **Step 3: Verify route โหลดได้ + server boot**

Run:
```bash
cd server && node -e "require('./routes/print'); console.log('route ok')"
```
Expected: `route ok` ไม่มี error (require puppeteer-core/pdf-to-printer แบบ lazy อยู่ใน handler จึงไม่ throw ตอนโหลด)

- [ ] **Step 4: Manual verify config endpoints (server ต้องรันอยู่ + MongoDB)**

เปิด server: `cd server && npm run dev` แล้วอีก terminal:
```bash
curl http://localhost:3001/api/print/config
curl http://localhost:3001/api/print/printers
```
Expected: `/config` คืน array 4 docType (printerName ว่าง); `/printers` คืนรายชื่อเครื่องที่เครื่อง dev เห็น

- [ ] **Step 5: Commit**

```bash
git add server/routes/print.js server/index.js
git commit -m "feat: add print route (config + printers + puppeteer print)" -- server/routes/print.js server/index.js
```

---

## Task 4: client lib `printConfig.ts` (types + validation mirror) — TDD

**Files:**
- Create: `src/lib/printConfig.ts`
- Test: `src/lib/printConfig.test.ts`

- [ ] **Step 1: เขียน failing test**

`src/lib/printConfig.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  PRINT_DOC_TYPES,
  getPrintDocType,
  isPrinterConfigured,
  validatePrintConfig,
  type PrintConfig,
} from "./printConfig";

describe("PRINT_DOC_TYPES", () => {
  it("has the 4 known doc types", () => {
    expect(PRINT_DOC_TYPES.map((d) => d.slug)).toEqual([
      "sample-label", "coa", "service-request", "production-plan",
    ]);
  });
});

describe("getPrintDocType", () => {
  it("returns metadata for a known slug", () => {
    expect(getPrintDocType("coa")?.defaultPaper).toBe("A4");
    expect(getPrintDocType("sample-label")?.defaultPaper).toBe("label-6x4");
  });
});

describe("isPrinterConfigured", () => {
  it("false when printerName empty or missing", () => {
    expect(isPrinterConfigured(undefined)).toBe(false);
    expect(isPrinterConfigured({ slug: "coa", printerName: "", copies: 1, paperSize: "A4" })).toBe(false);
  });
  it("true when printerName set", () => {
    const cfg: PrintConfig = { slug: "coa", printerName: "HP-A4", copies: 1, paperSize: "A4" };
    expect(isPrinterConfigured(cfg)).toBe(true);
  });
});

describe("validatePrintConfig", () => {
  it("passes a valid config", () => {
    expect(validatePrintConfig({ printerName: "HP", copies: 2, paperSize: "A4" })).toBeNull();
  });
  it("rejects copies < 1", () => {
    expect(validatePrintConfig({ printerName: "HP", copies: 0, paperSize: "A4" })).toMatch(/จำนวนชุด/);
  });
  it("rejects bad paperSize", () => {
    expect(validatePrintConfig({ printerName: "HP", copies: 1, paperSize: "A3" })).toMatch(/paperSize/);
  });
});
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `npm run test -- src/lib/printConfig.test.ts`
Expected: FAIL — module `./printConfig` ยังไม่มี

- [ ] **Step 3: เขียน implementation**

`src/lib/printConfig.ts`:
```ts
export type PrintDocType = "sample-label" | "coa" | "service-request" | "production-plan";
export type PaperSize = "A4" | "label-6x4";

export interface PrintConfig {
  slug: PrintDocType;
  printerName: string;
  copies: number;
  paperSize: PaperSize;
}

export interface PrintConfigInput {
  printerName: string;
  copies?: number;
  paperSize?: PaperSize;
}

export interface PrintDocTypeMeta {
  slug: PrintDocType;
  label: string;
  defaultPaper: PaperSize;
}

export const PRINT_DOC_TYPES: PrintDocTypeMeta[] = [
  { slug: "sample-label",    label: "ฉลากตัวอย่าง (sticker 6x4)", defaultPaper: "label-6x4" },
  { slug: "coa",             label: "ใบรายงานผล (COA)",            defaultPaper: "A4" },
  { slug: "service-request", label: "ใบคำขอ (Petition)",            defaultPaper: "A4" },
  { slug: "production-plan", label: "ใบวางแผนผลิต",                 defaultPaper: "A4" },
];

export function getPrintDocType(slug: PrintDocType): PrintDocTypeMeta | undefined {
  return PRINT_DOC_TYPES.find((d) => d.slug === slug);
}

export function isPrinterConfigured(cfg: PrintConfig | undefined | null): boolean {
  return !!cfg && typeof cfg.printerName === "string" && cfg.printerName.trim().length > 0;
}

// mirror ของ validate() ใน server/routes/print.js
export function validatePrintConfig(input: PrintConfigInput): string | null {
  if (typeof input.printerName !== "string") return "printerName ต้องเป็นข้อความ";
  if (input.copies != null && (!Number.isInteger(input.copies) || input.copies < 1)) {
    return "จำนวนชุดต้องเป็นจำนวนเต็มตั้งแต่ 1";
  }
  if (input.paperSize != null && !["A4", "label-6x4"].includes(input.paperSize)) {
    return "paperSize ไม่ถูกต้อง";
  }
  return null;
}
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `npm run test -- src/lib/printConfig.test.ts`
Expected: PASS ทุก test

- [ ] **Step 5: Commit**

```bash
git add src/lib/printConfig.ts src/lib/printConfig.test.ts
git commit -m "feat: add printConfig types + validation mirror" -- src/lib/printConfig.ts src/lib/printConfig.test.ts
```

---

## Task 5: client lib `print.ts` (serialize) — TDD

**Files:**
- Create: `src/lib/print.ts`
- Test: `src/lib/print.test.ts`
- Modify: `src/lib/api.ts`

- [ ] **Step 1: เขียน failing test สำหรับ serialize**

`src/lib/print.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { serializeForPrint } from "./print";

describe("serializeForPrint", () => {
  it("returns the element's outerHTML", () => {
    const el = document.createElement("div");
    el.className = "doc";
    el.innerHTML = "<p>hello</p>";
    expect(serializeForPrint(el)).toContain("<p>hello</p>");
    expect(serializeForPrint(el)).toContain('class="doc"');
  });

  it("prepends a <style> block when css is given", () => {
    const el = document.createElement("div");
    el.innerHTML = "x";
    const out = serializeForPrint(el, ".doc{color:red}");
    expect(out.startsWith("<style>.doc{color:red}</style>")).toBe(true);
    expect(out).toContain("x");
  });

  it("throws on null element", () => {
    expect(() => serializeForPrint(null)).toThrow();
  });
});
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `npm run test -- src/lib/print.test.ts`
Expected: FAIL — module `./print` ยังไม่มี

- [ ] **Step 3: เขียน `src/lib/print.ts`**

```ts
import { api } from "@/lib/api";
import type { PrintDocType } from "@/lib/printConfig";

// แปลง DOM node เป็น HTML string สำหรับส่งไป server.
// node ควรมี <style> ของตัวเองฝังอยู่แล้ว (templates ส่วนใหญ่ทำแบบนี้);
// COA ที่ CSS แยก ให้ส่ง css เข้ามาเพื่อ prepend
export function serializeForPrint(el: HTMLElement | null, css?: string): string {
  if (!el) throw new Error("ไม่พบเนื้อหาสำหรับพิมพ์");
  const body = el.outerHTML;
  return css ? `<style>${css}</style>${body}` : body;
}

export interface PrintResult {
  printer: string;
  copies: number;
}

export async function printDocument(
  docType: PrintDocType,
  el: HTMLElement | null,
  opts?: { css?: string; copies?: number },
): Promise<PrintResult> {
  const html = serializeForPrint(el, opts?.css);
  return api.printDocument({ docType, html, copies: opts?.copies });
}
```

- [ ] **Step 4: เพิ่ม endpoints ใน `src/lib/api.ts`**

import (ใกล้ๆ import บรรทัด 11):
```ts
import type { PrintConfig, PrintConfigInput, PrintDocType } from "@/lib/printConfig";
```
เพิ่มใน `export const api = { ... }` (ถัดจาก `updateEnvRoomConfig` ~บรรทัด 244):
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

- [ ] **Step 5: รัน test + typecheck**

Run: `npm run test -- src/lib/print.test.ts`
Expected: PASS

Run: `npx tsc --noEmit`
Expected: ไม่มี error เกี่ยวกับ print/api

- [ ] **Step 6: Commit**

```bash
git add src/lib/print.ts src/lib/print.test.ts src/lib/api.ts
git commit -m "feat: add print serialize util + api endpoints" -- src/lib/print.ts src/lib/print.test.ts src/lib/api.ts
```

---

## Task 6: PrintPreviewDialog component

**Files:**
- Create: `src/components/lis/PrintPreviewDialog.tsx`

- [ ] **Step 1: เขียน component**

`src/components/lis/PrintPreviewDialog.tsx`:
```tsx
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Printer } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { printDocument } from "@/lib/print";
import {
  getPrintDocType, isPrinterConfigured, type PrintDocType,
} from "@/lib/printConfig";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docType: PrintDocType;
  /** CSS เสริมสำหรับ template ที่ไม่ได้ฝัง <style> ไว้ใน children (เช่น COA) */
  css?: string;
  children: React.ReactNode; // template ที่จะ preview + พิมพ์
}

export default function PrintPreviewDialog({ open, onOpenChange, docType, css, children }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [copies, setCopies] = useState(1);
  const [printing, setPrinting] = useState(false);
  const meta = getPrintDocType(docType);

  const { data: configs } = useQuery({
    queryKey: ["print-config"],
    queryFn: api.getPrintConfigs,
    enabled: open,
  });
  const cfg = configs?.find((c) => c.slug === docType);
  const configured = isPrinterConfigured(cfg);

  async function handlePrint() {
    setPrinting(true);
    try {
      const res = await printDocument(docType, printRef.current, { css, copies });
      toast.success(`ส่งพิมพ์ไปยัง ${res.printer} (${res.copies} ชุด)`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "พิมพ์ไม่สำเร็จ");
    } finally {
      setPrinting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>ตัวอย่างก่อนพิมพ์ — {meta?.label ?? docType}</DialogTitle>
        </DialogHeader>

        <div className="rounded border bg-white p-2">
          <div ref={printRef}>{children}</div>
        </div>

        {!configured && (
          <p className="text-sm text-red-600">
            ยังไม่ได้ตั้งค่าเครื่องพิมพ์สำหรับเอกสารนี้ —{" "}
            <Link to="/settings" className="underline" onClick={() => onOpenChange(false)}>
              ไปหน้าตั้งค่าระบบ
            </Link>
          </p>
        )}

        <DialogFooter className="items-center gap-3 sm:justify-between">
          <div className="flex items-center gap-2">
            <Label htmlFor="print-copies" className="text-sm">จำนวนชุด</Label>
            <Input
              id="print-copies"
              type="number"
              min={1}
              value={copies}
              onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value || "1", 10)))}
              className="w-20"
            />
            {configured && <span className="text-sm text-muted-foreground">→ {cfg?.printerName}</span>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>ปิด</Button>
            <Button onClick={handlePrint} disabled={!configured || printing} className="gap-2">
              <Printer className="w-4 h-4" /> {printing ? "กำลังพิมพ์…" : "พิมพ์"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: ยืนยัน import paths ของ ui primitives มีจริง**

Run:
```bash
ls src/components/ui/dialog.tsx src/components/ui/button.tsx src/components/ui/input.tsx src/components/ui/label.tsx
```
Expected: มีครบทุกไฟล์ (ถ้า `label.tsx` ไม่มี ให้ใช้ `<label>` html ธรรมดาแทน)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: ไม่มี error ใน PrintPreviewDialog

- [ ] **Step 4: Commit**

```bash
git add src/components/lis/PrintPreviewDialog.tsx
git commit -m "feat: add PrintPreviewDialog" -- src/components/lis/PrintPreviewDialog.tsx
```

---

## Task 7: Settings — section เครื่องพิมพ์ + PrintConfigCard

**Files:**
- Create: `src/components/lis/PrintConfigCard.tsx`
- Modify: `src/pages/SettingsPage.tsx`

- [ ] **Step 1: เขียน `PrintConfigCard.tsx`**

```tsx
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getPrintDocType, validatePrintConfig, type PrintConfig, type PrintConfigInput } from "@/lib/printConfig";
import { toast } from "sonner";

interface Props {
  config: PrintConfig;
  printers: string[];
  saving: boolean;
  onSave: (slug: PrintConfig["slug"], input: PrintConfigInput) => void;
}

export default function PrintConfigCard({ config, printers, saving, onSave }: Props) {
  const [printerName, setPrinterName] = useState(config.printerName);
  const [copies, setCopies] = useState(config.copies);
  const [paperSize, setPaperSize] = useState(config.paperSize);
  const meta = getPrintDocType(config.slug);

  function handleSave() {
    const input: PrintConfigInput = { printerName, copies, paperSize };
    const err = validatePrintConfig(input);
    if (err) { toast.error(err); return; }
    onSave(config.slug, input);
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h3 className="text-sm font-semibold">{meta?.label ?? config.slug}</h3>

        <div className="space-y-1">
          <Label className="text-xs">เครื่องพิมพ์</Label>
          <Select value={printerName || undefined} onValueChange={setPrinterName}>
            <SelectTrigger><SelectValue placeholder="เลือกเครื่องพิมพ์" /></SelectTrigger>
            <SelectContent>
              {printers.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-3">
          <div className="space-y-1">
            <Label className="text-xs">จำนวนชุด</Label>
            <Input type="number" min={1} value={copies}
              onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value || "1", 10)))}
              className="w-20" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">ขนาดกระดาษ</Label>
            <Select value={paperSize} onValueChange={(v) => setPaperSize(v as PrintConfig["paperSize"])}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="A4">A4</SelectItem>
                <SelectItem value="label-6x4">ฉลาก 6x4 นิ้ว</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "กำลังบันทึก…" : "บันทึก"}
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: ยืนยัน `select.tsx` / `card.tsx` มีจริง**

Run:
```bash
ls src/components/ui/select.tsx src/components/ui/card.tsx
```
Expected: มีทั้งคู่ (shadcn ใช้ทั่วโปรเจกต์)

- [ ] **Step 3: เพิ่ม section ใน `SettingsPage.tsx`**

import เพิ่ม:
```tsx
import PrintConfigCard from "@/components/lis/PrintConfigCard";
import type { PrintConfig, PrintConfigInput } from "@/lib/printConfig";
```

ใน component เพิ่ม query + mutation (ถัดจาก `saveMutation` ~บรรทัด 36):
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

เพิ่ม block UI ถัดจาก `</div>` ปิด section env (หลังบรรทัด ~66, ก่อน `</AppLayout>`):
```tsx
      <div className="space-y-3 mt-8">
        <h2 className="text-sm font-semibold text-muted-foreground">เครื่องพิมพ์เอกสาร</h2>
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
      </div>
```

- [ ] **Step 4: Typecheck + รัน test เดิมของ Settings ไม่พัง**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

Run: `npm run test -- src/pages/__tests__/SettingsPage.test.tsx`
Expected: PASS (ถ้า fail เพราะ mock fetch ใหม่ ให้เพิ่ม mock ของ `getPrintConfigs`/`getPrinters` คืน `[]` ใน test setup)

- [ ] **Step 5: Commit**

```bash
git add src/components/lis/PrintConfigCard.tsx src/pages/SettingsPage.tsx src/pages/__tests__/SettingsPage.test.tsx
git commit -m "feat: add printer config section to Settings" -- src/components/lis/PrintConfigCard.tsx src/pages/SettingsPage.tsx src/pages/__tests__/SettingsPage.test.tsx
```

---

## Task 8: เชื่อม COADialog → PrintPreviewDialog

**Files:**
- Modify: `src/components/lis/COADialog.tsx`

- [ ] **Step 1: แทนที่ `handlePrint` (window.open) ด้วย PrintPreviewDialog**

ลบฟังก์ชัน `handlePrint` (บรรทัด 54-77) และ string CSS ในนั้น แต่ **เก็บ CSS string ไว้เป็นค่าคงที่** เพื่อส่งเป็น `css` prop. เพิ่มบนสุดของไฟล์ (นอก component):
```tsx
const COA_PRINT_CSS = `
body{font-family:'Kanit',sans-serif;margin:0;padding:24px;color:#000;font-size:13px;}
table{border-collapse:collapse;width:100%;}
td,th{border:1px solid #000;padding:6px 10px;vertical-align:top;}
.no-border td,.no-border th{border:none;padding:2px 0;}
.center{text-align:center;}
.right{text-align:right;}
.title{font-weight:700;font-size:15px;}
.small{font-size:11px;color:#333;}
.sig-line{border-bottom:1px dotted #000;display:inline-block;min-width:280px;}
img.logo{height:60px;}
@media print{ body{padding:12px;} }
`;
```

เพิ่ม import + state:
```tsx
import PrintPreviewDialog from "@/components/lis/PrintPreviewDialog";
// ...ใน component:
const [printOpen, setPrintOpen] = useState(false);
```
(`useState` import อยู่แล้วถ้าใช้; ถ้ายังไม่มีให้เพิ่ม `import { useRef, useState } from "react";`)

- [ ] **Step 2: เปลี่ยนปุ่มพิมพ์ใน DialogFooter (บรรทัด ~210)**

จาก:
```tsx
<Button onClick={handlePrint} className="gap-2"><Printer className="w-4 h-4" /> พิมพ์ / บันทึก PDF</Button>
```
เป็น:
```tsx
<Button onClick={() => setPrintOpen(true)} className="gap-2"><Printer className="w-4 h-4" /> พิมพ์</Button>
```

- [ ] **Step 3: เพิ่ม PrintPreviewDialog ใต้ DialogContent (ก่อนปิด `</Dialog>`)**

ส่ง innerHTML เดิม (ที่อยู่ใน `printRef` div) เป็น children. วิธีง่ายสุด: ย้ายเนื้อหา preview ที่อยู่ใน `<div ref={printRef}>` มา render ซ้ำใน PrintPreviewDialog ไม่ได้ (ซ้ำซ้อน) — แทนที่จะใช้ `printRef` เดิมของ COADialog ให้ extract เนื้อหา COA เป็นตัวแปร/ฟังก์ชัน `coaBody` แล้วใช้ทั้งใน preview เดิมและใน PrintPreviewDialog:

แยก JSX ใน `<div ref={printRef} ...>...</div>` ออกเป็นตัวแปร `const coaBody = ( ...เนื้อหาเดิม... );` แล้ว:
```tsx
<div ref={printRef} className="bg-white text-black p-6 font-[Kanit]" style={{ fontSize: 13 }}>
  {coaBody}
</div>
...
<PrintPreviewDialog open={printOpen} onOpenChange={setPrintOpen} docType="coa" css={COA_PRINT_CSS}>
  <div className="bg-white text-black p-6 font-[Kanit]" style={{ fontSize: 13 }}>{coaBody}</div>
</PrintPreviewDialog>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 5: Manual verify (frontend + backend รันอยู่ + ตั้งเครื่อง coa ใน Settings ก่อน)**

เปิด COA → กดพิมพ์ → เด้ง PrintPreviewDialog (ไม่ใช่ window.open) → กดพิมพ์ → toast สำเร็จ + งานออกเครื่อง
Expected: ไม่มี browser print dialog; PDF ออกถูกต้อง (ฟอนต์ Kanit, ตาราง, โลโก้)

- [ ] **Step 6: Commit**

```bash
git add src/components/lis/COADialog.tsx
git commit -m "feat: COA print via PrintPreviewDialog (no browser dialog)" -- src/components/lis/COADialog.tsx
```

---

## Task 9: เชื่อม ProductionPetitionNewPage (labels) → PrintPreviewDialog

**Files:**
- Modify: `src/pages/petitions/ProductionPetitionNewPage.tsx`

- [ ] **Step 1: เพิ่ม import + state**

```tsx
import PrintPreviewDialog from "@/components/lis/PrintPreviewDialog";
// ใน component:
const [labelPrintOpen, setLabelPrintOpen] = useState(false);
```

- [ ] **Step 2: แทน `printCreatedLabels` (บรรทัด 669-672)**

จาก:
```tsx
function printCreatedLabels() {
  if (!createdPetition) return;
  setTimeout(() => window.print(), 50);
}
```
เป็น:
```tsx
function printCreatedLabels() {
  if (!createdPetition) return;
  setLabelPrintOpen(true);
}
```

- [ ] **Step 3: ใช้ SampleLabelPrintTemplate ใน dialog แทนการ render hidden + window.print**

ลบ block `<div className="hidden print:block"><SampleLabelPrintTemplate .../></div>` (บรรทัด ~676-678) แล้วเพิ่มท้าย `successContent` (ก่อนปิด JSX):
```tsx
<PrintPreviewDialog
  open={labelPrintOpen}
  onOpenChange={setLabelPrintOpen}
  docType="sample-label"
>
  <SampleLabelPrintTemplate petition={createdPetition} />
</PrintPreviewDialog>
```
(`SampleLabelPrintTemplate` ฝัง `<style>` ของตัวเองอยู่แล้ว — ไม่ต้องส่ง `css`)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 5: Manual verify (ตั้งเครื่อง sample-label paperSize=label-6x4 ใน Settings ก่อน)**

สร้างคำขอ → กดพิมพ์ฉลาก → เด้ง preview → พิมพ์ → ฉลากออกเครื่อง label ขนาด 6x4
Expected: ขนาดถูก ไม่มี browser dialog

- [ ] **Step 6: Commit**

```bash
git add src/pages/petitions/ProductionPetitionNewPage.tsx
git commit -m "feat: sample-label print via PrintPreviewDialog" -- src/pages/petitions/ProductionPetitionNewPage.tsx
```

---

## Task 10: เชื่อม PetitionDetailPage (ใบคำขอ) → PrintPreviewDialog

**Files:**
- Modify: `src/pages/PetitionDetailPage.tsx`

- [ ] **Step 1: อ่านบริบทการพิมพ์ปัจจุบัน**

Run: `grep -n "window.print\|PetitionPrintTemplate\|handlePrint\|print:" src/pages/PetitionDetailPage.tsx`
Expected: เห็นจุดที่เรียก `window.print()` (บรรทัด ~128-132) และจุดที่ render `PetitionPrintTemplate`

- [ ] **Step 2: เพิ่ม import + state**

```tsx
import PrintPreviewDialog from "@/components/lis/PrintPreviewDialog";
// ใน component:
const [printOpen, setPrintOpen] = useState(false);
```

- [ ] **Step 3: เปลี่ยน trigger การพิมพ์เป็น `setPrintOpen(true)`**

แทนฟังก์ชัน/handler ที่เรียก `window.print()` (รวม logic รอโหลดโลโก้) ด้วย `setPrintOpen(true)` — การรอโลโก้ไม่จำเป็นแล้วเพราะ server `waitUntil: 'networkidle0'` รอโหลดเอง

- [ ] **Step 4: เปลี่ยน render ของ PetitionPrintTemplate เป็นภายใน PrintPreviewDialog**

ถ้าเดิม render แบบ `hidden print:block` ให้ลบออก แล้วเพิ่ม (ใช้ props `labRequest` + `petition` ที่หน้ามีอยู่ — ยืนยันชื่อ variable จาก Step 1):
```tsx
{labRequest && petition && (
  <PrintPreviewDialog open={printOpen} onOpenChange={setPrintOpen} docType="service-request">
    <PetitionPrintTemplate labRequest={labRequest} petition={petition} />
  </PrintPreviewDialog>
)}
```
(`PetitionPrintTemplate` ฝัง `<style>` ของตัวเองอยู่แล้ว — ไม่ต้องส่ง `css`)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 6: Manual verify (ตั้งเครื่อง service-request ใน Settings ก่อน)**

เปิดใบคำขอ → กดพิมพ์ → preview (2 หน้า portrait + landscape) → พิมพ์ออกเครื่อง
Expected: หน้า 2 เป็น landscape ถูกต้อง ไม่มี browser dialog

- [ ] **Step 7: Commit**

```bash
git add src/pages/PetitionDetailPage.tsx
git commit -m "feat: service-request print via PrintPreviewDialog" -- src/pages/PetitionDetailPage.tsx
```

---

## Task 11: เชื่อม production-plan → PrintPreviewDialog (ข้ามได้ถ้าถูกลบ)

**Files:**
- Modify: caller ของ `src/components/petition/ProductionPlanPrintTemplate.tsx`

- [ ] **Step 1: หา caller + เช็คว่ายังใช้อยู่ไหม**

Run: `grep -rn "ProductionPlanPrintTemplate\|window.print" src/pages src/components --include=*.tsx | grep -i "plan\|print"`
Expected: เจอไฟล์ที่ import/ใช้ `ProductionPlanPrintTemplate`

> หมายเหตุ: ตาม memory ใบวางแผนผลิตถูกมาร์ก "เลิกใช้/รอลบ" — ถ้าไฟล์/ปุ่มถูกลบไปแล้ว ให้ทำเครื่องหมาย task นี้ว่า N/A แล้วข้ามไป Task 12

- [ ] **Step 2: ใช้ pattern เดียวกับ Task 10**

เพิ่ม `import PrintPreviewDialog`, state `productionPlanPrintOpen`, เปลี่ยน trigger เป็น `setProductionPlanPrintOpen(true)`, ครอบ `<ProductionPlanPrintTemplate .../>` ใน:
```tsx
<PrintPreviewDialog open={productionPlanPrintOpen} onOpenChange={setProductionPlanPrintOpen} docType="production-plan">
  <ProductionPlanPrintTemplate {/* props เดิมตามที่ caller ส่ง */} />
</PrintPreviewDialog>
```

- [ ] **Step 3: Typecheck + Commit**

Run: `npx tsc --noEmit` → ไม่มี error
```bash
git add <ไฟล์ caller>
git commit -m "feat: production-plan print via PrintPreviewDialog" -- <ไฟล์ caller>
```

---

## Task 12: อัปเดต Playwright e2e

**Files:**
- Modify: `tests/e2e/service-request-print.spec.ts`
- Modify: `tests/e2e/production-plan-print.spec.ts`

- [ ] **Step 1: อ่าน spec เดิมว่า assert อะไร**

Run: `grep -n "print\|window.print\|dialog\|expect" tests/e2e/service-request-print.spec.ts tests/e2e/production-plan-print.spec.ts`
Expected: เห็นว่าเดิมทดสอบ `window.print` (เช่น stub `window.print`) หรือ visibility ของ template

- [ ] **Step 2: ปรับ test ให้ทดสอบ flow ใหม่**

แทนการ stub `window.print` ด้วยการ mock route `**/api/print` ให้คืน `{ ok: true, printer: "TEST", copies: 1 }` แล้ว assert:
1. กดปุ่มพิมพ์ → PrintPreviewDialog เปิด (เห็น title "ตัวอย่างก่อนพิมพ์")
2. กดปุ่ม "พิมพ์" ใน dialog → มี POST ไป `/api/print` (docType ถูกต้อง)
3. เห็น toast "ส่งพิมพ์ไปยัง TEST"

ตัวอย่าง mock (ใส่ก่อน navigate):
```ts
await page.route("**/api/print", (route) =>
  route.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, printer: "TEST", copies: 1 }) }));
await page.route("**/api/print/config", (route) =>
  route.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ data: [{ slug: "service-request", printerName: "TEST", copies: 1, paperSize: "A4" }] }) }));
```
(ปรับ `slug` ให้ตรงแต่ละ spec; production-plan spec ถ้า docType ถูกลบ ให้ลบ/skip spec นี้)

- [ ] **Step 3: รัน e2e**

Run: `npx playwright test tests/e2e/service-request-print.spec.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/service-request-print.spec.ts tests/e2e/production-plan-print.spec.ts
git commit -m "test: e2e for print preview dialog flow" -- tests/e2e/service-request-print.spec.ts tests/e2e/production-plan-print.spec.ts
```

---

## Task 13: seed:export + ตรวจรวม

**Files:**
- Modify: `server/seed-data/*.json` (ผ่าน script)

- [ ] **Step 1: ตั้งค่าเครื่องจริงทั้ง 4 docType ใน Settings**

เปิดแอป → หน้าตั้งค่าระบบ → เลือกเครื่อง + paper size ของแต่ละ docType → บันทึก
Expected: `GET /api/print/config` คืน printerName ครบ

- [ ] **Step 2: export seed-data**

Run: `cd server && npm run seed:export`
Expected: มีไฟล์ `server/seed-data/printconfigs.json` (หรือชื่อ collection ตามที่ Mongoose ตั้ง) อัปเดต

- [ ] **Step 3: รัน test suite รวม + typecheck**

Run:
```bash
npm run test
npx tsc --noEmit
npm run lint
```
Expected: PASS ทั้งหมด

- [ ] **Step 4: Commit seed-data**

```bash
git add server/seed-data/
git commit -m "chore: seed-data for PrintConfig" -- server/seed-data/
```

---

## Self-Review Notes (ผู้เขียน plan)

- **Spec coverage:** model (T2), route+printers+config+POST+security (T3), client config/validation mirror (T4), serialize+api (T5), PrintPreviewDialog (T6), Settings (T7), wire 4 docType (T8-T11), tests (T4/T5 unit, T12 e2e), seed-data (T13) — ครบทุก section ของ spec
- **ฟอนต์:** COA ใช้ Kanit (Google Fonts) → allowlist `fonts.googleapis.com`/`fonts.gstatic.com` ใน request interception; เอกสารอื่นใช้ฟอนต์ serif ที่เป็น Windows system font (มีบนเครื่อง prod)
- **โลโก้:** `i.ibb.co` อยู่ใน allowlist
- **ความเสี่ยงที่ทราบ:** (1) Petition หน้า landscape (`@page pageA4L`) อาศัย `preferCSSPageSize` ของ Chromium — verify ใน T10; (2) launch Puppeteer ต่อ request (ยอมรับได้ตอนนี้ ปรับเป็น singleton ภายหลังถ้าช้า — YAGNI); (3) server ไม่มี test runner → route ทดสอบ manual ตาม pattern repo เดิม
- **prod:** ต้อง `npm install` ใน `server/` หลัง pull (มี deps ใหม่) และตั้ง `PRINT_CHROME_PATH` ใน `server/.env` ของ prod
