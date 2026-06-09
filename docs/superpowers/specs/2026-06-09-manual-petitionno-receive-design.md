# กรอกเลขที่คำร้องเพื่อรับงาน (ทางเลือกนอกจากสแกน QR) — Design

วันที่: 2026-06-09
สถานะ: approved (รอ user review spec)

## ปัญหา / เป้าหมาย

หน้าทดสอบ Lab และ QC ปัจจุบันรับงานได้ทางเดียวคือเปิดกล้องสแกน QR บนใบคำร้อง
เมื่อกล้องไม่สะดวก (ไม่มีกล้อง / กล้องเสีย / QR เลอะ / สแกนไม่ติด) เจ้าหน้าที่ไม่มีทางรับงานได้เลย

เป้าหมาย: เพิ่ม **ช่องกรอกเลขที่คำร้อง (petitionNo) ด้วยมือ** เป็นทางเลือกควบคู่กับการสแกน
ในทั้งหน้า Lab และ QC

## ขอบเขต

- `src/components/petition/LabScanAcceptModal.tsx` — รับงาน Lab
- `src/components/petition/QrReceiveModal.tsx` — รับตัวอย่าง QC

**ไม่อยู่ในขอบเขต:** ไม่แตะ backend, ไม่แตะหน้า ScannerPage (หน้าส่งตัวอย่าง), ไม่ทำ
continuous-mode สำหรับการพิมพ์

## ข้อเท็จจริงที่ทำให้ implement ง่าย

1. ทั้งสอง modal ส่ง code ที่สแกนได้เข้าฟังก์ชันเดียว:
   - Lab: `fetchAndCheck(rawCode: string)`
   - QC: `fetchAndConfirm(rawCode: string)`
2. `extractScannedCode(raw)` ถ้า input ไม่ใช่ JSON และไม่ใช่ URL จะ `return text` (ค่าเดิม) —
   แปลว่าพิมพ์ `petitionNo` ธรรมดาเข้าไปจะถูกส่งต่อตามนั้น
3. backend `GET /petitions/scan/:code` ค้นด้วย `petitionNo` ได้อยู่แล้ว (petitions.js:208-222)
   และ `PATCH /petitions/:id/receive` รับ petitionNo เป็น `:id` ได้ (แปลงเป็น query เอง)

สรุป: เลขที่พิมพ์จะวิ่งเข้า flow ตรวจสอบ/ยืนยันเดิม **ทั้งหมด** โดยไม่ต้องเขียน logic ซ้ำ
และ validation เดิมยังทำงานครบ:
- Lab: ต้องมีรายการ Lab, ต้องถูก assign (หรือเป็น admin/lab-head), ต้องไม่ success แล้ว,
  ถ้า pendingReview/inProgress อยู่แล้ว → navigate เข้า detail ตรงๆ
- QC: ต้องสถานะ `sampleSent` เท่านั้น, กันรับซ้ำใน session

## แนวทางที่เลือก (A)

เพิ่มช่องกรอกใต้ element กล้อง ในมุมมอง phase `scanning` ของแต่ละ modal

### การเปลี่ยนแปลงต่อ modal

1. เพิ่ม state: `const [manualCode, setManualCode] = useState('')`
2. เพิ่ม UI ช่องกรอก โดยให้โชว์ทั้งตอน `phase === 'scanning'` **และ** `phase === 'no-camera'`
   (เคส "ไม่มีกล้อง" คือเหตุผลหลักที่ต้องมีช่องกรอก ห้ามซ่อน) — แยกเงื่อนไขเป็น
   `const showManual = phase === 'scanning' || phase === 'no-camera'` แล้ว render ช่องกรอก
   ใต้ element กล้อง/ข้อความ "ไม่พบกล้อง":
   - ตัวคั่น "— หรือ —"
   - `<form onSubmit=...>` ประกอบด้วย `<input>` + ปุ่ม submit
     - placeholder: `พิมพ์เลขที่คำร้อง เช่น P-2506-0001` (format จริง `P-YYMM-####`)
     - ปุ่ม Lab: `รับงาน` / ปุ่ม QC: `รับตัวอย่าง`
   - handler:
     ```
     const code = manualCode.trim();
     if (!code) return;
     setManualCode('');
     fetchAndCheck(code);   // QC ใช้ fetchAndConfirm(code)
     ```
   - ปุ่ม `disabled` เมื่อ `manualCode.trim() === ''`
3. ไม่แก้ flow `confirming` / `loading` / `success` / `error` เดิม — typed code ใช้ path เดียวกับ scan

### หมายเหตุ identifier

ผู้ใช้เลือก "เฉพาะ petitionNo" → ตั้ง label/placeholder เป็น "เลขที่คำร้อง"
แต่ **ไม่เพิ่ม logic บล็อก sampleId** เพราะ endpoint รองรับเป็น superset อยู่แล้ว
และการบล็อกคือความซับซ้อนที่ไม่จำเป็น (YAGNI) — ถ้าเผลอพิมพ์ sampleId ก็ยังค้นเจอ ไม่เป็นปัญหา

## สิ่งที่ไม่ทำ (YAGNI)

- ไม่แตะ backend
- ไม่บล็อก sampleId
- ไม่ทำ continuous mode สำหรับการพิมพ์ (พิมพ์ทีละอัน → confirm ทีละอัน ตาม flow เดิม)
- ไม่ทำ autocomplete/dropdown ค้นหาเลขที่คำร้อง

## Testing

- `npx tsc -p tsconfig.app.json` ต้องผ่าน (ตาม memory: root `tsc --noEmit` เป็น no-op)
- Verify จริงในแอป: เปิด modal แต่ละหน้า → พิมพ์ petitionNo จริง → กดปุ่ม → ขึ้นจอ confirm →
  รับงาน/รับตัวอย่างสำเร็จ; ลองพิมพ์เลขผิด → ขึ้น error เดิม

## ความเสี่ยง

- น้อย — reuse logic เดิมเกือบทั้งหมด, ไม่แตะ backend, ไม่แตะ state machine ของกล้อง
- เดียวที่ต้องระวัง: form submit ต้อง `preventDefault` ไม่ให้ reload หน้า
