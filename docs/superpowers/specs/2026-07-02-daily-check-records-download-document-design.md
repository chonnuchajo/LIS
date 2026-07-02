# โหลดเอกสารบันทึกการเช็กเครื่องมือ (รวมเข้าหน้า records)

วันที่: 2026-07-02
สถานะ: อนุมัติดีไซน์แล้ว (รอรีวิว spec)

## เป้าหมาย

ทำให้หน้า `daily-check/records` (รายการบันทึกการเช็กเครื่องมือ) โหลด/พิมพ์เอกสารได้จริง
โดย **รวมฟีเจอร์จากแท็บ placeholder "โหลดเอกสาร" เข้ามาไว้ในหน้า records** แล้วลบแท็บ placeholder ทิ้ง

การตัดสินใจหลัก (ผู้ใช้เลือก option 1 ทั้ง 3 ข้อ):
1. **ตำแหน่ง** — รวมเข้าหน้า records + ลบแท็บ "โหลดเอกสาร"
2. **รูปแบบเอกสาร** — รายงานตารางสรุป A4 (จากข้อมูลในระบบ ไม่ก๊อปฟอร์มกระดาษต้นฉบับ)
3. **วิธีส่งออก** — ใช้ระบบปริ้นกลางเดิม (`PrintPreviewDialog`) โดยเพิ่ม docType ใหม่ → ได้ทั้งพรีวิว / ปริ้น server-side / Windows Preview (Save-as-PDF)

## บริบทของโค้ดที่มีอยู่

- `src/pages/daily-check/DailyCheckRecordsPage.tsx` — โหลด `api.getEquipmentChecks({room,date})` ทีละห้อง (`EQUIPMENT_ROOM_SLUGS`) ตาม `filterDate` วันเดียว → merge client-side → เรียงใหม่สุดก่อน → กรองด้วย `filterEquipmentRecords(merged, {room,instrumentId,status})` แล้ว render ตาราง
- `src/pages/daily-check/DocumentsPage.tsx` — placeholder เปล่า (จะถูกลบ)
- `src/lib/dailyCheckRooms.ts` — `DAILY_CHECK_TABS` มีแท็บ `records` + `documents`
- `src/App.tsx` — route `records` + `documents` ใต้ `/daily-check`
- ระบบปริ้นกลาง:
  - `src/lib/printConfig.ts` — `PrintDocType` union + `PRINT_DOC_TYPES[]`
  - `src/components/lis/PrintPreviewDialog.tsx` — พรีวิว (ScaledPreview) + ปริ้น server-side + Windows Preview
  - `src/lib/print.ts` — `printDocument` / `openBrowserPrintPreview` / `collectDocumentCss`
  - `server/routes/print.js` — `DOC_DEFAULTS[]` / `ALLOWED_SLUGS` (mirror ของ client)
  - `src/components/lis/PrintConfigCard.tsx` + หน้า Settings — render ต่อ config จาก `/print/config` อัตโนมัติ

ชนิดข้อมูล `EquipmentCheckRecord` (`src/lib/api.ts`): `roomSlug, instrumentId, instrumentName, brand?, status ("normal"|"abnormal"), readings[] ({label,value,unit}), note?, recorder, date (YYYY-MM-DD), checkedAt (ISO)`

## หน่วยงานที่จะสร้าง/แก้

### 1. docType ใหม่ `daily-check-report` (A4)
- `src/lib/printConfig.ts`:
  - เพิ่ม `"daily-check-report"` ใน `PrintDocType`
  - เพิ่มใน `PRINT_DOC_TYPES`: `{ slug: "daily-check-report", label: "รายงานเช็กเครื่องมือ (Daily Check)", defaultPaper: "A4" }`
- `server/routes/print.js`:
  - เพิ่มใน `DOC_DEFAULTS`: `{ slug: 'daily-check-report', printerName: '', cupsPrinterUrl: '', copies: 1, paperSize: 'A4' }`
  - `ALLOWED_SLUGS` เดริฟจาก `DOC_DEFAULTS` อยู่แล้ว → auto
- ผล: docType ใหม่จะโผล่ในหน้า **ตั้งค่าระบบ** อัตโนมัติ (PrintConfigCard วนจาก `/print/config`) ให้ admin ตั้งเครื่องพิมพ์เอง
- อัปเดต test ที่ระบุจำนวน docType ถ้ามี (`printConfig.test.ts`)

### 2. คอมโพเนนต์รายงาน `EquipmentCheckReport`
ไฟล์ใหม่ `src/components/lis/EquipmentCheckReport.tsx` — เทมเพลตปริ้น A4 (พื้นหลังขาว, ฟอนต์ Kanit, ขนาดเหมาะพิมพ์)

Props:
```
{
  rows: EquipmentCheckRecord[];
  filters: { date: string; room: string; instrument: string; status: string };
  printedBy: string;   // ชื่อผู้พิมพ์ (จาก useAuth)
  printedAt: string;   // ISO ตอนกดเปิดพรีวิว
}
```

โครง:
- **หัวเอกสาร**: ชื่อ "บันทึกการเช็กเครื่องมือประจำวัน" + บรรทัดบริบทตัวกรอง (วันที่ = `fmtDate`, ห้อง, เครื่อง, สถานะ — แปลง "all" เป็นข้อความไทย เช่น "ทุกห้อง")
- **ตาราง** คอลัมน์ตรงกับบนจอ: วันที่ / เวลา / ห้อง / เครื่อง (ชื่อ + id) / สถานะ (ปกติ|ผิดปกติ) / ค่าที่วัด (`readings.map(label value unit).join(", ")` หรือ "—") / หมายเหตุ / ผู้บันทึก
- **ท้ายเอกสาร**: บรรทัดสรุป (จำนวนรายการ, จำนวนผิดปกติ) + ช่องลงชื่อ "ผู้บันทึก" / "ผู้ตรวจสอบ" + วันเวลาที่พิมพ์ + ผู้พิมพ์
- reuse helper `fmtDate`/`fmtTime`/`roomLabel` (ย้าย/แชร์จาก records page ตามเหมาะ)

### 3. หน้า records — เพิ่มปุ่ม "โหลดเอกสาร"
`src/pages/daily-check/DailyCheckRecordsPage.tsx`:
- เพิ่ม state `printOpen`
- ปุ่ม **"โหลดเอกสาร"** ที่หัวการ์ด (ข้างปุ่มสรุป AI); **disabled เมื่อ `rows.length === 0`** หรือกำลังโหลด
- กดแล้วเปิด `PrintPreviewDialog docType="daily-check-report"` โดยส่ง `<EquipmentCheckReport rows={rows} filters={...} printedBy={user} printedAt={...} />` เป็น children
- ส่งบริบทตัวกรองตามที่เลือกจริง (WYSIWYG — เฉพาะแถวที่กรองอยู่)

### 4. ลบแท็บ/หน้า documents
- `src/lib/dailyCheckRooms.ts` — เอา entry `documents` ออกจาก `DAILY_CHECK_TABS` (และลบ import `FileDown` ถ้าไม่ถูกใช้แล้ว)
- `src/App.tsx` — ลบ `<Route path="documents" ...>` + lazy import `DocumentsPage`; เพิ่ม redirect `<Route path="documents" element={<Navigate to="/daily-check/records" replace />} />` กันลิงก์เก่า/บุ๊กมาร์กพัง
- ลบไฟล์ `src/pages/daily-check/DocumentsPage.tsx`
- `src/lib/accessControl.ts` — ในลิสต์ child ของ `"/daily-check"` เปลี่ยน `"/daily-check/documents"` → `"/daily-check/records"` (หมายเหตุ: `records` เดิม**ไม่ได้**อยู่ในลิสต์นี้ — เป็นบั๊กสิทธิ์เดิม แก้ให้ถูกไปในตัว)

## Data flow
กดปุ่มโหลดเอกสาร → เปิด dialog → `EquipmentCheckReport` render จาก `rows` (ที่กรองแล้วในหน้า, ไม่ต้อง fetch ใหม่) → ในกล่อง:
- **พิมพ์** → `printDocument("daily-check-report", ref, {css, copies})` → server แปลง PDF (A4) → เครื่องพิมพ์ที่ตั้งค่า
- **Windows Preview** → `openBrowserPrintPreview` → เบราว์เซอร์ → Save as PDF ได้ (= ส่วน "โหลด")

## Error / edge cases
- ไม่มีแถว → ปุ่มโหลดเอกสาร disabled (ไม่เปิด dialog เปล่า)
- ยังไม่ตั้งค่าเครื่องพิมพ์ docType นี้ → `PrintPreviewDialog` โชว์ลิงก์ไปหน้าตั้งค่า (พฤติกรรมเดิม), ปุ่ม "พิมพ์" disabled แต่ **Windows Preview ยังใช้ได้** (โหลด PDF ได้แม้ไม่ตั้งเครื่องพิมพ์)
- ตารางยาวเกิน 1 หน้า → เทมเพลตต้อง print-friendly (ไม่ fix height, ปล่อย flow หลายหน้า); พรีวิว ScaledPreview ต้องไม่มี horizontal scroll (ตาม convention)

## Testing
- **Vitest**: `EquipmentCheckReport` render — หัวเอกสาร/บริบทตัวกรองถูก, จำนวนแถว = `rows.length`, สรุปจำนวนผิดปกตินับถูก, ค่าที่วัดว่าง → "—", แปลง "all" เป็นข้อความไทย
- **printConfig**: docType `daily-check-report` อยู่ใน `PRINT_DOC_TYPES` + defaultPaper A4; อัปเดต test ที่นับจำนวน docType (ถ้ามี)
- **Manual E2E** (ค้างให้ user รันบนเครื่องจริง): เปิด records → กดโหลดเอกสาร → พรีวิวถูก + ไม่มี scroll แนวนอน → Windows Preview → Save as PDF ได้; ตั้งเครื่องพิมพ์ใน Settings แล้วปริ้น server-side ได้

## ขอบเขตที่ตัดออก (YAGNI)
- ไม่ทำ date-range picker (ยึด `filterDate` วันเดียวที่หน้ามีอยู่)
- ไม่ทำ export Excel/CSV
- ไม่ก๊อปฟอร์มกระดาษต้นฉบับ (ถ้าภายหลังได้ไฟล์ฟอร์ม ค่อยปรับเทมเพลต)

## ไฟล์ที่แตะ (สรุป)
- แก้: `src/lib/printConfig.ts`, `server/routes/print.js`, `src/pages/daily-check/DailyCheckRecordsPage.tsx`, `src/lib/dailyCheckRooms.ts`, `src/App.tsx`, `src/lib/accessControl.ts`
- สร้าง: `src/components/lis/EquipmentCheckReport.tsx` (+ test)
- ลบ: `src/pages/daily-check/DocumentsPage.tsx`
- อาจแตะ: `src/lib/printConfig.test.ts` (ถ้ามี test นับจำนวน docType)
