# คำขอของแผนก RM จากฟอร์ม F-WAR-03-01,02

วันที่: 2026-07-20
สถานะ: design approved, ยังไม่ implement

## ปัญหา

`dept: 'production' | 'rm' | 'fg'` มีอยู่ครบทั้ง backend enum (`server/models/Petition.js:99-104`),
TypeScript union (`src/types/petition.types.ts:44`), zod schema (`src/lib/validations.ts:89-95`),
dept filter, และ QC priority scoring (`src/pages/QCApproval.tsx:22` — RM ได้คะแนนสูงสุด)

แต่ **ไม่มีทางสร้าง petition ของ RM เลย** — ทุก route วิ่งเข้า `ProductionPetitionNewPage.tsx`
ซึ่ง hardcode `dept: 'production'` ไว้ที่บรรทัด 788 และเป็นที่เดียวในระบบที่เรียก `createPetition`

แผนก RM (คลังสินค้าวัตถุดิบ) ใช้ฟอร์มกระดาษ **F-WAR-03-01,02 Rev 03 (01/09/60)** อยู่ ประกอบด้วย
2 หน้าที่ใช้คู่กัน ฟอร์มนี้จะกลายเป็นหน้าสร้างคำขอของ RM ในระบบ

## สิ่งที่ตัดสินใจไว้แล้ว

| ประเด็น | ข้อสรุป |
|---|---|
| บทบาทของฟอร์ม | เป็น**ตัวคำขอ RM เอง** — กรอกฟอร์มนี้แทน wizard ของฝ่ายผลิต แล้วระบบสร้าง `Petition{dept:'rm'}` |
| จังหวะกรอก | กรอกครบทั้ง 2 หน้าทีเดียวแล้วกดส่ง (ไม่มี draft / ไม่แยกจังหวะตามลายเซ็นบนกระดาษ) |
| แบช → item | ติ๊กเลือกได้ตอนกรอกว่าแบชไหนส่งตรวจ — แบชที่ติ๊ก 1 แบช = 1 `Petition.items[]` |
| รายการทดสอบ | RM เลือกเอง เพิ่มเป็น step ที่ 3 ของ wizard |
| ที่เก็บข้อมูลฟอร์ม | collection แยก `GoodsReceipt` ref `petitionId` (ตามรอย `LabRequest`) |
| URL | `/petition/rm/new` |
| `isLabBatch()` | **ไม่ใช้กับ `dept:'rm'`** |
| แก้ฟอร์มหลังส่ง | เฟสนี้ยังแก้ไม่ได้ |

### ทำไมถึงเลือก collection แยก ไม่ฝังบน Petition

`Petition.js` ตอนนี้ 184 บรรทัดและมี field เยอะมากอยู่แล้ว การยัดอีก ~50 field ที่ใช้แค่ `dept:'rm'`
ทำให้ schema บวมโดยที่ production/fg ไม่ได้ใช้เลย เหตุผลเดียวกับที่
`docs/superpowers/specs/2026-06-13-lab-agreement-review-design.md` ปฏิเสธการเก็บ review ไว้บน Petition
และ `documentNumber.js` รองรับ series เลขที่เอกสารอยู่แล้ว ทำให้ใบมีเลขที่ของตัวเองได้ตรงตามกระดาษ
ทางเลือกนี้ยังเปิดทางให้ต่อยอดเป็นโมดูลคลังสินค้าเต็มตัวทีหลังโดยไม่ต้อง migrate ข้อมูล

### ทำไมถึงตัด `isLabBatch()` ออกจาก RM

`src/types/petition.types.ts:53-56` กำหนดว่าแบชที่ลงท้ายด้วย `1` หรือ `6` ต้องแนบ `LabRequest`
(ใบคำขอรับบริการ) บังคับที่ `server/routes/labRequests.js:67-69` ด้วย

กฎนี้ตั้งบนสมมติฐานว่าเลขแบชเป็นเลขภายในที่หลักสุดท้ายมีความหมาย แต่แบชของ RM คือ
**แบชนัมเบอร์ของผู้ขาย** ซึ่งเป็นเลขอะไรก็ได้ ถ้าใช้กฎนี้ต่อจะเด้งขอ LabRequest แบบสุ่มโดยไม่มีเหตุผลทางธุรกิจ
→ RM ไม่มี LabRequest เลย ต้องเติม guard ทั้งฝั่ง UI และ `server/routes/labRequests.js:67-69`

## Data model

`server/models/GoodsReceipt.js` — 1 doc ต่อ 1 petition

```
GoodsReceipt
  receiptNo      String  เลขที่ใบรับสินค้า      (documentNumber series 'goodsReceipt')
  inspectionNo   String  เลขที่ใบตรวจสอบวัตถุดิบ (documentNumber series 'rawMaterialInspection')
  warehouse      String  คลังสินค้า
  petitionId     ObjectId ref Petition
  petitionNo     String
  receipt        ReceiptSchema      { _id: false }
  inspection     InspectionSchema   { _id: false }
  + { timestamps: true } + softDeletePlugin
```

ยึด convention เดียวกับ `LabAgreementReviewSchema` (`server/models/LabRequest.js:17-43`):

| ตัวควบคุมบนกระดาษ | Mongoose |
|---|---|
| radio เลือกอันเดียว | `{ type: String, enum: [...] }` |
| checkbox เลือกหลายอัน | `[{ type: String, enum: [...] }]` |
| ติ๊กเดี่ยว ใช่/ไม่ใช่ | `Boolean` |
| "อื่นๆ ระบุ ____" | `String` เป็นฟิลด์พี่น้อง |
| ช่องลงชื่อ | `xxxBy: String` + `xxxAt: Date` |

ทุก field เป็น optional ยกเว้นที่ระบุ — กรอกไม่ครบต้องเซฟได้

### `ReceiptSchema` — F-WAR-03-01 ใบรับสินค้า (ลัดดา)

```js
// อ้างถึง
references            [{ enum: ['foreign', 'domestic', 'deliveryNote'] }]
purchaseOrderNo       String    // ใบสั่งซื้อเลขที่
purchaseOrderDate     Date
deliveryNoteNo        String    // เลขที่ใบส่งของ

// รายการที่ตรวจรับ ข้อ 1-3
productCode              String    // 1. รหัสสินค้า
productName              String    //    ชื่อสินค้า
activeIngredientPercent  String    //    % สารออกฤทธิ์
packageSize              String    // 2. ขนาดบรรจุ
quantity                 Number    //    จำนวน
quantityUnit             { enum: ['drum','sack','box','can'] }        // ถัง/กส/กล่อง/กป
totalWeight              Number    //    น้ำหนักรวม
totalWeightUnit          { enum: ['litre','kg','piece'] }             // ลิตร/กก./ชิ้น
sellerGrossWeightKg      Number    // 3. ข้อมูลจากผู้ขาย Gross Weight (กก.)
sellerNetWeightLitre     Number    //    Net Weight (ลิตร)
sellerNetWeightKg        Number    //    Net Weight (กก.)

// กรณีมีแบชนัมเบอร์ — 2 ฝั่ง ฝั่งละ 5 แถวบนกระดาษ
caBatchMode        { enum: ['has', 'none'] }   // ข้อมูลจากผู้ขาย (CA)
caBatches          [{ batchNo: String, amount: Number,
                      unit: { enum: ['litre','kg','piece'] } }]
productBatchMode   { enum: ['has', 'none'] }   // ข้อมูลจากสินค้า
productBatches     [{ batchNo: String, amount: Number,
                      unit: { enum: ['litre','kg','piece'] },
                      sendToLab: Boolean }]    // ← ธงว่าส่งตรวจ

// ข้อ 5-8
seller                    String   // 5. ชื่อผู้ขาย
sellerCountry             String   //    ประเทศ
manufacturer              String   // 6. ชื่อผู้ผลิต
manufacturerCountry       String   //    ประเทศ
activeIngredientTolerance String   // 7. เกณฑ์คลาดเคลื่อนมาตรฐานสารออกฤทธิ์
toleranceResult           { enum: ['within', 'outside'] }
toleranceOutsideReason    String   //    ไม่อยู่ในเกณฑ์ คือ ____
lateDelivery              [{ enum: ['vsReport', 'vsPurchaseOrder'] }]  // 8. การส่งมอบ

// ลงชื่อ
receivedByName  String   // ผู้รับสินค้า
receivedAt      Date     // วันที่
```

`caBatches` / `productBatches` ไม่จำกัดจำนวนแถวใน schema (กระดาษมี 5 ช่อง แต่ UI ให้เพิ่มได้ตามจริง
และ print template จะ overflow ลงมาได้ด้วย `FitToBox`)

### `InspectionSchema` — F-WAR-03-02 ใบตรวจสอบวัตถุดิบ

```js
// 1. ลักษณะภาชนะที่ใส่
containerType       { enum: ['paperDrum','steelDrum','plasticDrum','paperSack',
                             'plasticSack','paperBox','jar','other'] }
containerTypeOther  String

// 2. สภาพภาชนะที่ใส่
containerCondition         { enum: ['normal', 'leakOrBroken'] }
containerConditionBatches  String    // แบชที่ ____

// 3. สัญลักษณ์บนภาชนะ (สำหรับสินค้าต่างประเทศ)
labelStatus     { enum: ['has', 'none'] }   // มี/ไม่มีฉลากปิด
sealMarkStatus  { enum: ['has', 'none'] }   // มี/ไม่มีซีลปิ๊งมาร์ค

// 4. การสุ่มตัวอย่างชั่งน้ำหนัก
specificGravity  Number   // ถพ. (กรณีวัดได้)
grossWeight      Number
grossWeightUnit  { enum: ['litre', 'kg'] }
netWeightLitre   Number
netWeightKg      Number
toleranceKg      Number   // ช่วงยอมรับ ต่ำกว่า Gross ไม่เกิน 0.2% สูงกว่าไม่เกิน 1.5% = ____ กก.
weighBatches     [{ batchNo: String, quantity: Number,
                    quantityUnit: { enum: ['drum','sack','box','can'] },
                    weightKg: Number }]

// สรุปผลการตรวจ ข้อ 1-4
summary14 {
  accepted      Boolean
  note          String    // ยอมรับได้ ____
  rejectReason  String    // ยอมรับไม่ได้ เพราะ ____
  inspectedBy   String
  inspectedAt   Date
}

// 5. ลักษณะของสินค้า
appearanceSameBatches  String   // แบชที่ลักษณะเหมือนเดิม คือ แบชที่ ____
appearance             [{ enum: ['powder','flake','granule','lump','fine','coarse',
                                 'viscousLiquid','clearLiquid','other'] }]
appearanceOther        String
appearanceDiffBatches  String   // แบชที่ลักษณะไม่เหมือนเดิม คือ แบชที่ ____
appearanceDiffDetail   String   // ระบุสิ่งที่ไม่เหมือนเดิม ____

// 6. สีของสินค้า
colorSameBatches  String
colorSame         String
colorDiffBatches  String
colorDiff         String

// สรุปผลการตรวจสอบ ข้อ 5-6
summary56 {  // โครงเดียวกับ summary14
  accepted, note, rejectReason, inspectedBy, inspectedAt
}
```

### จุดเชื่อมกับ Petition

`productBatches[].sendToLab` เป็นเพียงธง — **ไม่เก็บ `testItems` ไว้ใน `GoodsReceipt`**
`testItems` อยู่บน `Petition.items[]` ที่เดิมตามปกติ ผูกกลับหากันด้วย `batchNo`

การ map แบชที่ติ๊ก → `Petition.items[]` (1 แบชที่ติ๊ก = 1 item):

| `Petition.items[]` | มาจาก |
|---|---|
| `seq` | ลำดับที่ 1..n ของแบชที่ติ๊ก |
| `sampleName` | `receipt.productName` |
| `commonName` | master item ที่เลือกใน step 3 |
| `batchNo` | `productBatches[i].batchNo` |
| `testItems` | เลือกใน step 3 |

`commonName` ต้องมาจาก master item ที่ RM เลือก ไม่ใช่พิมพ์เอง เพราะเป็นตัวขับการจับคู่ simple-method
ตอน assign เครื่องมือ (ดู `src/lib/petitionTestItems.ts` และ gotcha เรื่อง simple-method positional ใน CLAUDE.md)

## Flow การสร้าง

หน้า `src/pages/petitions/RmPetitionNewPage.tsx` — wizard 4 step ใช้โครง stepper เดียวกับ
`ProductionPetitionNewPage`

| Step | เนื้อหา |
|---|---|
| 1. ใบรับสินค้า | F-WAR-03-01 ทั้งหน้า รวมตารางแบช 2 ฝั่ง — ฝั่ง "ข้อมูลจากสินค้า" มี checkbox **ส่งตรวจ** ต่อแถว |
| 2. ใบตรวจสอบวัตถุดิบ | F-WAR-03-02 ทั้งหน้า (ข้อ 1-6 + 2 สรุป) — ช่อง "อ้างถึงใบรับวัตถุดิบ เลขที่/วันที่" auto จาก step 1 |
| 3. รายการทดสอบ | เฉพาะแบชที่ติ๊ก แถวละแบช → เลือก master item (ได้ `commonName`) + `testItems` (ยืม pattern จาก `wizard/ItemsStep.tsx`) |
| 4. ตรวจทาน + ส่ง | preview แบบหน้ากระดาษ + ปุ่มส่ง |

**Submit ทำ 2 จังหวะตามลำดับ** (แบบเดียวกับที่ production ทำกับ LabRequest วันนี้ที่
`ProductionPetitionNewPage.tsx:808-816`):

1. `POST /petitions` — `dept:'rm'`, `items[]` จากแบชที่ติ๊ก, `submittedBy` = user ที่ล็อกอิน
   (`department` = `คลังสินค้า RM`)
2. `POST /goods-receipts` — ผูก `petitionId`/`petitionNo` ที่เพิ่งได้

ถ้าจังหวะ 2 พัง → ลบ petition ที่เพิ่งสร้างทิ้ง แล้วโยน error ให้ผู้ใช้กดส่งใหม่
ไม่ปล่อยให้มี petition ลอยที่ไม่มีฟอร์มผูกอยู่

### validation ก่อนส่ง

- ต้องติ๊ก `sendToLab` อย่างน้อย 1 แบช
- ทุกแบชที่ติ๊กต้องมี `batchNo` ไม่ว่าง และเลือก master item + `testItems` อย่างน้อย 1 รายการ
- `rmPetitionFormSchema` (`src/lib/validations.ts:89-95`) ใช้ได้ตามเดิม ไม่ต้องแก้

## แสดงผลและปริ้น

**ดูฟอร์มหลังส่ง** — การ์ดในหน้า `/petition/:id` (`PetitionTimelineDetailPage`) โผล่เฉพาะ
`dept==='rm'` เรนเดอร์ด้วย `GoodsReceiptView.tsx` ก๊อป pattern `Line`/`joinLabels` จาก
`LabAgreementReviewView.tsx:7-17` (ฟิลด์ว่างคืน `null` ไม่ต้องแสดง)

**ปริ้น** — `GoodsReceiptPrintTemplate.tsx` A4 แนวตั้ง 2 แผ่น (`.gr-page1` / `.gr-page2`)
ไม่ต้องสลับ orientation เหมือน `PetitionPrintTemplate`

ก๊อป primitive `CB` / `RD` / `Line` + บล็อก CSS จาก `PetitionPrintTemplate.tsx:31-45, 645-683`
มา rename prefix เป็น `.gr-*` ข้อกำหนดที่ต้องรักษา:

- หน่วยเป็น `pt` / `cm` / `mm` ล้วน ห้าม `px` ห้าม Tailwind spacing
- font จาก `A4_PRINT_FONT_FAMILY` / `A4_PRINT_FONT_SIZE` (`src/lib/printConfig.ts:6-8`)
  พร้อม `!important` กันโดน Tailwind ที่ `collectDocumentCss()` ลากเข้ามาทับ
- ห่อเนื้อหาด้วย `FitToBox` กันล้นหน้า (เขียน transform ลง `element.style` ตรงๆ เพราะ pipeline
  serialize ด้วย `outerHTML` — React state ไม่รอด)
- footer ตรงตามกระดาษ: `F-WAR-03-01 Rev:03 01/09/60` และ `F-WAR-03-02 Rev:03 01/09/60`

ลงทะเบียน docType `goods-receipt` **4 ที่ที่ต้อง sync กัน**:
`src/lib/printConfig.ts` (union + `DOC_TYPE_KIND` + `PRINT_DOC_TYPES`),
`server/lib/printerRouting.js` (`DOC_TYPE_KIND` + `paperSizeForSlug`),
`src/lib/api.ts:577`, `src/lib/printConfig.test.ts`
\+ เพิ่ม `.gr-page1` เข้า selector `getSheetSize()` ที่ `PrintPreviewDialog.tsx:53-55`

## ไฟล์

**เกิดใหม่**

```
server/models/GoodsReceipt.js
server/routes/goodsReceipts.js
server/routes/goodsReceipts.test.js
src/types/goodsReceipt.types.ts
src/lib/goodsReceipt.ts                  *_LABELS + isFilled()
src/lib/goodsReceipt.test.ts
src/lib/rmPetitionMapping.ts             แบชที่ติ๊ก → items[]
src/lib/rmPetitionMapping.test.ts
src/pages/petitions/RmPetitionNewPage.tsx
src/components/warehouse/GoodsReceiptStep.tsx          (F-WAR-03-01)
src/components/warehouse/RawMaterialInspectionStep.tsx (F-WAR-03-02)
src/components/warehouse/GoodsReceiptView.tsx
src/components/warehouse/GoodsReceiptPrintTemplate.tsx
```

**แก้ของเดิม**

```
server/index.js                    mountApi('/goods-receipts', ...)
server/lib/documentNumber.js       + series 'goodsReceipt', 'rawMaterialInspection'
server/models/DocumentNumberConfig.js   + docType enum 2 ค่า
server/routes/labRequests.js:67-69      guard ข้าม dept 'rm'
server/lib/printerRouting.js       + docType 'goods-receipt'
src/App.tsx                        + lazy route /petition/rm/new (ประกาศก่อน /petition/:id)
src/lib/navItems.ts                + เมนู
src/lib/api.ts                     + endpoints goodsReceipts, + docType ที่ :577
src/lib/printConfig.ts             + docType
src/lib/printConfig.test.ts        + docType
src/components/lis/PrintPreviewDialog.tsx:53-55   + .gr-page1
src/pages/petitions/PetitionTimelineDetailPage.tsx  + การ์ดฟอร์ม (dept==='rm')
server/seed-data/accessgroups.json + path /petition/rm/new
```

## สิทธิ์

เพิ่ม `/petition/rm/new` เข้า `navItems.ts` และ access group ของคลังสินค้าใน
`server/seed-data/accessgroups.json` — gate ปุ่ม/เมนูด้วย `useCanAccessPath()`
แบบเดียวกับ `LabApprovalReviewPage.tsx:30-31, 186`

## เทส

pure logic ที่คุ้มค่าเทส:

- **`rmPetitionMapping`** — ติ๊ก 3 จาก 5 แบช → ได้ 3 items เรียง `seq` 1-3, `batchNo` ตรงตัว,
  `sampleName` มาจาก `productName`, `commonName` มาจาก master item ที่เลือก;
  ไม่ติ๊กเลย → error; แบชที่ติ๊กแต่ `batchNo` ว่าง → error
- **`goodsReceipt.ts`** — label map ครอบคลุมทุกค่า enum ทั้ง 2 schema (กันลืมเวลาเพิ่มตัวเลือก),
  `isFilled()` คืน false เมื่อยังไม่ลงชื่อ
- **`goodsReceipts` route** — สร้างโดยไม่มี `petitionId` → 400, สร้างซ้ำ petition เดิม → 409

verify ด้วย `npx tsc -p tsconfig.app.json --noEmit` (**ไม่ใช่ `npx tsc --noEmit` เฉยๆ**
ซึ่งเป็น no-op เพราะ root tsconfig `files: []`) + `npm run test` + `cd server && npm test`
ห้ามรัน `npm run build`

หลัง implement เสร็จต้องรัน `npm run seed:export` แล้ว commit เพราะเพิ่ม model ใหม่

## นอกขอบเขตเฟสนี้

- **แก้ฟอร์มหลังส่ง** — ส่งแล้วจบ ผิดก็ยกเลิกใบแล้วสร้างใหม่
  (`PetitionEditPage` ของเดิมใช้ `SIMPLE_STEPS` กับ `dept!=='production'` ซึ่งแก้ฟอร์ม WAR ไม่ได้)
  ถ้าใช้จริงแล้วเจอปัญหาค่อยเพิ่มโหมด edit ที่ล็อกเมื่อ status พ้น `sampleSent`
- **บันทึกใบรับสินค้าโดยไม่ส่ง Lab** — โมดูลคลังสินค้าเต็มตัว
- **draft / save ค้างกลางคัน**
- **ป้อนผล % สารออกฤทธิ์ (ข้อ 7) กลับเข้าฟอร์มอัตโนมัติจากผล Lab** — เฟสนี้ RM กรอกเอง
- **`customerCode.ts`** — `"คลังสินค้า RM"` ยังไม่มี mapping ตกไปที่ `return raw`
  (`src/lib/customerCode.ts:26`) ใช้แค่ตอนปริ้น `PetitionPrintTemplate` ไม่กระทบ flow นี้
