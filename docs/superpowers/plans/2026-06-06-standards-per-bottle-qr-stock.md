# Standards Per-Bottle QR Stock — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ติดตาม Standards แบบรายขวด — แต่ละขวด (sealed ที่รับเข้า / working ที่แบ่ง) มี QR, EXP, ปริมาตร, สถานะของตัวเอง; แบ่ง working ได้ตาม ml; สแกนกล้องเพื่อแบ่ง/ทิ้ง; ทิ้งแล้ว QR ใช้ต่อไม่ได้.

**Architecture:** แนวทาง A — collection ใหม่ `StockUnit` (1 doc = 1 ขวดจริง) ผูกกับ `StockStandard` (แค็ตตาล็อก) ผ่าน `itemCode`; ยอดรวมคำนวณจากการนับ unit ไม่เก็บซ้ำ. Backend endpoints ใหม่อยู่ใน `routes/stock.js` (mount อยู่แล้ว). Pure logic (คำนวณ EXP working, parse QR, สรุปยอด) อยู่ใน `src/lib/stockUnit.ts` (ทดสอบด้วย Vitest); backend mirror date-math เป็น helper สั้นๆ ในไฟล์ route. QR gen + ปริ้นลาเบลต่อยอดระบบปริ้น server-side เดิม (docType ใหม่ `stock-label`). สแกนกล้องด้วย `html5-qrcode` ตาม pattern `QrReceiveModal`.

**Tech Stack:** Express 4 + Mongoose 8 (CommonJS), React 18 + TS + Vite, TanStack Query, shadcn/ui, `date-fns`, `qrcode`, `html5-qrcode`, Vitest. ทั้งหมดติดตั้งแล้ว — **ไม่ต้องเพิ่ม dependency**.

**Conventions ที่ต้องรู้:**
- Models auto-load จาก `server/models/*.js` (dir scan ใน `loadAllModels()`) + auto `createCollection()`/`syncIndexes()` ตอน boot → สร้างไฟล์ model แล้วพอ ไม่ต้อง register เพิ่ม.
- `routes/stock.js` mount ที่ `/stock` (และ `/LIS/api/stock`) อยู่แล้ว — เพิ่ม handler ในไฟล์เดิม.
- Frontend API base = `import.meta.env.BASE_URL + "api"`; ใช้ผ่าน `src/lib/api.ts` (`request<T>()`).
- commit เฉพาะ pathspec ของไฟล์ที่แก้ในแต่ละ task (รีโปนี้บางทีมี process อื่น commit แทรก — อย่า `git add -A`).
- type-check ด้วย `npx tsc --noEmit` (**ห้าม** `npm run build`).

---

## File Structure

**สร้างใหม่:**
- `server/models/StockUnit.js` — model รายขวด
- `src/lib/stockUnit.ts` — pure helpers (computeWorkingExp, parseScannedQrId, summarizeUnits, unitDerivedStatus)
- `src/lib/stockUnit.test.ts` — Vitest
- `src/lib/stockLabel.ts` — สร้าง HTML ลาเบล + QR dataURL
- `src/components/lis/StockQrScanner.tsx` — กล้องสแกน (reusable)
- `src/components/lis/stock/ReceiveBottlesDialog.tsx` — รับเข้าหลายขวด
- `src/components/lis/stock/WithdrawDialog.tsx` — แบ่ง working
- `src/components/lis/stock/DiscardDialog.tsx` — ทิ้งขวด
- `src/components/lis/stock/UnitsDrawer.tsx` — รายขวดของสารหนึ่งตัว
- `src/pages/StockUnitScanPage.tsx` — ปลายทาง QR `/stock/scan/:qrId`

**แก้ไข:**
- `server/routes/stock.js` — endpoints รายขวด
- `server/models/Stock.js` — เพิ่ม `openShelfLife` ใน StockStandardSchema
- `server/models/StockTransaction.js` — เพิ่ม action `withdraw`/`discard` + fields
- `server/models/PrintConfig.js` — เพิ่ม slug `stock-label`
- `server/routes/print.js` — เพิ่ม `stock-label` ใน DOC_DEFAULTS
- `src/lib/printConfig.ts` — เพิ่ม docType `stock-label`
- `src/types/stock.ts` — type ของ StockUnit + openShelfLife + action ใหม่
- `src/lib/api.ts` — api methods รายขวด
- `src/pages/Stock.tsx` — Standards tab ใช้ summary รายขวด + ปุ่มสแกน + เปิด drawer
- `src/App.tsx` — route `/stock/scan/:qrId`

---

## Task 1: StockUnit model

**Files:**
- Create: `server/models/StockUnit.js`

- [ ] **Step 1: เขียน model**

```js
const mongoose = require('mongoose');

const VolumeSchema = new mongoose.Schema({
  initial: { type: Number, default: 0 },
  remaining: { type: Number, default: 0 },
  unit: { type: String, enum: ['ml', 'mg', 'g'], default: 'ml' },
}, { _id: false });

const PersonSchema = new mongoose.Schema({
  email: { type: String, default: '' },
  name: { type: String, default: '' },
}, { _id: false });

const StockUnitSchema = new mongoose.Schema({
  qrId: { type: String, required: true, unique: true, index: true },
  itemCode: { type: String, required: true, index: true },
  itemName: { type: String, default: '' },
  kind: { type: String, enum: ['sealed', 'working'], required: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockUnit', default: null },
  lotNo: { type: String, default: '' },
  exp: { type: Date, default: null },
  volume: { type: VolumeSchema, default: () => ({}) },
  status: { type: String, enum: ['active', 'empty', 'discarded'], default: 'active', index: true },
  receivedDate: { type: Date, default: null },
  withdrawnDate: { type: Date, default: null },
  discardedAt: { type: Date, default: null },
  discardedBy: { type: PersonSchema, default: undefined },
  discardReason: { type: String, default: '' },
  createdBy: { type: PersonSchema, default: undefined },
}, { timestamps: true });

StockUnitSchema.index({ exp: 1 });

module.exports = mongoose.model('StockUnit', StockUnitSchema);
```

- [ ] **Step 2: ตรวจว่า model โหลดได้ (server boot)**

Run: `cd server && node -e "require('./models/StockUnit'); console.log('StockUnit OK')"`
Expected: พิมพ์ `StockUnit OK` ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add server/models/StockUnit.js
git commit -m "feat(stock): StockUnit model for per-bottle tracking"
```

---

## Task 2: Model changes — openShelfLife + transaction actions

**Files:**
- Modify: `server/models/Stock.js:9-28` (StockStandardSchema)
- Modify: `server/models/StockTransaction.js:3-18`

- [ ] **Step 1: เพิ่ม openShelfLife ใน StockStandardSchema**

ใน `server/models/Stock.js` เพิ่ม sub-schema ก่อน `StockStandardSchema` และเพิ่ม field. หลังบรรทัด `}, { _id: false });` ของ `TierSchema` ใส่:

```js
const OpenShelfLifeSchema = new mongoose.Schema({
  value: { type: Number, default: 0 },
  unit: { type: String, enum: ['day', 'week', 'month'], default: 'day' },
}, { _id: false });
```

แล้วใน `StockStandardSchema` เพิ่มฟิลด์นี้ (วางต่อจาก `frequency`):

```js
  openShelfLife: { type: OpenShelfLifeSchema, default: () => ({ value: 0, unit: 'day' }) },
```

- [ ] **Step 2: ขยาย StockTransaction**

ใน `server/models/StockTransaction.js` แก้ enum ของ `action` และเพิ่ม fields. เปลี่ยน:

```js
  action: { type: String, enum: ['create', 'update', 'delete', 'deduct', 'receive'], required: true, index: true },
```
เป็น:
```js
  action: { type: String, enum: ['create', 'update', 'delete', 'deduct', 'receive', 'withdraw', 'discard'], required: true, index: true },
```

และก่อน `userEmail: String,` เพิ่ม:

```js
  unitId: String,
  qrId: String,
  volumeDelta: { type: Number, default: null },
  volumeUnit: String,
```

- [ ] **Step 3: ตรวจว่าโหลดได้**

Run: `cd server && node -e "require('./models/Stock'); require('./models/StockTransaction'); console.log('models OK')"`
Expected: `models OK`

- [ ] **Step 4: Commit**

```bash
git add server/models/Stock.js server/models/StockTransaction.js
git commit -m "feat(stock): openShelfLife on standard + withdraw/discard tx fields"
```

---

## Task 3: Pure logic + Vitest (TDD)

**Files:**
- Create: `src/lib/stockUnit.ts`
- Test: `src/lib/stockUnit.test.ts`

- [ ] **Step 1: เขียน test ก่อน (ให้ fail)**

```ts
import { describe, it, expect } from "vitest";
import {
  addShelfLife,
  computeWorkingExp,
  parseScannedQrId,
  unitDerivedStatus,
  summarizeUnits,
} from "./stockUnit";

describe("addShelfLife", () => {
  it("adds days", () => {
    expect(addShelfLife(new Date("2026-01-01"), { value: 7, unit: "day" }))
      .toEqual(new Date("2026-01-08"));
  });
  it("adds weeks", () => {
    expect(addShelfLife(new Date("2026-01-01"), { value: 2, unit: "week" }))
      .toEqual(new Date("2026-01-15"));
  });
  it("adds months", () => {
    expect(addShelfLife(new Date("2026-01-15"), { value: 1, unit: "month" }))
      .toEqual(new Date("2026-02-15"));
  });
});

describe("computeWorkingExp", () => {
  it("withdraw + shelf when under parent exp", () => {
    const exp = computeWorkingExp(new Date("2026-01-01"), { value: 7, unit: "day" }, new Date("2026-12-31"));
    expect(exp).toEqual(new Date("2026-01-08"));
  });
  it("caps at parent exp when shelf exceeds it", () => {
    const exp = computeWorkingExp(new Date("2026-01-01"), { value: 1, unit: "month" }, new Date("2026-01-10"));
    expect(exp).toEqual(new Date("2026-01-10"));
  });
  it("no parent exp → just withdraw + shelf", () => {
    const exp = computeWorkingExp(new Date("2026-01-01"), { value: 3, unit: "day" }, null);
    expect(exp).toEqual(new Date("2026-01-04"));
  });
});

describe("parseScannedQrId", () => {
  it("plain id", () => expect(parseScannedQrId("u_abc123")).toBe("u_abc123"));
  it("from URL path", () =>
    expect(parseScannedQrId("https://x.com/LIS/stock/scan/u_abc123")).toBe("u_abc123"));
  it("from JSON payload", () =>
    expect(parseScannedQrId('{"qrId":"u_abc123"}')).toBe("u_abc123"));
  it("empty → empty", () => expect(parseScannedQrId("  ")).toBe(""));
});

describe("unitDerivedStatus", () => {
  const now = new Date("2026-06-06");
  it("discarded wins", () =>
    expect(unitDerivedStatus({ status: "discarded", exp: "2020-01-01" }, now)).toBe("discarded"));
  it("empty", () => expect(unitDerivedStatus({ status: "empty" }, now)).toBe("empty"));
  it("expired when exp past", () =>
    expect(unitDerivedStatus({ status: "active", exp: "2026-01-01" }, now)).toBe("expired"));
  it("active otherwise", () =>
    expect(unitDerivedStatus({ status: "active", exp: "2026-12-31" }, now)).toBe("active"));
});

describe("summarizeUnits", () => {
  const now = new Date("2026-06-06");
  it("counts sealed/working, skips discarded/empty, flags expired+soon", () => {
    const s = summarizeUnits([
      { kind: "sealed", status: "active", exp: "2026-12-31" },   // sealed
      { kind: "sealed", status: "active", exp: "2026-06-20" },   // sealed + soon
      { kind: "working", status: "active", exp: "2026-12-31" },  // working
      { kind: "sealed", status: "active", exp: "2026-01-01" },   // expired
      { kind: "sealed", status: "discarded", exp: "2026-12-31" },// skip
      { kind: "working", status: "empty", exp: "2026-12-31" },   // skip
    ], now, 30);
    expect(s).toEqual({ sealed: 2, working: 1, expiringSoon: 1, expired: 1 });
  });
});
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `npm run test -- src/lib/stockUnit.test.ts`
Expected: FAIL — `Failed to resolve import "./stockUnit"` / functions undefined

- [ ] **Step 3: เขียน implementation**

`src/lib/stockUnit.ts`:

```ts
import { addDays, addWeeks, addMonths } from "date-fns";

export type ShelfUnit = "day" | "week" | "month";
export interface OpenShelfLife {
  value: number;
  unit: ShelfUnit;
}

export function addShelfLife(from: Date, shelf: OpenShelfLife): Date {
  const v = Math.max(0, Math.floor(Number(shelf?.value) || 0));
  switch (shelf?.unit) {
    case "week":
      return addWeeks(from, v);
    case "month":
      return addMonths(from, v);
    case "day":
    default:
      return addDays(from, v);
  }
}

/** working EXP = วันเบิก + openShelfLife, cap ไม่ให้เกิน EXP ขวดแม่ */
export function computeWorkingExp(
  withdrawnAt: Date,
  shelf: OpenShelfLife,
  parentExp: Date | null,
): Date {
  const candidate = addShelfLife(withdrawnAt, shelf);
  if (parentExp && candidate.getTime() > parentExp.getTime()) return parentExp;
  return candidate;
}

/** ดึง qrId จากผลสแกน — รองรับ id เปล่า / URL .../stock/scan/<id> / JSON {qrId} */
export function parseScannedQrId(raw: string): string {
  const text = (raw || "").trim();
  if (!text) return "";
  try {
    const payload = JSON.parse(text) as { qrId?: unknown; id?: unknown };
    const v = payload.qrId ?? payload.id;
    if (v) return String(v).trim();
  } catch {
    /* not JSON */
  }
  try {
    const url = new URL(text);
    const parts = url.pathname.split("/").filter(Boolean);
    return decodeURIComponent(parts[parts.length - 1] || text).trim();
  } catch {
    return text;
  }
}

export type UnitDerivedStatus = "active" | "empty" | "discarded" | "expired";

export function unitDerivedStatus(
  u: { status: string; exp?: string | null },
  now: Date = new Date(),
): UnitDerivedStatus {
  if (u.status === "discarded") return "discarded";
  if (u.status === "empty") return "empty";
  if (u.exp && new Date(u.exp).getTime() < now.getTime()) return "expired";
  return "active";
}

export interface UnitsSummary {
  sealed: number;
  working: number;
  expiringSoon: number;
  expired: number;
}

export function summarizeUnits(
  units: Array<{ kind: string; status: string; exp?: string | null }>,
  now: Date = new Date(),
  soonDays = 30,
): UnitsSummary {
  let sealed = 0,
    working = 0,
    expiringSoon = 0,
    expired = 0;
  const soonMs = soonDays * 24 * 60 * 60 * 1000;
  for (const u of units) {
    const st = unitDerivedStatus(u, now);
    if (st === "discarded" || st === "empty") continue;
    if (st === "expired") {
      expired++;
      continue;
    }
    if (u.kind === "working") working++;
    else sealed++;
    if (u.exp && new Date(u.exp).getTime() - now.getTime() <= soonMs) expiringSoon++;
  }
  return { sealed, working, expiringSoon, expired };
}
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `npm run test -- src/lib/stockUnit.test.ts`
Expected: PASS ทุก case

- [ ] **Step 5: Commit**

```bash
git add src/lib/stockUnit.ts src/lib/stockUnit.test.ts
git commit -m "feat(stock): pure helpers for working EXP, QR parse, units summary"
```

---

## Task 4: Backend — qrId generator + receive endpoint

**Files:**
- Modify: `server/routes/stock.js` (เพิ่ม require + helper + handler; วางบล็อกใหม่ก่อน `/* ==================== SOLVENTS ==================== */`)

- [ ] **Step 1: เพิ่ม require + helpers ที่หัวไฟล์**

ใต้บรรทัด `const StockTransaction = require('../models/StockTransaction');` (บรรทัด 4) เพิ่ม:

```js
const StockUnit = require('../models/StockUnit');
const crypto = require('crypto');

async function genUniqueQrId() {
  for (let i = 0; i < 5; i++) {
    const id = 'u_' + crypto.randomBytes(6).toString('hex'); // u_ + 12 hex
    const exists = await StockUnit.exists({ qrId: id });
    if (!exists) return id;
  }
  throw new Error('ไม่สามารถสร้าง qrId ที่ไม่ซ้ำได้');
}

// mirror ของ addShelfLife/computeWorkingExp ใน src/lib/stockUnit.ts
function addShelfLife(from, shelf) {
  const v = Math.max(0, Math.floor(Number(shelf && shelf.value) || 0));
  const d = new Date(from);
  if (shelf && shelf.unit === 'week') d.setDate(d.getDate() + v * 7);
  else if (shelf && shelf.unit === 'month') d.setMonth(d.getMonth() + v);
  else d.setDate(d.getDate() + v);
  return d;
}
function computeWorkingExp(withdrawnAt, shelf, parentExp) {
  const candidate = addShelfLife(withdrawnAt, shelf);
  if (parentExp && candidate.getTime() > new Date(parentExp).getTime()) return new Date(parentExp);
  return candidate;
}
function personOf(req) {
  const m = userMeta(req);
  return m.name ? { email: m.email, name: m.name } : undefined;
}
```

> หมายเหตุ: `userMeta(req)` เดิมคืน `{ userEmail, userName }`. แก้ `personOf` ให้ตรง — ใช้ `m.userEmail`/`m.userName`:

```js
function personOf(req) {
  const m = userMeta(req);
  return m.userName ? { email: m.userEmail, name: m.userName } : undefined;
}
```

- [ ] **Step 2: เพิ่ม receive endpoint** (วางก่อน `/* ==================== SOLVENTS ==================== */`)

```js
/* ==================== STANDARD UNITS (per-bottle) ==================== */

// รับเข้าหลายขวด: { lotNo?, sizeMl, unit?, bottles: [{ exp }], note? }
router.post('/standards/:id/units/receive', async (req, res) => {
  try {
    const std = await StockStandard.findById(req.params.id);
    if (!std) return res.status(404).json({ error: 'ไม่พบสาร' });

    const { lotNo = '', sizeMl, unit = 'ml', bottles, note } = req.body || {};
    const size = Number(sizeMl);
    if (!Number.isFinite(size) || size <= 0) return res.status(400).json({ error: 'ขนาด/ขวดไม่ถูกต้อง' });
    if (!Array.isArray(bottles) || bottles.length === 0) return res.status(400).json({ error: 'ต้องระบุอย่างน้อย 1 ขวด' });

    const now = new Date();
    const created = [];
    for (const b of bottles) {
      const qrId = await genUniqueQrId();
      const u = await StockUnit.create({
        qrId,
        itemCode: std.code,
        itemName: std.name,
        kind: 'sealed',
        lotNo,
        exp: b && b.exp ? new Date(b.exp) : null,
        volume: { initial: size, remaining: size, unit },
        status: 'active',
        receivedDate: now,
        createdBy: personOf(req),
      });
      created.push(u);
      await logTransaction({
        itemType: 'standard',
        itemId: std._id.toString(),
        itemCode: std.code,
        itemName: std.name,
        action: 'receive',
        unitId: u._id.toString(),
        qrId,
        afterQty: size,
        volumeDelta: size,
        volumeUnit: unit,
        unit: 'ml',
        note,
        ...userMeta(req),
      });
    }
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
```

- [ ] **Step 3: ทดสอบด้วย server จริง**

เปิด server: `cd server && npm run dev` (อีก terminal). หา id สาร: `curl http://localhost:3001/api/stock/standards` แล้วคัด `_id` ตัวแรก เป็น `<ID>`.

Run:
```bash
curl -s -X POST http://localhost:3001/api/stock/standards/<ID>/units/receive \
  -H "Content-Type: application/json" \
  -d '{"lotNo":"L1","sizeMl":100,"bottles":[{"exp":"2027-01-01"},{"exp":"2027-06-01"}]}'
```
Expected: JSON array 2 ขวด แต่ละขวดมี `qrId` ขึ้นต้น `u_`, `kind:"sealed"`, `volume.remaining:100`, `exp` ต่างกันรายขวด

- [ ] **Step 4: Commit**

```bash
git add server/routes/stock.js
git commit -m "feat(stock): receive endpoint creating per-bottle sealed units with QR"
```

---

## Task 5: Backend — withdraw endpoint (atomic)

**Files:**
- Modify: `server/routes/stock.js` (เพิ่ม handler ในบล็อก STANDARD UNITS)

- [ ] **Step 1: เพิ่ม withdraw endpoint**

```js
// แบ่ง working จากขวด sealed: POST /units/:qrId/withdraw { ml, note? }
router.post('/units/:qrId/withdraw', async (req, res) => {
  try {
    const ml = Number(req.body && req.body.ml);
    if (!Number.isFinite(ml) || ml <= 0) return res.status(400).json({ error: 'ปริมาณไม่ถูกต้อง' });

    const parent = await StockUnit.findOne({ qrId: req.params.qrId });
    if (!parent) return res.status(404).json({ error: 'ไม่พบขวด' });
    if (parent.kind !== 'sealed') return res.status(400).json({ error: 'แบ่งได้เฉพาะขวดคงคลัง (sealed)' });
    if (parent.status === 'discarded') return res.status(400).json({ error: 'ขวดนี้ถูกทิ้งแล้ว ใช้งานต่อไม่ได้' });
    if (parent.status === 'empty') return res.status(400).json({ error: 'ขวดนี้หมดแล้ว' });
    if (parent.exp && new Date(parent.exp).getTime() < Date.now()) return res.status(400).json({ error: 'ขวดนี้หมดอายุแล้ว' });

    // atomic: หัก remaining เฉพาะเมื่อยัง active และเหลือพอ (กัน race 2 คนแบ่งพร้อมกัน)
    const updatedParent = await StockUnit.findOneAndUpdate(
      { qrId: req.params.qrId, status: 'active', 'volume.remaining': { $gte: ml } },
      { $inc: { 'volume.remaining': -ml } },
      { new: true },
    );
    if (!updatedParent) return res.status(400).json({ error: 'ปริมาณคงเหลือไม่พอ' });
    if (updatedParent.volume.remaining <= 0) {
      updatedParent.status = 'empty';
      await updatedParent.save();
    }

    const std = await StockStandard.findOne({ code: parent.itemCode });
    const shelf = (std && std.openShelfLife) || { value: 0, unit: 'day' };
    const now = new Date();
    const exp = computeWorkingExp(now, shelf, parent.exp || null);

    const qrId = await genUniqueQrId();
    const working = await StockUnit.create({
      qrId,
      itemCode: parent.itemCode,
      itemName: parent.itemName,
      kind: 'working',
      parentId: parent._id,
      lotNo: parent.lotNo,
      exp,
      volume: { initial: ml, remaining: ml, unit: parent.volume.unit },
      status: 'active',
      withdrawnDate: now,
      createdBy: personOf(req),
    });

    await logTransaction({
      itemType: 'standard',
      itemId: parent.itemCode,
      itemCode: parent.itemCode,
      itemName: parent.itemName,
      action: 'withdraw',
      unitId: working._id.toString(),
      qrId,
      volumeDelta: -ml,
      volumeUnit: parent.volume.unit,
      unit: 'ml',
      note: req.body && req.body.note,
      ...userMeta(req),
    });

    res.status(201).json({ parent: updatedParent, working });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
```

- [ ] **Step 2: ทดสอบ** (server รันอยู่)

ใช้ `qrId` ของขวด sealed จาก Task 4 (`<QR>`). ก่อนแบ่ง ตั้ง openShelfLife ให้สารก่อน:
```bash
curl -s -X PATCH http://localhost:3001/api/stock/standards/<ID> \
  -H "Content-Type: application/json" -d '{"openShelfLife":{"value":7,"unit":"day"}}'
curl -s -X POST http://localhost:3001/api/stock/units/<QR>/withdraw \
  -H "Content-Type: application/json" -d '{"ml":20}'
```
Expected: `{ parent: {...remaining:80}, working: {...kind:"working", volume.remaining:20, exp:<วันนี้+7 ไม่เกิน exp แม่>} }`

- [ ] **Step 3: ทดสอบ guard** — แบ่งเกิน:
```bash
curl -s -X POST http://localhost:3001/api/stock/units/<QR>/withdraw -H "Content-Type: application/json" -d '{"ml":9999}'
```
Expected: HTTP 400 `{"error":"ปริมาณคงเหลือไม่พอ"}`

- [ ] **Step 4: Commit**

```bash
git add server/routes/stock.js
git commit -m "feat(stock): atomic withdraw endpoint creating working units"
```

---

## Task 6: Backend — discard + list + get-by-qrId

**Files:**
- Modify: `server/routes/stock.js` (เพิ่ม handler ในบล็อก STANDARD UNITS)

- [ ] **Step 1: เพิ่ม endpoints**

```js
// ทิ้งขวด: POST /units/:qrId/discard { reason? }
router.post('/units/:qrId/discard', async (req, res) => {
  try {
    const unit = await StockUnit.findOne({ qrId: req.params.qrId });
    if (!unit) return res.status(404).json({ error: 'ไม่พบขวด' });
    if (unit.status === 'discarded') return res.status(400).json({ error: 'ขวดนี้ถูกทิ้งแล้ว' });

    unit.status = 'discarded';
    unit.discardedAt = new Date();
    unit.discardedBy = personOf(req);
    unit.discardReason = (req.body && req.body.reason) || '';
    await unit.save();

    await logTransaction({
      itemType: 'standard',
      itemId: unit.itemCode,
      itemCode: unit.itemCode,
      itemName: unit.itemName,
      action: 'discard',
      unitId: unit._id.toString(),
      qrId: unit.qrId,
      note: unit.discardReason,
      ...userMeta(req),
    });
    res.json(unit);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// list units: GET /units?itemCode=&status=&kind=
router.get('/units', async (req, res) => {
  try {
    const { itemCode, status, kind } = req.query;
    const f = {};
    if (itemCode) f.itemCode = itemCode;
    if (status) f.status = status;
    if (kind) f.kind = kind;
    const units = await StockUnit.find(f).sort({ createdAt: -1 }).limit(2000);
    res.json(units);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// get by qrId: GET /units/:qrId  (ปลายทางสแกน)
router.get('/units/:qrId', async (req, res) => {
  try {
    const unit = await StockUnit.findOne({ qrId: req.params.qrId });
    if (!unit) return res.status(404).json({ error: 'ไม่พบขวด' });
    res.json(unit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

> **ลำดับ route สำคัญ:** ใส่ `GET /units` (ไม่มี param) **ก่อน** `GET /units/:qrId` ตามโค้ดด้านบนแล้ว — Express จะ match ถูกต้อง.

- [ ] **Step 2: ทดสอบ**

```bash
curl -s http://localhost:3001/api/stock/units?itemCode=<CODE>
curl -s http://localhost:3001/api/stock/units/<QR>
curl -s -X POST http://localhost:3001/api/stock/units/<QR>/discard -H "Content-Type: application/json" -d '{"reason":"ทดสอบ"}'
curl -s -X POST http://localhost:3001/api/stock/units/<QR>/withdraw -H "Content-Type: application/json" -d '{"ml":5}'
```
Expected: list คืน array; get คืน 1 ขวด; discard คืนขวด `status:"discarded"`; withdraw หลัง discard → 400 `"ขวดนี้ถูกทิ้งแล้ว ใช้งานต่อไม่ได้"`

- [ ] **Step 3: Commit**

```bash
git add server/routes/stock.js
git commit -m "feat(stock): discard + list + get-by-qrId unit endpoints"
```

---

## Task 7: Frontend types + API methods

**Files:**
- Modify: `src/types/stock.ts`
- Modify: `src/lib/api.ts`

- [ ] **Step 1: เพิ่ม type ใน `src/types/stock.ts`**

ต่อท้ายไฟล์:

```ts
export type ShelfUnit = "day" | "week" | "month";
export interface OpenShelfLife {
  value: number;
  unit: ShelfUnit;
}

export type StockUnitKind = "sealed" | "working";
export type StockUnitStatus = "active" | "empty" | "discarded";

export interface StockUnitVolume {
  initial: number;
  remaining: number;
  unit: "ml" | "mg" | "g";
}

export interface StockUnitItem {
  _id: string;
  qrId: string;
  itemCode: string;
  itemName: string;
  kind: StockUnitKind;
  parentId?: string | null;
  lotNo?: string;
  exp?: string | null;
  volume: StockUnitVolume;
  status: StockUnitStatus;
  receivedDate?: string | null;
  withdrawnDate?: string | null;
  discardedAt?: string | null;
  discardedBy?: { email?: string; name?: string };
  discardReason?: string;
  createdBy?: { email?: string; name?: string };
  createdAt?: string;
  updatedAt?: string;
}
```

และเพิ่ม `openShelfLife?: OpenShelfLife;` ใน interface `StockStandardItem` (วางต่อจาก `frequency: string;`).

แก้ `StockAction` ให้รวม action ใหม่:
```ts
export type StockAction = "create" | "update" | "delete" | "deduct" | "receive" | "withdraw" | "discard";
```

- [ ] **Step 2: เพิ่ม API methods ใน `src/lib/api.ts`**

เพิ่ม import ใน type block (บนสุด): เพิ่ม `StockUnitItem` เข้าไปในรายการ import จาก `@/types/stock`.

หลังบล็อก `// Stock — Transactions (audit log)` (ราว ๆ บรรทัด 188-192) เพิ่ม:

```ts
  // Stock — Units (per-bottle)
  getStockUnits: (params?: { itemCode?: string; status?: string; kind?: string }) => {
    const q = new URLSearchParams();
    if (params?.itemCode) q.set("itemCode", params.itemCode);
    if (params?.status) q.set("status", params.status);
    if (params?.kind) q.set("kind", params.kind);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return request<StockUnitItem[]>(`/stock/units${qs}`);
  },
  getStockUnit: (qrId: string) =>
    request<StockUnitItem>(`/stock/units/${encodeURIComponent(qrId)}`),
  receiveStockUnits: (
    standardId: string,
    body: { lotNo?: string; sizeMl: number; unit?: string; bottles: { exp?: string }[]; note?: string },
  ) =>
    request<StockUnitItem[]>(`/stock/standards/${standardId}/units/receive`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  withdrawStockUnit: (qrId: string, body: { ml: number; note?: string }) =>
    request<{ parent: StockUnitItem; working: StockUnitItem }>(
      `/stock/units/${encodeURIComponent(qrId)}/withdraw`,
      { method: "POST", body: JSON.stringify(body) },
    ),
  discardStockUnit: (qrId: string, body: { reason?: string }) =>
    request<StockUnitItem>(`/stock/units/${encodeURIComponent(qrId)}/discard`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
```

- [ ] **Step 3: type-check**

Run: `npx tsc --noEmit`
Expected: ไม่มี error ใหม่จากไฟล์ที่แก้

- [ ] **Step 4: Commit**

```bash
git add src/types/stock.ts src/lib/api.ts
git commit -m "feat(stock): frontend types + API methods for units"
```

---

## Task 8: Print docType `stock-label` + label builder

**Files:**
- Modify: `server/models/PrintConfig.js:6`
- Modify: `server/routes/print.js:11-16`
- Modify: `src/lib/printConfig.ts:1,25-30`
- Create: `src/lib/stockLabel.ts`

- [ ] **Step 1: backend enum + defaults**

ใน `server/models/PrintConfig.js` แก้ enum เป็น:
```js
    enum: ['sample-label', 'coa', 'service-request', 'production-plan', 'stock-label'],
```

ใน `server/routes/print.js` เพิ่มใน `DOC_DEFAULTS` (ต่อท้าย array):
```js
  { slug: 'stock-label',     printerName: '', cupsPrinterUrl: '', copies: 1, paperSize: 'label-6x4' },
```

- [ ] **Step 2: frontend docType**

ใน `src/lib/printConfig.ts` แก้ union:
```ts
export type PrintDocType = "sample-label" | "coa" | "service-request" | "production-plan" | "stock-label";
```
และเพิ่มใน `PRINT_DOC_TYPES` (ต่อท้าย array):
```ts
  { slug: "stock-label",     label: "ฉลากขวด Standard (sticker)", defaultPaper: "label-6x4" },
```

- [ ] **Step 3: label builder** — `src/lib/stockLabel.ts`

```ts
import QRCode from "qrcode";
import type { StockUnitItem } from "@/types/stock";

/** สร้าง HTML ลาเบลขวด พร้อม QR (data URL) — ส่งตรงเข้า api.printDocument */
export async function buildStockLabelHtml(
  unit: StockUnitItem,
  origin: string,
): Promise<string> {
  const scanUrl = `${origin.replace(/\/$/, "")}/LIS/stock/scan/${encodeURIComponent(unit.qrId)}`;
  const qr = await QRCode.toDataURL(scanUrl, { margin: 1, width: 240 });
  const exp = unit.exp ? new Date(unit.exp).toLocaleDateString("th-TH") : "-";
  const kindLabel = unit.kind === "working" ? "WORKING" : "SEALED";
  const size = `${unit.volume?.initial ?? "-"} ${unit.volume?.unit ?? ""}`;
  return `
<div style="display:flex;gap:8px;align-items:center;font-family:'Kanit',sans-serif;width:152mm;height:101mm;box-sizing:border-box;padding:6mm;">
  <img src="${qr}" alt="qr" style="width:34mm;height:34mm;flex:none;" />
  <div style="font-size:11pt;line-height:1.4;">
    <div style="font-weight:700;font-size:14pt;">${escapeHtml(unit.itemName || "")}</div>
    <div>Code: <b>${escapeHtml(unit.itemCode || "")}</b> · <b>${kindLabel}</b></div>
    <div>Lot: ${escapeHtml(unit.lotNo || "-")} · ขนาด: ${escapeHtml(size)}</div>
    <div>EXP: <b>${escapeHtml(exp)}</b></div>
    <div style="font-size:8pt;color:#666;margin-top:4px;">${escapeHtml(unit.qrId)}</div>
  </div>
</div>`.trim();
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
```

- [ ] **Step 4: type-check**

Run: `npx tsc --noEmit`
Expected: ไม่มี error ใหม่

- [ ] **Step 5: Commit**

```bash
git add server/models/PrintConfig.js server/routes/print.js src/lib/printConfig.ts src/lib/stockLabel.ts
git commit -m "feat(stock): stock-label print docType + QR label builder"
```

---

## Task 9: StockQrScanner component (camera)

**Files:**
- Create: `src/components/lis/StockQrScanner.tsx`

ดู `src/components/petition/QrReceiveModal.tsx:96-148` เป็น reference ของการเปิดกล้องด้วย `html5-qrcode`.

- [ ] **Step 1: เขียน component**

```tsx
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseScannedQrId } from "@/lib/stockUnit";

const READER_ID = "stock-qr-reader";

interface Props {
  open: boolean;
  title?: string;
  onClose: () => void;
  onScanned: (qrId: string) => void;
}

/** เปิดกล้องอ่าน QR ขวด แล้วคืน qrId; มี fallback กรอก id มือ */
export default function StockQrScanner({ open, title = "สแกน QR ขวด", onClose, onScanned }: Props) {
  const [phase, setPhase] = useState<"scanning" | "no-camera" | "error">("scanning");
  const [errorMsg, setErrorMsg] = useState("");
  const [manual, setManual] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (open) {
      setPhase("scanning");
      setErrorMsg("");
      setManual("");
      firedRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open || phase !== "scanning") return;
    let active = true;

    (async () => {
      const scanner = new Html5Qrcode(READER_ID);
      const config = { fps: 10, qrbox: { width: 250, height: 250 } };
      const onScan = (text: string) => {
        if (!active || firedRef.current) return;
        const qrId = parseScannedQrId(text);
        if (!qrId) return;
        firedRef.current = true;
        onScanned(qrId);
      };
      const startWith = (source: MediaTrackConstraints | string) =>
        scanner.start(source, config, onScan, () => {});
      try {
        try {
          await startWith({ facingMode: { exact: "environment" } });
        } catch {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras.length === 0) {
            if (active) setPhase("no-camera");
            return;
          }
          const back = cameras.find((c) => /back|environment|rear|หลัง|后|背面/i.test(c.label));
          const cam = back ?? cameras[cameras.length - 1];
          await startWith(cam.id);
        }
        if (!active) {
          scanner.stop().catch(() => {});
          return;
        }
        scannerRef.current = scanner;
      } catch {
        if (active) {
          setPhase("error");
          setErrorMsg("ไม่สามารถเปิดกล้องได้ — ใช้ช่องกรอก id ด้านล่างแทนได้");
        }
      }
    })();

    return () => {
      active = false;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        try {
          const state = s.getState();
          if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
            s.stop().catch(() => {});
          }
        } catch {
          /* ignore */
        }
      }
    };
  }, [open, phase, onScanned]);

  if (!open) return null;

  const submitManual = () => {
    const qrId = parseScannedQrId(manual);
    if (qrId) onScanned(qrId);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-base font-bold">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className={phase === "scanning" ? "block" : "hidden"}>
            <div id={READER_ID} className="w-full rounded-lg overflow-hidden border" />
            <p className="mt-2 text-center text-sm text-muted-foreground">เล็งกล้องไปที่ QR บนขวด</p>
          </div>
          {phase !== "scanning" && <div id={READER_ID} className="hidden" />}

          {phase === "no-camera" && (
            <p className="text-center text-sm text-muted-foreground">ไม่พบกล้องในอุปกรณ์นี้</p>
          )}
          {phase === "error" && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center text-sm text-destructive flex items-center gap-2 justify-center">
              <AlertCircle className="w-4 h-4" /> {errorMsg}
            </div>
          )}

          <div className="border-t pt-4 space-y-2">
            <Label>หรือกรอก/วาง qrId เอง</Label>
            <div className="flex gap-2">
              <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="u_xxxxxxxx หรือ URL" />
              <Button onClick={submitManual} disabled={!manual.trim()}>ตกลง</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: type-check**

Run: `npx tsc --noEmit`
Expected: ไม่มี error ใหม่

- [ ] **Step 3: Commit**

```bash
git add src/components/lis/StockQrScanner.tsx
git commit -m "feat(stock): camera QR scanner with manual fallback"
```

---

## Task 10: ReceiveBottlesDialog

**Files:**
- Create: `src/components/lis/stock/ReceiveBottlesDialog.tsx`

- [ ] **Step 1: เขียน dialog**

```tsx
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api";
import { buildStockLabelHtml } from "@/lib/stockLabel";
import type { StockStandardItem, StockUnitItem } from "@/types/stock";

interface Props {
  standard: StockStandardItem;
  onClose: () => void;
  onSaved: () => void;
}

export default function ReceiveBottlesDialog({ standard, onClose, onSaved }: Props) {
  const [lotNo, setLotNo] = useState("");
  const [sizeMl, setSizeMl] = useState("100");
  const [count, setCount] = useState("1");
  const [sameExp, setSameExp] = useState(true);
  const [commonExp, setCommonExp] = useState("");
  const [perExp, setPerExp] = useState<string[]>([""]);
  const [printAfter, setPrintAfter] = useState(true);
  const [busy, setBusy] = useState(false);

  const n = Math.max(1, Number(count) || 1);
  // keep perExp length synced with count
  const ensurePerExp = (len: number) => {
    setPerExp((prev) => {
      const next = [...prev];
      while (next.length < len) next.push("");
      next.length = len;
      return next;
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const size = Number(sizeMl);
    if (!Number.isFinite(size) || size <= 0) { toast.error("กรุณาระบุขนาด/ขวด"); return; }
    const bottles = sameExp
      ? Array.from({ length: n }, () => ({ exp: commonExp || undefined }))
      : perExp.slice(0, n).map((exp) => ({ exp: exp || undefined }));
    setBusy(true);
    try {
      const created = await api.receiveStockUnits(standard._id, {
        lotNo, sizeMl: size, unit: "ml", bottles,
      });
      toast.success(`รับเข้า ${created.length} ขวดแล้ว`);
      if (printAfter) await printLabels(created);
      onSaved();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const printLabels = async (units: StockUnitItem[]) => {
    for (const u of units) {
      try {
        const html = await buildStockLabelHtml(u, window.location.origin);
        await api.printDocument({ docType: "stock-label", html });
      } catch (err) {
        toast.error(`ปริ้นลาเบล ${u.qrId} ไม่สำเร็จ: ${(err as Error).message}`);
      }
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>รับเข้าขวด — {standard.name}</DialogTitle>
            <DialogDescription>{standard.code}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Lot No</Label><Input value={lotNo} onChange={(e) => setLotNo(e.target.value)} /></div>
              <div><Label>ขนาด/ขวด (ml)</Label><Input type="number" value={sizeMl} onChange={(e) => setSizeMl(e.target.value)} /></div>
            </div>
            <div>
              <Label>จำนวนขวด</Label>
              <Input type="number" min="1" value={count}
                onChange={(e) => { setCount(e.target.value); ensurePerExp(Math.max(1, Number(e.target.value) || 1)); }} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={sameExp} onCheckedChange={(v) => setSameExp(!!v)} /> EXP เท่ากันทุกขวด
            </label>
            {sameExp ? (
              <div><Label>EXP (ทุกขวด)</Label><Input type="date" value={commonExp} onChange={(e) => setCommonExp(e.target.value)} /></div>
            ) : (
              <div className="space-y-2">
                {Array.from({ length: n }, (_, i) => (
                  <div key={i}>
                    <Label>EXP ขวดที่ {i + 1}</Label>
                    <Input type="date" value={perExp[i] ?? ""}
                      onChange={(e) => setPerExp((prev) => { const x = [...prev]; x[i] = e.target.value; return x; })} />
                  </div>
                ))}
              </div>
            )}
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={printAfter} onCheckedChange={(v) => setPrintAfter(!!v)} /> ปริ้นลาเบลหลังรับเข้า
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
            <Button type="submit" disabled={busy}>{busy ? "กำลังบันทึก..." : "รับเข้า"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

> ตรวจว่ามี `src/components/ui/checkbox.tsx` อยู่จริง — ถ้าไม่มี ใช้ `<input type="checkbox">` ธรรมดาแทน. Run: `ls src/components/ui/checkbox.tsx`

- [ ] **Step 2: type-check**

Run: `npx tsc --noEmit`
Expected: ไม่มี error ใหม่

- [ ] **Step 3: Commit**

```bash
git add src/components/lis/stock/ReceiveBottlesDialog.tsx
git commit -m "feat(stock): ReceiveBottlesDialog with per-bottle EXP + label print"
```

---

## Task 11: WithdrawDialog

**Files:**
- Create: `src/components/lis/stock/WithdrawDialog.tsx`

- [ ] **Step 1: เขียน dialog**

รับ `qrId` (มาจากสแกนหรือเลือกขวด) → โหลดข้อมูลขวด → กรอก ml → แบ่ง → ปริ้นลาเบล working.

```tsx
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { buildStockLabelHtml } from "@/lib/stockLabel";
import { unitDerivedStatus } from "@/lib/stockUnit";
import type { StockUnitItem } from "@/types/stock";

interface Props {
  qrId: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function WithdrawDialog({ qrId, onClose, onSaved }: Props) {
  const [unit, setUnit] = useState<StockUnitItem | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [ml, setMl] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let on = true;
    api.getStockUnit(qrId)
      .then((u) => { if (on) setUnit(u); })
      .catch((e) => { if (on) setLoadErr((e as Error).message); });
    return () => { on = false; };
  }, [qrId]);

  const derived = unit ? unitDerivedStatus(unit) : null;
  const blocked =
    !unit ? "" :
    unit.kind !== "sealed" ? "แบ่งได้เฉพาะขวดคงคลัง (sealed)" :
    derived === "discarded" ? "ขวดนี้ถูกทิ้งแล้ว ใช้งานต่อไม่ได้" :
    derived === "empty" ? "ขวดนี้หมดแล้ว" :
    derived === "expired" ? "ขวดนี้หมดอายุแล้ว" : "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(ml);
    if (!Number.isFinite(amt) || amt <= 0) { toast.error("กรุณาระบุปริมาณ"); return; }
    if (unit && amt > (unit.volume?.remaining ?? 0)) { toast.error("ปริมาณคงเหลือไม่พอ"); return; }
    setBusy(true);
    try {
      const { working } = await api.withdrawStockUnit(qrId, { ml: amt, note: note || undefined });
      toast.success(`แบ่ง working ${amt} ml แล้ว`);
      try {
        const html = await buildStockLabelHtml(working, window.location.origin);
        await api.printDocument({ docType: "stock-label", html });
      } catch (err) {
        toast.error(`ปริ้นลาเบล working ไม่สำเร็จ: ${(err as Error).message}`);
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>แบ่งใช้ → working</DialogTitle>
            <DialogDescription>{qrId}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {loadErr && <p className="text-sm text-destructive">{loadErr}</p>}
            {unit && (
              <div className="text-sm text-muted-foreground">
                {unit.itemName} ({unit.itemCode}) · Lot {unit.lotNo || "-"} · คงเหลือ <b>{unit.volume?.remaining}</b> {unit.volume?.unit}
              </div>
            )}
            {blocked && <p className="text-sm text-destructive font-medium">{blocked}</p>}
            <div>
              <Label>ปริมาณที่แบ่ง (ml)</Label>
              <Input type="number" min="1" value={ml} onChange={(e) => setMl(e.target.value)} disabled={!!blocked} />
            </div>
            <div>
              <Label>หมายเหตุ</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" disabled={!!blocked} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
            <Button type="submit" disabled={busy || !!blocked || !unit}>{busy ? "กำลังบันทึก..." : "แบ่ง working"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: type-check** — Run: `npx tsc --noEmit` → ไม่มี error ใหม่

- [ ] **Step 3: Commit**

```bash
git add src/components/lis/stock/WithdrawDialog.tsx
git commit -m "feat(stock): WithdrawDialog (split working + print)"
```

---

## Task 12: DiscardDialog

**Files:**
- Create: `src/components/lis/stock/DiscardDialog.tsx`

- [ ] **Step 1: เขียน dialog**

```tsx
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { unitDerivedStatus } from "@/lib/stockUnit";
import type { StockUnitItem } from "@/types/stock";

interface Props {
  qrId: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function DiscardDialog({ qrId, onClose, onSaved }: Props) {
  const [unit, setUnit] = useState<StockUnitItem | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let on = true;
    api.getStockUnit(qrId)
      .then((u) => { if (on) setUnit(u); })
      .catch((e) => { if (on) setLoadErr((e as Error).message); });
    return () => { on = false; };
  }, [qrId]);

  const already = unit ? unitDerivedStatus(unit) === "discarded" : false;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.discardStockUnit(qrId, { reason: reason || undefined });
      toast.success("ทิ้งขวดแล้ว — QR นี้ใช้ต่อไม่ได้");
      onSaved();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>ทิ้งขวด</DialogTitle>
            <DialogDescription>{qrId}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {loadErr && <p className="text-sm text-destructive">{loadErr}</p>}
            {unit && (
              <div className="text-sm text-muted-foreground">
                {unit.itemName} ({unit.itemCode}) · {unit.kind === "working" ? "working" : "คงคลัง"} · Lot {unit.lotNo || "-"}
              </div>
            )}
            {already && <p className="text-sm text-destructive font-medium">ขวดนี้ถูกทิ้งไปแล้ว</p>}
            <div>
              <Label>เหตุผล</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เช่น หมดอายุ / ปนเปื้อน" disabled={already} />
            </div>
            <p className="text-xs text-muted-foreground">เมื่อทิ้งแล้ว QR ของขวดนี้จะใช้งานต่อไม่ได้ถาวร</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
            <Button type="submit" variant="destructive" disabled={busy || already || !unit}>{busy ? "กำลังบันทึก..." : "ยืนยันทิ้ง"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: type-check** — Run: `npx tsc --noEmit` → ไม่มี error ใหม่

- [ ] **Step 3: Commit**

```bash
git add src/components/lis/stock/DiscardDialog.tsx
git commit -m "feat(stock): DiscardDialog (scan + reason, kills QR)"
```

---

## Task 13: UnitsDrawer

**Files:**
- Create: `src/components/lis/stock/UnitsDrawer.tsx`

แสดงรายขวดทุกใบของสารหนึ่งตัว + ปุ่มแบ่ง/ทิ้ง/ปริ้นซ้ำ รายขวด.

- [ ] **Step 1: เขียน component**

```tsx
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Minus, Trash2, Printer, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { buildStockLabelHtml } from "@/lib/stockLabel";
import { unitDerivedStatus } from "@/lib/stockUnit";
import type { StockStandardItem, StockUnitItem } from "@/types/stock";
import WithdrawDialog from "./WithdrawDialog";
import DiscardDialog from "./DiscardDialog";

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  empty: "bg-slate-100 text-slate-600",
  discarded: "bg-destructive/15 text-destructive",
  expired: "bg-amber-100 text-amber-700",
};
const STATUS_LABEL: Record<string, string> = {
  active: "ใช้งานได้", empty: "หมด", discarded: "ทิ้งแล้ว", expired: "หมดอายุ",
};

export default function UnitsDrawer({ standard, onClose }: { standard: StockStandardItem; onClose: () => void }) {
  const qc = useQueryClient();
  const [withdrawQr, setWithdrawQr] = useState<string | null>(null);
  const [discardQr, setDiscardQr] = useState<string | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["stock", "units", standard.code],
    queryFn: () => api.getStockUnits({ itemCode: standard.code }),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["stock", "units", standard.code] });
    qc.invalidateQueries({ queryKey: ["stock", "units"] });
    qc.invalidateQueries({ queryKey: ["stock", "transactions"] });
  };

  const reprint = async (u: StockUnitItem) => {
    try {
      const html = await buildStockLabelHtml(u, window.location.origin);
      await api.printDocument({ docType: "stock-label", html });
      toast.success("ส่งปริ้นแล้ว");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={onClose}>
      <div className="bg-background w-full max-w-2xl h-full overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b sticky top-0 bg-background">
          <div>
            <div className="font-bold">{standard.name}</div>
            <div className="text-xs text-muted-foreground">{standard.code} · รายขวด</div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead>qrId</TableHead>
                <TableHead>ชนิด</TableHead>
                <TableHead>Lot</TableHead>
                <TableHead className="text-right">คงเหลือ</TableHead>
                <TableHead>EXP</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-6">กำลังโหลด...</TableCell></TableRow>
              ) : data.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">ยังไม่มีขวด — กดรับเข้า</TableCell></TableRow>
              ) : data.map((u) => {
                const st = unitDerivedStatus(u);
                const canWithdraw = u.kind === "sealed" && st === "active";
                const canDiscard = st !== "discarded";
                return (
                  <TableRow key={u._id}>
                    <TableCell className="font-mono text-xs">{u.qrId}</TableCell>
                    <TableCell><Badge variant="outline">{u.kind === "working" ? "working" : "คงคลัง"}</Badge></TableCell>
                    <TableCell className="text-xs">{u.lotNo || "-"}</TableCell>
                    <TableCell className="text-right">{u.volume?.remaining ?? "-"} {u.volume?.unit}</TableCell>
                    <TableCell className="text-xs">{u.exp ? new Date(u.exp).toLocaleDateString("th-TH") : "-"}</TableCell>
                    <TableCell><Badge className={`text-xs ${STATUS_BADGE[st]}`}>{STATUS_LABEL[st]}</Badge></TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {canWithdraw && <Button size="icon" variant="ghost" title="แบ่ง working" onClick={() => setWithdrawQr(u.qrId)}><Minus className="w-4 h-4" /></Button>}
                        <Button size="icon" variant="ghost" title="ปริ้นซ้ำ" onClick={() => reprint(u)}><Printer className="w-4 h-4" /></Button>
                        {canDiscard && <Button size="icon" variant="ghost" title="ทิ้ง" onClick={() => setDiscardQr(u.qrId)}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {withdrawQr && <WithdrawDialog qrId={withdrawQr} onClose={() => setWithdrawQr(null)} onSaved={refresh} />}
      {discardQr && <DiscardDialog qrId={discardQr} onClose={() => setDiscardQr(null)} onSaved={refresh} />}
    </div>
  );
}
```

- [ ] **Step 2: type-check** — Run: `npx tsc --noEmit` → ไม่มี error ใหม่

- [ ] **Step 3: Commit**

```bash
git add src/components/lis/stock/UnitsDrawer.tsx
git commit -m "feat(stock): UnitsDrawer listing per-bottle units with actions"
```

---

## Task 14: Standards tab rework + floating scan + scan page/route

**Files:**
- Modify: `src/pages/Stock.tsx` (StandardsTab + page)
- Create: `src/pages/StockUnitScanPage.tsx`
- Modify: `src/App.tsx` (route)

- [ ] **Step 1: StandardsTab — summary จากรายขวด + เปิด drawer + รับเข้าใหม่ + สแกน**

ใน `src/pages/Stock.tsx` เพิ่ม import ที่หัวไฟล์:
```tsx
import { summarizeUnits } from "@/lib/stockUnit";
import UnitsDrawer from "@/components/lis/stock/UnitsDrawer";
import ReceiveBottlesDialog from "@/components/lis/stock/ReceiveBottlesDialog";
import StockQrScanner from "@/components/lis/StockQrScanner";
import WithdrawDialog from "@/components/lis/stock/WithdrawDialog";
import DiscardDialog from "@/components/lis/stock/DiscardDialog";
import type { StockUnitItem } from "@/types/stock";
import { ScanLine } from "lucide-react";
```

ใน `StandardsTab()` หลัง `const { data = [], isLoading } = useQuery({ queryKey: ["stock","standards"], ... })` เพิ่ม query รวมทุก unit เพื่อทำ summary ต่อสาร:
```tsx
  const { data: allUnits = [] } = useQuery({
    queryKey: ["stock", "units"],
    queryFn: () => api.getStockUnits(),
  });
  const unitsByCode = useMemo(() => {
    const m = new Map<string, StockUnitItem[]>();
    for (const u of allUnits) {
      const arr = m.get(u.itemCode) ?? [];
      arr.push(u);
      m.set(u.itemCode, arr);
    }
    return m;
  }, [allUnits]);

  const [drawer, setDrawer] = useState<StockStandardItem | null>(null);
  const [receiving, setReceiving] = useState<StockStandardItem | null>(null);
```

แทนที่คอลัมน์ tier 3 ช่อง (Primary/Supplier/Working) ในตารางด้วยคอลัมน์ summary 2 ช่อง. ในส่วน `<TableHeader>` เปลี่ยน 3 `<TableHead>` ของ Primary/Supplier/Working เป็น:
```tsx
                  <TableHead className="text-center">คงคลัง (ขวด)</TableHead>
                  <TableHead className="text-center">working (ขวด)</TableHead>
```
และในแถว ลบ 3 `<TierCell ... />` ออก แล้วใส่:
```tsx
                      {(() => {
                        const sum = summarizeUnits(unitsByCode.get(item.code) ?? []);
                        return (
                          <>
                            <TableCell className="text-center">{sum.sealed}</TableCell>
                            <TableCell className="text-center">{sum.working}</TableCell>
                          </>
                        );
                      })()}
```

> สถานะ/แจ้งเตือน: ใช้ `summarizeUnits` แทน `worstExpiry`/`totalQty` เดิม. ในเซลล์ "สถานะ" แทนเงื่อนไขเดิมด้วย:
```tsx
                      {(() => {
                        const sum = summarizeUnits(unitsByCode.get(item.code) ?? []);
                        return (
                          <div className="flex flex-wrap gap-1">
                            {sum.sealed + sum.working === 0 && <Badge className="bg-destructive/15 text-destructive text-xs">หมด</Badge>}
                            {sum.expired > 0 && <Badge className="bg-destructive/15 text-destructive text-xs">หมดอายุ {sum.expired}</Badge>}
                            {sum.expiringSoon > 0 && <Badge className="bg-amber-100 text-amber-700 text-xs">ใกล้หมดอายุ {sum.expiringSoon}</Badge>}
                            {sum.sealed + sum.working > 0 && sum.expired === 0 && sum.expiringSoon === 0 && <Badge className="bg-emerald-100 text-emerald-700 text-xs">ปกติ</Badge>}
                          </div>
                        );
                      })()}
```

ในคอลัมน์ Actions ของแต่ละแถว เพิ่มปุ่ม "รับเข้า (ขวด)" และ "รายขวด" — แทนที่ปุ่ม deduct/receive เดิม (`setMoving(...)`) ด้วย:
```tsx
                          <Button size="icon" variant="ghost" title="รับเข้า (ขวด)" onClick={() => setReceiving(item)}><ArrowDownToLine className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" title="รายขวด" onClick={() => setDrawer(item)}><Package className="w-4 h-4" /></Button>
```
และทำให้คลิกที่ชื่อเปิด drawer: เปลี่ยน `<TableCell className="font-medium">{item.name}</TableCell>` เป็น:
```tsx
                      <TableCell className="font-medium">
                        <button type="button" className="hover:underline text-left" onClick={() => setDrawer(item)}>{item.name}</button>
                      </TableCell>
```

ท้าย `return` ของ StandardsTab (ก่อนปิด `</div>` นอกสุด) เพิ่ม render drawer + receive:
```tsx
      {drawer && <UnitsDrawer standard={drawer} onClose={() => setDrawer(null)} />}
      {receiving && (
        <ReceiveBottlesDialog
          standard={receiving}
          onClose={() => setReceiving(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["stock", "units"] }); }}
        />
      )}
```

> ลบ state/JSX ที่อ้าง `moving`/`StandardMoveDialog` ออกถ้าไม่ใช้แล้ว เพื่อไม่ให้ tsc เตือน unused (หรือคงไว้ก็ได้ถ้าไม่ error). อย่างน้อยลบการเรียก `<StandardMoveDialog .../>` ที่ผูกกับ `moving` ของ StandardsTab.

- [ ] **Step 2: ปุ่มสแกนลอย + เลือก action ตามสถานะ** — ใน `StockPage` (ล่างสุดไฟล์) ครอบด้วย state + ปุ่มลอย:

แก้ `const StockPage = () => { return ( <AppLayout> ... </AppLayout> ); };` เป็น:
```tsx
const StockPage = () => {
  const [scanOpen, setScanOpen] = useState(false);
  const [scannedQr, setScannedQr] = useState<string | null>(null);
  const [scannedUnit, setScannedUnit] = useState<StockUnitItem | null>(null);
  const [action, setAction] = useState<"withdraw" | "discard" | null>(null);
  const qc = useQueryClient();

  const onScanned = async (qrId: string) => {
    setScanOpen(false);
    setScannedQr(qrId);
    try {
      const u = await api.getStockUnit(qrId);
      setScannedUnit(u);
    } catch (err) {
      toast.error((err as Error).message);
      setScannedQr(null);
    }
  };
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["stock", "units"] });
    qc.invalidateQueries({ queryKey: ["stock", "transactions"] });
  };
  const closeScanned = () => { setScannedQr(null); setScannedUnit(null); setAction(null); };

  return (
    <AppLayout>
      <PageHeader
        className="mb-6"
        title={<span className="inline-flex items-center gap-2"><Package className="w-6 h-6" /> Stock Management</span>}
        description="จัดการ inventory: Standards, สารเคมี, เครื่องแก้ว — บันทึกข้อมูลใน MongoDB"
      />
      <Tabs defaultValue="standard">
        <TabsList className="mb-4 flex-wrap h-auto">
          <TabsTrigger value="standard">Standards</TabsTrigger>
          <TabsTrigger value="solvent">สารเคมี</TabsTrigger>
          <TabsTrigger value="glassware">เครื่องแก้ว</TabsTrigger>
          <TabsTrigger value="history">ประวัติ</TabsTrigger>
        </TabsList>
        <TabsContent value="standard"><StandardsTab /></TabsContent>
        <TabsContent value="solvent"><SolventsTab /></TabsContent>
        <TabsContent value="glassware"><GlasswareTab /></TabsContent>
        <TabsContent value="history"><HistoryTab /></TabsContent>
      </Tabs>

      <Button
        className="fixed bottom-6 right-6 rounded-full shadow-lg h-14 w-14 p-0"
        title="สแกน QR ขวด" onClick={() => setScanOpen(true)}
      >
        <ScanLine className="w-6 h-6" />
      </Button>

      <StockQrScanner open={scanOpen} onClose={() => setScanOpen(false)} onScanned={onScanned} />

      {/* เลือก action หลังสแกน */}
      {scannedQr && scannedUnit && !action && (
        <Dialog open onOpenChange={(o) => { if (!o) closeScanned(); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{scannedUnit.itemName}</DialogTitle>
              <DialogDescription>
                {scannedUnit.itemCode} · {scannedUnit.kind === "working" ? "working" : "คงคลัง"} · เหลือ {scannedUnit.volume?.remaining} {scannedUnit.volume?.unit}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 py-2">
              {scannedUnit.status === "discarded" ? (
                <p className="text-destructive font-medium text-center">ขวดนี้ถูกทิ้งแล้ว ใช้งานต่อไม่ได้</p>
              ) : (
                <>
                  {scannedUnit.kind === "sealed" && (
                    <Button onClick={() => setAction("withdraw")}>แบ่งใช้ → working</Button>
                  )}
                  <Button variant="destructive" onClick={() => setAction("discard")}>ทิ้งขวด</Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {scannedQr && action === "withdraw" && (
        <WithdrawDialog qrId={scannedQr} onClose={closeScanned} onSaved={refresh} />
      )}
      {scannedQr && action === "discard" && (
        <DiscardDialog qrId={scannedQr} onClose={closeScanned} onSaved={refresh} />
      )}
    </AppLayout>
  );
};
```

> ตรวจว่า import `toast` (จาก "sonner"), `Dialog/DialogContent/...`, `Button`, `useQueryClient` มีอยู่แล้วในไฟล์ (StandardsTab ใช้อยู่) — `toast`, dialog, button มีแล้ว; `useQueryClient` import แล้ว.

- [ ] **Step 3: scan page** — `src/pages/StockUnitScanPage.tsx`

```tsx
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Package } from "lucide-react";
import AppLayout from "@/components/lis/AppLayout";
import PageHeader from "@/components/lis/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { unitDerivedStatus } from "@/lib/stockUnit";
import WithdrawDialog from "@/components/lis/stock/WithdrawDialog";
import DiscardDialog from "@/components/lis/stock/DiscardDialog";

export default function StockUnitScanPage() {
  const { qrId = "" } = useParams();
  const qc = useQueryClient();
  const [action, setAction] = useState<"withdraw" | "discard" | null>(null);

  const { data: unit, isLoading, error } = useQuery({
    queryKey: ["stock", "unit", qrId],
    queryFn: () => api.getStockUnit(qrId),
    enabled: !!qrId,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["stock", "unit", qrId] });
  const st = unit ? unitDerivedStatus(unit) : null;

  return (
    <AppLayout>
      <PageHeader className="mb-6" title={<span className="inline-flex items-center gap-2"><Package className="w-6 h-6" /> ขวด Standard</span>} description={qrId} />
      {isLoading && <p className="text-muted-foreground">กำลังโหลด...</p>}
      {error && <p className="text-destructive">ไม่พบขวดนี้</p>}
      {unit && (
        <Card className="max-w-md">
          <CardContent className="p-5 space-y-2">
            <div className="text-lg font-bold">{unit.itemName}</div>
            <div className="text-sm text-muted-foreground">{unit.itemCode} · Lot {unit.lotNo || "-"}</div>
            <div className="flex gap-2 text-sm">
              <Badge variant="outline">{unit.kind === "working" ? "working" : "คงคลัง"}</Badge>
              <span>เหลือ {unit.volume?.remaining} {unit.volume?.unit}</span>
              <span>EXP {unit.exp ? new Date(unit.exp).toLocaleDateString("th-TH") : "-"}</span>
            </div>
            <div className="pt-3 flex flex-col gap-2">
              {st === "discarded" ? (
                <p className="text-destructive font-medium">ขวดนี้ถูกทิ้งแล้ว ใช้งานต่อไม่ได้</p>
              ) : (
                <>
                  {unit.kind === "sealed" && st === "active" && <Button onClick={() => setAction("withdraw")}>แบ่งใช้ → working</Button>}
                  <Button variant="destructive" onClick={() => setAction("discard")}>ทิ้งขวด</Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      {action === "withdraw" && <WithdrawDialog qrId={qrId} onClose={() => setAction(null)} onSaved={refresh} />}
      {action === "discard" && <DiscardDialog qrId={qrId} onClose={() => setAction(null)} onSaved={refresh} />}
    </AppLayout>
  );
}
```

- [ ] **Step 4: route** — ใน `src/App.tsx` เพิ่ม import และ route. ใต้ `import Stock from "./pages/Stock";` เพิ่ม:
```tsx
import StockUnitScanPage from "./pages/StockUnitScanPage";
```
ใต้ `<Route path="/stock" ... />` (บรรทัด ~94) เพิ่ม:
```tsx
              <Route path="/stock/scan/:qrId" element={<PrivateRoute><StockUnitScanPage /></PrivateRoute>} />
```

- [ ] **Step 5: type-check** — Run: `npx tsc --noEmit` → ไม่มี error ใหม่

- [ ] **Step 6: Commit**

```bash
git add src/pages/Stock.tsx src/pages/StockUnitScanPage.tsx src/App.tsx
git commit -m "feat(stock): per-bottle Standards UI, scan flow, scan page + route"
```

---

## Task 15: Final verification + seed-data

**Files:** (none new — verification)

- [ ] **Step 1: รัน test ทั้งชุด**

Run: `npm run test`
Expected: ผ่านทั้งหมด รวม `stockUnit.test.ts`

- [ ] **Step 2: type-check + lint**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

Run: `npm run lint`
Expected: ไม่มี error ใหม่จากไฟล์ที่เพิ่ม (เตือนเดิมของไฟล์อื่นปล่อยได้)

- [ ] **Step 3: smoke test end-to-end (manual, ต้องมี server + dev รัน)**

1. เปิด `npm run dev` + `cd server && npm run dev`
2. หน้า Stock → tab Standards → ปุ่ม "รับเข้า (ขวด)" → กรอก 2 ขวด EXP ต่างกัน → บันทึก
3. คลิกชื่อสาร → drawer แสดง 2 ขวด sealed
4. กด "แบ่ง working" ขวดหนึ่ง → กรอก 20 ml → working ขวดใหม่โผล่ใน drawer, sealed remaining ลดลง
5. กดปุ่มสแกนลอย → (หรือกรอก qrId มือใน fallback) ใส่ qrId ของ working → เลือก "ทิ้งขวด" → ยืนยัน
6. สแกน/เปิด qrId เดิมอีกครั้ง → ขึ้น "ขวดนี้ถูกทิ้งแล้ว ใช้งานต่อไม่ได้"

> หมายเหตุปริ้น/กล้อง: ปริ้นต้องตั้ง `stock-label` ที่หน้าตั้งค่าระบบ + `PRINT_CHROME_PATH` ก่อน; กล้องต้องเป็น https/localhost. ถ้ายังไม่ตั้ง ใช้ fallback กรอก qrId มือได้.

- [ ] **Step 4: seed-data export**

Run: `cd server && npm run seed:export`
Expected: สร้าง/อัปเดต `server/seed-data/stockunits.json` (collection ใหม่) + ไฟล์อื่น

- [ ] **Step 5: Commit seed-data**

```bash
git add server/seed-data
git commit -m "chore(stock): seed-data export incl. stockunits collection"
```

---

## Self-Review Notes

- **Spec coverage:** Data model (T1–T2, T7) · working/EXP cap (T3, T5) · receive รายขวด+EXP รายขวด (T4, T10) · withdraw atomic (T5, T11) · discard+QR ตาย (T6, T12) · expired guard (T3,T5,T6,UI) · QR gen+URL (T4,T8) · ปริ้น stock-label (T8,T10,T11) · กล้องสแกน+fallback (T9,T14) · UI summary+drawer+scan page (T13,T14) · seed-data (T15). ครบ.
- **เปลี่ยนจาก spec เล็กน้อย:** "reprint endpoint" → ทำเป็น frontend-only (re-render label จาก unit ที่ fetch มา ไม่ต้องมี backend endpoint) — เห็นใน UnitsDrawer.reprint.
- **Mirror logic:** `computeWorkingExp`/`addShelfLife` มีทั้งใน `src/lib/stockUnit.ts` (ทดสอบ) และ inline ใน `server/routes/stock.js` (มี comment ชี้); ตรงกับ pattern เดิมที่ `printConfig.ts` mirror `print.js`.
- **Naming consistency:** `qrId`, `volume.remaining`, `kind`('sealed'|'working'), `status`('active'|'empty'|'discarded'), action 'withdraw'/'discard' ใช้ตรงกันทั้ง model/route/type/UI.
