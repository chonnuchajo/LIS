# Master Item Export (Excel / PDF) — Design

วันที่: 2026-06-08

## Context

หน้า **Master Item** (`src/pages/MasterItems.tsx` → default export `MasterItems()`) แสดงรายการ item
ที่ดึงจาก n8n webhook / `GET /master-items` พร้อม filter (หมวดหมู่, ประเภทสินค้า, ค้นหา) ฝั่ง client
ตอนนี้ผู้ใช้ดูได้บนจอเท่านั้น เอาออกไปทำงานต่อ (กรอง/คำนวณ/ส่งต่อ) หรือพิมพ์เป็นรายงานไม่ได้

ต้องการปุ่ม **Export Excel** และ **Export PDF** ที่หน้านี้

## Requirements (สรุปจาก brainstorming)

- **ชุดข้อมูล**: หน้า Master Item เท่านั้น (ไม่ใช่ Machines / Simple Method)
- **รูปแบบ**: มี 2 ปุ่มแยก — Excel (`.xlsx`) และ PDF
- **ขอบเขตแถว**: ตามที่ filter/ค้นหาอยู่ตอนนั้น (`filteredItems`) — สิ่งที่เห็นบนจอ
- **คอลัมน์**: **ทุก field ดิบ** ทั้ง Excel และ PDF (union ของทุก key ในแถวที่ export)
- ข้อมูลที่ export คือ `item` หลัง `applyOverride` (ค่า common_name ที่แก้ไว้ถูก merge เข้า key เดิม)

## Architecture — Server-side endpoint เดียว

Frontend ส่งแถวที่กรองแล้วไป backend, backend สร้างไฟล์ด้วย lib ที่มีอยู่ (`xlsx`, `puppeteer-core`)
แล้วส่ง binary กลับมาให้ browser ดาวน์โหลด เหตุผล: reuse lib เดิม, frontend ไม่ต้องลง dep, PDF ฟอนต์ไทย
สวยและ**ไม่เด้ง print dialog** (ตรงกับ pattern server-side printing เดิมของโปรเจกต์)

### Backend — `POST /master-items/export` (ใน `server/routes/master-items.js`)

Request body:
```json
{ "format": "xlsx" | "pdf", "rows": [ {...item}, ... ], "title": "Master Item" }
```

- คำนวณ `columns` = union ของทุก key ที่ปรากฏใน `rows` (คงลำดับการพบครั้งแรก)
- **xlsx**: `XLSX.utils.json_to_sheet(rows, { header: columns })` → `XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })`
  → response `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  + `Content-Disposition: attachment; filename="master-item-<yyyymmdd>.xlsx"`
- **pdf**: สร้าง HTML `<table>` (ทุกคอลัมน์), หน้า **A4 แนวนอน (landscape)**, ฟอนต์ Kanit, font เล็ก (~7–8px),
  `table-layout: auto`, header ซ้ำทุกหน้า (`thead { display: table-header-group }`)
  → puppeteer-core launch ด้วย `PRINT_CHROME_PATH` → `page.pdf({ landscape: true, format: 'A4', printBackground: true })`
  → response `Content-Type: application/pdf` + attachment
  - ถ้า `PRINT_CHROME_PATH` ไม่ถูกตั้ง/ไม่มีไฟล์ → `400` พร้อมข้อความไทย (เหมือน print.js)
- mount endpoint ทั้ง `/api/*` และ `/LIS/api/*` อัตโนมัติผ่าน `mountApi()` เดิม

### Frontend — `src/pages/MasterItems.tsx` + `src/lib/api.ts`

- เพิ่มฟังก์ชันใน `api.ts`: `exportMasterItems(format, rows, title)` → `fetch` รับ `blob`
  (ต้องรับ blob ไม่ใช่ json — ใช้ `request` แบบ raw หรือ fetch ตรงไป `BASE_URL + "api/master-items/export"`)
- ปุ่ม 2 ปุ่ม (`Excel`, `PDF`) ที่ header card "รายการ Item" ข้าง filter
- onClick → `setExporting(format)` → เรียก api → สร้าง object URL → `<a download>` trigger → revoke URL
- ส่ง `rows = filteredItems.map(f => f.item)`
- loading state ต่อปุ่ม + `toast.error` ตอน fail

## Edge cases / Notes

- **PDF ทุก field**: ถ้า field เยอะมากตารางจะแน่น — ยอมรับได้ตาม requirement (landscape + font เล็ก ช่วยบรรเทา)
- **PDF ต้องมี Chrome**: dev ที่ไม่ตั้ง `PRINT_CHROME_PATH` จะ export PDF ไม่ได้ (Excel ใช้ได้ทุกที่) — แสดง error ชัดเจน
- **rows ว่าง**: ถ้า `filteredItems` ว่าง → ปุ่ม disable หรือ toast เตือน
- **ขนาด payload**: rows ทั้งหมดถูก POST ขึ้น server (master item ปริมาณหลักร้อย–พัน รับได้); ถ้าโตมากค่อยพิจารณา body limit

## Verification

1. `cd server && npm run dev` + `npm run dev` (root)
2. เปิดหน้า Master Item → กรองหมวดหมู่/ค้นหา
3. กด **Excel** → ได้ `.xlsx` เปิดด้วย Excel เห็นทุก field, จำนวนแถว = ที่กรอง
4. กด **PDF** → ได้ `.pdf` แนวนอน ฟอนต์ไทยอ่านออก, header ซ้ำทุกหน้า
5. ลองตอน `filteredItems` ว่าง → ปุ่ม disable/เตือน
6. (dev ไม่มี Chrome) กด PDF → เห็น error ภาษาไทยชัดเจน
7. `npx tsc -p tsconfig.app.json --noEmit` ไม่มี error ใหม่
