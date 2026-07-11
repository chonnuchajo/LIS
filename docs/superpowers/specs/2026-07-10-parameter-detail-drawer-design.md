# Design: คลิกแถว Parameter เปิด Drawer รายละเอียด (หน้า /parameter-settings)

วันที่: 2026-07-10
สถานะ: อนุมัติดีไซน์แล้ว (รอ review spec)

## ปัญหา / เป้าหมาย

หน้า **พารามิเตอร์การตรวจสอบ** (`/parameter-settings`) ตอนนี้:

- ตารางรายการ parameter ย่อข้อมูลหมด — คอลัมน์ "ใช้กับ" ตัดเหลือ 2 ค่าแรก `+N`,
  คอลัมน์ "ค่าที่ต้องใส่" เห็นแค่ชื่อช่อง+ชนิด ไม่เห็นเกณฑ์
- คลิกที่แถว**ไม่เกิดอะไรขึ้น** — ทางเดียวที่จะเห็นรายละเอียดเต็มคือกดปุ่ม ✏️
  ซึ่งเปิด **dialog แก้ไข** (ฟอร์มเต็ม แก้ค่าได้ เสี่ยงแก้พลาดทั้งที่แค่อยากดู)

ผู้ใช้ต้องการ: **คลิกที่ parameter ไหนก็มีรายละเอียดให้ดู** (read-only)

## แนวทางที่เลือก

**A. Component แยกไฟล์ `ParameterDetailDrawer.tsx`** — shadcn **Sheet** ฝั่งขวา
(pattern เดียวกับ `MasterItemDetailDrawer` หน้า Master Item และ
`StandardDetailDrawer` หน้า Stock) + ทำทั้งแถวคลิกได้

ทางเลือกที่ตัดไป:
- เขียน drawer inline ใน `ParameterSettings.tsx` = ไฟล์ 3,134 บรรทัดบวมต่อ
- เปิด `ParameterDialog` เดิมแบบ disable ทุกช่อง = UX แย่ ฟอร์มเทายาวไม่ใช่หน้า "อ่าน"

## ขอบเขต

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `src/components/lis/ParameterDetailDrawer.tsx` | **ใหม่** — Sheet รายละเอียด parameter (read-only) |
| `src/components/lis/ParameterDetailDrawer.test.tsx` | **ใหม่** — Vitest |
| `src/lib/parameterDisplay.ts` | **ใหม่** — ย้าย `FIELD_TYPE_META`, `summarizeOptionFilter`, type `OptionFilter` ออกจาก page มา share |
| `src/pages/ParameterSettings.tsx` | row click + state `viewingId` + import จาก `parameterDisplay.ts` แทน local copy (ลบ copy เดิม) |

**ไม่แตะ:** `ParameterDialog` (ฟอร์มแก้ไข), `ParameterCriteriaTabs` (แท็บเกณฑ์),
`SubstanceStandardsDialog`/`ConditionalStandardsDialog`/`LabelToleranceDialog`,
ค้นหา/filter/summary cards, backend/schema ทุกอย่าง — feature นี้อ่านจาก data
ที่ query `["parameters"]` โหลดมาแล้ว ไม่มี API ใหม่

## รายละเอียด

### 1. แถวในตาราง

- `<TableRow className="cursor-pointer" onClick={...} onDoubleClick={...} title="คลิกเพื่อดูรายละเอียด">`
  — idiom เดียวกับตาราง Stock/Master Items. เปิด drawer ได้ทั้ง **single-click และ
  double-click** (double-click เป็นท่าเปิดแบบ desktop app; single-click ก็เปิดอยู่แล้ว
  ท่าเดียวก็พอ แต่รองรับทั้งคู่ให้ผู้ใช้ที่คุ้นท่าไหนก็ได้)
- ปุ่ม ✏️ แก้ไข / 🗑️ ลบ ท้ายแถว: เพิ่ม `e.stopPropagation()` — ทำงานเหมือนเดิม
  ไม่เปิด drawer

### 2. ความสดของข้อมูล

- state เป็น `viewingId: string | null` (ไม่เก็บ object) แล้ว derive ทุก render จาก
  ลิสต์ **เต็ม** (`parameters`, ไม่ใช่ `filtered`): `const viewing = parameters.find(p => p._id === viewingId)`
- ถ้า id หายจาก `parameters` (parameter **ถูกลบ**) → drawer ปิดตัวเอง (render null).
  จงใจ derive จากลิสต์เต็มไม่ใช่ลิสต์ที่กรอง เพื่อไม่ให้ drawer เด้งปิดเองกลางคัน
  ตอน background refetch (query refetch เอง ~10s) เปลี่ยน status/scope ของตัวที่กำลังดู
  ให้หลุด filter — Sheet เป็น modal ผู้ใช้เปลี่ยนแท็บ/ค้นหาเองระหว่างเปิดไม่ได้อยู่แล้ว
- กด **แก้ไข** ใน drawer → `setViewingId(null)` แล้ว `setEditing(viewing)` —
  ปิด drawer ก่อนเปิด dialog แก้ไขตัวเดิม (ไม่ซ้อนกัน)

### 3. `ParameterDetailDrawer` (ใหม่)

Props: `{ parameter: ParameterItem; allParameters: ParameterItem[]; groupNameById: Map<string,string>; onEdit: () => void; onClose: () => void }`

Sheet `side="right"` กว้าง `w-full sm:max-w-lg`, เนื้อหา scroll แนวตั้ง, บน→ล่าง:

**หัว (SheetHeader):**
- ชื่อ parameter (ใหญ่) + badge scope (QC indigo / Lab sky — class ชุดเดิม
  `SCOPE_BADGE_CLASS`) + badge "→ Lab" ถ้า `shareWithLab` + badge สถานะ เปิด/ปิด
- หมายเหตุ (`note`) ถ้ามี

**ใช้กับ:**
- `applyAll` → badge "ทั้งหมด" อันเดียว
- ไม่งั้น list เต็มทุกมิติ **ไม่ตัด +N**: Item / Common / ประเภท / หมวดหมู่ /
  หมวดย่อย / กลุ่ม (กลุ่ม resolve ชื่อผ่าน `groupNameById`) — มิติที่ว่างไม่แสดง,
  โทนสี badge ชุดเดียวกับ `ApplyToBadges` ในตาราง
- ทุกมิติว่างหมด → "—"

**ช่องค่า (การ์ดต่อช่อง เรียงตามลำดับจริง):**
- แถวหัวการ์ด: ไอคอน+สีตามชนิด (จาก `FIELD_TYPE_META`), ลำดับ, ชื่อช่อง,
  ป้ายชนิด, `*` แดงถ้าบังคับกรอก
- chips เงื่อนไข (แสดงเฉพาะที่เป็นจริง): phase (ทั้ง 2 phase / เฉพาะก่อน /
  เฉพาะหลัง — เฉพาะเมื่อ parameter `hasPhases`), "ตัวเริ่ม Phase 2",
  "กรอกได้หลายค่า" (`multiple`), "โชว์ค่าแบชล่าสุด" (`showLastBatch`)
- รายละเอียดตามชนิด:
  - **number/float**: หน่วย + โหมดเกณฑ์
    - ค่าเดียว → ข้อความเกณฑ์เต็ม (logic เดียวกับ `StandardPreview` ของ page —
      "ค่าปกติ: 10 - 50 cP" / "ยังไม่ได้กำหนดเงื่อนไข")
    - แยกตามสาร → หัว "เกณฑ์ต่อสาร (N สาร)" + list
      `สาร — describeSubstanceStandard(s, unit)`
    - ตาม %สาร → หัว "ตาม %สาร (N สาร)" + list `สาร — describeLabelTolerance(s)`
    - เงื่อนไขพิเศษ → หัว "เงื่อนไขพิเศษ (N กฎ)" + list ต่อกฎ:
      `conditionalResult === "output"` ใช้ `describeOutputRule(r)` ไม่งั้น
      `describeRule(r, unit)`
    - **ทั้ง 3 โหมด list**: โชว์ 5 รายการแรก + ปุ่ม "ดูทั้งหมด (N)" คลี่ในที่
      (local state ต่อการ์ด, กดแล้วเปลี่ยนเป็น "ย่อ") — N ≤ 5 ไม่มีปุ่ม
  - **enum**: list ตัวเลือกทุกตัว + chip ผลของตัวเลือก
    (ปกติ emerald / ไม่ปกติ แดง / ข้อความ: "…" เทา — อ่านจาก `optionOutputs`;
    ไม่มี `optionOutputs` → fallback legacy: ตัวที่อยู่ใน `expectedValues` = ปกติ
    ที่เหลือ = ไม่ปกติ ตาม `seedOptionOutputsFromLegacy`) + ไอคอน 📝
    "ต้องกรอกหมายเหตุ" ถ้าอยู่ใน `requireNoteOn` + ไอคอน filter พร้อมข้อความ
    `summarizeOptionFilter(...)` ถ้าตัวเลือกนั้นมี `optionFilters`
  - **timer**: `formatTimerHuman(timerDurationSec)` + หน่วยที่ตั้ง / "ยังไม่ตั้งระยะเวลา"
  - **photo**: สูงสุด N รูป
  - **file**: ชนิดไฟล์ (PDF/EXCEL/…) + สูงสุด N ไฟล์
  - **reference**: "← ดึงจาก {ชื่อ parameter ต้นทาง} · {ชื่อช่อง}" (+ " · phase 2"
    ถ้า `refPhase === 2`) — resolve ชื่อจาก `allParameters` ด้วย `refParameterId`,
    หาไม่เจอ → โชว์ id
  - **text**: ไม่มีรายละเอียดเพิ่ม (chips พออยู่แล้ว)
- ไม่มีช่องค่าเลย → "— ยังไม่มีช่องค่า"

**ข้อมูลระบบ (แถวเล็กท้าย body):**
- "มี 2 phase (ก่อน/หลัง)" ถ้า `hasPhases` · "กรอกซ้ำได้หลายรายการ" ถ้า `multiEntry`
  — ไม่มีทั้งคู่ก็ไม่แสดง section นี้

**Footer (SheetFooter):** ปุ่ม `[✎ แก้ไข]` (variant outline, เรียก `onEdit`) +
`[ปิด]` — ปุ่มแก้ไขโชว์เสมอ (คนที่เข้าหน้านี้ได้มีสิทธิ์แก้อยู่แล้ว ตาราง
ก็มีปุ่ม ✏️ ให้ทุกคนเหมือนกัน)

### 4. `src/lib/parameterDisplay.ts` (ใหม่ — targeted refactor)

ย้ายของที่ drawer ต้องใช้ร่วมกับ page ออกจาก `ParameterSettings.tsx` (ตัด copy เดิมทิ้ง):

- `FIELD_TYPE_META` (label/Icon/สีต่อชนิด field — Lucide icons เป็น value import ได้ใน .ts)
- type `OptionFilter` + `summarizeOptionFilter(filter, groupNameById)`
- `SCOPE_LABEL`, `SCOPE_BADGE_CLASS`

**ไม่ย้าย** `summarizeField`/`StandardPreview` — ใช้เฉพาะใน page; drawer เขียน
renderer ของตัวเอง (ละเอียดกว่า summary)

## Testing

`ParameterDetailDrawer.test.tsx` (Vitest + testing-library ตามแนวเทสใน repo):

1. header — ชื่อ/scope/→ Lab/สถานะ/note ครบ
2. ใช้กับ — applyAll โชว์ "ทั้งหมด"; ไม่ applyAll โชว์ค่าเต็มทุกมิติไม่ตัด +N,
   กลุ่ม resolve ชื่อจาก map
3. number ค่าเดียว — ข้อความเกณฑ์ถูก (between + หน่วย)
4. เกณฑ์ต่อสาร 7 สาร — เห็น 5 + ปุ่ม "ดูทั้งหมด (7)" → กดแล้วเห็นครบ + ปุ่มเปลี่ยนเป็น "ย่อ";
   3 สาร → ไม่มีปุ่ม
5. enum — chip ปกติ/ไม่ปกติ/ข้อความ ตาม optionOutputs + legacy fallback จาก
   expectedValues + requireNoteOn
6. timer/photo/file/reference — รายละเอียดถูก (reference resolve ชื่อ param ต้นทาง)
7. ปุ่มแก้ไข → เรียก `onEdit`
8. field chips — required/phase/ตัวเริ่ม Phase 2/multiple/showLastBatch

ของเดิมต้องไม่พัง: เทสทั้ง repo เขียว + `npx tsc -p tsconfig.app.json --noEmit`
ไม่มี error ใหม่ (root `tsconfig` เป็น no-op)

ค้าง manual E2E ในเบราว์เซอร์ (คลิกแถว → drawer → แก้ไข → บันทึก → เปิด drawer ซ้ำเห็นค่าใหม่)

## หมายเหตุ implementation

- commit ด้วย explicit pathspec (มี process อื่น commit แทรกใน repo นี้ได้)
- drawer เป็น Radix Sheet ปิดแล้ว navigate ไม่มี (อยู่หน้าเดิม) — ไม่เข้าเคส
  pointer-events lock ที่เคยเจอกับ ConfirmDialog
