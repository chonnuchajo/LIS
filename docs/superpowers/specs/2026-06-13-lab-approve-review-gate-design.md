# ผูกฟอร์มทบทวนข้อตกลงเข้ากับการอนุมัติผล Lab

**วันที่:** 2026-06-13
**สถานะ:** design — รอ user review

## ปัญหา / เป้าหมาย

ปัจจุบันที่หน้า `/lab-approval/:id` (`LabApprovalReviewPage.tsx`) การอนุมัติกับการกรอกฟอร์มทบทวนข้อตกลงเป็น 2 ขั้นแยกกันอิสระ:

- ปุ่ม **"อนุมัติผล Lab"** → เด้ง `ConfirmDialog` ยืนยันใช่/ไม่ใช่ → `api.labApprovePetition` ทันที (ไม่บังคับให้กรอกทบทวน)
- ปุ่ม **"กรอกการทบทวน / แก้ไขการทบทวน"** บนการ์ด → เปิด `LabAgreementReviewDialog` กรอก review แล้ว `saveLabAgreementReview` เฉยๆ

ผลคือหัวหน้า Lab อนุมัติได้โดยไม่ได้กรอกฟอร์มทบทวนข้อตกลง

เป้าหมาย: ทำให้การกด "อนุมัติผล Lab" บังคับผ่านฟอร์มทบทวนก่อน แล้วยืนยันอีกชั้นถึงจะอนุมัติจริง

## Flow ใหม่ — ปุ่ม "อนุมัติผล Lab"

1. กด "อนุมัติผล Lab" → เปิด `LabAgreementReviewDialog` (pre-fill ด้วย `currentReview` ถ้าเคยกรอก)
2. หัวหน้า Lab กรอก/ตรวจ → กด "บันทึกการทบทวน"
3. บันทึก review สำเร็จ → ฟอร์มปิด → เด้ง `ConfirmDialog` ("อนุมัติผล Lab นี้?")
4. กดยืนยัน → `api.labApprovePetition` → toast → `navigate("/lab-approval")`
5. ถ้า **ยกเลิก** ฟอร์มทบทวน (ปิดโดยไม่บันทึก) → ยกเลิกทั้งหมด ไม่มี confirm ไม่อนุมัติ

**ไม่บล็อกตามค่าในฟอร์ม** — แม้เลือก "ไม่พร้อมรับงาน" (`acceptable = false`) ก็ยังกดอนุมัติต่อได้ตามปกติ (หัวหน้า Lab รับผิดชอบเอง)

## สิ่งที่คงเดิม (ไม่แตะ)

- ปุ่ม **"กรอกการทบทวน / แก้ไขการทบทวน"** บนการ์ด — คงไว้ ใช้กรอก/แก้ review โดยไม่อนุมัติ (เปิด dialog เดียวกัน แต่ไม่มี confirm + approve ตามหลัง)
- ปุ่ม **"ส่งกลับให้แก้"** (reject → `RevisionRequestDialog`) — คงเดิมทั้งหมด
- `LabAgreementReviewDialog` component — ไม่ต้องแก้ logic ภายใน
- `handleReject`, `saveLabAgreementReview`, payload ของ review — ไม่เปลี่ยน

## การเปลี่ยนในโค้ด

ทั้งหมดอยู่ใน `src/pages/LabApprovalReviewPage.tsx` ไฟล์เดียว

### State ใหม่
- `pendingApprove: boolean` — แยกว่า `LabAgreementReviewDialog` ถูกเปิดมาจาก flow อนุมัติ (`true`) หรือจากปุ่มแก้ไขเฉยๆ (`false`)

### ปุ่ม "อนุมัติผล Lab" (`onClick`)
เปลี่ยนจากเรียก `handleApprove` (ที่ confirm ทันที) เป็น:
```
setPendingApprove(true);
setReviewDialogOpen(true);
```

### ปุ่ม "กรอกการทบทวน / แก้ไขการทบทวน" (`onClick`)
คงเดิม แต่ระบุชัดว่าไม่ใช่ flow อนุมัติ:
```
setPendingApprove(false);
setReviewDialogOpen(true);
```

### `handleSaveReview(draft)`
หลังบันทึก review สำเร็จ (toast + `refreshLabRequests()` เดิม) เพิ่ม:
- ปิดฟอร์มทบทวน (`setReviewDialogOpen(false)`) ก่อน
- ถ้า `pendingApprove === true`:
  - เคลียร์ `setPendingApprove(false)`
  - เรียกลำดับ confirm + approve เดิม (logic เดียวกับ `handleApprove` ปัจจุบัน): `await confirm({...})` → ถ้ายืนยัน `api.labApprovePetition` → toast → navigate
- ถ้าบันทึก review ล้มเหลว → ไม่ต่อ approve (ปล่อย throw เดิม) และคง `pendingApprove` ไว้ให้ลองใหม่ได้

### `onOpenChange` ของ `LabAgreementReviewDialog` (กดยกเลิก/ปิด)
เมื่อ dialog ปิด (`open === false`) ให้เคลียร์ `setPendingApprove(false)` เสมอ
- กรณีกดบันทึกสำเร็จ: `handleSaveReview` เคลียร์ flag + จัดการ approve ไปแล้วก่อน dialog ปิด → onOpenChange ไม่ทำซ้ำ (flag เป็น false อยู่แล้ว)
- กรณีกดยกเลิก: flag ยังเป็น true → เคลียร์ → ไม่อนุมัติ

### `handleApprove` เดิม
แตก logic ส่วน confirm+approve+navigate ออกมาเป็นฟังก์ชันที่ใช้ซ้ำได้ (เช่น `runApprove()`) เพื่อเรียกจาก `handleSaveReview` flow อนุมัติ ตัวปุ่มไม่เรียก `handleApprove` ตรงๆ อีกต่อไป

## ความเสี่ยง: dialog ซ้อน / body pointer-events ค้าง

review dialog ปิดแล้ว confirm dialog เปิดติดกันทันที — เป็นจุดที่เคยเจอบั๊ก Radix lock `body { pointer-events: none }` ค้างจน nav กดไม่ได้ (ดู memory `confirm_dialog_pointer_events_fix`)

มาตรการ:
- เรียก `releaseBodyPointerLock()` (มีอยู่แล้วใน `@/context/ConfirmDialog`) ก่อนเปิด confirm
- `LabAgreementReviewDialog.close()` เรียก `releaseBodyPointerLock` ตอนปิดอยู่แล้ว และมี global `RoutePointerLockGuard` กันอีกชั้นตอน route เปลี่ยน
- หลัง approve มี `navigate("/lab-approval")` อยู่แล้ว ซึ่ง guard จะเคลียร์ lock ให้

## Testing

- หน่วยทดสอบ logic ลำดับ flow ทำได้ยากเพราะผูกกับ dialog + confirm provider → เน้น **manual E2E**:
  1. กดอนุมัติ → ฟอร์มทบทวนเด้ง → บันทึก → confirm เด้ง → ยืนยัน → อนุมัติสำเร็จ กลับหน้า list
  2. กดอนุมัติ → ฟอร์มทบทวนเด้ง → กดยกเลิก → ไม่มี confirm ไม่อนุมัติ ปุ่ม/ nav ยังกดได้ (เช็ค pointer-events ไม่ค้าง)
  3. กด "กรอกการทบทวน" (ปุ่มบนการ์ด) → บันทึก → ไม่มี confirm ไม่อนุมัติ (review ถูกบันทึกเฉยๆ)
  4. เลือก "ไม่พร้อมรับงาน" แล้วกดอนุมัติ → ยังอนุมัติต่อได้
  5. ปุ่ม "ส่งกลับให้แก้" → ยังทำงานเหมือนเดิม
- `npx tsc -p tsconfig.app.json --noEmit` ไม่มี error ใหม่ (ดู memory `real_typecheck_command` — root `tsc --noEmit` เป็น no-op)
- `npm run lint`

## Out of scope

- ไม่บังคับ validation ฟิลด์ใน review (กรอกไม่ครบก็บันทึก/อนุมัติได้)
- ไม่แตะ print template, schema `LabRequest`, หรือ backend route
- ไม่แตะ flow QC อนุมัติ
