# ปลด lock เลขที่ใบนำส่ง (submissionNo) — Design

วันที่: 2026-06-05
สถานะ: approved

## ปัญหา

ช่อง "เลขที่ใบนำส่ง" (`submissionNo`) ถูกบังคับให้เท่ากับเลขคำขอ (`petitionNo`) เสมอ และ
lock ไม่ให้แก้ ใน 4 จุด:

- `src/components/petition/wizard/ItemsStep.tsx` — `<Input readOnly disabled>` ราย item
- `src/pages/PetitionEditPage.tsx:112` — set `submissionNo = data.petitionNo`
- `server/routes/petitions.js:339` (create) — เขียนทับ `submissionNo = petitionNo` ทุก item
- `server/routes/petitions.js:543` (update) — เขียนทับ `submissionNo = before.petitionNo` ทุก item

กฎทางธุรกิจเปลี่ยน: เลขใบนำส่งไม่จำเป็นต้องเท่าเลขคำขออีกต่อไป ต้องกรอกเองได้

## พฤติกรรมที่ต้องการ

- ผู้ใช้พิมพ์เลขใบนำส่งเองได้
- ถ้าเว้นว่าง → backend ตั้ง default = เลขคำขอ (`petitionNo`) ให้อัตโนมัติตอนบันทึก
- เป็น **ช่องเดียวต่อใบคำขอ** (ใช้ร่วมทุก item) ไม่ใช่รายตัวอย่าง
- ตำแหน่ง: ส่วนหัวของ step รายการตัวอย่าง (เหนือรายการ item)

## Data model

คงเดิม — `submissionNo` ยังเก็บราย item ใน `Petition.items[]` (ไม่รื้อ schema)
แต่ทุก item ในใบเดียวกันจะถูกเขียนด้วยค่าเดียวกันตอน save จึงรองรับ print template /
PetitionView ที่อ่าน `item.submissionNo` ได้โดยไม่ต้องแก้

## การเปลี่ยนแปลง

### Frontend

**`src/components/petition/wizard/ItemsStep.tsx`**
- เพิ่ม props: `submissionNo: string`, `onSubmissionNoChange: (value: string) => void`
- ลบช่อง `submissionNo` รายตัว (readOnly/disabled) ที่อยู่ในลูป item ออก
- เพิ่มช่อง 1 ช่อง แก้ได้ ที่ header ของ step (เหนือรายการ item)
  - label: "เลขที่ใบนำส่ง"
  - helper/placeholder: "เว้นว่าง = ใช้เลขคำขออัตโนมัติ"

**`src/pages/petitions/ProductionPetitionNewPage.tsx`**
- ถือ `submissionNo` ใน state ระดับหน้า (ค่าเดียว)
- ส่ง `submissionNo` + `onSubmissionNoChange` เข้า `<ItemsStep>`
- ตอน submit: `items.map(it => ({ ...it, submissionNo }))` เขียนค่าลงทุก item
- (`makeBlankItem` ยังคง `submissionNo: ''` ได้ — ค่าจริงมาจาก state ระดับหน้าตอน submit)

**`src/pages/PetitionEditPage.tsx`**
- โหลดค่าเดิม: `submissionNo = data.items[0]?.submissionNo || data.petitionNo`
  (แทนบรรทัด 112 ที่บังคับ = `data.petitionNo`)
- ถือใน state, ส่งเข้า `<ItemsStep>` เหมือนหน้า new
- ตอน submit: เขียน `submissionNo` ลงทุก item เช่นกัน

### Backend (`server/routes/petitions.js`)

- create (บรรทัด 339):
  `const items = body.items.map((it) => ({ ...it, submissionNo: (it.submissionNo || '').trim() || petitionNo }));`
- update (บรรทัด 543):
  `updates.items = updates.items.map((it) => ({ ...it, submissionNo: (it.submissionNo || '').trim() || before.petitionNo }));`

## ผลข้างเคียง (ไม่ต้องแก้)

`PetitionPrintTemplate`, `SampleLabelPrintTemplate`, `PetitionView` อ่าน `item.submissionNo`
ทำงานต่อได้ เพราะทุก item ยังมีค่า (เท่ากันทั้งใบ)

## Test

1. เว้นว่าง → save → ทุก item ได้ `submissionNo = petitionNo`
2. กรอกเอง "DN-123" → save → ทุก item ได้ `submissionNo = "DN-123"`
3. แก้ใบเก่า (submissionNo = petitionNo เดิม) → ฟอร์มแสดงค่าเดิม, แก้เป็นค่าใหม่แล้ว save ติด
4. (regression) print template / PetitionView ยังแสดง submissionNo ถูกต้อง
