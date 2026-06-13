# การทบทวนข้อตกลงการบริการทดสอบ — ส่วน "สำหรับหัวหน้าห้องปฏิบัติการ"

วันที่: 2026-06-13 · สาขา: develop

## ปัญหา / เป้าหมาย

แบบฟอร์ม **FM-QP-07-01-001 R02 การทบทวนข้อตกลงการบริการทดสอบ** มีสองครึ่ง:

- **สำหรับลูกค้ากรอก** — เก็บใน `LabRequest.serviceAgreement` กรอกตอนสร้าง/แก้คำร้อง (มีอยู่แล้ว)
- **สำหรับหัวหน้าห้องปฏิบัติการ** — เก็บใน `LabRequest.labAgreementReview` มีใน schema และต่อเข้ากับ print template แล้ว **แต่ไม่มี UI กรอก** จึงพิมพ์ออกมาว่างเสมอ

เป้าหมาย: เมื่อหัวหน้า Lab อนุมัติผล (หลังผู้ทดสอบยืนยันผล → เข้าคิว `/lab-approval`) ให้หัวหน้า Lab กรอกครึ่ง "สำหรับหัวหน้าห้องปฏิบัติการ" ได้

## ขอบเขตที่ตกลงแล้ว

1. **ความละเอียดฟอร์ม:** ขยายให้ครบทั้งฟอร์มกระดาษ (ไม่ใช่แค่ 4 บูลีนเดิม)
2. **การบังคับ:** ไม่บังคับก่อนอนุมัติ — เป็นขั้นแยก ปุ่ม "อนุมัติผล Lab" ทำงานอิสระเหมือนเดิม
3. **จำนวน:** กรอกครั้งเดียวต่อ 1 คำร้อง แล้ว apply ให้ทุก `LabRequest` ในคำร้องนั้น (fan-out)

## สถาปัตยกรรม: Approach A — Fan-out write

ฟอร์มรีวิวเก็บที่ `LabRequest.labAgreementReview` (print อ่านจากที่นี่อยู่แล้ว) คำร้อง 1 ใบมีได้หลาย LabRequest →
บันทึกครั้งเดียวผ่าน endpoint ใหม่ `POST /petitions/:id/lab-agreement-review` ที่เขียน `labAgreementReview` ตัวเดียวกันลง
**ทุก** LabRequest ของคำร้องนั้น ทำให้ print code อ่านจาก LabRequest ของตัวเองเหมือนเดิม เปลี่ยนแค่ชุด field ที่กว้างขึ้น

ปฏิเสธทางเลือก B (ย้ายไปเก็บบน Petition) เพราะจะแยกฟอร์มสองครึ่งไปคนละ model และต้องเปลี่ยน data source ของ print

## 1. Schema / Types

แทนที่ 4 บูลีนเดิม (`capabilityOk/methodOk/scheduleOk/acceptable`) ด้วยฟอร์มเต็ม
ฟิลด์ `labAgreementReview` ยังไม่เคยถูกเขียนจริงในฐานข้อมูล จึง**ไม่ต้อง migrate**

`src/types/labRequest.types.ts` (และ enum ฝั่ง server `LabAgreementReviewSchema`):

```ts
type PersonnelCapability = 'able' | 'unable';
type PersonnelAbleReason = 'trained' | 'assigned';
type PersonnelUnableReason = 'neverDone' | 'notTrained' | 'notAssigned';
type Workload = 'normal' | 'slower' | 'cannot';
type SubcontractorChoice = 'none' | 'used';
type EquipmentReadiness = 'ready' | 'notReady';
type EquipmentReadyReason = 'hasInstrument' | 'calibrated';
type EquipmentNotReadyReason = 'noInstrument' | 'notCalibrated' | 'outOfRange' | 'broken';

interface LabAgreementReview {
  reviewedAt: string;
  reviewedBy: string;
  // กรณีวิธีปกติ (standard)
  personnel?: PersonnelCapability;
  personnelAbleReasons?: PersonnelAbleReason[];
  personnelUnableReasons?: PersonnelUnableReason[];
  workload?: Workload;
  subcontractor?: SubcontractorChoice;
  subcontractorName?: string;
  // กรณีวิธีเฉพาะตามเอกสารลูกค้า (custom)
  methodSuitable?: boolean;
  methodSuitableReason?: string;
  equipmentName?: string;
  equipment?: EquipmentReadiness;
  equipmentReadyReasons?: EquipmentReadyReason[];
  equipmentNotReadyReasons?: EquipmentNotReadyReason[];
  // สรุป (ทั้งสองกรณี)
  acceptable?: boolean;
  notAcceptableReason?: string;
  remark?: string;
}
```

ฝั่ง server แก้ `LabAgreementReviewSchema` ใน `server/models/LabRequest.js` ให้ตรงกัน (array enums, `_id: false`)

## 2. Editor — `LabAgreementReviewDialog`

คอมโพเนนต์ใหม่ `src/components/review/LabAgreementReviewDialog.tsx`

- แสดง**ทั้งสองส่วน** (กรณีวิธีปกติ + กรณีวิธีเฉพาะ) เหมือนฟอร์มกระดาษ ให้ผู้รีวิวติ๊กส่วนที่ใช้
- ส่วน "กรณีวิธีปกติ": บุคลากร (able/unable + เหตุผล multi), ปริมาณงาน (radio 3 ตัว), ผู้รับเหมาช่วง (none/used + ชื่อ), สรุปพร้อม/ไม่พร้อม
- ส่วน "กรณีวิธีเฉพาะ": พิจารณาเหมาะสม/ไม่ + เหตุผล, ชื่อเครื่องมือ + ความพร้อม (ready/notReady + เหตุผล multi), สรุปพร้อม/ไม่พร้อม
- ช่อง remark รวม
- prefill จาก `labRequests[0]?.labAgreementReview`
- ปุ่มบันทึก → เรียก endpoint fan-out, toast, ปิด dialog, refresh

## 3. จุดเรียกใน `LabApprovalReviewPage`

เพิ่ม Card ใหม่ "การทบทวนข้อตกลงการบริการทดสอบ — สำหรับหัวหน้าห้องปฏิบัติการ":

- โหลด LabRequests ของคำร้องด้วย `useLabRequestsByPetition(petition._id)`
- ถ้า**ไม่มี** LabRequest (คำร้องไม่มี batch ลงท้าย 1/6) → ซ่อน Card ทั้งใบ
- แสดงสถานะ: "กรอกแล้ว โดย {reviewedBy} · {เวลา}" หรือ "ยังไม่กรอก"
- ปุ่ม **กรอก/แก้ไขการทบทวน** เปิด `LabAgreementReviewDialog` (เฉพาะ `canApproveLab`)
- ถ้ากรอกแล้ว แสดงสรุปอ่านอย่างเดียวด้วย `LabAgreementReviewView` ที่อัปเดตแล้ว
- **อิสระจากปุ่มอนุมัติ** — ไม่ block ปุ่ม "อนุมัติผล Lab"

## 4. Backend endpoint

`POST /petitions/:id/lab-agreement-review` (ใน `server/routes/petitions.js`)

- body = `labAgreementReview` (ไม่รวม reviewedAt/reviewedBy — server stamp เอง: `reviewedBy` จาก body.actor, `reviewedAt = now`)
- หา LabRequest ทุกใบของ petition แล้ว `updateMany({ petitionId }, { $set: { labAgreementReview } })`
- คืน `{ updated: n }`
- ฝั่ง client เพิ่ม `saveLabAgreementReview(petitionId, review, actor)` ใน `usePetition.ts`

## 5. Print + read-only view

- `PetitionPrintTemplate.tsx` PageOne คอลัมน์ขวา: แทน `<CB />` / `<RD />` แบบ static ด้วย `checked` ที่ผูกกับฟิลด์ใหม่ทั้งหมด (บุคลากร, ปริมาณงาน, ผู้รับเหมาช่วง + ชื่อ, เหมาะสม, เครื่องมือ + ความพร้อม, สรุป)
- `LabAgreementReviewView.tsx` อัปเดตแสดงฟิลด์ใหม่ (ใช้ในการ์ดสรุปบนหน้า lab-approval)

## การทดสอบ

- Vitest: ฟังก์ชัน map/serialize ฟอร์ม (ถ้ามี helper) + endpoint logic ถ้าแยกได้
- `tsc -p tsconfig.app.json` (type-check จริง — root tsconfig เป็น no-op)
- E2E (manual): หน้า lab-approval → กรอกรีวิว → บันทึก → reload เห็นสถานะ → print เห็นช่องติ๊กถูก

## หมายเหตุ

- คำร้องที่มีหลายตัวอย่างต่าง testMethod กัน: ใช้รีวิวชุดเดียวกันทุก LabRequest (ตามข้อตกลง "ใช้ทั้งคำร้อง")
- สิทธิ์: เฉพาะ `canAccessPath('/lab-approval')` แก้ไขได้
