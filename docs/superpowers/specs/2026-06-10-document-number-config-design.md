# ตั้งค่ารูปแบบเลขที่เอกสาร (Document Number Config)

วันที่: 2026-06-10
สถานะ: ออกแบบเสร็จ รอทำ plan

## ปัญหา / เป้าหมาย

ตอนนี้รูปแบบเลขที่เอกสารที่ระบบสร้างอัตโนมัติ ถูก hardcode ไว้ในโค้ด backend ทั้งหมด แอดมินแก้เองไม่ได้ ต้องแก้โค้ด ต้องการให้แอดมินแก้ format เหล่านี้ได้จากหน้า "ตั้งค่าระบบ" (`SettingsPage`)

เลขที่ครอบคลุม (เอกสารที่ระบบ "รับ" และออกเลขให้):

| ประเภท | docType key | format เดิม (hardcode) | รอบรีเซ็ตเดิม | ที่อยู่โค้ดเดิม |
|---|---|---|---|---|
| เลขคำร้อง Petition | `petition` | `P-YYMM-####` | รายเดือน | `server/routes/petitions.js` `nextPetitionNo()` (~บรรทัด 30-41) |
| เลขรับตัวอย่าง Sample Receipt | `sampleReceipt` | `RCV-YYYY-####` | รายปี | `server/routes/sampleReceipts.js` `nextRunNo()` (บรรทัด 7-15) |
| เลขใบคำขอ Lab Request | `labRequest` | `L-YYMM-####` | รายเดือน | `server/routes/labRequests.js` `nextLabRequestNo()` (บรรทัด 7-17) |

## ขอบเขต (decisions ที่ตกลงแล้ว)

- แก้ได้ทั้ง 3 เลข: petition, sampleReceipt, labRequest
- รูปแบบฟอร์ม = **แยกช่องให้เลือก** (structured fields) ไม่ใช่ pattern string อิสระ — validate ง่าย กันพิมพ์ผิด
- เปลี่ยน format แล้ว เลข running **เดินต่ออัตโนมัติ** (หาเลขล่าสุดของ prefix+รอบปัจจุบันใน DB แล้ว +1 เหมือนเดิม)
- เอกสารเก่าที่ออกไปแล้ว **ไม่แตะ** เก็บเลขเดิม
- สิทธิ์: **admin เท่านั้น** (เหมือนแท็บ settings อื่น)

## โครงสร้างข้อมูล (Structured fields)

แต่ละ docType เก็บ config ดังนี้:

| field | ชนิด | ความหมาย | default (petition) |
|---|---|---|---|
| `docType` | enum `petition`/`sampleReceipt`/`labRequest` | คีย์ประเภทเอกสาร (unique) | — |
| `prefix` | string | ตัวอักษรนำหน้า เช่น `P` | `P` |
| `yearFormat` | enum `none`/`yy`/`yyyy` | ปี: ไม่มี / 2 หลัก / 4 หลัก | `yy` |
| `includeMonth` | boolean | ใส่เดือน 2 หลักไหม | `true` |
| `seqPadding` | number (1–10) | จำนวนหลัก running เช่น 4 → `0042` | `4` |
| `separator` | string (0–3 ตัว) | ตัวคั่น default `-` (ว่างได้) | `-` |

**รอบรีเซ็ตไม่เก็บเป็น field แยก** — มันเกิดจาก date tokens ที่เลือกเอง:
- ใส่เดือน → prefix เปลี่ยนทุกเดือน → รีเซ็ตรายเดือนโดยปริยาย
- ใส่แค่ปี (ไม่ใส่เดือน) → รีเซ็ตรายปี
- ไม่ใส่ปีไม่ใส่เดือน → เลขเดินยาวตลอด ไม่รีเซ็ต

## กฎ validate

- `separator` → ว่างได้เต็มที่ (จะได้ `P25060042`)
- `prefix` ว่างได้ แต่ frontend ขึ้น **คำเตือน**ว่าจะมองแยกประเภทเอกสารด้วยตาไม่ออก
- **บังคับ: ต้องมีอย่างน้อย 1 ระหว่าง `prefix` (ไม่ว่าง) หรือ `yearFormat !== 'none'`** — กันเคสเหลือเลข running เปล่าที่ไม่มีจุดยึดให้ระบบหาเลขล่าสุด (เสี่ยงนับเลขเพี้ยน) — validate ทั้งฝั่ง frontend และ backend (PATCH ปฏิเสธถ้าผิดกฎ)
- `seqPadding` 1–10
- `yearFormat` ต้องอยู่ใน enum, `docType` ต้องอยู่ใน enum

## การสร้างเลข (build prefix + scan)

หลักการเดิมไม่เปลี่ยน — แค่ build "prefix สแกน" จาก config แทนค่า hardcode:

```
buildPrefix(cfg, now):
  parts = cfg.prefix
  datePart = ''
  if cfg.yearFormat == 'yyyy': datePart += YYYY
  if cfg.yearFormat == 'yy':   datePart += YY
  if cfg.includeMonth:         datePart += MM
  // prefix ที่ใช้สแกน = prefix + separator(ถ้ามี prefix) + datePart + separator(ถ้ามี datePart)
  return cfg.prefix + sep? + datePart + sep?
```

> รายละเอียดการประกอบ separator ให้ออกมาเหมือนของเดิมเป๊ะเมื่อใช้ค่า default (เช่น `P-2506-` ไม่ใช่ `P--2506-`) จะกำหนดให้ชัดในขั้น plan + เขียน unit test ครอบ

จากนั้น (logic เดิม):
```
last = findOne({ <numField>: /^<scanPrefix>/ }).sort({ <numField>: -1 })
nextSeq = last ? Number(last.<numField>.slice(scanPrefix.length)) + 1 : 1
return scanPrefix + String(nextSeq).padStart(cfg.seqPadding, '0')
```

**Fallback**: ถ้าอ่าน config จาก DB ไม่เจอ (collection ว่าง/ยังไม่ seed) → ใช้ค่า default ที่ฝังในโค้ด (เท่ากับ format เดิมเป๊ะ) เพื่อไม่ให้ของเดิมพัง

> หมายเหตุ concurrency: logic findOne+1 เดิมมี race condition อยู่แล้ว (ไม่ atomic) — งานนี้ **คงพฤติกรรมเดิม** ไม่แก้เรื่อง race เพราะนอก scope และ volume ต่ำ

## Backend

### Model ใหม่ `server/models/DocumentNumberConfig.js`
- schema ตามตารางด้านบน, `docType` unique + index, `timestamps: true`
- รูปแบบเดียวกับ `PrintConfig` (1 doc ต่อ type, ไม่ soft-delete, upsert/แก้อย่างเดียว)

### Route ใหม่ `server/routes/documentNumberConfigs.js`
- `GET /` → คืน config ทั้ง 3 docType; ถ้า docType ไหนยังไม่มีใน DB ให้คืน default (เหมือน EnvRoomConfig ที่มี ROOM_DEFAULTS)
- `PATCH /:docType` → validate แล้ว upsert
- mount แบบ double-route (`/api/*` + `/LIS/api/*`) ตาม `mountApi()` ใน `server/index.js`
- เพิ่มเข้า `loadAllModels()` / `ensureCollections()` อัตโนมัติเพราะ model อยู่ใน `server/models/`

### helper กลาง `server/lib/documentNumber.js`
- export `nextDocumentNumber(docType, Model, numField)` ที่อ่าน config + build prefix + scan + คืนเลขถัดไป
- มี `DEFAULTS` map (3 docType) ใช้เป็น fallback
- มี `buildScanPrefix(cfg, now)` แยกออกมาเทสได้
- co-located test `server/lib/documentNumber.test.js` (Vitest) — ครอบ: ค่า default ต้องได้ format เดิมเป๊ะ, prefix ว่าง, separator ว่าง, ปี 4 หลัก, ไม่ใส่เดือน, กฎ validate

### แก้ route เดิม 3 ที่
- `petitions.js` `nextPetitionNo()`, `sampleReceipts.js` `nextRunNo()`, `labRequests.js` `nextLabRequestNo()` → เรียก helper กลางแทน (ส่ง Model + ชื่อ field: `petitionNo` / `runNo` / `labRequestNo`)
- พฤติกรรม default ต้องเท่าเดิมทุกประการ

### seed-data
- หลังเพิ่ม model + (ถ้ามีการตั้งค่าจริง) ให้รัน `npm run seed:export` + commit ตาม CLAUDE.md (seed-data ต้องตรงกับ DB)

## Frontend

### `src/lib/documentNumberConfig.ts`
- type `DocumentNumberConfig`, `DocumentNumberConfigInput`
- `buildPreview(input, now)` — สร้างสตริงตัวอย่างเลขถัดไปสำหรับ live preview (ใช้ seq สมมติ เช่น 43 หรือ "0001") **ต้อง match logic backend** — แชร์ความรู้เรื่อง build prefix ให้ตรงกัน
- labels ภาษาไทยต่อ docType

### API ใน `src/lib/api.ts`
- `getDocumentNumberConfigs()` → GET
- `updateDocumentNumberConfig(docType, input)` → PATCH

### Component `src/components/lis/DocumentNumberConfigCard.tsx`
- ตาม pattern `PrintConfigCard` / `EnvRoomConfigCard`: รับ `config`, `saving`, `onSave`
- ช่อง: prefix (input), yearFormat (select 3 ตัว), includeMonth (checkbox/switch), seqPadding (number), separator (input)
- **Live preview**: โชว์ "ตัวอย่างเลขถัดไป: `P-2506-0043`" อัปเดตสดตอนแก้ฟอร์ม
- คำเตือนเมื่อ prefix ว่าง
- ปุ่มบันทึก disabled ถ้าผิดกฎ validate (ต้องมี prefix หรือปี อย่างน้อย 1)

### แท็บใหม่ใน `src/pages/SettingsPage.tsx`
- เพิ่ม `<TabsTrigger value="doc-numbers">รหัสเอกสาร</TabsTrigger>`
- `<TabsContent value="doc-numbers">` แสดง grid ของ `DocumentNumberConfigCard` 3 ใบ
- useQuery `["document-number-config"]` + useMutation PATCH + invalidate (เลียนแบบ block printers ในไฟล์เดียวกัน)

## สิ่งที่ "ไม่ทำ" (YAGNI / out of scope)

- ไม่ทำ pattern string อิสระ
- ไม่เก็บประวัติการเปลี่ยน format (audit) — ถ้าต้องการค่อยเพิ่มทีหลัง
- ไม่แก้ race condition ของการเดินเลข (คงพฤติกรรมเดิม)
- ไม่แตะ/รีฟอร์แมตเลขเอกสารเก่า
- ไม่ทำช่อง "วัน" (day) ในเลข — ไม่มี use case
- ไม่แตะ Stock code (มาจากภายนอก ไม่ auto-gen) และ QCTestResult (ไม่มีเลข)

## ไฟล์ที่จะแตะ (สรุป)

ใหม่:
- `server/models/DocumentNumberConfig.js`
- `server/routes/documentNumberConfigs.js`
- `server/lib/documentNumber.js` + `server/lib/documentNumber.test.js`
- `src/lib/documentNumberConfig.ts`
- `src/components/lis/DocumentNumberConfigCard.tsx`

แก้:
- `server/index.js` (mount route)
- `server/routes/petitions.js`, `server/routes/sampleReceipts.js`, `server/routes/labRequests.js` (เรียก helper)
- `src/lib/api.ts` (2 ฟังก์ชัน)
- `src/pages/SettingsPage.tsx` (แท็บใหม่)
