# Document Number Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้แอดมินแก้รูปแบบเลขที่เอกสาร (Petition / Sample Receipt / Lab Request) ได้จากหน้า "ตั้งค่าระบบ" แทนการ hardcode ในโค้ด

**Architecture:** Model + route ใหม่ (`DocumentNumberConfig`, pattern เดียวกับ `EnvRoomConfig`/`PrintConfig` — 1 doc ต่อ docType, upsert ไม่ลบ). helper กลาง `server/lib/documentNumber.js` อ่าน config แล้ว build prefix + เดินเลข; ฟังก์ชัน `next*No()` เดิม 3 ตัวเรียก helper นี้ ถ้า config ไม่มีใน DB ก็ fallback กลับ default = format เดิมเป๊ะ. Frontend เพิ่มแท็บใน `SettingsPage` + card ต่อ docType พร้อม live preview.

**Tech Stack:** Express + Mongoose (backend), `node:test` (backend tests), React + TanStack Query + shadcn/ui (frontend), Vitest (frontend tests).

**สำคัญ:**
- backend tests รันด้วย `node --test <file>` (ไฟล์ใช้ `require('node:test')`) — **ไม่ใช่ Vitest** (Vitest include เฉพาะ `src/**`).
- `prefix` กลายเป็น user input → ต้อง **escape regex** ก่อนเอาไป `new RegExp` (ของเดิม prefix เป็นค่าคงที่เลยไม่ escape).
- ค่า default ของ 3 docType ต้อง build ออกมาได้สตริงเดิมเป๊ะ: `P-2506-`, `RCV-2026-`, `L-2506-`.

---

## File Structure

ใหม่:
- `server/lib/documentNumber.js` — DEFAULTS map, `buildScanPrefix()`, `validateDocNumberConfig()`, `nextDocumentNumber()`, `escapeRegex()`
- `server/lib/documentNumber.test.js` — node:test ครอบ pure functions
- `server/models/DocumentNumberConfig.js` — schema 1 doc ต่อ docType
- `server/routes/documentNumberConfigs.js` — GET all (+default), PUT /:docType
- `src/lib/documentNumberConfig.ts` — types, DEFAULTS, labels, `buildPreview()`, `validateDocNumberConfig()`
- `src/lib/documentNumberConfig.test.ts` — Vitest ครอบ buildPreview + validate
- `src/components/lis/DocumentNumberConfigCard.tsx` — card ฟอร์ม + live preview

แก้:
- `server/index.js` — mount route ใหม่
- `server/routes/petitions.js` — `nextPetitionNo()` เรียก helper
- `server/routes/sampleReceipts.js` — `nextRunNo()` เรียก helper
- `server/routes/labRequests.js` — `nextLabRequestNo()` เรียก helper
- `src/lib/api.ts` — 2 ฟังก์ชันใหม่
- `src/pages/SettingsPage.tsx` — แท็บใหม่

---

## Task 1: Backend helper + pure-function tests (TDD)

**Files:**
- Create: `server/lib/documentNumber.js`
- Test: `server/lib/documentNumber.test.js`

- [ ] **Step 1: Write the failing test**

สร้าง `server/lib/documentNumber.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const {
  DEFAULTS,
  escapeRegex,
  buildScanPrefix,
  validateDocNumberConfig,
} = require('./documentNumber');

// Fixed date: 2026-06-15 → yy=26? No: getFullYear()=2026 → yy="26", but legacy
// uses slice(-2) of "2026" = "26". Month index 5 → mm="06".
const JUNE_2026 = new Date(2026, 5, 15);

test('DEFAULTS build the exact legacy prefixes', () => {
  assert.strictEqual(buildScanPrefix(DEFAULTS.petition, JUNE_2026), 'P-2606-');
  assert.strictEqual(buildScanPrefix(DEFAULTS.sampleReceipt, JUNE_2026), 'RCV-2026-');
  assert.strictEqual(buildScanPrefix(DEFAULTS.labRequest, JUNE_2026), 'L-2606-');
});

test('buildScanPrefix: 4-digit year, no month', () => {
  const cfg = { prefix: 'P', yearFormat: 'yyyy', includeMonth: false, separator: '-', seqPadding: 4 };
  assert.strictEqual(buildScanPrefix(cfg, JUNE_2026), 'P-2026-');
});

test('buildScanPrefix: empty separator concatenates', () => {
  const cfg = { prefix: 'P', yearFormat: 'yy', includeMonth: true, separator: '', seqPadding: 4 };
  assert.strictEqual(buildScanPrefix(cfg, JUNE_2026), 'P2606');
});

test('buildScanPrefix: empty prefix keeps date anchor', () => {
  const cfg = { prefix: '', yearFormat: 'yy', includeMonth: true, separator: '-', seqPadding: 4 };
  assert.strictEqual(buildScanPrefix(cfg, JUNE_2026), '2606-');
});

test('buildScanPrefix: prefix only, no date (never resets)', () => {
  const cfg = { prefix: 'X', yearFormat: 'none', includeMonth: false, separator: '-', seqPadding: 4 };
  assert.strictEqual(buildScanPrefix(cfg, JUNE_2026), 'X-');
});

test('escapeRegex escapes regex-special chars', () => {
  assert.strictEqual(escapeRegex('P.('), 'P\\.\\(');
});

test('validate: rejects when no prefix and no year', () => {
  const err = validateDocNumberConfig({ prefix: '  ', yearFormat: 'none', includeMonth: true, separator: '-', seqPadding: 4 });
  assert.match(err, /prefix หรือปี/);
});

test('validate: accepts prefix-only', () => {
  assert.strictEqual(validateDocNumberConfig({ prefix: 'P', yearFormat: 'none', includeMonth: false, separator: '-', seqPadding: 4 }), null);
});

test('validate: accepts year-only (no prefix)', () => {
  assert.strictEqual(validateDocNumberConfig({ prefix: '', yearFormat: 'yyyy', includeMonth: false, separator: '-', seqPadding: 4 }), null);
});

test('validate: rejects seqPadding out of range', () => {
  assert.match(validateDocNumberConfig({ prefix: 'P', yearFormat: 'yy', includeMonth: true, separator: '-', seqPadding: 0 }), /จำนวนหลัก/);
  assert.match(validateDocNumberConfig({ prefix: 'P', yearFormat: 'yy', includeMonth: true, separator: '-', seqPadding: 11 }), /จำนวนหลัก/);
});

test('validate: rejects bad yearFormat', () => {
  assert.match(validateDocNumberConfig({ prefix: 'P', yearFormat: 'decade', includeMonth: true, separator: '-', seqPadding: 4 }), /yearFormat/);
});

test('validate: rejects separator longer than 3', () => {
  assert.match(validateDocNumberConfig({ prefix: 'P', yearFormat: 'yy', includeMonth: true, separator: '----', seqPadding: 4 }), /ตัวคั่น/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test server/lib/documentNumber.test.js`
Expected: FAIL — `Cannot find module './documentNumber'`

- [ ] **Step 3: Write minimal implementation**

สร้าง `server/lib/documentNumber.js`:

```js
// Centralized document-number generation driven by DocumentNumberConfig.
// next*No() functions in routes call nextDocumentNumber(); when no config row
// exists the DEFAULTS below reproduce the original hardcoded formats exactly.

const DEFAULTS = {
  petition:      { docType: 'petition',      prefix: 'P',   yearFormat: 'yy',   includeMonth: true,  seqPadding: 4, separator: '-' },
  sampleReceipt: { docType: 'sampleReceipt', prefix: 'RCV', yearFormat: 'yyyy', includeMonth: false, seqPadding: 4, separator: '-' },
  labRequest:    { docType: 'labRequest',    prefix: 'L',   yearFormat: 'yy',   includeMonth: true,  seqPadding: 4, separator: '-' },
};

const DOC_TYPES = Object.keys(DEFAULTS);
const YEAR_FORMATS = ['none', 'yy', 'yyyy'];

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Build the non-sequence portion of the number (the part used to scan for the
// last issued number). Sequence is appended by the caller.
function buildScanPrefix(cfg, now) {
  const sep = cfg.separator == null ? '' : String(cfg.separator);
  const yyyy = String(now.getFullYear());
  const yy = yyyy.slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');

  let datePart = '';
  if (cfg.yearFormat === 'yyyy') datePart += yyyy;
  else if (cfg.yearFormat === 'yy') datePart += yy;
  if (cfg.includeMonth) datePart += mm;

  const segments = [];
  if (cfg.prefix) segments.push(cfg.prefix);
  if (datePart) segments.push(datePart);
  let prefix = segments.join(sep);
  if (segments.length > 0) prefix += sep; // trailing separator before sequence
  return prefix;
}

// Returns an error string (Thai) or null. Mirrors validateDocNumberConfig in
// src/lib/documentNumberConfig.ts — keep the two in sync.
function validateDocNumberConfig(input) {
  if (typeof input.prefix !== 'string') return 'prefix ต้องเป็นข้อความ';
  if (!YEAR_FORMATS.includes(input.yearFormat)) return 'yearFormat ไม่ถูกต้อง';
  if (typeof input.includeMonth !== 'boolean') return 'includeMonth ต้องเป็น boolean';
  if (typeof input.separator !== 'string' || input.separator.length > 3) return 'ตัวคั่นต้องเป็นข้อความไม่เกิน 3 ตัว';
  if (!Number.isInteger(input.seqPadding) || input.seqPadding < 1 || input.seqPadding > 10) return 'จำนวนหลัก running ต้องเป็นจำนวนเต็ม 1–10';
  const hasPrefix = input.prefix.trim().length > 0;
  const hasYear = input.yearFormat !== 'none';
  if (!hasPrefix && !hasYear) return 'ต้องมี prefix หรือปี อย่างน้อย 1 อย่าง (กันเลขเดินผิด)';
  return null;
}

// docType: 'petition'|'sampleReceipt'|'labRequest'; Model: the Mongoose model;
// numField: the document's number field name (e.g. 'petitionNo').
async function nextDocumentNumber(docType, Model, numField) {
  const DocumentNumberConfig = require('../models/DocumentNumberConfig');
  const saved = await DocumentNumberConfig.findOne({ docType }).lean();
  const cfg = saved || DEFAULTS[docType];
  const now = new Date();
  const scanPrefix = buildScanPrefix(cfg, now);
  const last = await Model.findOne({ [numField]: new RegExp(`^${escapeRegex(scanPrefix)}`) })
    .sort({ [numField]: -1 })
    .lean();
  const nextSeq = last ? Number(last[numField].slice(scanPrefix.length)) + 1 : 1;
  return `${scanPrefix}${String(nextSeq).padStart(cfg.seqPadding, '0')}`;
}

module.exports = {
  DEFAULTS,
  DOC_TYPES,
  YEAR_FORMATS,
  escapeRegex,
  buildScanPrefix,
  validateDocNumberConfig,
  nextDocumentNumber,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test server/lib/documentNumber.test.js`
Expected: PASS — all tests pass

- [ ] **Step 5: Commit**

```bash
git add server/lib/documentNumber.js server/lib/documentNumber.test.js
git commit -m "feat(server): document-number helper with config-driven prefixes"
```

---

## Task 2: DocumentNumberConfig model

**Files:**
- Create: `server/models/DocumentNumberConfig.js`

- [ ] **Step 1: Write the model**

สร้าง `server/models/DocumentNumberConfig.js`:

```js
const mongoose = require('mongoose');

const DocumentNumberConfigSchema = new mongoose.Schema({
  docType: {
    type: String,
    enum: ['petition', 'sampleReceipt', 'labRequest'],
    required: true,
    unique: true,
    index: true,
  },
  prefix: { type: String, default: '' },
  yearFormat: { type: String, enum: ['none', 'yy', 'yyyy'], default: 'yy' },
  includeMonth: { type: Boolean, default: true },
  seqPadding: { type: Number, default: 4, min: 1, max: 10 },
  separator: { type: String, default: '-' },
}, { timestamps: true });

module.exports = mongoose.model('DocumentNumberConfig', DocumentNumberConfigSchema);
```

- [ ] **Step 2: Verify it loads (no syntax/schema errors)**

Run: `node -e "require('./server/models/DocumentNumberConfig'); console.log('ok')"`
Expected: prints `ok`

- [ ] **Step 3: Commit**

```bash
git add server/models/DocumentNumberConfig.js
git commit -m "feat(server): DocumentNumberConfig model"
```

---

## Task 3: Route + mount

**Files:**
- Create: `server/routes/documentNumberConfigs.js`
- Modify: `server/index.js` (after the `env-room-config` mount line)

- [ ] **Step 1: Write the route**

สร้าง `server/routes/documentNumberConfigs.js`:

```js
const express = require('express');
const router = express.Router();
const DocumentNumberConfig = require('../models/DocumentNumberConfig');
const { DEFAULTS, DOC_TYPES, validateDocNumberConfig } = require('../lib/documentNumber');

function pick(doc) {
  return {
    docType: doc.docType,
    prefix: doc.prefix || '',
    yearFormat: doc.yearFormat,
    includeMonth: doc.includeMonth,
    seqPadding: doc.seqPadding,
    separator: doc.separator == null ? '' : doc.separator,
  };
}

// GET /api/document-number-config — always returns all 3 docTypes (DB doc or default).
router.get('/', async (req, res) => {
  try {
    const docs = await DocumentNumberConfig.find().lean();
    const byType = new Map(docs.map((d) => [d.docType, d]));
    const data = DOC_TYPES.map((t) => {
      const d = byType.get(t);
      return d ? pick(d) : { ...DEFAULTS[t] };
    });
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/document-number-config/:docType — validate + upsert one docType.
router.put('/:docType', async (req, res) => {
  try {
    const { docType } = req.params;
    if (!DOC_TYPES.includes(docType)) {
      return res.status(400).json({ error: 'docType ไม่ถูกต้อง' });
    }
    const body = req.body || {};
    const input = {
      prefix: typeof body.prefix === 'string' ? body.prefix : '',
      yearFormat: body.yearFormat,
      includeMonth: !!body.includeMonth,
      seqPadding: Number(body.seqPadding),
      separator: typeof body.separator === 'string' ? body.separator : '',
    };
    const err = validateDocNumberConfig(input);
    if (err) return res.status(400).json({ error: err });

    const doc = await DocumentNumberConfig.findOneAndUpdate(
      { docType },
      { docType, ...input },
      { new: true, upsert: true },
    ).lean();
    res.json({ data: pick(doc) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 2: Mount the route in `server/index.js`**

หาบรรทัด (ราว 51):
```js
mountApi('/env-room-config', require('./routes/envRoomConfig'));
```
เพิ่มบรรทัดถัดไป:
```js
mountApi('/document-number-config', require('./routes/documentNumberConfigs'));
```

- [ ] **Step 3: Verify route loads**

Run: `node -e "require('./server/routes/documentNumberConfigs'); console.log('ok')"`
Expected: prints `ok`

- [ ] **Step 4: Commit**

```bash
git add server/routes/documentNumberConfigs.js server/index.js
git commit -m "feat(server): document-number-config route (GET all + PUT upsert)"
```

---

## Task 4: Wire helper into the 3 existing number generators

**Files:**
- Modify: `server/routes/petitions.js:30-41`
- Modify: `server/routes/sampleReceipts.js:6-15`
- Modify: `server/routes/labRequests.js:7-17`

- [ ] **Step 1: Replace `nextPetitionNo()` in `server/routes/petitions.js`**

แทนที่บล็อก (บรรทัด 30–41):
```js
// Generate next petition number: P-YYMM-#### (resets monthly)
async function nextPetitionNo() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `P-${yy}${mm}-`;
  const last = await Petition.findOne({ petitionNo: new RegExp(`^${prefix}`) })
    .sort({ petitionNo: -1 })
    .lean();
  const nextSeq = last ? Number(last.petitionNo.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}
```
ด้วย:
```js
// Generate next petition number from DocumentNumberConfig (default: P-YYMM-####).
const { nextDocumentNumber } = require('../lib/documentNumber');
function nextPetitionNo() {
  return nextDocumentNumber('petition', Petition, 'petitionNo');
}
```

- [ ] **Step 2: Replace `nextRunNo()` in `server/routes/sampleReceipts.js`**

แทนที่บล็อก (บรรทัด 6–15):
```js
// Generate next run number: RCV-YYYY-#### (resets yearly)
async function nextRunNo() {
  const year = new Date().getFullYear();
  const prefix = `RCV-${year}-`;
  const last = await SampleReceipt.findOne({ runNo: new RegExp(`^${prefix}`) })
    .sort({ runNo: -1 })
    .lean();
  const nextSeq = last ? Number(last.runNo.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}
```
ด้วย:
```js
// Generate next run number from DocumentNumberConfig (default: RCV-YYYY-####).
const { nextDocumentNumber } = require('../lib/documentNumber');
function nextRunNo() {
  return nextDocumentNumber('sampleReceipt', SampleReceipt, 'runNo');
}
```

- [ ] **Step 3: Replace `nextLabRequestNo()` in `server/routes/labRequests.js`**

แทนที่บล็อก (บรรทัด 7–17):
```js
async function nextLabRequestNo() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `L-${yy}${mm}-`;
  const last = await LabRequest.findOne({ labRequestNo: new RegExp(`^${prefix}`) })
    .sort({ labRequestNo: -1 })
    .lean();
  const nextSeq = last ? Number(last.labRequestNo.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}
```
ด้วย:
```js
// Generate next lab-request number from DocumentNumberConfig (default: L-YYMM-####).
const { nextDocumentNumber } = require('../lib/documentNumber');
function nextLabRequestNo() {
  return nextDocumentNumber('labRequest', LabRequest, 'labRequestNo');
}
```

> หมายเหตุ: callers เดิมใช้ `await nextPetitionNo()` / `await nextRunNo()` / `await nextLabRequestNo()` อยู่แล้ว — ฟังก์ชันใหม่คืน Promise เหมือนเดิม ไม่ต้องแก้จุดเรียก.

- [ ] **Step 4: Verify all three route files load**

Run: `node -e "require('./server/routes/petitions');require('./server/routes/sampleReceipts');require('./server/routes/labRequests');console.log('ok')"`
Expected: prints `ok`

- [ ] **Step 5: Commit**

```bash
git add server/routes/petitions.js server/routes/sampleReceipts.js server/routes/labRequests.js
git commit -m "refactor(server): petition/receipt/labRequest numbers use config helper"
```

---

## Task 5: Frontend lib (types, preview, validate) + Vitest

**Files:**
- Create: `src/lib/documentNumberConfig.ts`
- Test: `src/lib/documentNumberConfig.test.ts`

- [ ] **Step 1: Write the failing test**

สร้าง `src/lib/documentNumberConfig.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  DOC_NUMBER_TYPES,
  DOC_NUMBER_DEFAULTS,
  buildPreview,
  validateDocNumberConfig,
} from "./documentNumberConfig";

const JUNE_2026 = new Date(2026, 5, 15);

describe("buildPreview", () => {
  it("renders the legacy petition format", () => {
    expect(buildPreview(DOC_NUMBER_DEFAULTS.petition, JUNE_2026)).toBe("P-2606-0043");
  });
  it("renders 4-digit year receipt format", () => {
    expect(buildPreview(DOC_NUMBER_DEFAULTS.sampleReceipt, JUNE_2026)).toBe("RCV-2026-0043");
  });
  it("respects empty separator and padding", () => {
    expect(
      buildPreview({ prefix: "P", yearFormat: "yy", includeMonth: true, separator: "", seqPadding: 6 }, JUNE_2026),
    ).toBe("P2606000043");
  });
});

describe("validateDocNumberConfig", () => {
  it("rejects no prefix + no year", () => {
    expect(validateDocNumberConfig({ prefix: " ", yearFormat: "none", includeMonth: true, separator: "-", seqPadding: 4 }))
      .toMatch(/prefix หรือปี/);
  });
  it("accepts prefix only", () => {
    expect(validateDocNumberConfig({ prefix: "P", yearFormat: "none", includeMonth: false, separator: "-", seqPadding: 4 }))
      .toBeNull();
  });
  it("rejects padding out of range", () => {
    expect(validateDocNumberConfig({ prefix: "P", yearFormat: "yy", includeMonth: true, separator: "-", seqPadding: 0 }))
      .toMatch(/จำนวนหลัก/);
  });
});

describe("DOC_NUMBER_TYPES", () => {
  it("covers all three docTypes", () => {
    expect(DOC_NUMBER_TYPES.map((t) => t.docType)).toEqual(["petition", "sampleReceipt", "labRequest"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/documentNumberConfig.test.ts`
Expected: FAIL — cannot resolve `./documentNumberConfig`

- [ ] **Step 3: Write the implementation**

สร้าง `src/lib/documentNumberConfig.ts`:

```ts
// Mirror of server/lib/documentNumber.js — keep buildPreview/validate in sync
// with buildScanPrefix/validateDocNumberConfig on the server.

export type DocNumberType = "petition" | "sampleReceipt" | "labRequest";
export type YearFormat = "none" | "yy" | "yyyy";

export interface DocumentNumberConfig {
  docType: DocNumberType;
  prefix: string;
  yearFormat: YearFormat;
  includeMonth: boolean;
  seqPadding: number;
  separator: string;
}

export type DocumentNumberConfigInput = Omit<DocumentNumberConfig, "docType">;

export interface DocNumberTypeMeta {
  docType: DocNumberType;
  label: string;
  hint: string;
}

export const DOC_NUMBER_TYPES: DocNumberTypeMeta[] = [
  { docType: "petition",      label: "เลขคำร้อง (Petition)",        hint: "เลขที่ออกตอนสร้างคำร้องใหม่" },
  { docType: "sampleReceipt", label: "เลขรับตัวอย่าง (Sample Receipt)", hint: "เลขที่ออกตอนรับตัวอย่างเข้าระบบ" },
  { docType: "labRequest",    label: "เลขใบคำขอ Lab (Lab Request)", hint: "เลขที่ออกตอนสร้างใบคำขอรับบริการ" },
];

export const DOC_NUMBER_DEFAULTS: Record<DocNumberType, DocumentNumberConfigInput> = {
  petition:      { prefix: "P",   yearFormat: "yy",   includeMonth: true,  seqPadding: 4, separator: "-" },
  sampleReceipt: { prefix: "RCV", yearFormat: "yyyy", includeMonth: false, seqPadding: 4, separator: "-" },
  labRequest:    { prefix: "L",   yearFormat: "yy",   includeMonth: true,  seqPadding: 4, separator: "-" },
};

const SAMPLE_SEQ = 43; // illustrative running number for the preview

function buildScanPrefix(cfg: DocumentNumberConfigInput, now: Date): string {
  const sep = cfg.separator ?? "";
  const yyyy = String(now.getFullYear());
  const yy = yyyy.slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");

  let datePart = "";
  if (cfg.yearFormat === "yyyy") datePart += yyyy;
  else if (cfg.yearFormat === "yy") datePart += yy;
  if (cfg.includeMonth) datePart += mm;

  const segments: string[] = [];
  if (cfg.prefix) segments.push(cfg.prefix);
  if (datePart) segments.push(datePart);
  let prefix = segments.join(sep);
  if (segments.length > 0) prefix += sep;
  return prefix;
}

// Illustrative "next number" string for live preview.
export function buildPreview(cfg: DocumentNumberConfigInput, now: Date = new Date()): string {
  const scanPrefix = buildScanPrefix(cfg, now);
  const pad = Math.max(1, Math.min(10, cfg.seqPadding || 1));
  return `${scanPrefix}${String(SAMPLE_SEQ).padStart(pad, "0")}`;
}

// Returns a Thai error string or null. Mirror of validateDocNumberConfig in
// server/lib/documentNumber.js.
export function validateDocNumberConfig(input: DocumentNumberConfigInput): string | null {
  if (typeof input.prefix !== "string") return "prefix ต้องเป็นข้อความ";
  if (!["none", "yy", "yyyy"].includes(input.yearFormat)) return "yearFormat ไม่ถูกต้อง";
  if (typeof input.separator !== "string" || input.separator.length > 3) return "ตัวคั่นต้องไม่เกิน 3 ตัว";
  if (!Number.isInteger(input.seqPadding) || input.seqPadding < 1 || input.seqPadding > 10) return "จำนวนหลัก running ต้องเป็นจำนวนเต็ม 1–10";
  const hasPrefix = input.prefix.trim().length > 0;
  const hasYear = input.yearFormat !== "none";
  if (!hasPrefix && !hasYear) return "ต้องมี prefix หรือปี อย่างน้อย 1 อย่าง (กันเลขเดินผิด)";
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/documentNumberConfig.test.ts`
Expected: PASS — all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/documentNumberConfig.ts src/lib/documentNumberConfig.test.ts
git commit -m "feat(web): documentNumberConfig lib (types, preview, validate)"
```

---

## Task 6: API client functions

**Files:**
- Modify: `src/lib/api.ts` (import block + after `updateEnvRoomConfig`, ราวบรรทัด 355)

- [ ] **Step 1: Add the import**

ใกล้บรรทัด 12–13 (กลุ่ม import type) เพิ่ม:
```ts
import type { DocumentNumberConfig, DocumentNumberConfigInput, DocNumberType } from "@/lib/documentNumberConfig";
```

- [ ] **Step 2: Add the two API methods**

หลังบล็อก `updateEnvRoomConfig` (ราวบรรทัด 355) เพิ่ม:
```ts
  // ── Document number config (petition / sampleReceipt / labRequest formats) ──
  getDocumentNumberConfigs: () =>
    request<{ data: DocumentNumberConfig[] }>("/document-number-config").then((r) => r.data),
  updateDocumentNumberConfig: (docType: DocNumberType, input: DocumentNumberConfigInput) =>
    request<{ data: DocumentNumberConfig }>(`/document-number-config/${docType}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }).then((r) => r.data),
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors referencing `api.ts` or `documentNumberConfig` (repo มี ~12 latent errors เดิมที่ไม่เกี่ยว — ดูว่าไม่มีตัวใหม่เพิ่ม)

- [ ] **Step 4: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(web): api methods for document-number-config"
```

---

## Task 7: DocumentNumberConfigCard component

**Files:**
- Create: `src/components/lis/DocumentNumberConfigCard.tsx`

- [ ] **Step 1: Write the component**

สร้าง `src/components/lis/DocumentNumberConfigCard.tsx`:

```tsx
import { useState } from "react";
import { Hash } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  buildPreview,
  validateDocNumberConfig,
  type DocumentNumberConfig,
  type DocumentNumberConfigInput,
  type DocNumberTypeMeta,
  type YearFormat,
} from "@/lib/documentNumberConfig";

interface Props {
  meta: DocNumberTypeMeta;
  config: DocumentNumberConfig;
  saving: boolean;
  onSave: (docType: DocumentNumberConfig["docType"], input: DocumentNumberConfigInput) => void;
}

const DocumentNumberConfigCard = ({ meta, config, saving, onSave }: Props) => {
  const [prefix, setPrefix] = useState<string>(config.prefix);
  const [yearFormat, setYearFormat] = useState<YearFormat>(config.yearFormat);
  const [includeMonth, setIncludeMonth] = useState<boolean>(config.includeMonth);
  const [seqPadding, setSeqPadding] = useState<string>(String(config.seqPadding));
  const [separator, setSeparator] = useState<string>(config.separator);

  const draft: DocumentNumberConfigInput = {
    prefix,
    yearFormat,
    includeMonth,
    seqPadding: Number(seqPadding),
    separator,
  };
  const error = validateDocNumberConfig(draft);
  const preview = error ? null : buildPreview(draft);
  const prefixEmpty = prefix.trim() === "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Hash className="w-4 h-4 text-primary" />
          {meta.label}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{meta.hint}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Prefix</label>
            <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="เช่น P" className="h-9 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">ตัวคั่น</label>
            <Input value={separator} onChange={(e) => setSeparator(e.target.value)} placeholder="เช่น -" className="h-9 text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">ปี</label>
            <Select value={yearFormat} onValueChange={(v) => setYearFormat(v as YearFormat)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ไม่มีปี</SelectItem>
                <SelectItem value="yy">2 หลัก (26)</SelectItem>
                <SelectItem value="yyyy">4 หลัก (2026)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">จำนวนหลัก running</label>
            <Input type="number" min={1} max={10} value={seqPadding} onChange={(e) => setSeqPadding(e.target.value)} className="h-9 text-sm" />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">ใส่เดือน (รีเซ็ตรายเดือน)</label>
          <Switch checked={includeMonth} onCheckedChange={setIncludeMonth} />
        </div>

        {/* Live preview */}
        <div className="rounded-md bg-muted px-3 py-2">
          <span className="text-xs text-muted-foreground">ตัวอย่างเลขถัดไป: </span>
          {preview ? (
            <span className="font-mono text-sm font-semibold">{preview}</span>
          ) : (
            <span className="text-xs text-red-600">{error}</span>
          )}
        </div>

        {!error && prefixEmpty && (
          <p className="text-xs text-amber-600">⚠ ไม่มี prefix — จะมองแยกประเภทเอกสารด้วยตายากขึ้น</p>
        )}

        <div className="flex justify-end">
          <Button size="sm" disabled={saving || !!error} onClick={() => onSave(config.docType, draft)}>
            บันทึก
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default DocumentNumberConfigCard;
```

- [ ] **Step 2: Verify the Switch primitive exists**

Run: `test -f src/components/ui/switch.tsx && echo present || echo MISSING`
Expected: `present`. ถ้า `MISSING` ให้แทน `<Switch>` ด้วย checkbox: `<input type="checkbox" checked={includeMonth} onChange={(e) => setIncludeMonth(e.target.checked)} />` และลบ import `Switch`.

- [ ] **Step 3: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่ที่อ้าง `DocumentNumberConfigCard`

- [ ] **Step 4: Commit**

```bash
git add src/components/lis/DocumentNumberConfigCard.tsx
git commit -m "feat(web): DocumentNumberConfigCard with live preview"
```

---

## Task 8: Add the tab to SettingsPage

**Files:**
- Modify: `src/pages/SettingsPage.tsx`

- [ ] **Step 1: Add imports + query/mutation**

ใต้ import `PrintConfigCard` (บรรทัด 8) เพิ่ม:
```tsx
import DocumentNumberConfigCard from "@/components/lis/DocumentNumberConfigCard";
```
ใต้ import type ของ printConfig (บรรทัด 13) เพิ่ม:
```tsx
import { DOC_NUMBER_TYPES, type DocumentNumberConfig, type DocumentNumberConfigInput, type DocNumberType } from "@/lib/documentNumberConfig";
```

หลังบล็อก `savePrintMutation` (ราวบรรทัด 59) เพิ่ม:
```tsx
  const { data: docNumberConfigs = [] } = useQuery({
    queryKey: ["document-number-config"],
    queryFn: api.getDocumentNumberConfigs,
  });
  const saveDocNumberMutation = useMutation({
    mutationFn: ({ docType, input }: { docType: DocNumberType; input: DocumentNumberConfigInput }) =>
      api.updateDocumentNumberConfig(docType, input),
    onSuccess: () => {
      toast.success("บันทึกรูปแบบเลขที่เอกสารแล้ว");
      queryClient.invalidateQueries({ queryKey: ["document-number-config"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    },
  });
  const docConfigByType = new Map(docNumberConfigs.map((c: DocumentNumberConfig) => [c.docType, c]));
```

- [ ] **Step 2: Add the trigger + content**

ใน `<TabsList>` (หลัง trigger `printers`, บรรทัด 75) เพิ่ม:
```tsx
          <TabsTrigger value="doc-numbers">รหัสเอกสาร</TabsTrigger>
```

หลัง `</TabsContent>` ของ printers (บรรทัด 114) ก่อน `</Tabs>` เพิ่ม:
```tsx
        <TabsContent value="doc-numbers" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            กำหนดรูปแบบเลขที่เอกสารที่ระบบออกอัตโนมัติ — เปลี่ยนแล้วมีผลกับเลขที่ออกใหม่เท่านั้น เอกสารเดิมไม่เปลี่ยน
          </p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {DOC_NUMBER_TYPES.map((meta) => {
              const cfg = docConfigByType.get(meta.docType);
              if (!cfg) return null;
              return (
                <DocumentNumberConfigCard
                  key={meta.docType}
                  meta={meta}
                  config={cfg}
                  saving={saveDocNumberMutation.isPending}
                  onSave={(docType, input) => saveDocNumberMutation.mutate({ docType, input })}
                />
              );
            })}
          </div>
        </TabsContent>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่ที่อ้าง `SettingsPage`

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: ไม่มี error ใหม่จากไฟล์ที่แก้

- [ ] **Step 5: Commit**

```bash
git add src/pages/SettingsPage.tsx
git commit -m "feat(web): document number format tab in system settings"
```

---

## Task 9: Manual verification + seed export

**Files:** none (verification only)

- [ ] **Step 1: Run backend + frontend, smoke-test**

```bash
cd server && npm run dev   # terminal 1 (port 3001)
npm run dev                # terminal 2 (port 8000)
```
- เปิด `/LIS/settings` → แท็บ "รหัสเอกสาร" → เห็น 3 card พร้อมค่า default (P / RCV / L)
- preview โชว์ `P-2606-0043` (เดือนปัจจุบัน), `RCV-2026-0043`, `L-2606-0043`
- ลบ prefix petition จนว่าง + ปี = "ไม่มีปี" → preview เปลี่ยนเป็น error "ต้องมี prefix หรือปี…" และปุ่มบันทึก disabled
- ตั้ง prefix petition = `PT`, separator = `/`, ปี 4 หลัก, ไม่ใส่เดือน, padding 5 → กดบันทึก → toast สำเร็จ
- สร้าง petition ใหม่ 1 ใบ (หน้า petition new) → เลขที่ออกต้องเป็น `PT/2026/00001`

- [ ] **Step 2: Confirm default fallback (no config row) still equals legacy**

ก่อนตั้งค่าใดๆ (collection `documentnumberconfigs` ว่าง) การสร้าง petition ต้องได้ `P-YYMM-####` เหมือนเดิม — ยืนยันด้วย Task 1 unit test (`DEFAULTS build the exact legacy prefixes`) + การสร้างจริง 1 ใบบน DB เปล่า.

- [ ] **Step 3: Export seed data (มี collection ใหม่ + ค่าที่ตั้งจริง)**

```bash
cd server && npm run seed:export
git add server/seed-data
git commit -m "chore(seed): export document-number-config collection"
```

> ตาม CLAUDE.md: เพิ่ม model/แก้ data นอกรอบ auto-sync ต้องรัน `seed:export` + commit เอง เพื่อให้ `seed-data/` ตรงกับ DB.

- [ ] **Step 4: Final full test sweep**

```bash
node --test server/lib/documentNumber.test.js   # backend helper
npm run test                                     # frontend Vitest (รวม documentNumberConfig.test.ts)
```
Expected: ทั้งสองชุด PASS
```

---

## Self-Review Notes

- **Spec coverage:** ครบทั้ง 3 docType (Task 4), structured fields (Task 7), เดินเลขต่ออัตโนมัติ (Task 1 `nextDocumentNumber` scan logic), validate "ต้องมี prefix หรือปี" ทั้ง backend (Task 1) + frontend (Task 5), live preview (Task 7), admin-only (อยู่ใน SettingsPage ที่ route ป้องกันด้วย PrivateRoute อยู่แล้ว — ไม่ต้องเพิ่ม), fallback default (Task 1 + Task 9 Step 2), seed export (Task 9 Step 3).
- **prefix เป็น user input → escape regex** (Task 1 `escapeRegex`) — กัน prefix ที่มีอักขระพิเศษทำ regex พัง.
- **backend test = node:test, frontend = Vitest** — แยกคำสั่งรันชัดเจน.
- **ชื่อฟังก์ชันตรงกันสองฝั่ง:** `buildScanPrefix`/`validateDocNumberConfig` (backend), `buildPreview`/`validateDocNumberConfig` (frontend) — preview ฝั่ง web เรียก buildScanPrefix ภายในไฟล์เดียวกัน.
- **ความเสี่ยงที่รับไว้:** race condition ของ findOne+1 คงเดิม (นอก scope), การเปลี่ยน padding กลางคันยังเดินเลขต่อถูกเพราะ string-sort ของเลขเดือน/ปีเดียวกันยังเรียงถูก.
