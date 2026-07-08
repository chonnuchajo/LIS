# เบิก Standard — กลุ่มเครื่อง (GC/HPLC) ดึงจาก simple method (ไม่มีปุ่มเลือกเครื่อง)

**วันที่:** 2026-07-08
**สถานะ:** design (approved, รอ spec review)
**ขอบเขต:** `StandardRequisitionDialog.tsx` (ฟอร์มเบิก Standard) + resolver lib ใหม่ + `StockTransaction` audit
**ต่อยอดจาก:** [2026-07-07-stock-standards-types-mg-requisition-design.md](2026-07-07-stock-standards-types-mg-requisition-design.md) §4 (เดิมมีปุ่มเลือกเครื่อง GC/HPLC)

---

## 1. ที่มา / ปัญหา

ฟอร์ม "เบิก Standard" ปัจจุบัน (`StandardRequisitionDialog.tsx`, commit `58962f4`) บังคับให้ **เลือกเครื่อง GC/HPLC เอง** ก่อน แล้วใช้ `group` ของเครื่องกำหนด default จำนวนน้ำหนัก (`gc`→3, `hplc`→1 ผ่าน `defaultWeightCount()`) และเก็บ `instrumentId/instrumentName` ลง `StockTransaction`

**ปัญหา:** คนเบิก Standard ไม่ควรต้องเลือกเครื่อง เพราะสารตัวหนึ่ง **ใช้กับ GC หรือ HPLC ตายตัวตาม simple method อยู่แล้ว** การให้เลือกเองซ้ำซ้อนและเปิดช่องเลือกผิด

**การตัดสินใจสถาปัตยกรรม (ผู้ใช้เคาะ):**
- **แหล่งจริง (source of truth) ของ group = simple method** — resolve จากสาร ไม่เก็บ field ที่ตัว `StockStandard`
- **ห้ามเพิ่ม field group ที่ standard** — ถ้าสารไหน resolve ไม่ได้ ให้ไปแก้ที่ simple method (ตำแหน่งสารในสินค้า) ไม่ใช่เติม override ที่ตัวสาร → กัน 2 แหล่งความจริง drift กัน

---

## 2. กลไก resolve: สาร → กลุ่มเครื่อง

Standard = **สารเดี่ยว** (เช่น `Abamectin`, `Atrazine`, `2,4-D Acid`) — ไม่ได้เป็น "A + B" ในตัวเอง
`SimpleMethod` เก็บ key ด้วย `itemNo` (สินค้า) + method code ราย-ตำแหน่งสาร (`methods: [["GC"], ...]`) — **ไม่มีชื่อสาร** ต้อง join กับ `commonName` ของสินค้า (จาก master-items) แล้ว `parseSubstances` เพื่อรู้ว่าสารไหนอยู่ตำแหน่งไหน

Reuse pattern เดียวกับ `PetitionAssignPage.tsx` (join `/master-items` + `/simple-methods`) แต่สร้าง **reverse index**:

```
substanceGroups : Map<matchSubstanceKey(สาร), Set<'gc'|'hplc'>>
```

**การ build (ต่อสินค้าที่มีทั้ง commonName + simple-method entry):**
1. `substances = parseSubstances(commonName)` (แยก "+" positional)
2. `slots = readSlotMethods(entry, substances.length)` (method code ราย-ตำแหน่ง)
3. ต่อตำแหน่ง `i`: ต่อ method code ใน `slots[i]` → map เป็น group ผ่าน `methodByCode` (machine-backed เท่านั้น; `machinePrefix` ขึ้นต้น `HPLC`→`hplc`, `GC`→`gc`; อื่น/ไม่ใช่เครื่อง→ข้าม) → `add` group ลง `substanceGroups[matchSubstanceKey(substances[i])]`

**การ resolve ตอนเบิก:** `resolveGroups(standard.name, index)` → คืน `Set` ของ group ที่สารนั้นเจอ **รวมทุกสินค้า** — สารเดียวโผล่หลายสินค้าอาจได้ group ต่างกัน (นั่นคือเคส ">1 → ให้เลือก")

> ตำแหน่งของ resolver: FE (ตรงกับ Assign). แหล่งข้อมูล `/master-items` + `/simple-methods` cache 5 นาที (React Query, staleTime เดียวกับ Assign). Index สร้างครั้งเดียวใน `useMemo` แล้ว lookup O(1) ต่อ standard

> **ความละเอียดของการ match:** ใช้ `matchSubstanceKey` (token แรก + lowercase) เป็น key ทั้ง 2 ฝั่ง — เป็น key มาตรฐานที่ทั้งแอปใช้อยู่ (conditional standards ฯลฯ) จึงสอดคล้องกัน. ผลข้างเคียงที่ต้องรู้: สารตระกูลเดียวกันที่ต่างรูป เช่น `2,4-D Acid` / `2,4-D Butyl ester` จะยุบเป็น key เดียว `2,4-d` → ถ้ารูปหนึ่งใช้ GC อีกรูปใช้ HPLC สาร 2,4-D ทุกตัวจะ resolve เป็น 2 กลุ่ม (ให้เลือก). ยอมรับได้เพราะ (ก) ตรงกับพฤติกรรม match ทั้งแอป (ข) มี fallback ให้เลือก group อยู่แล้ว. ถ้าภายหลังต้องแยกละเอียดกว่านี้ ค่อยยกเป็นงานปรับ `matchSubstanceKey` ทั้งระบบ (นอกขอบเขต)

---

## 3. Resolver lib ใหม่ — `src/lib/standardInstrumentGroups.ts` (pure, มี test)

```ts
export type InstrumentGroup = 'gc' | 'hplc';

// method code → group (machine-backed เท่านั้น) ผ่าน machinePrefix ใน methodByCode
export function methodCodeToGroup(code: string, methodByCode: Map<string, MethodDoc>): InstrumentGroup | null

// build reverse index จาก master-items + simple-methods
export function buildSubstanceGroups(
  masterItems: MasterItemRaw[],
  simpleMethods: { itemNo: string; methods?: string[][]; instruments?: string[] }[],
  methodByCode: Map<string, MethodDoc>,
): Map<string, Set<InstrumentGroup>>

// lookup ต่อ standard
export function resolveGroups(name: string, index: Map<string, Set<InstrumentGroup>>): InstrumentGroup[]
```

- reuse: `parseSubstances`, `matchSubstanceKey` (`src/lib/substances.ts`), `readSlotMethods` + `MethodDoc` (`src/lib/methodRegistry.ts`)
- reuse ค่า key จาก Assign: `MASTER_COMMON_NAME_KEYS`, `MASTER_ITEM_NO_KEYS` — **ย้ายไป export จาก lib กลาง** (เช่น `src/lib/masterItemFields.ts` ที่มีอยู่) เพื่อไม่ก๊อป literal ซ้ำใน 2 ไฟล์ (Assign import จากที่เดียวกัน)
- `defaultWeightCount(group)` เดิม (`standardRequisition.ts`) reuse ไม่แตะ

---

## 4. ฟอร์มเบิก — `StandardRequisitionDialog.tsx`

**ลบ:**
- แถวปุ่ม "เครื่อง" (list GC/HPLC machines) + state `instrumentId` / `instrument` / `pickInstrument`
- prop `instruments` (ผู้เรียกเลิกส่งให้ — ดู §6)

**เพิ่ม 3 query reuse ของเดิม:** `/master-items`, `/simple-methods`, `api.getMethods()` → build `substanceGroups` index (useMemo) + `methodByCode`

**พอเลือก Standard → `resolveGroups(standard.name)`:**

| จำนวน group ที่ resolve ได้ | UI / พฤติกรรม |
|---|---|
| **1 กลุ่ม** | auto — ป้าย read-only `GC · default 3 น้ำหนัก` / `HPLC · default 1 น้ำหนัก`; ตั้งจำนวนน้ำหนัก = default; **ไม่มี picker** |
| **2 กลุ่ม** (gc+hplc) | segmented เลือก **GC / HPLC** (เฉพาะที่ resolve ได้) → เลือกแล้ว set จำนวน = default ของ group; **ต้องเลือกก่อนกดเบิก** |
| **0 กลุ่ม** (resolve ไม่ได้) | default 1 + segmented GC/HPLC (ให้เลือกทั้ง 2 ได้) + hint `"สารนี้ยังไม่มี simple method ระบุเครื่อง — ไปตั้งที่ simple method"`; group จะบันทึกก็ต่อเมื่อเลือก (ไม่เลือก = null); **ยังเบิกได้** |

**คงเดิมทุกกรณี:**
- ช่อง **"จำนวนน้ำหนัก"** ปรับมือ 1–20 — จำนวนที่ตั้งอัตโนมัติเป็นแค่จุดเริ่ม, พิมพ์ทับได้ตลอด (custom). เมื่อค่า ≠ default โชว์ป้าย `custom` เล็กๆ กำกับ
- flow เลือกประเภทขวด (primary/working/supplier) → เลือกขวด (FEFO) → กรอก mg ราย-น้ำหนัก → validate (`validateWeights`) — ไม่แตะ

**`canSave`** (เดิมต้องมี `instrumentId`) → เปลี่ยนเป็น:
```
bottle && !weightError && user?.name && (resolvedGroups.length < 2 || pickedGroup)
```
(≥2 กลุ่มต้องเลือก group ก่อน; 1 กลุ่ม auto; 0 กลุ่มไม่บังคับเลือก)

**ตัวแปร `effectiveGroup`** (ที่ส่งไป audit + ใช้หา default count):
- 1 กลุ่ม → กลุ่มนั้น
- ≥2 กลุ่ม → `pickedGroup`
- 0 กลุ่ม → `pickedGroup` (อาจ null)

---

## 5. Backend + audit

### `server/models/StockTransaction.js`
เพิ่ม `instrumentGroup: { type: String, enum: ['gc', 'hplc', null], default: null }`
คงฟิลด์ `instrumentId` / `instrumentName` ไว้ (deprecated — flow นี้ไม่เขียนแล้ว)

### `server/routes/stock.js` — `POST /units/:qrId/deduct-mg`
- รับเพิ่ม `instrumentGroup` ใน body; ใส่ลง `meta` → เก็บลง transaction
- ตรรกะหัก mg atomic เดิม (`$inc`+`$gte`), รับ `weights[]` / `{mg}` เดิม — ไม่แตะ

### `src/lib/api.ts` — `deductStockUnitMg`
body type: เพิ่ม `instrumentGroup?: 'gc' | 'hplc'` (คง `instrumentId/instrumentName` optional ไว้ back-compat)
ฟอร์มส่ง `instrumentGroup: effectiveGroup ?? undefined` (เลิกส่ง `instrumentId/instrumentName`)

---

## 6. ผู้เรียก — `StockRequisitionButton.tsx`

- เลิกส่ง `instruments` ให้ `<StandardRequisitionDialog>` (เอา prop ออก)
- **คง** prop `instruments` ของ `StockRequisitionButton` เอง + ส่งต่อให้ `<ChemicalRequisitionDialog>` (ยังใช้อยู่) — ไม่แตะ

---

## 7. ไม่ทำ / out of scope

- ❌ ไม่เพิ่ม field ที่ `StockStandard` / ไม่แตะ schema standard / ไม่มี migration (ตรงกับ "ห้ามแก้ที่สาร")
- ❌ ไม่แตะฟอร์ม config Standard (`StandardFormDialog`)
- ❌ ไม่แตะ solvent/glassware, ไม่แตะ QR/print, ไม่แตะ flow ขวด/mg (§ อื่นของ spec 07-07)
- ❌ ไม่ทำ UI แก้ simple method ในตัว (hint ชี้ให้ไปหน้า Simple Method ที่มีอยู่)

---

## 8. ไฟล์ที่แตะ

**Frontend**
- `src/lib/standardInstrumentGroups.ts` (ใหม่) + `.test.ts`
- `src/lib/masterItemFields.ts` — export `MASTER_COMMON_NAME_KEYS` / `MASTER_ITEM_NO_KEYS` (ย้ายจาก PetitionAssignPage literal)
- `src/pages/PetitionAssignPage.tsx` — import 2 key set จาก lib กลางแทน literal (no behavior change)
- `src/components/lis/stock/StandardRequisitionDialog.tsx` — รื้อ: ลบ picker เครื่อง, เพิ่ม resolve group + segmented conditional
- `src/components/lis/stock/StockRequisitionButton.tsx` — เลิกส่ง `instruments` ให้ Standard dialog
- `src/lib/api.ts` — `deductStockUnitMg` body: `+instrumentGroup`

**Backend**
- `server/models/StockTransaction.js` — `+instrumentGroup`
- `server/routes/stock.js` — `deduct-mg` รับ `instrumentGroup`

---

## 9. Test plan

**Unit (Vitest) — `standardInstrumentGroups.test.ts`:**
- `methodCodeToGroup`: `GC`→gc, `HPLC`→hplc, non-machine/unknown→null
- `buildSubstanceGroups` + `resolveGroups`:
  - สารในสินค้าที่ method = GC → `['gc']` (1 กลุ่ม)
  - สารเดียวกันโผล่ 2 สินค้า GC และ HPLC → `['gc','hplc']` (2 กลุ่ม)
  - สาร "A + B" ในสินค้า: A→GC, B→HPLC แยกถูกตำแหน่ง (resolveGroups(A)=`['gc']`, (B)=`['hplc']`)
  - สารที่ไม่มี simple method → `[]` (0 กลุ่ม)
- `defaultWeightCount` เดิม — คงเทสไว้

**Backend:** `deduct-mg` เก็บ `instrumentGroup` ลง transaction ถูก; ยังหัก mg atomic ถูก

**Manual E2E (Brave/Playwright):**
1. เบิกสาร 1-กลุ่ม (GC) → ป้าย `GC · default 3`, ช่องน้ำหนัก = 3, แก้เป็น 4 → เห็นป้าย `custom` → เบิกได้
2. เบิกสาร 2-กลุ่ม → ปุ่มเบิก disabled จนเลือก GC/HPLC → เลือก HPLC → น้ำหนัก = 1
3. เบิกสารที่ไม่มี simple method → เห็น hint + default 1 + เลือกเครื่องได้ → เบิกได้
4. เช็ค transaction บันทึก `instrumentGroup` ถูก; ยืนยันไม่มีปุ่ม "เครื่อง" (list machines) แล้ว

**Type/lint:** `tsc -p tsconfig.app.json` + `npm run lint`
