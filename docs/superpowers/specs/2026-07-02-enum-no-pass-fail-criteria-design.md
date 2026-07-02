# Enum ไม่มีเกณฑ์ผ่าน/ไม่ผ่าน — มีแต่ field ตัวเลขที่ตัดสิน

วันที่: 2026-07-02
สถานะ: รออนุมัติ (spec review)

## ที่มา

หลักการที่ผู้ใช้กำหนด: ในหน้า Parameter Settings เรื่อง **การตัดสินผ่านเกณฑ์/ไม่ผ่านเกณฑ์**
- ชนิด **ตัวเลข (number/float)** เท่านั้นที่ "มีเกณฑ์" — เทียบค่าที่กรอกกับ `standardOperator`/`standardValue`
  (โหมดค่าเดียว / แยกตามสาร / เงื่อนไขพิเศษ) แล้วตัดสิน ปกติ/ไม่ปกติ อัตโนมัติ
- ชนิด **text และ enum** "ไม่มีเกณฑ์" — เป็นการบันทึกค่าเชิงคุณภาพล้วนๆ ไม่ตัดสินผ่าน/ไม่ผ่านอัตโนมัติ

ปัจจุบัน text ไม่มีเกณฑ์อยู่แล้ว (ถูกต้อง) แต่ **enum ยังตัดสิน ปกติ/ไม่ปกติ ได้** ผ่าน 2 กลไก:
1. `optionOutputs` (kind: normal/abnormal/text) — ฟีเจอร์ที่เพิ่ง push วันนี้
   (สเปกเดิม `2026-07-02-enum-option-output-design.md`)
2. `expectedValues` (legacy) — ค่าที่ไม่อยู่ในลิสต์ = ผิดปกติ

สเปกนี้ **reverse** การตัดสินผ่าน/ไม่ผ่านของ enum ทั้งหมด ให้ enum กลับไปเป็นตัวเลือกข้อความล้วนๆ

## เจตนา / ผลลัพธ์ที่ต้องการ

- enum ในหน้า Parameter Settings เหลือแค่: รายการตัวเลือก + "ต้องการคำอธิบาย" (requireNoteOn)
  + ตัวกรองตาม product (optionFilters) — **ไม่มี** ปุ่ม ปกติ/ไม่ปกติ/ข้อความ อีก
- enum จะไม่มีวันถูกมาร์คเป็น abnormal โดยระบบ — การตัดสินเชิงคุณภาพให้หัวหน้า QC กดเอง
  ในด่านอนุมัติ (ปุ่ม ปกติ/ไม่ปกติ ที่มีอยู่แล้วในหน้าอนุมัติ — ไม่แตะ)
- การนับ abnormal (`getAbnormalFlags` / `countAbnormalInResults`) มาจาก field ตัวเลขเท่านั้น

## แนวทางที่เลือก

**A. ถอดทิ้งทั้งก้อน** — ลบ `optionOutputs` + legacy `expectedValues` + ตรรกะ enum-abnormal
ทุกชั้น (schema / FE / BE / UI / tests). enum กลับไปเป็นตัวเลือกล้วน.

เหตุผล: ตรงกับ "enum ไม่มีเกณฑ์" ที่สุด, สะอาด ไม่เหลือ schema/โค้ดตายค้าง.
ข้อแลก: ช่อง "ข้อความ" (custom-display text ต่อ option ที่ optionOutputs kind=text ให้) หายไปด้วย
— ยอมรับได้ เพราะเป็นของที่เพิ่งเพิ่มวันนี้ ไม่ได้ใช้จริงในข้อมูล production

แนวทางที่พิจารณาแต่ไม่เลือก:
- **B. แค่ปิดการทำงาน** (คง schema, ทำ `isEnumAbnormal` คืน false, ซ่อน UI) — เหลือ schema/โค้ดตาย
  + ปุ่ม "ข้อความ" ลอยครึ่งๆ ไม่สะอาด
- **C. ถอดผ่าน/ไม่ผ่าน แต่เก็บ "ข้อความ"** (คง optionOutputs เฉพาะ kind=text) — งานมากกว่า A,
  เป็น fallback ถ้าภายหลังต้องการ custom-display text จริง

> จุดตัดสินใจสำหรับผู้ใช้รีวิว: ถ้าต้องการเก็บช่อง "ข้อความ" (custom-display) ให้สลับไปแนวทาง C.
> โดย default ใช้ A.

## ขอบเขตการแก้ (แนวทาง A)

### 1. Schema — `server/models/Parameter.js`
- ลบ `OptionOutputSchema` (sub-schema kind/text)
- ลบ field `optionOutputs` ออกจาก `ValueFieldSchema`
- ลบ field `expectedValues` ออกจาก `ValueFieldSchema`
- ลบ validation block ของ `optionOutputs` (orphan-drop, empty-collapse, text-requires-text)
- ลบ validation block ของ `expectedValues` (ต้องเป็น subset ของ options)
- คงไว้: `requireNoteOn` + validation (อิสระจากการตัดสินผ่าน/ไม่ผ่าน)

### 2. FE logic — `src/lib/parameterValidation.ts`
- ลบ `isEnumAbnormal`
- ลบ `optionOutputText`
- ลบ `enumNormalValues`
- ลบ `seedOptionOutputsFromLegacy`
- `isFieldAbnormal(field, value)` = `isNumericAbnormal(field, value)` เท่านั้น
- คง `isNumericAbnormal`, substance/conditional helpers, `countAbnormalInResults` (enum contribute 0 โดยปริยาย)

### 3. BE logic — `server/lib/abnormal.js`
- ลบ `isEnumAbnormal`
- `isFieldAbnormal(field, value)` = `isNumericAbnormal(field, value)` เท่านั้น
- คง export เดิม (`isNumericAbnormal`, `isFieldAbnormal`) เพื่อไม่กระทบผู้เรียก (`qcResults.js`)

### 4. Types — `src/lib/api.ts`
- ลบ type `OptionOutput`
- ลบ field `optionOutputs` และ `expectedValues` จาก `ParameterValueField`

### 5. UI — `src/pages/ParameterSettings.tsx`
- ลบบล็อกปุ่ม 3 ทาง (ปกติ/ไม่ปกติ/ข้อความ) ต่อ option + ช่อง input custom text (kind=text)
- ลบบล็อกสรุป "ไม่ปกติ: …" / "ยังไม่มีตัวเลือกที่ตั้งเป็นไม่ปกติ"
- ลบ helper: `setOptionOutput`, `setOptionText`, และการอ้าง `seedOptionOutputsFromLegacy`
- แก้ describe-summary ของ enum (ส่วน `case "enum"`): เอา branch `optionOutputs`/`expectedValues` ออก
  เหลือแค่ตัวอย่างตัวเลือก `head + more`
- ลบ `optionOutputs`/`expectedValues` จาก object ตอนสลับ type (field type reset)
- ลบ `expectedValues`/`optionOutputs` จาก field default (ถ้ามีใน DEFAULT_FIELD)
- enum block เหลือ: เพิ่ม/ลบตัวเลือก + toggle "ต้องการคำอธิบาย" + OptionFilterDialog/Badge

### 6. Testing pages — `src/pages/LabTestingDetailPage.tsx`, `src/pages/QCTestingDetailPage.tsx`
- ลบ import `optionOutputText`, `enumNormalValues`
- ลบการแสดง custom-text (`customText`)
- ลบ hint "ค่าผิดปกติ — คาดหวัง: …" (ที่ใช้ enumNormalValues)
- คงการเรียก `isFieldAbnormal` ได้ (ตอนนี้ enum คืน false เสมอ → ไม่โชว์ธงผิดปกติสำหรับ enum);
  ตรวจว่า UI ยังถูกเมื่อ enum ไม่มีสถานะผิดปกติ (ไม่มีกรอบแดง/ป้าย)

### 7. AI — `server/routes/ai.js`, `.claude/agents/parameter-builder.md`
- `ai.js`: เอา `expectedValues` ออกจาก JSON schema ตัวอย่าง + กฎข้อ 4 (subset) + คำแนะนำ
  "ถ้าโจทย์บอกค่าปกติของตัวเลือกให้ใส่ expectedValues"
- `parameter-builder.md`: อัปเดตให้เลิกอ้าง `expectedValues`/`optionOutputs` สำหรับ enum

### 8. Tests
- `server/models/Parameter.test.js`: ลบเคส `optionOutputs`/`expectedValues`
- `server/lib/abnormal.test.js`: ลบเคส enum abnormal (คงเคส numeric)
- `src/lib/parameterValidation.test.ts`: ลบเคส `isEnumAbnormal`/`optionOutputText`/
  `enumNormalValues`/`seedOptionOutputsFromLegacy` (คงเคส numeric/substance/conditional)

## ข้อมูลเดิม (ไม่ต้อง migrate)

- เอกสาร Parameter เดิมที่มี `optionOutputs`/`expectedValues` — Mongoose (strict) จะ strip
  ฟิลด์ที่ไม่รู้จักเมื่อ document ถูก save ครั้งถัดไป; ระหว่างนั้นก็ไม่มีผลเพราะ `isEnumAbnormal` ถูกลบ
- abnormal count ถูกคำนวณสดจาก `getAbnormalFlags`/`countAbnormalInResults` ไม่ได้ถูกเก็บค่าไว้
  → ไม่มีค่าเพี้ยนค้าง
- `server/seed-data/parameters.json` / `LIS-DB.parameters.json`: ฟิลด์เก่ากลายเป็น inert;
  จะถูก strip ครั้งถัดไปที่ export หลังแก้ (`npm run seed:export`) — ไม่ต้องแก้มือ

## นอกขอบเขต (ไม่แตะ)

- `assets/*.js` — build artifact จะถูกสร้างใหม่ตอน build
- text / photo / file / timer / reference field types
- ปุ่มตัดสิน ปกติ/ไม่ปกติ ของหัวหน้า QC ในด่านอนุมัติ (post-test approval flow) — ทำงานเหมือนเดิม
- `requireNoteOn` และ `optionFilters` ของ enum — คงไว้

## Testing / Verification

- `npx tsc -p tsconfig.app.json --noEmit` ผ่าน (type-check จริง; root `tsc --noEmit` เป็น no-op)
- `npm run test` (Vitest FE) ผ่าน
- `cd server && node --test` (Parameter.test.js, abnormal.test.js) ผ่าน
- Manual E2E:
  1. Parameter Settings → เพิ่ม field enum → เห็นแค่ตัวเลือก + "ต้องการคำอธิบาย" + filter (ไม่มีปุ่มปกติ/ไม่ปกติ)
  2. field ตัวเลข → ยังมีโหมดเกณฑ์ครบ (ค่าเดียว/รายสาร/เงื่อนไข)
  3. QC/Lab testing → กรอก enum แล้วไม่มีธงผิดปกติ; กรอกตัวเลขนอกเกณฑ์ → ยังขึ้นผิดปกติ
  4. เปิด parameter เดิมที่เคยตั้ง enum abnormal → ไม่ error, ไม่โชว์ปุ่มเก่า, save ได้
