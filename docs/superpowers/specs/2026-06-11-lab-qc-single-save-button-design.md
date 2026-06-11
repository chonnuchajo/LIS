# Lab/QC Testing — ปุ่มบันทึกปุ่มเดียว (single dynamic save button)

วันที่: 2026-06-11
สถานะ: design approved (pending user spec review)
ขอบเขต: frontend เท่านั้น — ไม่แตะ backend

## ปัญหา / เป้าหมาย

หน้า Lab testing detail และ QC testing detail ปัจจุบันมี **2 ปุ่ม**:
- `บันทึกแบบร่าง` (outline) — แค่ toast + navigate ออก (ค่า auto-save รายช่องอยู่แล้ว)
- `บันทึกผล` (primary) — validate ครบ → `completePetitionTrack` ปิด track ตัวเอง

ต้องการรวมเหลือ **ปุ่มเดียว** ที่เปลี่ยน label + พฤติกรรมตามความครบของช่อง `required`

## ดีไซน์

### ปุ่มเดียว แสดงผลตามสถานะความครบ

คำนวณ `isComplete = validate(effectivePhase).length === 0` ทุก render (ลอจิก `validate` มีอยู่แล้ว)

| สถานะ | label | variant / icon | onClick |
|---|---|---|---|
| required **ยังไม่ครบ** | `บันทึกแบบร่าง` | outline / Save | `handleSaveDraft` (เดิม — toast + navigate) |
| required **ครบหมด** | `บันทึก` | primary / Send | `handleSubmitResult` (ปิด track) |

ปุ่ม `disabled` ระหว่าง `submitting` เหมือนเดิม

### Confirm ตอนปิด track

`handleSubmitResult` ต้องขึ้น confirm **ทุกครั้ง** (เพราะปิด track แล้วหน้าจะ lock แก้ไม่ได้):
- ปกติ: "ยืนยันบันทึกผล? หลังจากบันทึกแล้วจะแก้ไขไม่ได้"
- ถ้า `abnormalCount > 0`: รวมข้อความเตือนค่าผิดปกติเข้าไปใน dialog เดียวกัน (ไม่ขึ้น 2 ครั้ง)

ถ้า user กดยกเลิก → ไม่ทำอะไร (ค่ายัง draft อยู่)

### Flow ส่ง QC (ไม่เปลี่ยน — backend เดิม)

แต่ละฝั่ง (Lab / QC) กด `บันทึก` ปิด track ของตัวเอง → `completePetitionTrack(petition._id, 'lab'|'qc', ...)`
พอ **ครบทั้ง 2 ฝั่ง** backend ตั้ง `status = 'success'` แล้วเข้าคิว QC อนุมัติ **อัตโนมัติ** (gate มีอยู่แล้ว)

## สิ่งที่ไม่เปลี่ยน

- auto-save รายช่อง, ระบบ Phase 1/2, การ lock หน้าหลังปิด track (`labCompletedAt` / `qcCompletedAt`)
- ลอจิก backend ทั้งหมด รวมถึง dual-track gating
- กล่อง "บันทึกผลแล้ว" เมื่อ `status === 'success'`

## ไฟล์ที่แตะ

- `src/pages/LabTestingDetailPage.tsx` — ส่วน render ปุ่ม (~บรรทัด 973-998) + ปรับ `handleSubmitResult` ให้ confirm ทุกครั้ง
- `src/pages/QCTestingDetailPage.tsx` — ส่วน render ปุ่ม (~บรรทัด 1019-1042) + ปรับ `handleSubmitResult` ให้ confirm ทุกครั้ง

## Verification

- `npx tsc -p tsconfig.app.json --noEmit` ผ่าน
- `npm run lint` ผ่าน
- manual: required ไม่ครบ → เห็นปุ่ม `บันทึกแบบร่าง`; กรอกครบ → ปุ่มเปลี่ยนเป็น `บันทึก`; กด → ขึ้น confirm; ยืนยัน → ปิด track + lock
