# เงื่อนไขพิเศษของเกณฑ์ Parameter + ค่าแบชล่าสุด — Design Spec

วันที่: 2026-06-09
สถานะ: รออนุมัติ implementation plan
สาขา: develop

## ภาพรวม

หน้า **Parameter Settings** ตอนนี้ตั้ง "เกณฑ์ค่าปกติ" (abnormal check) ของ field ตัวเลขได้
แค่ค่าเดียว (`standardOperator` + `standardValue` + `standardValue2`) หรือแยกตามสาร
(`substanceMode` + `substanceStandards[]`)

โจทย์นี้เพิ่ม 2 ฟีเจอร์ที่อยู่บนหน้าจอเดียวกันแต่เป็นอิสระต่อกัน:

- **A. เงื่อนไขพิเศษ (rule engine)** — เกณฑ์ผันแปรตามค่า field อื่น (พี่น้องใน parameter เดียวกัน
  หรือข้าม parameter) ด้วยกฎแบบ if เรียงลำดับ first-match
- **B. ค่าแบชล่าสุด** — โชว์ค่า field เดียวกันจากผลตรวจครั้งก่อนของ common name เดียวกัน
  ไว้เทียบเฉยๆ ไม่ตรวจ abnormal

### เคสตัวอย่างจริง

- field **ลักษณะ** (enum): `ก้อนเล็ก` / `ก้อนใหญ่`
- field **น้ำหนัก** (number) เกณฑ์ผันตามลักษณะ:
  - ก้อนใหญ่ → `23.5–26 กรัม`
  - ก้อนเล็ก → `5.5–5.6 กรัม`

---

## A. เงื่อนไขพิเศษ (rule engine)

### A.1 Data model

เพิ่มบน `ParameterValueField` (ใช้กับ `number`/`float` เท่านั้น):

```ts
conditionalMode?: boolean;            // เปิดโหมดเงื่อนไขพิเศษ
conditionalStandards?: StandardRule[];
```

โครงสร้างใหม่ใน `src/lib/api.ts`:

```ts
type StandardConditionOp = "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "between";

type StandardCondition = {
  sourceParameterId?: string | null;  // null/ว่าง = field พี่น้องใน parameter เดียวกัน
  sourceFieldLabel: string;           // เอาค่าจาก field ไหนมาเช็ค
  op: StandardConditionOp;
  value: string | number;             // enum/text → string, ตัวเลข → number
  value2?: number | null;             // ใช้กับ between
};

type StandardRule = {
  label?: string;                     // ป้ายชื่อ เช่น "ก้อนใหญ่" (โชว์ตอนตรวจ + เหตุผล abnormal)
  conditions: StandardCondition[];    // AND กันทุกตัว; ว่าง = เข้าเสมอ (แถว default)
  operator: StandardOperator;         // เกณฑ์ผลลัพธ์ (lt/lte/eq/gte/gt/between/tolerance)
  value: number | null;
  value2?: number | null;
};
```

**โหมดเกณฑ์ของ field ตัวเลขเป็น 3 แบบ mutually exclusive:**

1. ค่าเดียว — `standardOperator`/`standardValue` (เดิม)
2. แยกตามสาร — `substanceMode` + `substanceStandards[]` (เดิม)
3. เงื่อนไขพิเศษ — `conditionalMode` + `conditionalStandards[]` (ใหม่)

เปิดโหมดใดโหมดหนึ่งจะ ignore ค่าของอีกโหมด (v1 ใช้พร้อมกันไม่ได้)

### A.2 การ resolve เกณฑ์ตอนตรวจ

ฟังก์ชันใหม่ใน `src/lib/parameterValidation.ts`:

```ts
type ResolvedStandard = {
  operator: StandardOperator;
  value: number | null;
  value2: number | null;
  matchedRuleLabel?: string;   // เอาไว้โชว์ "(ก้อนใหญ่)"
} | null;

type ConditionContext = {
  // ค่าของ field ทุกตัวในงานตรวจของ item ปัจจุบัน
  // key = field label, value = ค่าที่กรอก
  sameParam: Record<string, unknown>;
  // ค่าจาก parameter อื่นของ item เดียวกัน: parameterId -> (fieldLabel -> value)
  otherParams: Record<string, Record<string, unknown>>;
};

function resolveStandard(field: ParameterValueField, ctx: ConditionContext): ResolvedStandard;
```

ลำดับการ resolve:

1. ถ้า `!field.conditionalMode` → คืนเกณฑ์ค่าเดียวเดิม (หรือ null ถ้าไม่ได้ตั้ง)
2. ไล่ `conditionalStandards` **บนลงล่าง** — แถวแรกที่ **ทุก** condition เป็นจริง → คืนเกณฑ์แถวนั้น
   พร้อม `matchedRuleLabel`
3. ไม่มีแถวไหนเข้า → คืน `null` (**ไม่ตรวจ abnormal** — ถือว่าเกณฑ์ยังกำหนดไม่ได้)

การประเมิน 1 condition:

- หาค่า source: ถ้า `sourceParameterId` ว่าง → `ctx.sameParam[sourceFieldLabel]`;
  ถ้ามี → `ctx.otherParams[sourceParameterId]?.[sourceFieldLabel]`
- source value ว่าง/undefined → condition = **false** (กฎไม่เข้า)
- `eq`/`ne`: ถ้าฝั่งใดไม่ใช่ตัวเลข → เทียบ string (รองรับ enum); เป็นตัวเลขทั้งคู่ → เทียบเลข
- `gt`/`gte`/`lt`/`lte`/`between`: แปลงเป็นตัวเลขทั้งคู่; แปลงไม่ได้ → false

การเช็ค abnormal: เอา `ResolvedStandard` ไปสร้าง virtual field แล้วเรียก `isNumericAbnormal` เดิม
(pattern เดียวกับ `isSubstanceAbnormal`)

### A.3 จุด integrate ฝั่ง logic

- `isFieldAbnormal` / `isNumericAbnormal` ต้องรับ ctx ได้ (เพิ่ม overload หรือ wrapper
  `isFieldAbnormalWithCtx(field, value, ctx)`) — path เดิมที่ไม่ส่ง ctx ยังทำงาน (conditional = ไม่ตรวจ)
- `countAbnormalInResults` — loop อยู่แล้วต่อ result ของทั้ง item; ต้อง build ctx จาก
  results ทั้งหมดของ (petitionId,itemSeq) เดียวกัน แล้วส่งเข้า resolve ต่อ field
- `expandFieldForItem` — conditionalMode เป็นคนละ path กับ substanceMode (mutually exclusive)
  ไม่ต้องแตกราย field

### A.4 UI ตั้งค่า (ParameterSettings.tsx)

ใน `ValueFieldEditor` ของ field ตัวเลข เปลี่ยน checkbox เดียว "แยกเงื่อนไขตามสาร"
เป็น **ตัวเลือกโหมดเกณฑ์ 3 แบบ** (radio/segmented):

```
โหมดเกณฑ์:  ( ) ค่าเดียว   ( ) แยกตามสาร   ( ) เงื่อนไขพิเศษ
```

เลือก "เงื่อนไขพิเศษ" → แสดงปุ่ม `ตั้งกฎ (N กฎ)` เปิด **ConditionalStandardsDialog**

`summarizeField` / `StandardPreview` — เพิ่มเคส conditionalMode: สรุปว่า "เงื่อนไขพิเศษ N กฎ"
+ พรีวิวแต่ละกฎย่อๆ

### A.5 ConditionalStandardsDialog (component ใหม่)

`src/components/lis/ConditionalStandardsDialog.tsx` — คล้าย `SubstanceStandardsDialog`
รับ `field`, `allParameters`, `currentParameterId`, `onSave`

แต่ละกฎ = 1 การ์ด เรียงลำดับได้ (ขึ้น/ลง — สำคัญเพราะ first-match):

```
┌─ กฎ #1   [ป้ายชื่อ: ก้อนใหญ่]                 ↑ ↓ 🗑 ─┐
│  ถ้า (AND):                                           │
│   [ลักษณะ ▾] [= ▾] [ก้อนใหญ่ ▾]                 + ลบ  │
│   (+ เพิ่มเงื่อนไข)                                    │
│  → เกณฑ์: [ระหว่าง ▾] [23.5] ถึง [26]                 │
│  พรีวิว: ก้อนใหญ่ → ค่าปกติ 23.5–26 ก.               │
└───────────────────────────────────────────────────────┘
[+ เพิ่มกฎ]   [+ เพิ่มแถว default (ไม่มีเงื่อนไข)]
```

dropdown "field ต้นทาง":

- field พี่น้องใน parameter เดียวกัน (label ของ valueFields อื่น, ตัดตัวเอง)
- + เลือกข้าม parameter ได้ (จาก `allParameters`, ตัด `currentParameterId` ออกได้หรือคงไว้ก็ได้)
- ถ้า source field เป็น enum → ช่องค่าเป็น dropdown ตัวเลือกของ field นั้น
- ถ้า source field เป็นตัวเลข → input เลข + ตัวกระทำเชิงเลข
- ถ้า source field เป็น text → input ข้อความ + eq/ne

ตัวช่วยอธิบายกฎ (`describeRule`) วางใน `src/lib/standardOperators.ts`

---

## B. ค่าแบชล่าสุด (display-only)

ขอบเขต **v1 = QC เท่านั้น** (Lab ต่อทีหลังด้วย pattern เดียวกัน)

### B.1 Data model

เพิ่มบน `ParameterValueField`:

```ts
showLastBatch?: boolean;   // opt-in ต่อ field; ใช้กับ number/float/enum/text
```

### B.2 Backend

denormalize common name ลงผลตรวจ — **client ส่ง `commonName` มาตอนเซฟ**
(client มี helper `getItemCommonName` อยู่แล้ว ไม่ต้อง port logic ไป server)

- `server/models/QCTestResult.js`: เพิ่ม field `commonName: { type: String }`
  + index `{ commonName: 1, parameterId: 1, enteredAt: -1 }`
- route เซฟผล QC (`server/routes/qcResults.js`): รับ `commonName` จาก body แล้วเก็บลง result
- endpoint ใหม่:
  `GET /qc-results/last-values?commonName=&parameterId=&excludePetitionId=`
  → คืนผลล่าสุด (เรียงตาม `enteredAt`/`updatedAt` ใหม่สุด) ของ commonName+parameter นั้น
  ที่ไม่ใช่ petition ปัจจุบัน: `{ petitionNo, enteredAt, values }` (หรือ `{}` ถ้าไม่มี)
- ของเก่าที่ไม่มี commonName ไม่ต้อง backfill (ฟีเจอร์มองไปข้างหน้า); ถ้าต้องการให้เทียบ
  ผลเก่าด้วยค่อยเขียน backfill script ทีหลัง

mount endpoint ทั้ง `/api/*` และ `/LIS/api/*` ตาม pattern `mountApi()` เดิม

### B.3 Client

- `api.ts`: wrapper `getLastBatchValues(commonName, parameterId, excludePetitionId)`
  + ส่ง `commonName` ตอน save result
- หน้าตรวจ QC: ถ้า parameter มี field ใดเปิด `showLastBatch` → ยิง endpoint 1 ครั้งต่อ parameter,
  โชว์ `แบชก่อน: X` ข้างช่อง input (display-only, ไม่ตรวจ abnormal, ไม่กระทบ progress)

---

## จุดที่ต้องแก้ (สรุป)

Frontend:

- `src/lib/api.ts` — types `StandardCondition`, `StandardRule`, field flags `conditionalMode`/
  `conditionalStandards`/`showLastBatch`; endpoint `getLastBatchValues`; ส่ง commonName ตอน save
- `src/lib/parameterValidation.ts` — `resolveStandard`, ctx-aware abnormal, `countAbnormalInResults` ctx + tests
- `src/lib/standardOperators.ts` — `describeRule`
- `src/components/lis/ConditionalStandardsDialog.tsx` — ใหม่
- `src/pages/ParameterSettings.tsx` — โหมด 3 แบบ + dialog wiring + preview + checkbox B
- หน้าตรวจ QC (และ Lab สำหรับ A) — resolve เกณฑ์ live + โชว์เกณฑ์ที่ได้ + ค่าแบชก่อน (B = QC)

Backend:

- `server/models/QCTestResult.js` — `commonName` + index
- `server/routes/qcResults.js` — รับ commonName ตอน save + endpoint `last-values`

---

## พฤติกรรมตอนกรอกผลจริง (A)

- field ที่ conditionalMode เปิด → ใต้ช่องโชว์เกณฑ์ที่ resolve ได้แบบ live
  - resolve ได้ → `เกณฑ์: 23.5–26 ก. (ก้อนใหญ่)` + เช็ค abnormal ตามนั้น
  - ยังไม่เข้ากฎไหน → `ยังกำหนดเกณฑ์ไม่ได้ — รอกรอก "ลักษณะ"` (ไม่ตรวจ abnormal)
- เหตุผล abnormal แสดง `matchedRuleLabel` ด้วย (เช่น "หลุดเกณฑ์ ก้อนใหญ่ 23.5–26")

## นอกขอบเขต v1

- conditionalMode + substanceMode พร้อมกัน
- เงื่อนไข OR/ซ้อนชั้น (ใช้หลายแถวแทน OR)
- Lab สำหรับฟีเจอร์ B (ค่าแบชล่าสุด)
- backfill commonName ลงผลเก่า

## ความเสี่ยง / ข้อควรระวัง

- **commonName matching**: client ต้องคำนวณ common name ให้ตรงกับที่ใช้จับคู่จริง
  (ชนิดสาร+%); ถ้า item ไม่มี common name → ฟีเจอร์ B ข้ามไป (ไม่โชว์)
- **ctx ข้าม parameter**: หน้าตรวจต้องโหลดผลทุก parameter ของ item ก่อน resolve
  ให้ครบ (โดยทั่วไปโหลดอยู่แล้ว — ต้องยืนยันตอนลงแผน)
- **first-match ordering**: ลำดับกฎมีผลต่อผลลัพธ์ — UI ต้องจัดลำดับได้ชัดเจน
- **concurrent committer**: รีโปมี process อื่น commit แทรกได้ — commit เฉพาะไฟล์ตัวเองด้วย
  explicit pathspec
