# โหมดเกณฑ์ที่ 4 — "ตาม %สาร" (label-% tolerance, 3 ช่วง ต่อสาร)

**Date:** 2026-07-07
**Branch:** develop
**Scope:** feature — เพิ่มโหมดเกณฑ์ใหม่สำหรับช่องตัวเลขในหน้า Parameter Settings

## Problem / เป้าหมาย

หน้า `/LIS/parameter-settings` ปัจจุบันมี "โหมดเกณฑ์" 3 แบบสำหรับช่องตัวเลข (`number`/`float`):

- **ค่าเดียว** — `standardOperator` / `standardValue` / `standardValue2`
- **แยกตามสาร** (`substanceMode`) — เกณฑ์ต่อสาร (operator/value ตายตัว) + `headOnly`
- **เงื่อนไขพิเศษ** (`conditionalMode`) — กฎ if/then อ้าง**ค่าจากช่องอื่น** (cross-field)

ผู้ใช้ต้องการเกณฑ์อีกแบบ: **ผ่าน/ไม่ผ่านอิงจาก %ฉลากของสารที่แกะจากชื่อผลิตภัณฑ์อัตโนมัติ** โดยมี tolerance 2 ชั้น — ชั้นในผ่านเอง ชั้นนอกต้องให้หัวหน้า QC อนุมัติ นอกสุด = ไม่ผ่าน

ตัวอย่าง: สารประกาศฉลาก 1% → tolerance ±ออโต้ 2.5% (ผ่านเอง 0.975–1.025), ±หัวหน้า 5% (0.95–1.05 หัวหน้าอนุมัติได้), นอก 0.95–1.05 = ไม่ผ่าน

**เดิมทำไม่ได้เพราะ:**
1. เกณฑ์ที่มี "ศูนย์กลาง = %ฉลาก" ต้องแกะเลขจากชื่อสารตอนตรวจ — ไม่มี operator ไหนรองรับ (`tolerance` เดิมต้องกรอกค่ามาตรฐานเอง)
2. ระบบ abnormal เดิมเป็น binary (ปกติ/ผิดปกติ) — ไม่มีแนวคิด 3 ช่วง (ผ่าน/รอหัวหน้า/ไม่ผ่าน)

## Decisions (สรุปจาก brainstorm)

| ประเด็น | สรุป |
|---|---|
| วางที่ไหน | **โหมดที่ 4 ใหม่** แยกจาก 3 โหมดเดิม (ไม่แตะ substance/conditional) |
| โครงสร้างค่า | **ต่อสารล้วน ไม่มี default** — สารที่ไม่ได้เพิ่ม = ไม่มีเกณฑ์ตรวจ |
| ศูนย์กลาง (center) | **แกะจาก %ฉลากในชื่อสารอัตโนมัติ ไม่เก็บ ไม่กรอกเอง** |
| tolerance | **relative** = % ของค่าฉลาก (1% ±5% → 0.95–1.05) |
| จำนวนช่วง | 3 ช่วง: `pass` (ผ่านเอง) / `review` (หัวหน้าอนุมัติ) / `fail` (ไม่ผ่าน) |
| map เข้าระบบเดิม | `review` + `fail` = **abnormal (binary)** ทั้งคู่ → เข้า flow หัวหน้า QC เดิม ต่างแค่ **ป้ายแสดง** |
| ค่าอยู่ช่วง `fail` | หัวหน้า QC **อนุมัติได้** (คงพฤติกรรมเดิม) แต่ UI ต้อง **แจ้งเตือน** ว่าเกินช่วงอนุมัติ |
| สารไม่มี % ในชื่อ | **ข้ามการตรวจ + แสดงคำเตือน** (ไม่ flag, ไม่ผ่าน pipeline) |
| `headPct` | **ไม่บังคับ** — ไม่ใส่ = ไม่มีช่วง review, นอก auto = fail ทันที |

## Non-goals (YAGNI)

- ไม่มี default กลาง / ตาราง tolerance ตามช่วงความเข้มข้น (FAO/CIPAC) — ต่อสารล้วนตามที่ผู้ใช้เลือก
- ไม่รองรับ center จากหน่วยอื่น (เช่น g/L) — เฉพาะ `%` เท่านั้น; สารที่ชื่อเป็น g/L = ข้ามการตรวจ + เตือน
- ไม่กรอก center เอง — auto ล้วน
- ไม่เพิ่ม status enum ใหม่ใน DB / ไม่บล็อกหัวหน้าจากการอนุมัติ `fail` (แค่เตือน)
- ไม่แตะ 3 โหมดเดิม, ไม่ migrate ข้อมูล (ฟีเจอร์ใหม่ ไม่มีข้อมูลเก่า)

## Design

### 1. Data model

**`server/models/Parameter.js`** — เพิ่ม sub-schema + 2 field บน `ValueFieldSchema`:

```js
const LabelToleranceStandardSchema = new mongoose.Schema({
  substance: { type: String, required: true, trim: true },  // "ABAMECTIN" (matched-name form)
  autoPct:   { type: Number, default: null },               // ± ชั้นใน (ผ่านเอง) %ของค่าฉลาก, >0
  headPct:   { type: Number, default: null },               // ± ชั้นนอก (หัวหน้าอนุมัติ), ถ้าใส่ต้อง ≥ autoPct
}, { _id: false });

// บน ValueFieldSchema:
labelToleranceMode:      { type: Boolean, default: false },
labelToleranceStandards: { type: [LabelToleranceStandardSchema], default: [] },
```

- **ไม่เก็บ center** — คำนวณจากชื่อสารตอนอ่าน (เหมือน substanceMode ที่ resolve std ตอนอ่าน)
- **key การเก็บค่าผล** ใช้ `substanceFieldKey(label, substance)` เดิม (`${label}::${matchSubstanceKey}`) เหมือน substanceMode → progress-counting / value storage ใช้ path เดิม ไม่ต้องแก้

**`src/lib/api.ts`** — เพิ่ม type ให้ตรง:
```ts
export type LabelToleranceStandard = { substance: string; autoPct: number | null; headPct: number | null };
// บน ParameterValueField:
labelToleranceMode?: boolean;
labelToleranceStandards?: LabelToleranceStandard[];
```

**Validation** (`Parameter.js` `pre('validate')`):
- exclusivity: ถ้ามีมากกว่า 1 ใน `{substanceMode, conditionalMode, labelToleranceMode}` เป็น true → error (radio คุมอยู่แล้ว, เป็น defense-in-depth; ขยาย guard เดิมที่เช็ค substance+conditional)
- `multiple` + `labelToleranceMode` → error (เหมือน substanceMode)
- แต่ละ `labelToleranceStandards`: `autoPct` ต้อง `> 0`; ถ้า `headPct != null` ต้อง `headPct >= autoPct`
- ไม่ normalize บน field ที่ไม่ใช่ number/float — UI reset ให้อยู่แล้ว (consumers gate ด้วย isNumeric)

### 2. แกะ %ฉลาก — `src/lib/substances.ts`

```ts
// จับเลขที่ตามด้วย "%" ตัวแรก เช่น "ABAMECTIN 1.8% W/V EC" → 1.8 ; "2,4-D 96% SL" → 96 (ข้าม "2,4")
// ไม่มี "%" → null
export function parseLabelPercent(raw: string): number | null {
  const m = String(raw || "").match(/(\d+(?:\.\d+)?)\s*%/);
  return m ? Number(m[1]) : null;
}
```
- ทำงานหลัง `parseSubstances(commonName)` split "+" แล้ว — จับ % ของสารตัวนั้น
- ไม่มี % → `null` → ข้ามการตรวจ + เตือน (ตาม decision)

### 3. ตรรกะ 3 ช่วง — helper กลาง (mirror FE + BE)

**`src/lib/parameterValidation.ts`** — helper ใหม่ + type:
```ts
export type LabelToleranceStatus = "pass" | "review" | "fail" | "none";
export type LabelToleranceResolved = {
  status: LabelToleranceStatus;   // "none" = แกะ % ไม่ได้ / ไม่มี std → ข้ามการตรวจ
  center: number | null;
  autoRange: [number, number] | null;   // [center-autoAbs, center+autoAbs]
  headRange: [number, number] | null;   // [center-headAbs, center+headAbs] (null ถ้าไม่มี headPct)
};

// std = LabelToleranceStandard ของสาร, rawSpec = ชื่อสารดิบ (มี %), value = ค่าที่วัด
export function resolveLabelTolerance(
  std: LabelToleranceStandard | undefined,
  rawSpec: string,
  value: unknown,
): LabelToleranceResolved;
```
ตรรกะ:
```
center = parseLabelPercent(rawSpec)
ถ้า !std || std.autoPct==null || center==null → { status: "none", ... }
autoAbs = center * autoPct/100 ; headAbs = headPct!=null ? center*headPct/100 : autoAbs
ถ้า value ว่าง/NaN → status "none" (ยังไม่กรอก ไม่ flag) แต่ยังคืน range ไว้โชว์เกณฑ์
dev = |value - center|
dev ≤ autoAbs → "pass"
dev ≤ headAbs → "review"
else          → "fail"
```
- `isLabelToleranceAbnormal(...)` = `status === "review" || status === "fail"` → ใช้กับ binary abnormal เดิม
- แยก 2 กรณีของ `status "none"` ตอนแสดงผลด้วย `center`: `center == null` = **ไม่มี %ฉลาก → ข้ามการตรวจ + เตือน** (เทา); `center != null` แต่ค่าว่าง = ยังไม่กรอก (โชว์เกณฑ์เฉยๆ ไม่มี chip). ทั้งคู่ไม่ flag abnormal

**`server/lib/abnormal.js`** + **`server/routes/qcResults.js`** — mirror `parseLabelPercent` + `resolveLabelTolerance` (คอมเมนต์ KEEP IN SYNC เดิม)

### 4. ขยายต่อสารตอนตรวจ — `expandFieldForItem`

เพิ่ม branch เมื่อ `labelToleranceMode && isNumeric` (คู่ขนานกับ substanceMode):
- `parseSubstances(commonName)` → ต่อสาร map เป็น unit
- key = `substanceFieldKey(field.label, name)` (เหมือน substanceMode)
- label = `${field.label} — ${name}`
- แนบ payload ใหม่บน unit: `labelTolerance?: { std, rawSpec }` (raw ยังมี % ให้ resolve ตอน render)
- virtual field: ปิด `labelToleranceMode`, ไม่ยัด `standardOperator` (การตัดสิน 3 ช่วงใช้ `resolveLabelTolerance` แทน)

> `RenderFieldUnit` เพิ่ม optional field `labelTolerance?: { std: LabelToleranceStandard | undefined; rawSpec: string }`

### 5. UI ตั้งค่า — `src/pages/ParameterSettings.tsx` + dialog ใหม่

- **radio โหมด**: เพิ่มตัวที่ 4 `["labelTolerance", "ตาม %สาร"]`; ขยาย `mode` union + `setMode` ให้ล้าง/คงค่า `labelToleranceStandards` แบบเดียวกับ substance/conditional (คงอาเรย์ไว้ ไม่ล้างตอนสลับโหมด)
- **บล็อกตั้งค่า** (คู่ขนานกับ substanceMode block): ช่องหน่วย * + ปุ่ม "ตั้งเกณฑ์ตาม %สาร (N สาร)" เปิด dialog + preview บรรทัดสรุปต่อสาร
- **`LabelToleranceDialog.tsx`** (ใหม่ ใน `src/components/lis/`):
  - ซ้าย: reuse substance picker เดิม (3 แท็บ commonName/กลุ่ม/trade name) — แยก helper ที่ใช้ร่วมได้จาก `SubstanceStandardsDialog` ถ้าคุ้ม ไม่งั้น copy ให้ตรง (picker เป็น pure)
  - ขวา: ต่อสารกรอก `±ออโต้ %` + `±หัวหน้า %` (optional) + preview เช่น
    `"ตัวอย่างฉลาก 1% → ผ่าน 0.975–1.025 · หัวหน้าอนุมัติถึง 0.95–1.05"`
  - หมายเหตุใน dialog: "ศูนย์กลางแกะจาก %ในชื่อสารอัตโนมัติ · สารที่ชื่อไม่มี % จะข้ามการตรวจ"

### 6. แสดงตอนตรวจ + หัวหน้า QC

Consumers ของ `expandFieldForItem` ที่ต้องเพิ่ม branch labelTolerance:
- **`LabTestingDetailPage.tsx` / `QCTestingDetailPage.tsx`** — input ต่อสาร (input เดิมทำงานได้ key เดิม) + แสดงเกณฑ์ (`autoRange`/`headRange`) + chip สถานะหลังกรอก: `ผ่าน` (เขียว) / `รอหัวหน้าอนุมัติ` (เหลือง) / `ไม่ผ่าน` (แดง) / `ข้ามการตรวจ — ไม่มี %ฉลาก` (เทา, เตือน)
- **`PetitionView.tsx`** — read-only แสดงเกณฑ์ + สถานะ
- **`qcApprovalRows.ts`** — หัวหน้า QC: แถวผล + ป้าย `review` vs `fail`; ช่อง `fail` แสดง **คำเตือน** "เกินช่วงที่อนุมัติได้" (ยังกดอนุมัติได้)
- **`qcProgress.ts`** — filled-counting ใช้ key เดิม (`${label}::…`) → ทำงานได้เลย ไม่ต้องแก้ตรรกะ (ยืนยันว่า unit ยังนับเป็น field ที่ต้องกรอก)

### 7. นับ abnormal — `countAbnormalInResults` (FE) + `abnormal-flags` (BE)

- เพิ่ม branch `labelToleranceMode && isNumeric` คู่ขนานกับ substanceMode:
  - ต้องใช้ **`commonName` ของผล** เพื่อ resolve center ต่อสาร
  - FE: `countAbnormalInResults` อ่าน `r.commonName` (มีใน `QCTestResult`)
  - BE: **เพิ่ม `commonName` ใน projection** ของ `GET /qc-results/abnormal-flags` (ปัจจุบัน select แค่ `values/entries/...`)
  - loop ค่าที่ key `${label}::${subKey}` → หา rawSpec จาก `parseSubstances(commonName)` ที่ `matchSubstanceKey===subKey` → `resolveLabelTolerance` → `review|fail` = abnormal

### 8. describe helper — `src/lib/standardOperators.ts`

เพิ่ม `describeLabelTolerance(std, unit)` เช่น `"ฉลาก ±2.5% (หัวหน้า ±5%)"` และ range-formatter สำหรับ preview/ผลลัพธ์

## Files touched

**Backend**
- `server/models/Parameter.js` — sub-schema + 2 field + validation guard
- `server/lib/abnormal.js` — `parseLabelPercent` + `resolveLabelTolerance` + `isLabelToleranceAbnormal`
- `server/routes/qcResults.js` — branch ใน abnormal-flags + เพิ่ม `commonName` ใน projection; mirror resolver
- `server/models/Parameter.test.js` — round-trip + guard (node:test)

**Frontend**
- `src/lib/api.ts` — types
- `src/lib/substances.ts` — `parseLabelPercent`
- `src/lib/parameterValidation.ts` — resolver + expand branch + count branch + `RenderFieldUnit.labelTolerance`
- `src/lib/standardOperators.ts` — describe helper
- `src/pages/ParameterSettings.tsx` — radio ตัวที่ 4 + บล็อกตั้งค่า + preview
- `src/components/lis/LabelToleranceDialog.tsx` — ใหม่
- `src/pages/LabTestingDetailPage.tsx`, `src/pages/QCTestingDetailPage.tsx`, `src/components/petition/PetitionView.tsx`, `src/lib/qcApprovalRows.ts` — render branch + chip/เตือน
- `src/lib/parameterValidation.test.ts` — `parseLabelPercent` + `resolveLabelTolerance` 3-zone + no-% + expand

## Risks / notes

- **FE↔BE parity**: `parameterValidation.ts` ↔ `abnormal.js`/`qcResults.js` ต้อง mirror ให้ตรง (มีคอมเมนต์ KEEP IN SYNC เดิม) — เพิ่ม test ทั้ง 2 ฝั่ง
- **หน่วยต้องเป็น %**: center ที่แกะเป็นตัวเลข % สมมติว่า field วัดในหน่วยเดียวกับฉลาก (%) — เป็นความรับผิดชอบตอน config; ระบุ note ใน dialog
- **parseSubstances merge**: ผลิตภัณฑ์ >2 สารจะถูก merge เป็น "A + B" — `parseLabelPercent` จับ % ตัวแรก (rare edge, ยอมรับได้)
- **Concurrent-committer hazard** บน develop — commit เฉพาะไฟล์ฟีเจอร์นี้ด้วย explicit pathspec
- **seed:export**: schema/code change ไม่ใช่ data change — ไม่ต้องรัน
