# Standard Config — Design Spec (Redesign)

**Date**: 2026-05-29
**Status**: Approved (pending impl plan)
**Scope**: Phase 1 — config-only (เก็บค่าจำนวนครั้งที่ใช้ standard). การ match กับ
commonName ตอนรันจริง + ตัดสต็อก ยกไป Phase 2.

> **หมายเหตุ**: spec นี้ **เขียนใหม่ทั้งหมด** แทนของเดิม (เวอร์ชัน override + auto-sync
> + 2 tabs) ที่ over-engineered ไป. แนวใหม่เรียบง่าย: หน้าเดียว, ฟอร์มกรอก, match
> keyword ใน commonName, เก็บ "จำนวนครั้ง" ที่ปกติใช้ std ต่อเครื่อง (GC/HPLC).

## Purpose

หน้า `/standard-config` ให้ผู้ใช้บันทึกว่า "สาร (ที่ระบุด้วย keyword ใน commonName)
ปกติใช้ standard กี่ครั้งบนเครื่อง GC และ HPLC". Phase 1 แค่เก็บค่าไว้ — ยังไม่ตัดสต็อก.

## สิ่งที่เปลี่ยนจากเวอร์ชันเดิม (ลบทิ้ง)

- ❌ collection `StandardOverride` + route `/standard-overrides` + `OverridesTab`
- ❌ auto-sync รายชื่อสารจาก master items (`POST /standard-configs/sync`) + `SubstancesTab`
- ❌ การ parse substance รายตัว / positional instruments / slots / unit / enabled
- ❌ `resolveStandardConfig.ts` (lookup ผูกกับ override — ยกการ match ไป Phase 2)
- ❌ แยกเป็น 2 tabs

## Glossary

- **Keyword**: คำที่ผู้ใช้กรอก ใช้ค้นแบบ contains (case-insensitive) ใน commonName
  ของสินค้า เช่น `"ANILOFOS"`. พิมพ์เองก็ได้ หรือเลือกจาก commonName ที่มีใน master.
- **จำนวนครั้ง (times)**: จำนวนเต็ม ≥ 0 — ปกติเตรียม/ใช้ standard กี่ครั้งบนเครื่องนั้น.
- **Instrument**: `GC` หรือ `HPLC` (1 entry เก็บค่าของทั้งสองเครื่อง).

## Architecture

### Frontend

- หน้าเดียว: `src/pages/StandardConfig.tsx` mounted ที่ `/standard-config`
  (route + nav entry มีอยู่แล้ว — คงไว้).
- เลย์เอาต์: list (table) + ปุ่ม "เพิ่ม Standard" → dialog ฟอร์ม (สร้าง/แก้).
  ไม่มี `Tabs`.
- ลบโฟลเดอร์ย่อย `src/pages/standardConfig/` (OverridesTab, SubstancesTab) ทิ้ง;
  ย้าย type ที่จำเป็นไปไว้ที่เดียว (ดู Data layer).

### Backend

- เขียนใหม่ `server/models/StandardConfig.js` (schema ใหม่ด้านล่าง).
- เขียนใหม่ `server/routes/standardConfigs.js` (CRUD ล้วน, ไม่มี `/sync`).
- ลบ `server/models/StandardOverride.js`, `server/routes/standardOverrides.js`.
- ลบ mount `/standard-overrides` ใน `server/index.js`.
- `server/utils/substances.js`: หลังลบ sync จะไม่มีคนใช้ → ลบทิ้ง
  (ตรวจ grep ยืนยันก่อนลบ; ฝั่ง frontend `src/lib/substances.ts` **คงไว้** เพราะ
  `MasterItems.tsx` + `PetitionAssignPage.tsx` ยังใช้).

### Data layer

- `src/lib/api.ts`:
  - คง/ปรับ: `getStandardConfigs`, `createStandardConfig`, `updateStandardConfig`,
    `deleteStandardConfig` (เปลี่ยน key จาก `nameLower` → `id`).
  - ลบ: `syncStandardConfigs`, และทุกฟังก์ชัน `*StandardOverride*`.
- React Query key: `['standard-configs']`. Refetch หลัง create/update/delete.
- Type `StandardConfigDoc` ใหม่ (ดูด้านล่าง) — เก็บใน `src/lib/api.ts` หรือไฟล์ type
  เดี่ยว; ลบ `src/pages/standardConfig/types.ts` (override/slot types เลิกใช้).

## Data Model

### `StandardConfig` (ใหม่)

```js
{
  keyword: String,        // required — คำที่ค้นใน commonName (เก็บ casing เดิม), ≤ 200 ตัว
  keywordLower: String,   // required, unique, indexed — lowercased+trimmed กันซ้ำ + lookup
  gcTimes:   Number,      // default null — จำนวนครั้งบน GC   (จำนวนเต็ม ≥ 0)
  hplcTimes: Number,      // default null — จำนวนครั้งบน HPLC (จำนวนเต็ม ≥ 0)
  note: String,           // default '' — หมายเหตุ (optional)
}
// timestamps: true
```

### Type (frontend)

```ts
export type StandardConfigDoc = {
  _id: string;
  keyword: string;
  keywordLower: string;
  gcTimes: number | null;
  hplcTimes: number | null;
  note: string;
  createdAt?: string;
  updatedAt?: string;
};
```

## API — `/api/standard-configs`

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | list ทั้งหมด |
| `POST` | `/` | สร้าง entry ใหม่. กันซ้ำ `keywordLower` → 409 |
| `PUT` | `/:id` | แก้ `keyword` / `gcTimes` / `hplcTimes` / `note` |
| `DELETE` | `/:id` | ลบ entry |

### Validation rules (server)

- `keyword`: trim แล้วต้องไม่ว่าง, ≤ 200 ตัว.
- `gcTimes` / `hplcTimes`: ถ้าส่งมา ต้องเป็นจำนวนเต็ม `≥ 0` และ `≤ 100000`
  (ค่าว่าง/`null` = ไม่ใช้เครื่องนั้น).
- ต้องมีอย่างน้อย 1 ใน `gcTimes` / `hplcTimes` ที่ `> 0` (ไม่งั้น 400).
- `keywordLower` unique → POST/PUT ที่ชนกัน return 409.
- เปลี่ยน `keyword` ใน PUT ได้ (อัปเดต `keywordLower` ตาม + เช็คชนซ้ำ).

### Permissions

- Module: `master` (เหมือน MasterItems / SimpleMethod / ParameterSettings).
- อ่าน: `master` read. เขียน (POST/PUT/DELETE): `master` write.
- Frontend gate ปุ่ม เพิ่ม/แก้/ลบ ด้วย permission `master`.

### Error shape

- `400` validation: `{ message, field }`
- `404` not found: `{ message }`
- `409` duplicate: `{ message, field: 'keyword' }`
- `500` server error: `{ message }`

## UI — หน้าเดียว

```
┌─ Standard Config ───────────────────────────────────────┐
│  ตั้งค่าจำนวนครั้งที่ใช้ standard ต่อสาร (ใช้ตัดสต็อกในอนาคต) │
│  🔍 ค้นหา keyword...                   [+ เพิ่ม Standard]  │
├──────────────────────────────────────────────────────────┤
│  Keyword (ใน commonName)   GC       HPLC      หมายเหตุ  ⋯ │
│  ───────────────────────   ───────  ────────  ────────    │
│  ANILOFOS                  3 ครั้ง   —          ...    ✏ 🗑│
│  BISPYRIBAC                —         2 ครั้ง    ...    ✏ 🗑│
│  GLYPHOSATE                2 ครั้ง   1 ครั้ง    ...    ✏ 🗑│
└──────────────────────────────────────────────────────────┘
```

### Row / list

- คอลัมน์: Keyword, GC (จำนวนครั้ง หรือ `—`), HPLC (จำนวนครั้ง หรือ `—`),
  หมายเหตุ, ปุ่มแก้/ลบ.
- ค้นหา: substring บน `keyword` (debounce ~200ms).
- ปุ่ม แก้/ลบ แสดงเมื่อมีสิทธิ์ `master` write. ลบมี confirm dialog.

### ฟอร์ม (dialog) — เพิ่ม / แก้

```
┌─ เพิ่ม Standard ────────────────────────────────────┐
│ Keyword (ในชื่อ commonName) *                        │
│   [ ค้นหา/พิมพ์ keyword ▾ ]                          │
│   ↳ พิมพ์เองได้ หรือเลือกจาก commonName ที่มีในระบบ   │
│   ↳ match แบบ "มีคำนี้อยู่ในชื่อ" (contains)         │
│                                                      │
│ GC — จำนวนครั้ง    [   3   ]                         │
│ HPLC — จำนวนครั้ง  [       ]                         │
│   (อย่างน้อยต้องกรอก 1 เครื่อง)                       │
│                                                      │
│ หมายเหตุ          [ _______________________ ]        │
│                                                      │
│              [ ยกเลิก ]   [ บันทึก ]                  │
└──────────────────────────────────────────────────────┘
```

- **Keyword**: combobox/autocomplete — รายการ suggestion ดึงจาก commonName ของ
  master items ที่อยู่ใน cache (React Query) แต่ผู้ใช้พิมพ์ค่าอื่นเองได้ด้วย.
  ค่าที่เก็บคือ string ที่กรอก; การ match ตอน Phase 2 = `commonName.toLowerCase()`
  `.includes(keyword.toLowerCase())`.
- **GC / HPLC จำนวนครั้ง**: `<input type=number min=0 step=1>`; ว่าง = ไม่ใช้.
- **หมายเหตุ**: optional, textarea/​input สั้น.
- บันทึก → POST/PUT → ปิด dialog → toast → refetch list.

## Errors (frontend)

- Network / 500 → toast `บันทึกไม่สำเร็จ — ลองอีกครั้ง`; คง dialog ไว้ให้ลองใหม่.
- 400 → inline error ใต้ field (ใช้ `field` จาก response).
- 409 → inline error ใต้ keyword "keyword นี้มีอยู่แล้ว".

## Testing

### Unit (Vitest) — server validation helper

- กรอง `gcTimes`/`hplcTimes`: ปฏิเสธค่าติดลบ, ทศนิยม, NaN, `> 100000`.
- บังคับอย่างน้อย 1 เครื่อง `> 0`.
- `keyword` ว่าง/ยาวเกิน → 400.

### Component (Vitest + Testing Library)

- render list rows จาก mocked configs.
- ฟอร์มเพิ่ม: กรอก keyword + GC times → submit → เรียก `createStandardConfig`
  ด้วย payload ถูกต้อง.
- ปุ่มแก้/ลบ ถูกซ่อนเมื่อไม่มีสิทธิ์ write.
- combobox keyword: แสดง suggestion จาก master commonNames + ยอมรับค่าพิมพ์เอง.

### Manual / Playwright (smoke, optional)

- เพิ่ม keyword + จำนวนครั้ง → reload → ค่ายังอยู่.
- ลบ entry → หายจาก list.

## Out of Scope (Phase 2+)

- การ match keyword → commonName ตอนรันจริง + ตัดสต็อกตามจำนวนครั้ง.
- ปริมาตร/หน่วย (ml/µL) ต่อครั้ง — ตอนนี้เก็บแค่ "จำนวนครั้ง".
- Audit log / version history.
- Bulk import/export.

## Files Touched

**เขียนใหม่:**
- `server/models/StandardConfig.js`
- `server/routes/standardConfigs.js`
- `src/pages/StandardConfig.tsx`

**แก้:**
- `src/lib/api.ts` (ปรับ standard-config funcs → key by id; ลบ override/sync funcs; ลบ import จาก standardConfig/types)
- `server/index.js` (ลบ mount `/standard-overrides`)

**ลบ:**
- `server/models/StandardOverride.js`
- `server/routes/standardOverrides.js`
- `server/utils/substances.js` (หลังยืนยันไม่มีคนใช้)
- `src/pages/standardConfig/OverridesTab.tsx`
- `src/pages/standardConfig/SubstancesTab.tsx`
- `src/pages/standardConfig/types.ts`
- `src/lib/resolveStandardConfig.ts` + `src/lib/resolveStandardConfig.test.ts`

**คงไว้:**
- `src/lib/substances.ts` (+ test) — ใช้โดย MasterItems / PetitionAssignPage
- nav entry + route `/standard-config` (มีอยู่แล้ว)
