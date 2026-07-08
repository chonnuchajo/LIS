# โหมด ± ค่าคงที่ (absolute) ในเกณฑ์ "ตาม %สาร"

วันที่: 2026-07-08
สถานะ: approved (design)
ขอบเขต: `/LIS/parameter-settings` → โหมดเกณฑ์ที่ 4 "ตาม %สาร" (`labelToleranceMode`)

## ปัญหา

โหมด "ตาม %สาร" ปัจจุบันมี 2 โหมดย่อยต่อกฎ (`LabelToleranceRule.mode`):

- `percent` — ค่ากลาง (center) = %ฉลากที่แกะจากชื่อสาร, tolerance เป็น **% relative** ของ center (`autoPct` / `headPct`)
- `range` — กรอกขอบเขต 4 ค่าเอง (`failLow ≤ passLow ≤ passHigh ≤ failHigh`), ไม่ใช้ center

ยังไม่มีทางกำหนด tolerance เป็น **ค่าสัมบูรณ์** รอบ center ที่แกะจากฉลาก เช่น ฉลาก 1.8% → ผ่าน ±0.05 (1.75–1.85)
ทางเลี่ยงเดียวคือใช้ `range` แล้วคำนวณ 4 ขอบเอง ซึ่ง freeze ค่าไว้ตอน config → กฎเดียวใช้ซ้ำข้ามสารที่ %ฉลากต่างกัน (0.3% vs 1.8%) ไม่ได้

## เป้าหมาย

เพิ่มโหมดย่อยที่ 3 `abs`: center มาจาก %ฉลากอัตโนมัติเหมือน `percent` แต่ tolerance กรอกเป็นค่าจริงในหน่วยของ field ตรงๆ

## Non-goals

- ไม่เพิ่มช่อง "ค่ากลาง" ให้กรอกเอง (center ยังมาจาก `parseLabelPercent(rawSpec)` เท่านั้น — ถ้าอยากกำหนดค่ากลางเองใช้โหมด `range`)
- ไม่แตะโหมด `percent` / `range` เดิม
- ไม่แตะหน้าแสดงผล (Lab testing / QC testing / QC approval / PetitionView) — ทุกหน้าอ่านผ่าน resolver อยู่แล้ว
- ไม่ต้อง migrate ข้อมูลเดิม

## Data model

`LabelToleranceRule` (`src/lib/api.ts:996`) และ `LabelToleranceStandardSchema` (`server/models/Parameter.js`):

```ts
mode?: "percent" | "abs" | "range"   // เดิม "percent" | "range"
autoAbs?: number | null              // ใหม่ — ± ช่วงผ่าน (หน่วยจริงของ field)
headAbs?: number | null              // ใหม่ — ± ช่วงหัวหน้าตรวจสอบ (ไม่บังคับ)
```

Migration: ไม่มี doc เดิมไม่มี `mode` → default `"percent"` ตามเดิม `autoPct`/`headPct` คงอยู่ครบ

## Resolver

`resolveLabelTolerance()` ที่ `src/lib/parameterValidation.ts:554` และ mirror `server/lib/abnormal.js:58` (ต้องแก้คู่กันเสมอ)

กิ่ง `range` คงเดิมทุกบรรทัด กิ่งท้าย (เดิมรองรับ `percent` อย่างเดียว) เปลี่ยนเป็น "คำนวณ `autoAbs`/`headAbs` ตามโหมด แล้วใช้ตรรกะโซนร่วมกัน":

```
const isAbs = (std.mode ?? "percent") === "abs"
const center = parseLabelPercent(rawSpec)

autoAbs = isAbs ? std.autoAbs
                : (std.autoPct == null ? null : Math.abs(center) * std.autoPct / 100)

// guard — ข้ามการตรวจ
if (autoAbs == null || autoAbs <= 0 || center == null)
    → { status: "none", center, autoRange: null, headRange: null }

headSet = isAbs ? std.headAbs != null : std.headPct != null
headAbs = headSet ? (isAbs ? std.headAbs : Math.abs(center) * std.headPct / 100)
                  : autoAbs
```

> หมายเหตุ: guard ต้องเช็ค `center == null` ก่อนคูณในกิ่ง percent (ลำดับเดิมของโค้ดเช็ค `autoPct` แล้วค่อยคูณอยู่แล้ว) — เมื่อ refactor ให้คงลำดับนั้นไว้

จากนั้นใช้โค้ดเดิมทั้งหมด ไม่แก้:

- `autoRange = [center - autoAbs, center + autoAbs]`
- `headRange = headSet ? [center - headAbs, center + headAbs] : null`
- ค่าว่าง / NaN → `status: "none"` (แต่คืน range ไปแสดงผล)
- `dev = |num - center|`; `dev ≤ autoAbs` → `pass`; `dev ≤ headAbs` → `review`; นอกนั้น `fail`
- `round(n) = Number(n.toFixed(6))`

พฤติกรรมที่ยืนยันว่าเหมือนโหมด `percent`:

- ชื่อสารไม่มี % → `center = null` → `status: "none"` → chip "ข้ามการตรวจ — ไม่มี %ฉลาก"
- ไม่กรอก head → `headRange = null` → เกินช่วงผ่าน = `fail` ทันที (ไม่มีโซน review)
- `isLabelToleranceAbnormal()` = `review || fail` — ไม่แตะ

## UI — `src/components/lis/LabelToleranceDialog.tsx`

- radio โหมด 3 ตัว: `เปอร์เซ็นต์ ±` / `± ค่าคงที่` / `ช่วงกำหนดเอง`
- โหมด `abs` ใช้ layout เดียวกับ `percent` เป๊ะ: ช่อง "ผ่าน" + ช่อง "หัวหน้าตรวจสอบ" (ช่องหลัง gate ด้วย `canEditHeadFields` = admin / qc-head เหมือนเดิม) ต่างแค่ผูกกับ `autoAbs` / `headAbs` และ placeholder เป็นค่าหน่วยจริง (เช่น `0.05`)
- `emptyRule()` คงค่าเริ่มต้น `mode: "percent"` — สลับโหมดไม่ต้องล้างค่าของอีกโหมด (field คนละชุด)
- `previewLine()` โหมด `abs`: ใช้ `center = rule.labelPercent ?? 1` เหมือน `percent` แล้วพิมพ์
  `ABAMECTIN 1.8% -> ผ่าน 1.75000-1.85000 | หัวหน้าตรวจสอบ 1.70000-1.90000`
  (คืน `""` เมื่อ `autoAbs == null || autoAbs <= 0`)

## Validation — mirror 3 จุด

| จุด | กฎ |
|---|---|
| `isRuleInvalid()` (dialog) | `abs`: `autoAbs == null \|\| autoAbs <= 0` → invalid; `headAbs != null && headAbs < autoAbs` → invalid |
| `Parameter.js` pre-validate (~บรรทัด 264) | `abs`: throw `ช่อง "…" สาร "…": ±ผ่าน (autoAbs) ต้องมากกว่า 0` / `±หัวหน้า (headAbs) ต้อง ≥ ±ผ่าน` |
| `describeLabelTolerance()` (`standardOperators.ts:97`) | `abs` → `ฉลาก ±0.05 (หัวหน้า ±0.1) g/L` — **ไม่มีเครื่องหมาย %** |

`hasSelector` (ต้องมีสาร หรือ %ฉลาก หรือประเภทสินค้า อย่างน้อย 1) และ `findLabelToleranceStandard()` (การให้คะแนนกฎที่ตรงที่สุด) ไม่เปลี่ยน — selector อิสระจาก mode

## Test

| ไฟล์ | เคส |
|---|---|
| `src/lib/parameterValidation.test.ts` | abs: pass/review/fail ตรงขอบพอดี (`dev == autoAbs` → pass, `dev == headAbs` → review); `headAbs` ว่าง → เกิน auto = fail ทันที; center null (ชื่อสารไม่มี %) → none; `autoAbs ≤ 0` → none; `percent` เดิมไม่ regress |
| `server/lib/abnormal.test.js` | parity เคสเดียวกันฝั่ง BE |
| `src/lib/standardOperators.test.ts` | `describeLabelTolerance` โหมด abs (มี/ไม่มี head, มี/ไม่มี unit) |
| `server/models/Parameter.test.js` | reject `autoAbs = 0`, reject `headAbs < autoAbs`, accept `abs` ที่ถูกต้อง |

## ไฟล์ที่กระทบ

แก้: `src/lib/api.ts`, `src/lib/parameterValidation.ts`, `src/lib/standardOperators.ts`,
`src/components/lis/LabelToleranceDialog.tsx`, `server/models/Parameter.js`, `server/lib/abnormal.js`
\+ ไฟล์เทสต์ 4 ไฟล์ข้างบน

ไม่แตะ: `src/lib/qcApprovalRows.ts`, `src/pages/LabTestingDetailPage.tsx`, `src/pages/QCTestingDetailPage.tsx`,
`src/components/petition/PetitionView.tsx`, `server/routes/qcResults.js`, `src/pages/ParameterSettings.tsx`

## เกณฑ์เสร็จ

- `npm run test` (FE) และ `cd server && npm test` เขียวทั้งหมด
- `npx tsc -p tsconfig.app.json --noEmit` ไม่มี error ใหม่
- manual: สร้างกฎโหมด `± ค่าคงที่` ในหน้า parameter-settings → กรอกผลใน Lab/QC testing → chip pass/review/fail ตรงกับช่วงที่คำนวณจาก %ฉลากของสารจริง
