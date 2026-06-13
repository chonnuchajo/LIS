# ฟอร์มทบทวนข้อตกลง — โชว์ section ตามวิธีทดสอบ

**วันที่:** 2026-06-13
**สถานะ:** design — อนุมัติแล้ว

## ปัญหา / เป้าหมาย

`LabAgreementReviewDialog` (ฟอร์มที่หัวหน้า Lab กรอกทบทวนข้อตกลง) แสดง 2 section เสมอ:
- "กรณีลูกค้าระบุวิธีทดสอบตามปกติ" (บุคลากร / ปริมาณงาน / sub-contractor)
- "กรณีลูกค้าระบุวิธีการทดสอบตามเอกสารของลูกค้า" (พิจารณาวิธี / เครื่องมือ)

ต้องการให้แต่ละ section โผล่ตามวิธีทดสอบที่ลูกค้าระบุ (ข้อ 2 ในใบคำขอ): 2.1 วิธีปกติ → section วิธีปกติ, 2.2 วิธีเฉพาะตามเอกสารของลูกค้า → section วิธีเฉพาะ

## ข้อเท็จจริงของข้อมูล

- `testMethod` เก็บที่ `LabRequest.serviceAgreement.testMethod` ชนิด `'standard' | 'custom' | 'previous'`
- ต่อ 1 คำร้องมีวิธีเดียว (ทุก LabRequest ใน petition ใช้ค่าเดียวกัน) — **ไม่มีเคสวิธีปนกัน**
- `'previous'` ("เคยทำ") เป็นกรณีย่อยของวิธีเฉพาะ (ใน `LabRequestStep` ปุ่ม custom ติ๊กเมื่อ `custom` หรือ `previous`)

## พฤติกรรมที่ต้องการ

ตัดสินด้วยค่าเดียว `testMethod` ของคำร้อง:
- `standard` → โชว์เฉพาะ section **วิธีปกติ**
- `custom` หรือ `previous` → โชว์เฉพาะ section **วิธีเฉพาะ**
- ไม่ระบุ (undefined/null) → ถือเป็น standard (ตรงโน้ตในฟอร์ม "2.1 กรณีลูกค้าไม่ระบุวิธี")
- section "สรุปความพร้อมของงานบริการ" + ช่องหมายเหตุ ท้ายฟอร์ม → **โชว์เสมอ** (ใช้ร่วมกันทั้งสองวิธี)

นิยาม: `isCustom = testMethod === 'custom' || testMethod === 'previous'`
- section วิธีปกติ render เมื่อ `!isCustom`
- section วิธีเฉพาะ render เมื่อ `isCustom`

## การเปลี่ยนในโค้ด

### 1. `src/pages/LabApprovalReviewPage.tsx`
- ดึงวิธีทดสอบของคำร้อง: `const testMethod = labRequests?.[0]?.serviceAgreement?.testMethod;`
- ส่งเป็น prop ใหม่ให้ dialog: `<LabAgreementReviewDialog ... testMethod={testMethod} />`

### 2. `src/components/review/LabAgreementReviewDialog.tsx`
- เพิ่ม optional prop `testMethod?: TestMethod` (import `TestMethod` จาก `@/types/labRequest.types`)
- คำนวณ `const isCustom = testMethod === 'custom' || testMethod === 'previous';`
- ครอบ `<section>` วิธีปกติ (หัวข้อ "กรณีลูกค้าระบุวิธีทดสอบตามปกติ") ด้วย `{!isCustom && ( ... )}`
- ครอบ `<section>` วิธีเฉพาะ (หัวข้อ "กรณีลูกค้าระบุวิธีการทดสอบตามเอกสารของลูกค้า") ด้วย `{isCustom && ( ... )}`
- section สรุป + footer ไม่แตะ

## ไม่อยู่ใน scope (ไม่แตะ)

- **`PetitionPrintTemplate.tsx`** — เป็น layout ใบทางการ FM-QP-07-01-001 ที่พิมพ์ทั้งสอง section ไว้ และติ๊กช่องตาม `isStandardMethod`/`isCustomMethod` อยู่แล้ว → คงเดิม
- **`LabAgreementReviewView.tsx`** — render รายฟิลด์ตามข้อมูลที่มีอยู่แล้ว (ฟิลด์ฝั่งที่ไม่ได้กรอกจะไม่ขึ้นเอง) → ไม่ต้องแก้
- ไม่ลบ/เคลียร์ข้อมูลฝั่ง section ที่ซ่อน (คำร้องวิธีเดียว ฝั่งที่ซ่อนไม่เคยถูกกรอก) — YAGNI
- ไม่แตะ schema / backend

## Testing

- `npx tsc -p tsconfig.app.json --noEmit` ไม่มี error ใหม่ในสองไฟล์นี้ (root `tsc --noEmit` เป็น no-op)
- `npm run lint`
- Manual E2E:
  1. คำร้องวิธี standard → เปิดฟอร์มทบทวน เห็นเฉพาะ section วิธีปกติ + สรุป
  2. คำร้องวิธี custom (หรือ previous) → เห็นเฉพาะ section วิธีเฉพาะ + สรุป
  3. กรอก + บันทึก + อนุมัติ (flow ใหม่จากงานก่อนหน้า) ผ่านได้ทั้งสองกรณี
