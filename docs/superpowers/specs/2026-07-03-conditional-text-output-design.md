# เงื่อนไขพิเศษ: ผลลัพธ์เป็นข้อความ + สถานะ (Conditional Text Output)

วันที่: 2026-07-03
สถานะ: Draft — รอผู้ใช้ review ก่อนทำ implementation plan

## 1. ที่มา / ปัญหา

ผู้ใช้ต้องการให้ช่องกรอกผลตัวเลข map "ช่วงค่า → ข้อความผลลัพธ์" แบบ IF/else เช่น

```
if (this.parameter อยู่ในช่วง 5.5–6.5) output "ก้อนเล็ก"
else if (this.parameter อยู่ในช่วง 23.5–26) output "ก้อนใหญ่"
```

ปัจจุบันโหมด **"เงื่อนไขพิเศษ" (`conditionalMode`)** มีอยู่แล้ว และทำ IF/else ได้จริง (ไล่กฎบนลงล่าง เจอกฎแรกที่เข้าใช้กฎนั้น, AND ภายในกฎ, เพิ่มกฎ = OR) — แต่มี 2 ข้อจำกัดที่ไม่ตรงกับที่ต้องการ:

1. **ผลลัพธ์ของกฎเป็น "เกณฑ์ตัวเลข"** (operator/value ไว้ตัดสินปกติ/ผิดปกติ) ไม่ใช่ "ข้อความ"
2. **เงื่อนไขอ้างได้เฉพาะ field อื่น** (ตัดตัวเองออก) จึงเขียน `this.parameter` ไม่ได้

## 2. เป้าหมาย

- ช่องตัวเลข (number/float) ในโหมดเงื่อนไขพิเศษ เลือก "ชนิดผลของกฎ" ได้ 2 แบบ:
  - **เกณฑ์ตัวเลข** — พฤติกรรมเดิม ไม่เปลี่ยน
  - **ข้อความ + สถานะ** — กฎแต่ละข้อให้ `ข้อความ` (เช่น "ก้อนเล็ก") + `ปกติ/ผิดปกติ`
- เงื่อนไขอ้าง "ค่าตัวเอง" (`this.parameter`) ได้ นอกเหนือจาก field อื่น (sibling / ต่าง parameter) ที่ทำได้อยู่แล้ว
- ผู้ตรวจกรอกเลขตามปกติ → ระบบคำนวณข้อความผลลัพธ์ให้อัตโนมัติ **(อ่านอย่างเดียว)** + ไฮไลต์สถานะ
- **ไม่เข้ากฎไหนเลย = ผิดปกติอัตโนมัติ**

## 3. Non-goals (ตัดออก — YAGNI)

- ไม่เก็บข้อความผลลัพธ์ซ้ำใน DB — **คำนวณสดตอนแสดงผล** (สอดคล้องกับ `optionOutputText` / `resolveStandard` เดิม)
- ไม่ให้ผู้ตรวจแก้ข้อความผลลัพธ์เอง (read-only)
- ไม่ทำ field แยกไว้ใส่ข้อความ no-match — ถ้าต้องการข้อความกำกับตอนตกร่อง ให้เพิ่ม "แถว default" (กฎไม่มีเงื่อนไข) ปิดท้ายแล้วตั้งเป็นผิดปกติ (ใช้กลไก default row เดิม)
- ไม่แตะโหมด "ค่าเดียว" / "แยกตามสาร" / enum optionOutputs

## 4. Data model

### 4.1 `StandardRule` (เพิ่ม 2 ฟิลด์)

`src/lib/api.ts` + `StandardRuleSchema` ใน `server/models/Parameter.js`:

```ts
type StandardRule = {
  label?: string;
  conditions: StandardCondition[];
  // ผลแบบ "เกณฑ์ตัวเลข" (เดิม) — ใช้เมื่อ field.conditionalResult === 'standard'
  operator: StandardOperator;
  value: number | null;
  value2?: number | null;
  // ผลแบบ "ข้อความ + สถานะ" (ใหม่) — ใช้เมื่อ field.conditionalResult === 'output'
  outputText?: string;                    // ข้อความที่แสดง เช่น "ก้อนเล็ก"; ว่าง = fallback ไปใช้ label
  outputKind?: 'normal' | 'abnormal';     // default 'normal'
};
```

Schema: `outputText: { type: String, default: '' }`, `outputKind: { type: String, enum: ['normal','abnormal'], default: 'normal' }`.

### 4.2 `ParameterValueField` (เพิ่มตัวแยกโหมด)

```ts
conditionalResult?: 'standard' | 'output';   // default 'standard'
```

Schema (ValueFieldSchema): `conditionalResult: { type: String, enum: ['standard','output'], default: 'standard' }`.

> Back-compat: ข้อมูลเดิมไม่มีฟิลด์นี้ → default `'standard'` → พฤติกรรมเดิมทุกประการ ไม่ต้อง migrate

### 4.3 Validation (`Parameter.js` pre('validate'))

เมื่อ `conditionalMode === true` และ `conditionalResult === 'output'`:
- ทุกกฎต้องมี `outputText` หรือ `label` อย่างน้อยหนึ่ง (มิฉะนั้น error: `ช่อง "<label>": ต้องระบุข้อความผลลัพธ์ของกฎ`)
- `operator/value` ไม่บังคับ (ถูก ignore)

เมื่อ `conditionalResult !== 'output'` → คงกฎเดิมทั้งหมด ไม่เปลี่ยน

## 5. Evaluation semantics

### 5.1 อ้างค่าตัวเอง
`this.parameter` = ค่าของ field เอง อยู่ใน `ctx.sameParam[field.label]` อยู่แล้ว ดังนั้น condition
`{ sourceParameterId: null, sourceFieldLabel: field.label, op: 'between', value: 5.5, value2: 6.5 }`
resolve ได้ทันทีด้วย `conditionSourceValue` เดิม **โดยไม่ต้องแก้ core** — เพียงเพิ่ม field ปัจจุบันเข้า "ตัวเลือก field ต้นทาง" ใน dialog

### 5.2 ฟังก์ชันใหม่ `resolveConditionalOutput`

`src/lib/parameterValidation.ts`:

```ts
type ResolvedOutput = { text: string; kind: 'normal' | 'abnormal'; matchedRuleLabel?: string };

function resolveConditionalOutput(
  field: ParameterValueField,
  ctx: ConditionContext,
): ResolvedOutput | null {
  if (!field.conditionalMode || field.conditionalResult !== 'output') return null;
  for (const rule of field.conditionalStandards ?? []) {
    if ((rule.conditions ?? []).every((c) => evalCondition(c, ctx))) {
      return {
        text: (rule.outputText && rule.outputText.trim()) || rule.label || '',
        kind: rule.outputKind ?? 'normal',
        matchedRuleLabel: rule.label,
      };
    }
  }
  // ไม่เข้ากฎไหนเลย = ผิดปกติอัตโนมัติ
  return { text: '', kind: 'abnormal' };
}
```

**Blank guard (ตัดสินแล้ว):** ก่อนไล่กฎ ถ้าค่าของ field เอง (`ctx.sameParam[field.label]`) ยังว่าง/undefined → คืน `null` (ยังไม่ flag) เพื่อไม่ให้ทุกช่องที่ยังไม่กรอกขึ้นแดงทันที — flag เฉพาะเมื่อ "กรอกค่าแล้วแต่ตกร่อง"

หมายเหตุ: no-match (กรอกค่าแล้วแต่ไม่เข้าช่วง) คืน `text: ''` แต่ `kind: 'abnormal'`

### 5.3 abnormal
- helper `isConditionalOutputAbnormal(field, ctx)` = `resolveConditionalOutput(field, ctx)?.kind === 'abnormal'`
- ต่อในเส้นทาง conditional ที่มี `ctx` อยู่แล้ว (ไม่ผ่าน `isFieldAbnormal(field, value)` ปกติ เพราะ output ไม่ได้เทียบ value กับ standard)

## 6. Integration points

### 6.1 Frontend logic — `src/lib/parameterValidation.ts`
- เพิ่ม `resolveConditionalOutput`, `isConditionalOutputAbnormal`
- `countAbnormalInResults`: ในลูป field ปัจจุบันมี branch `field.conditionalMode && isNumeric → resolveFieldStandard`; เพิ่มก่อนหน้า: ถ้า `conditionalResult === 'output'` → `if (isConditionalOutputAbnormal(field, ctx)) count += 1` แล้ว `continue` (ไม่วน `fieldValueList` ตัดสินซ้ำ)

### 6.2 Backend logic (ต้อง sync)
- `server/lib/abnormal.js`: เพิ่ม mirror `isConditionalOutputAbnormal` (หรือ resolve loop เทียบเท่า) — คอมเมนต์บนไฟล์ระบุ "KEEP IN SYNC"
- `server/routes/qcResults.js`: endpoint `/abnormal-flags` คำนวณ conditional abnormal ซ้ำเองด้วย `resolveFieldStandardJS` + `isFieldAbnormal`. เพิ่มสาขา output: ถ้า `field.conditionalResult === 'output'` → ใช้ resolve-output loop (JS mirror ของ 5.2) เช็ค `kind==='abnormal'` แทน (มี `evalConditionJS` อยู่แล้ว reuse ได้)

### 6.3 UI — Parameter editor `src/pages/ParameterSettings.tsx`
- ในบล็อก `field.conditionalMode` (ราว 1324–1360) เพิ่มสวิตช์ radio **"ผลของกฎ: [เกณฑ์ตัวเลข] [ข้อความ+สถานะ]"** → เซ็ต `field.conditionalResult`
- `setMode` (ราว 1300): เมื่อออกจากโหมด conditional ให้รีเซ็ต `conditionalResult` กลับ `'standard'`
- ส่ง prop `resultMode = field.conditionalResult ?? 'standard'` เข้า `ConditionalStandardsDialog`
- บรรทัดสรุปกฎ (`describeRule`) → เลือกใช้ `describeOutputRule` เมื่อ output

### 6.4 UI — `src/components/lis/ConditionalStandardsDialog.tsx`
- รับ prop `resultMode: 'standard' | 'output'`
- เพิ่ม field ปัจจุบันเข้า `sources` (ป้าย เช่น "ช่องนี้ (ค่าที่กรอก)") — ปัจจุบัน `siblingFields` ตัดตัวเองออก จึงต้องส่ง current field แยกเข้ามา หรือเพิ่มใน sources ภายใน dialog
- เมื่อ `resultMode === 'output'`: แทนแถว "→ เกณฑ์ (operator/value/value2)" ด้วย
  **"→ ผลลัพธ์: [Input ข้อความ] [Select ปกติ/ผิดปกติ]"** (patch `outputText` / `outputKind`)
- `addRule`: ตอน output ให้ default `{ outputText:'', outputKind:'normal', conditions:[...] }`
- ป้ายชื่อกฎ / จัดลำดับ / AND-OR / แถว default ใช้ต่อได้เหมือนเดิม

### 6.5 UI — หน้าตรวจ QC/Lab (`QCTestingDetailPage.tsx`, `LabTestingDetailPage.tsx`)
- จุดที่ตอนนี้คำนวณ `resolvedStandardText` (ราว 1209–1225 ของ QC): เพิ่มสาขา output — `const out = resolveConditionalOutput(unit.field, condCtx)` แล้วโชว์ `out.text` เป็น chip ผลลัพธ์ (อ่านอย่างเดียว) + ย้อมสีจาก `out.kind`
- จุดนับ abnormal ในหน้า (ราว 855–857) และ badge ต่อ field ต้องรวม output-abnormal (ผ่าน ctx)

### 6.6 อนุมัติ — `src/lib/qcApprovalRows.ts`
- ราว 110–139: สำหรับ output-mode ให้ `standardText` = ข้อความผลลัพธ์ (`out.text` + label), `abnormal` = `out.kind === 'abnormal'`, `value` = เลขดิบที่กรอก
- `getAbnormalFlags` / ด่านหัวหน้าอนุมัติ เห็นสถานะจาก output ครบ

### 6.7 describe helper — `src/lib/standardOperators.ts`
- เพิ่ม `describeOutputRule(rule)` → เช่น `เมื่อ <เงื่อนไข> → "ก้อนเล็ก" (ปกติ)`
- (ถ้าจำเป็น) `describeConditionalOutput(resolved)` สำหรับหน้าตรวจ

## 7. Tests

- `src/lib/parameterValidation.test.ts`:
  - first-match-wins คืนกฎแรกที่เข้า
  - no-match → `{ kind:'abnormal' }`
  - self-condition (`this.parameter between`) eval ถูก
  - `outputText` ว่าง → fallback ไป `label`
  - `countAbnormalInResults` นับ output-abnormal ถูก
- `server/models/Parameter.test.js`: persist `outputText`/`outputKind`/`conditionalResult`; validation output ต้องมีข้อความ
- `server/lib/abnormal.test.js`: mirror output-abnormal ให้ผลตรงกับ FE

## 8. Edge cases / คำถามค้าง

### 8.1 ยังไม่กรอกค่า (blank) — ตัดสินแล้ว (ดู 5.2 Blank guard)
`resolveConditionalOutput` คืน `null` เมื่อค่าของ field เองยัง blank → ไม่ flag จนกว่าจะกรอก. flag เฉพาะ "กรอกค่าแล้วตกร่อง". ยืนยันได้ตอน review ถ้าอยากได้พฤติกรรมอื่น

### 8.2 multiple / substanceMode
- `conditionalResult==='output'` ควรใช้ได้กับ field ธรรมดา (ไม่ substanceMode — mutually exclusive อยู่แล้ว)
- ร่วมกับ `multiple` (กรอกหลายค่า): ค่อยพิจารณา — เบื้องต้นถือว่าไม่รองรับพร้อมกัน (กันไว้ใน validation) เว้นผู้ใช้ต้องการ

## 9. ลำดับงาน (คร่าว — รายละเอียดไปที่ implementation plan)
1. Schema + types + validation (+ Parameter.test.js)
2. `resolveConditionalOutput` + abnormal FE (+ parameterValidation.test.ts)
3. BE sync: `abnormal.js` + `qcResults.js` (+ abnormal.test.js)
4. Dialog (resultMode + self source + แถวผลลัพธ์)
5. ParameterSettings (สวิตช์ + reset + describe)
6. หน้าตรวจ QC/Lab + qcApprovalRows + standardOperators
7. Manual E2E
