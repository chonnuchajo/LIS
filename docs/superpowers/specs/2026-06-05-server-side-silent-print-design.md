# Server-side Silent Print — Design

วันที่: 2026-06-05
สถานะ: อนุมัติ design แล้ว รอเขียน implementation plan

## เป้าหมาย

เปลี่ยนการพิมพ์เอกสารจากเดิมที่ใช้ `window.print()` / เปิด window ใหม่ (ซึ่งเด้ง print
preview ของ browser และให้เลือกเครื่องเอง) มาเป็น:

1. กดพิมพ์ → เด้ง **preview ที่ทำเองใน app** (ไม่ใช่ของ browser) แสดงเอกสารจริง
2. กดยืนยัน → ส่งเข้า **เครื่องปริ้นที่ตั้งค่าไว้ตาม "ประเภทเอกสาร"** โดยตรง ไม่มี dialog
   ของ browser โผล่เลย
3. มีหน้า **ตั้งค่าระบบ** กำหนดว่าเอกสารแต่ละประเภทออกเครื่องไหน

## ข้อจำกัดทางเทคนิคที่เป็นที่มาของ design

Browser **ปริ้นเงียบไปเครื่องที่เจาะจงไม่ได้** — `window.print()` เด้ง dialog เสมอ และ web
ไม่มี API เลือกเครื่องปริ้น เป็นข้อจำกัดด้านความปลอดภัยของทุก browser การจะ "กดแล้วออกเลย"
ต้องทำผ่าน backend

## สภาพแวดล้อมจริง (ยืนยันกับ user แล้ว)

- เครื่องปริ้นเป็น **network printer ส่วนกลาง** ที่เครื่อง server มองเห็น/สั่งได้
  → ทำ server-side printing ได้
- prod เป็น Windows + Node + Apache
- ตั้งค่าเครื่องปริ้น **แยกตามประเภทเอกสาร** (ฉลาก → label printer, เอกสาร → A4)
- พฤติกรรมตอนกดพิมพ์: **preview ที่ทำเอง** (in-app modal) ไม่ใช่ browser window

## Flow ภาพรวม

```
กดพิมพ์
  → PrintPreviewDialog (in-app) render template จริง
  → แสดงเครื่องปลายทาง (ตาม config ของ docType) + จำนวนชุด
  → กด "พิมพ์"
  → client serialize HTML + inline CSS → POST /api/print { docType, html, copies }
  → server: Puppeteer (puppeteer-core ชี้ Chrome ที่ prod) แปลง HTML → PDF
  → pdf-to-printer ส่ง PDF เข้า network printer ตาม config ของ docType
  → toast "ส่งพิมพ์ไปยัง [ชื่อเครื่อง]" ✅  (ไม่มี browser dialog)
```

## ประเภทเอกสาร (docType)

| docType           | เอกสาร                  | กระดาษ      | จุดเดิมในโค้ด |
|-------------------|-------------------------|-------------|--------------|
| `sample-label`    | ฉลากตัวอย่าง (sticker)  | 6x4 นิ้ว    | `ProductionPetitionNewPage.tsx`, `SampleLabelPrintTemplate.tsx` |
| `coa`             | COA                     | A4          | `COADialog.tsx` |
| `service-request` | ใบคำขอ (Petition)       | A4          | `PetitionDetailPage.tsx`, `PetitionPrintTemplate.tsx` |
| `production-plan` | ใบวางแผนผลิต            | A4          | `ProductionPlanPrintTemplate.tsx` |

> หมายเหตุ: production-plan ปัจจุบันถูกมาร์กว่าเลิกใช้/รอลบ — ใส่ใน scope ของกลไก แต่ถ้า
> ตอน implement ถูกลบไปแล้วก็ข้าม docType นี้ได้ ไม่กระทบตัวกลไกกลาง

## Backend (`server/`)

### Model `PrintConfig` (`server/models/PrintConfig.js`)

pattern เดียวกับ `EnvRoomConfig` (1 doc ต่อ docType, `slug` unique):

```
slug:        String enum ['sample-label','coa','service-request','production-plan'] unique index
printerName: String  default ''   // '' = ยังไม่ตั้ง → บล็อกการพิมพ์
copies:      Number  default 1
paperSize:   String  default 'A4' // 'A4' | 'label-6x4' (กำหนด PDF page size)
```

### Route `server/routes/print.js` (mount ผ่าน `mountApi('/print', ...)`)

- `GET  /api/print/printers` → `{ data: [printerName, ...] }` จาก `pdf-to-printer` `getPrinters()`
- `GET  /api/print/config`   → คืน config ทั้ง 4 docType (DB หรือ default) แบบเดียวกับ
  `GET /env-room-config`
- `PUT  /api/print/config/:slug` → upsert printerName/copies/paperSize ของ docType นั้น
  (validate slug + ฟิลด์)
- `POST /api/print` → รับ `{ docType, html, copies? }`:
  1. resolve config ของ docType; ถ้า `printerName === ''` → 400 `"ยังไม่ได้ตั้งค่าเครื่องพิมพ์สำหรับเอกสารนี้"`
  2. Puppeteer render `html` → PDF (page size ตาม `paperSize`)
  3. `pdf-to-printer` print PDF ไปที่ `printerName` จำนวน `copies` (override ได้จาก body)
  4. ลบไฟล์ PDF temp; คืน `{ ok: true, printer: printerName }`

### Dependencies (server)

- `puppeteer-core` — ชี้ executable ผ่าน `PRINT_CHROME_PATH` ใน `server/.env` (Chrome/Brave
  ที่เครื่อง prod มีอยู่แล้ว) เพื่อ **ไม่ต้องโหลด Chromium ~150MB**
- `pdf-to-printer` — bundle SumatraPDF ในตัว (Windows) สำหรับสั่งปริ้น PDF ไปเครื่องที่ระบุ

### Security (สำคัญ)

`POST /api/print` รับ HTML จาก client แล้ว render ใน headless Chrome → เสี่ยง SSRF / อ่านไฟล์
local. ป้องกัน:

- ปิด JavaScript (`page.setJavaScriptEnabled(false)`)
- บล็อก network request ทุกชนิด (`page.setRequestInterception` → abort ทุก request ยกเว้น
  data URI / inline) — รูป/โลโก้ที่ต้องใช้ให้ฝัง data URI หรือ allowlist origin ของ
  `ICP_LADDA_LOGO_URL` เท่านั้น
- รัน Chrome แบบ sandbox, ไม่มี file:// access
- จำกัดขนาด payload (มี `express.json({ limit: '10mb' })` อยู่แล้ว — พอ)

## Frontend (`src/`)

### `src/lib/print.ts` (ใหม่)

util กลาง:

```
printDocument(docType, htmlElement, { copies }): Promise<{ printer }>
```

- serialize `htmlElement.outerHTML` + รวบ `<style>`/inline CSS ที่จำเป็น (ดึงจาก template
  เดิม — แต่ละ template มี `@media print` block อยู่แล้ว)
- POST `/api/print` ผ่าน `src/lib/api.ts` (เพิ่ม endpoints: `printDocument`,
  `getPrinters`, `getPrintConfig`, `updatePrintConfig`)
- คืนผล/throw error ให้ caller toast

### `PrintPreviewDialog` (`src/components/lis/PrintPreviewDialog.tsx`, ใหม่)

modal:
- แสดง template จริง (children/render-prop) เป็น preview
- แสดงชื่อเครื่องปลายทาง (จาก `getPrintConfig` ตาม docType) + input จำนวนชุด
- ปุ่ม "พิมพ์" → เรียก `printDocument` → toast → ปิด; ปุ่ม "ปิด"
- ถ้า docType ยังไม่ตั้งค่าเครื่อง → แสดงข้อความเตือน + ลิงก์ไปหน้าตั้งค่า และ disable ปุ่มพิมพ์
  (pattern เดียวกับ simple-method ที่บล็อกเมื่อข้อมูลไม่ครบ)

### Settings (`src/pages/SettingsPage.tsx`)

เพิ่ม section "เครื่องพิมพ์เอกสาร":
- การ์ดต่อ docType (component ใหม่ `PrintConfigCard` คล้าย `EnvRoomConfigCard`)
- เลือกเครื่องจาก dropdown (`getPrinters`), ตั้งจำนวนชุด default, paper size
- บันทึกผ่าน `updatePrintConfig` + invalidate query + toast

### ปรับจุดเดิม 4 จุด (เลิก `window.print()` / open-window)

- `PetitionDetailPage.tsx` — เปลี่ยนปุ่มพิมพ์ → เปิด `PrintPreviewDialog` docType=`service-request`
- `ProductionPetitionNewPage.tsx` — `printCreatedLabels()` → `PrintPreviewDialog` docType=`sample-label`
- `COADialog.tsx` — `handlePrint` (เปิด window ใหม่) → `PrintPreviewDialog` docType=`coa`
- production-plan (`ProductionPlanPrintTemplate.tsx` caller) → docType=`production-plan`
  (ข้ามได้ถ้าถูกลบ)

## Error handling

- docType ไม่มี config เครื่อง → บล็อกพิมพ์ + ลิงก์ไปตั้งค่า (ทั้งฝั่ง dialog และ server 400)
- server ปริ้นล้มเหลว (เครื่องออฟไลน์ / Chrome ไม่เจอ / PDF fail) → toast error พร้อมเหตุผล
  จาก server
- `PRINT_CHROME_PATH` ไม่ตั้ง / หา Chrome ไม่เจอ → error ชัดเจน (เช็คตอน render ครั้งแรก)
- `getPrinters` ว่าง (ไม่เห็นเครื่องเลย) → แจ้งใน Settings

## Testing

- **Vitest**: `src/lib/print.ts` — serialize logic; resolve config/printer สำหรับ docType;
  กรณีไม่มีเครื่อง → throw/บล็อก
- **Server**: unit test route config (GET/PUT validate), mock `pdf-to-printer` + Puppeteer
  สำหรับ `POST /api/print` (ไม่ปริ้นจริง)
- **Playwright**: ปรับ `tests/e2e/production-plan-print.spec.ts`,
  `tests/e2e/service-request-print.spec.ts` ที่อ้าง `window.print` เดิม → ทดสอบ
  PrintPreviewDialog + mock `POST /api/print`

## Seed-data

เพิ่ม model ใหม่ `PrintConfig` → หลัง implement ต้องรัน `npm run seed:export` + commit ให้
`server/seed-data/` ตรงกับ DB (ตามกฎ seed-data)

## ลำดับ implement ที่แนะนำ

1. Backend: model + route + deps + security (ไม่มี UI ก็ test ผ่าน mock ได้)
2. `src/lib/print.ts` + endpoints ใน `api.ts`
3. `PrintPreviewDialog`
4. Settings section + `PrintConfigCard`
5. ปรับ 4 จุดเดิมให้ใช้ dialog (ทีละ docType, label ก่อนเพราะใช้บ่อยสุด)
6. seed:export + commit
