# Standard Config — Redesign v2 (Design Spec)

**Date**: 2026-06-01
**Status**: Draft (pending user review)
**Supersedes**: `2026-05-29-standard-config-design.md`
**Scope**: Phase 1 — config-only (เก็บค่าจำนวนครั้งที่ใช้ standard ต่อเครื่อง/ต่อสาร).
การ match ตอนรันจริง + ตัดสต็อก ยกไป Phase 2 (ไม่เปลี่ยนจากเดิม).

> **ทำไมเขียนใหม่**: เวอร์ชัน 2026-05-29 เก็บ 1 แถว = 1 keyword โดยมีทั้ง `gcTimes` และ
> `hplcTimes` รวมในแถวเดียว และ match สารแบบ contains ใน commonName. ของจริงที่
> ต้องการคือ: **มีค่า default ต่อเครื่องที่ลบไม่ได้** (GC=3, HPLC=1) แล้วตั้งค่าเฉพาะ
> รายสารทับ default ได้ โดย **1 แถว = 1 เครื่อง** และระบุสารด้วยการ**เลือก commonName
> ตรงตัว** (ไม่ใช่ keyword contains).

## Purpose

หน้า `/standard-config` ให้ผู้ใช้กำหนดว่า "บนเครื่อง GC / HPLC ปกติใช้ standard กี่ครั้ง"
แบ่งเป็น 2 ระดับ:

1. **ค่า default ต่อเครื่อง** (scope = `all`) — ใช้กับสารทุกตัวที่ไม่ได้ตั้งค่าเฉพาะ.
   มี 2 แถวตายตัว: `GC = 3`, `HPLC = 1`. แก้จำนวนครั้งได้ แต่**ลบไม่ได้**.
2. **ค่าเฉพาะรายสาร** (scope = `substance`) — เลือก commonName + เครื่อง + จำนวนครั้ง.
   เพิ่ม/แก้/ลบ ได้อิสระ. เป็นการ "override" ค่า default ของเครื่องนั้นสำหรับสารนั้น.

Phase 1 แค่เก็บค่า — ยังไม่ตัดสต็อกและยังไม่ผูกกับ flow จริง.

## Decisions (locked)

| หัวข้อ | ค่าที่ตกลง |
|---|---|
| โครงแถว | **1 แถว = 1 เครื่อง** (ไม่รวม GC/HPLC ในแถวเดียว) |
| Default | แยกต่อเครื่อง — 2 แถว `GC/all/3`, `HPLC/all/1`, `isDefault=true`, ลบไม่ได้ |
| แก้ default | แก้ได้แค่ `times` (+ `note`); เปลี่ยน instrument/scope/commonName ไม่ได้ |
| ระบุสารเฉพาะ | เลือก **commonName ตรงตัว** จากรายการ master (ไม่ใช่ keyword contains) |
| เพิ่มสารทั้ง 2 เครื่อง | ทำทีละแถว — ไม่มีโหมด "ทั้งสอง" ในฟอร์มเดียว |
| `times` | จำนวนเต็ม **≥ 1** (สูงสุด 100000) |
| Uniqueness | unique ที่ `(instrument, scope, commonNameLower)` — 1 commonName ใส่ได้ทั้ง GC และ HPLC (คนละแถว) แต่ห้ามซ้ำเครื่องเดียวกัน |
| ข้อมูลเก่า | **ทิ้งทั้งหมด เริ่มใหม่** (DB ปัจจุบันว่างอยู่แล้ว — `[]`); ไม่เขียน migration |

## Data Model — `StandardConfig` (เขียนใหม่ทับของเดิม)

```js
{
  instrument:      'GC' | 'HPLC',          // required
  scope:           'all' | 'substance',    // required
  commonName:      String | null,          // required(non-empty) เมื่อ scope='substance'; null เมื่อ scope='all'
  commonNameLower: String | null,          // lowercased+trimmed; null เมื่อ scope='all' — ใช้ทำ unique + lookup
  times:           Number,                 // required, จำนวนเต็ม 1..100000
  isDefault:       Boolean,                // default false; true = แถว default (ลบไม่ได้)
  note:            String,                 // default ''
}
// timestamps: true
// compound unique index: { instrument: 1, scope: 1, commonNameLower: 1 }
```

หมายเหตุ index: แถว default มี `commonNameLower = null`. MongoDB ถือว่า `null` เป็นค่า
หนึ่งใน unique index ปกติ ดังนั้น `(GC, all, null)` กับ `(HPLC, all, null)` ไม่ชนกัน
(instrument ต่างกัน) และกัน default ซ้ำของเครื่องเดียวกันได้เอง.

### Type (frontend) — `src/lib/standardConfig.ts`

```ts
export type Instrument = "GC" | "HPLC";
export type Scope = "all" | "substance";

export type StandardConfigDoc = {
  _id: string;
  instrument: Instrument;
  scope: Scope;
  commonName: string | null;
  commonNameLower: string | null;
  times: number;
  isDefault: boolean;
  note: string;
  createdAt?: string;
  updatedAt?: string;
};

export type StandardConfigInput = {
  instrument: Instrument;
  scope: Scope;
  commonName: string | null;
  times: number | null;
  note?: string;
};
```

## Default seeding

แถว default 2 แถวต้องมีอยู่เสมอ แม้ DB ถูกล้าง.

- **กลไก**: `GET /standard-configs` ทำ **lazy ensure** ก่อนคืนผล — ถ้าไม่พบแถว
  `{instrument:'GC', scope:'all'}` หรือ `{instrument:'HPLC', scope:'all'}` ให้
  `insert` ด้วยค่าเริ่ม `GC=3`, `HPLC=1`, `isDefault=true`, `note=''` (ใช้
  `updateOne(..., {$setOnInsert}, {upsert:true})` กัน race).
- เลือก lazy-ensure แทน boot-seed เพราะกู้คืนได้เองหลัง DB wipe และไม่ต้องแตะ
  `ensureCollections()`.
- `seed-data/standardconfigs.json` เขียนใหม่ให้มี 2 แถว default (ค่าเริ่มต้น) เพื่อให้
  `seed:import` ได้ผลตรงกัน.

## API — `/api/standard-configs` (และ `/LIS/api/...` ผ่าน `mountApi`)

| Method | Path | หมายเหตุ |
|---|---|---|
| GET | `/` | lazy-ensure 2 default → คืนทั้งหมด (เรียง default บนสุด, แล้วตามด้วย commonName) |
| POST | `/` | สร้างแถวสารเฉพาะ (`scope='substance'`). กัน `(instrument, commonName)` ซ้ำ → 409. ห้ามสร้าง `scope='all'` ผ่าน API → 400 |
| PUT | `/:id` | แถว default: แก้ได้แค่ `times`/`note` (ฟิลด์อื่นถูกเมิน). แถวสาร: แก้ `instrument`/`commonName`/`times`/`note` ได้ + เช็คชนซ้ำ |
| DELETE | `/:id` | ถ้า `isDefault=true` → **403** (`{message:'ลบค่าตั้งต้นไม่ได้'}`). อื่น ๆ ลบได้ |

### Validation (server + แชร์ helper ฝั่ง client)

ย้าย logic ตรวจค่าไป `src/lib/standardConfig.ts` (unit-test ได้) และให้ route ฝั่ง
server ตรวจซ้ำ:

- `instrument` ต้องเป็น `'GC'` หรือ `'HPLC'`.
- `scope` ต้องเป็น `'all'` หรือ `'substance'`.
- `times`: ต้องเป็นจำนวนเต็ม `1..100000` (ปฏิเสธ null/ติดลบ/ทศนิยม/NaN/เกิน).
- `scope='substance'` → `commonName` trim แล้วต้องไม่ว่าง (≤ 200 ตัว).
- `scope='all'` → ห้ามมาจาก POST (สร้างได้เฉพาะผ่าน lazy-ensure).
- duplicate `(instrument, commonNameLower)` → 409.

### Error shape

- `400` validation: `{ message, field }` (`field` ∈ instrument|commonName|times|scope)
- `403` ลบ default: `{ message }`
- `404` not found: `{ message }`
- `409` duplicate: `{ message, field: 'commonName' }`
- `500`: `{ message }`

### Permissions

- Module `master` (เหมือน MasterItems / SimpleMethod / ParameterSettings).
- อ่าน = `master` read; เขียน (POST/PUT/DELETE) = `master` write.
- Frontend gate ปุ่ม เพิ่ม/แก้/ลบ ด้วย permission `master`.

## UI — หน้าเดียว (`src/pages/StandardConfig.tsx`)

```
┌─ Standard Config ─────────────────────────────────────────────┐
│  ตั้งค่าจำนวนครั้งที่ใช้ standard ต่อเครื่อง/ต่อสาร (ใช้ตัดสต็อกในอนาคต) │
│  🔍 ค้นหาชื่อสาร...                              [+ เพิ่มสาร]      │
├────────────────────────────────────────────────────────────────┤
│  เครื่อง   เป้าหมาย              จำนวนครั้ง   หมายเหตุ        ⋯   │
│  ──────   ──────────────────   ─────────   ──────────         │
│  GC       ทั้งหมด [ค่าตั้งต้น]      3 ครั้ง                  ✏      │  ← ไม่มีปุ่มลบ
│  HPLC     ทั้งหมด [ค่าตั้งต้น]      1 ครั้ง                  ✏      │  ← ไม่มีปุ่มลบ
│  GC       ANILOFOS               5 ครั้ง    ...            ✏ 🗑   │
│  HPLC     ANILOFOS               2 ครั้ง               ✏ 🗑   │
│  GC       GLYPHOSATE             4 ครั้ง               ✏ 🗑   │
└────────────────────────────────────────────────────────────────┘
```

### ตาราง / แถว

- คอลัมน์: **เครื่อง** (GC/HPLC), **เป้าหมาย** (commonName หรือ "ทั้งหมด" + badge
  `ค่าตั้งต้น` เมื่อ `isDefault`), **จำนวนครั้ง** (`N ครั้ง`), **หมายเหตุ**, ปุ่มแก้/ลบ.
- เรียง: 2 แถว default บนสุดเสมอ → ตามด้วยสารเฉพาะ (เรียงตาม commonName, แล้ว instrument).
- ปุ่ม **ลบ**: ซ่อนสำหรับแถว `isDefault`. ลบสารมี confirm dialog.
- ปุ่ม แก้/ลบ แสดงเมื่อมีสิทธิ์ `master` write.
- ค้นหา: substring บน commonName. **แถว default โชว์เสมอ** ไม่ถูกกรองออกแม้ search ไม่ match (เป็นค่าอ้างอิงที่ต้องเห็นตลอด).

### Dialog — เพิ่มสาร / แก้

**เพิ่มสาร (scope='substance')**:
```
┌─ เพิ่มสาร ──────────────────────────────────┐
│ เครื่อง *        ( ) GC   ( ) HPLC           │
│ สาร (commonName) *  [ เลือกจากรายการ ▾ ]     │
│ จำนวนครั้ง *     [   1   ]   (≥ 1)           │
│ หมายเหตุ        [ ____________________ ]     │
│            [ ยกเลิก ]      [ บันทึก ]         │
└──────────────────────────────────────────────┘
```
- **เครื่อง**: radio GC/HPLC (required).
- **สาร**: combobox เลือก commonName **ตรงตัว** จากรายการ distinct ของ master items
  (React Query cache `master-items`). ต้องเลือกจากรายการ (ไม่รับค่าพิมพ์เองที่ไม่ตรง).
- **จำนวนครั้ง**: `<input type=number min=1 step=1>`.
- บันทึก → POST → ปิด dialog → toast → refetch.

**แก้แถว default (isDefault=true)**:
- Dialog เดียวกันแต่ **ล็อก** เครื่อง + เป้าหมาย ("ทั้งหมด") — แก้ได้เฉพาะ `จำนวนครั้ง`
  (+ หมายเหตุ). หัวข้อ dialog = "แก้ค่าตั้งต้น (เครื่อง X)".

**แก้แถวสาร**:
- แก้ได้ทุกฟิลด์ (เครื่อง/สาร/จำนวนครั้ง/หมายเหตุ) → PUT.

### Errors (frontend)

- Network/500 → toast `บันทึกไม่สำเร็จ — ลองอีกครั้ง`; คง dialog ไว้.
- 400 → inline error ใต้ field (จาก `field`).
- 409 → inline error ใต้ commonName: "สารนี้มีค่าของเครื่องนี้แล้ว".
- 403 (ลบ default) → toast (ปกติ UI ซ่อนปุ่มลบอยู่แล้ว เป็น guard ชั้นสอง).

## Data layer — `src/lib/api.ts`

- ปรับ `getStandardConfigs` → คืน `StandardConfigDoc[]` (รวม default).
- `createStandardConfig(data)` → POST.
- `updateStandardConfig(id, data)` → PUT.
- `deleteStandardConfig(id)` → DELETE.
- ลบ field/type เดิม (`keyword`, `gcTimes`, `hplcTimes`, `nameLower`) ออกจาก type/calls.
- React Query key คงเดิม: `['standard-configs']`. Invalidate หลัง mutate.

## Testing

### Unit (Vitest) — `src/lib/standardConfig.test.ts` (rewrite)

- `times`: ปฏิเสธ null/0/ติดลบ/ทศนิยม/NaN/`>100000`; รับ 1..100000.
- `instrument` นอกเหนือ GC/HPLC → error.
- `scope='substance'` ไม่มี commonName → error; commonName ยาวเกิน → error.
- `scope='all'` ผ่าน input ปกติ (POST) → error (สร้างไม่ได้).

### Component (Vitest + RTL) — `src/pages/__tests__/StandardConfig.test.tsx` (rewrite)

- render: 2 แถว default โชว์ badge `ค่าตั้งต้น` + ไม่มีปุ่มลบ.
- แถวสารมีปุ่มลบ.
- ฟอร์มเพิ่มสาร: เลือกเครื่อง + commonName + จำนวนครั้ง → submit → เรียก
  `createStandardConfig` ด้วย payload `{instrument, scope:'substance', commonName, times}`.
- แก้ default: เครื่อง/เป้าหมายถูกล็อก, แก้ได้แค่จำนวนครั้ง.
- ปุ่มเพิ่ม/แก้/ลบ ซ่อนเมื่อไม่มีสิทธิ์ write.

### Manual / Playwright (smoke, optional)

- เปิดหน้า → เห็น 2 default (GC 3, HPLC 1).
- เพิ่ม GC + ANILOFOS + 5 → reload → ยังอยู่.
- ลองลบ default → ไม่มีปุ่ม/ถูกบล็อก.
- ลบสาร → หายจาก list.

## Out of Scope (Phase 2+)

- การ resolve runtime: เลือกค่า standard ของสาร X บนเครื่อง Y (ใช้ค่าเฉพาะถ้ามี ไม่งั้น default) + ตัดสต็อก.
- ปริมาตร/หน่วยต่อครั้ง.
- Audit log / version history / bulk import-export.

## Files Touched

**เขียนใหม่:**
- `server/models/StandardConfig.js` (schema ใหม่ + compound unique index)
- `server/routes/standardConfigs.js` (lazy-ensure default, CRUD, delete guard, validation)
- `src/lib/standardConfig.ts` (types + validation helper)
- `src/pages/StandardConfig.tsx` (UI ใหม่: ตาราง + dialog)
- `src/lib/standardConfig.test.ts` (rewrite)
- `src/pages/__tests__/StandardConfig.test.tsx` (rewrite)
- `server/seed-data/standardconfigs.json` (2 default rows)

**แก้:**
- `src/lib/api.ts` (ปรับ standard-config funcs/type ตาม schema ใหม่)

**คงไว้:**
- route `/standard-config` (App.tsx) + nav entry (navItems.ts) — มีอยู่แล้ว
- mount `/standard-configs` ใน `server/index.js` — มีอยู่แล้ว

## Note (นอก scope งานนี้)

ระหว่าง brainstorm พบบั๊กแยกต่างหาก: root `index.html` ถูกเขียนทับด้วยไฟล์ build →
`/LIS/LIS/...` 404 ทั้งแอป. แก้แล้วด้วย `node scripts/restore-index.mjs` (ไม่เกี่ยวกับ
redesign นี้ บันทึกไว้กันลืม).
