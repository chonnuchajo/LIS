# RM Goods-Receipt Petition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้แผนก RM สร้าง petition ได้จากฟอร์มกระดาษ F-WAR-03-01,02 (ใบรับสินค้า + ใบตรวจสอบวัตถุดิบ) ที่ `/petition/rm/new`

**Architecture:** ข้อมูลฟอร์มเก็บใน collection ใหม่ `GoodsReceipt` ที่ ref `petitionId` ตามรอย `LabRequest` — Petition schema ไม่ถูกแตะ แบชที่ติ๊ก "ส่งตรวจ" ในฟอร์มจะ generate `Petition.items[]` ส่วน `testItems`/`commonName` เลือกใน step 3 ของ wizard และเก็บบน Petition ตามปกติ

**Tech Stack:** Express 4 + Mongoose 8 (jest) / React 18 + TypeScript + Vite + shadcn/ui + TanStack Query (vitest)

**Spec:** `docs/superpowers/specs/2026-07-20-rm-goods-receipt-petition-design.md`

## Global Constraints

- **ห้ามรัน `npm run build`** — `postbuild` เขียนทับไฟล์ root แล้ว dev server พัง ใช้ type-check แทน
- **type-check ที่ใช้จริงคือ `npx tsc -p tsconfig.app.json --noEmit`** — `npx tsc --noEmit` เฉยๆ เป็น no-op เพราะ root `tsconfig.json` มี `files: []`
- Frontend test: `npm run test` (vitest, run once) — ไฟล์เดียว: `npx vitest run <path>`
- Backend test: `cd server && npm test` (jest) — ไฟล์เดียว: `cd server && npx jest lib/<name>.test.js`
- **server ไม่มี supertest** — เทสฝั่ง server ทำได้เฉพาะ pure function ใน `server/lib/*.test.js` ห้ามเขียน route test ที่ยิง HTTP
- ข้อความ error ที่ผู้ใช้เห็นต้องเป็น**ภาษาไทย**
- Path alias `@/*` → `src/*`
- `tsconfig` เป็นแบบหลวม (`noImplicitAny: false`, `strictNullChecks: false`)
- ทุก mongoose model ใหม่ต้องใส่ `softDeletePlugin` จาก `../lib/softDelete`
- subschema ของฟอร์มใช้ `{ _id: false }` และทุก field เป็น optional ยกเว้นที่ระบุ — กรอกไม่ครบต้องเซฟได้
- Commit message ลงท้ายด้วย `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- **`git add` ต้องระบุ pathspec รายไฟล์เสมอ** — repo นี้มีงาน uncommitted ของ session อื่นค้างอยู่ ห้าม `git add -A` / `git add .`

## File Structure

**สร้างใหม่ — backend**

| ไฟล์ | หน้าที่ |
|---|---|
| `server/models/GoodsReceipt.js` | schema ของฟอร์มทั้ง 2 หน้า |
| `server/lib/goodsReceipt.js` | pure validation + helper (แยกออกมาเพราะ route เทสไม่ได้) |
| `server/lib/goodsReceipt.test.js` | เทสของข้างบน |
| `server/lib/labRequestEligibility.js` | pure predicate: petition แบบไหนมี LabRequest ได้ |
| `server/lib/labRequestEligibility.test.js` | เทสของข้างบน |
| `server/routes/goodsReceipts.js` | CRUD |

**สร้างใหม่ — frontend**

| ไฟล์ | หน้าที่ |
|---|---|
| `src/types/goodsReceipt.types.ts` | union types + interfaces (mirror ของ mongoose schema) |
| `src/lib/goodsReceipt.ts` | `*_LABELS` ทุก enum + `isReceiptFilled()` / `isInspectionFilled()` |
| `src/lib/goodsReceipt.test.ts` | เทส label coverage |
| `src/lib/rmPetitionMapping.ts` | แบชที่ติ๊ก → `Petition.items[]` |
| `src/lib/rmPetitionMapping.test.ts` | เทสของข้างบน |
| `src/pages/petitions/RmPetitionNewPage.tsx` | wizard 4 step + submit |
| `src/components/warehouse/GoodsReceiptStep.tsx` | ฟอร์ม F-WAR-03-01 |
| `src/components/warehouse/RawMaterialInspectionStep.tsx` | ฟอร์ม F-WAR-03-02 |
| `src/components/warehouse/RmTestItemsStep.tsx` | เลือก master item + testItems ต่อแบช |
| `src/components/warehouse/formControls.tsx` | `RadioRow` / `CheckRow` / `toggle` ใช้ร่วมกัน 3 step |
| `src/components/warehouse/GoodsReceiptView.tsx` | read-only view บนหน้า detail |
| `src/components/warehouse/GoodsReceiptPrintTemplate.tsx` | A4 2 แผ่น |

**แก้ของเดิม**

| ไฟล์ | แก้อะไร |
|---|---|
| `server/lib/documentNumber.js:5-9` | `DEFAULTS` += `goodsReceipt`, `rawMaterialInspection` |
| `server/models/DocumentNumberConfig.js:6` | `docType` enum += 2 ค่า |
| `server/routes/labRequests.js:6,58-69` | guard ด้วย `canHaveLabRequest()` |
| `server/index.js` | `mountApi('/goods-receipts', ...)` |
| `server/lib/printerRouting.js:8-14,23-27` | docType `goods-receipt` |
| `src/lib/printConfig.ts:1,53-59,115-121` | docType `goods-receipt` |
| `src/lib/printConfig.test.ts:23-25,37-43` | เพิ่ม docType ใหม่เข้า assertion |
| `src/lib/api.ts:577` + block endpoints | `goods-receipt` + endpoints ใหม่ |
| `src/components/lis/PrintPreviewDialog.tsx:53-55` | selector += `.gr-page1` |
| `src/App.tsx:146-147` | route `/petition/rm/new` (ประกาศ**ก่อน** `/petition/:id`) |
| `src/lib/navItems.ts` | เมนู "รับวัตถุดิบ (RM)" |
| `src/pages/petitions/PetitionTimelineDetailPage.tsx` | การ์ดฟอร์มเมื่อ `dept === 'rm'` |
| `server/seed-data/accessgroups.json` | path `/petition/rm/new` |

---

### Task 1: GoodsReceipt model + เลขที่เอกสาร 2 series

**Files:**
- Create: `server/models/GoodsReceipt.js`
- Modify: `server/lib/documentNumber.js:5-9`, `server/models/DocumentNumberConfig.js:6`
- Test: `server/lib/documentNumber.test.js`

**Interfaces:**
- Consumes: `softDeletePlugin` จาก `server/lib/softDelete.js`, `nextDocumentNumber(docType, Model, numField)` จาก `server/lib/documentNumber.js`
- Produces: model `GoodsReceipt` (collection `goodsreceipts`) พร้อม field `receiptNo`, `inspectionNo`, `warehouse`, `petitionId`, `petitionNo`, `receipt`, `inspection`; docType ใหม่ `'goodsReceipt'` (prefix `GR`) และ `'rawMaterialInspection'` (prefix `RMI`)

- [ ] **Step 1: เขียนเทสที่ยังแดง — default config ของ docType ใหม่**

เพิ่มท้ายไฟล์ `server/lib/documentNumber.test.js`:

```js
describe('docType ใหม่ของฟอร์ม F-WAR-03', () => {
  const { DEFAULTS, DOC_TYPES, buildScanPrefix } = require('./documentNumber');

  it('มี goodsReceipt และ rawMaterialInspection อยู่ใน DOC_TYPES', () => {
    expect(DOC_TYPES).toContain('goodsReceipt');
    expect(DOC_TYPES).toContain('rawMaterialInspection');
  });

  it('ใบรับสินค้าเดินเลขเป็น GR-YYMM-####', () => {
    const prefix = buildScanPrefix(DEFAULTS.goodsReceipt, new Date(2026, 6, 20));
    expect(prefix).toBe('GR-2607-');
  });

  it('ใบตรวจสอบวัตถุดิบเดินเลขเป็น RMI-YYMM-####', () => {
    const prefix = buildScanPrefix(DEFAULTS.rawMaterialInspection, new Date(2026, 6, 20));
    expect(prefix).toBe('RMI-2607-');
  });
});
```

- [ ] **Step 2: รันเทสให้เห็นว่าแดง**

Run: `cd server && npx jest lib/documentNumber.test.js`
Expected: FAIL — `expect(DOC_TYPES).toContain('goodsReceipt')` ไม่ผ่าน และ `buildScanPrefix(undefined, ...)` โยน TypeError

- [ ] **Step 3: เพิ่ม DEFAULTS 2 ตัว**

`server/lib/documentNumber.js` แก้ block `DEFAULTS` (บรรทัด 5-9) เป็น:

```js
const DEFAULTS = {
  petition:      { docType: 'petition',      prefix: 'P',   yearFormat: 'yy',   includeMonth: true,  seqPadding: 4, separator: '-' },
  sampleReceipt: { docType: 'sampleReceipt', prefix: 'RCV', yearFormat: 'yyyy', includeMonth: false, seqPadding: 4, separator: '-' },
  labRequest:    { docType: 'labRequest',    prefix: 'L',   yearFormat: 'yy',   includeMonth: true,  seqPadding: 4, separator: '-' },
  // ฟอร์ม F-WAR-03-01,02 — ใบรับสินค้า / ใบตรวจสอบวัตถุดิบ ของแผนก RM
  goodsReceipt:  { docType: 'goodsReceipt',  prefix: 'GR',  yearFormat: 'yy',   includeMonth: true,  seqPadding: 4, separator: '-' },
  rawMaterialInspection: { docType: 'rawMaterialInspection', prefix: 'RMI', yearFormat: 'yy', includeMonth: true, seqPadding: 4, separator: '-' },
};
```

- [ ] **Step 4: เปิด enum ของ DocumentNumberConfig**

`server/models/DocumentNumberConfig.js` บรรทัด 6:

```js
    enum: ['petition', 'sampleReceipt', 'labRequest', 'goodsReceipt', 'rawMaterialInspection'],
```

- [ ] **Step 5: รันเทสให้เขียว**

Run: `cd server && npx jest lib/documentNumber.test.js`
Expected: PASS ทั้งไฟล์

- [ ] **Step 6: เขียน model**

Create `server/models/GoodsReceipt.js`:

```js
const mongoose = require('mongoose');
const { softDeletePlugin } = require('../lib/softDelete');

// ฟอร์ม F-WAR-03-01,02 Rev 03 (01/09/60) — ใบรับสินค้า (ลัดดา) + ใบตรวจสอบวัตถุดิบ
// เก็บเป็น collection แยกที่ ref petition ตามรอย LabRequest เพื่อไม่ให้ Petition บวม
// ทุก field เป็น optional ยกเว้นที่ระบุ — กรอกฟอร์มไม่ครบต้องเซฟได้

const QUANTITY_UNITS = ['drum', 'sack', 'box', 'can'];        // ถัง/กส/กล่อง/กป
const WEIGHT_UNITS = ['litre', 'kg', 'piece'];                 // ลิตร/กก./ชิ้น

// แถวแบชในตาราง "กรณีมีแบชนัมเบอร์" ฝั่งข้อมูลจากผู้ขาย (CA)
const CaBatchSchema = new mongoose.Schema({
  batchNo: String,
  amount: Number,
  unit: { type: String, enum: WEIGHT_UNITS },
}, { _id: false });

// ฝั่งข้อมูลจากสินค้าจริง — เพิ่มธง sendToLab ที่ RM ติ๊กว่าแบชไหนส่งตรวจ
const ProductBatchSchema = new mongoose.Schema({
  batchNo: String,
  amount: Number,
  unit: { type: String, enum: WEIGHT_UNITS },
  sendToLab: { type: Boolean, default: false },
}, { _id: false });

// F-WAR-03-01 ใบรับสินค้า
const ReceiptSchema = new mongoose.Schema({
  // อ้างถึง
  references: [{ type: String, enum: ['foreign', 'domestic', 'deliveryNote'] }],
  purchaseOrderNo: String,
  purchaseOrderDate: Date,
  deliveryNoteNo: String,

  // รายการที่ตรวจรับ ข้อ 1-3
  productCode: String,
  productName: String,
  activeIngredientPercent: String,
  packageSize: String,
  quantity: Number,
  quantityUnit: { type: String, enum: QUANTITY_UNITS },
  totalWeight: Number,
  totalWeightUnit: { type: String, enum: WEIGHT_UNITS },
  sellerGrossWeightKg: Number,
  sellerNetWeightLitre: Number,
  sellerNetWeightKg: Number,

  // กรณีมีแบชนัมเบอร์
  caBatchMode: { type: String, enum: ['has', 'none'] },
  caBatches: [CaBatchSchema],
  productBatchMode: { type: String, enum: ['has', 'none'] },
  productBatches: [ProductBatchSchema],

  // ข้อ 5-8
  seller: String,
  sellerCountry: String,
  manufacturer: String,
  manufacturerCountry: String,
  activeIngredientTolerance: String,
  toleranceResult: { type: String, enum: ['within', 'outside'] },
  toleranceOutsideReason: String,
  lateDelivery: [{ type: String, enum: ['vsReport', 'vsPurchaseOrder'] }],

  // ลงชื่อ
  receivedByName: String,
  receivedAt: Date,
}, { _id: false });

// แถวตารางสุ่มชั่งน้ำหนัก ข้อ 4 ของใบตรวจสอบ
const WeighBatchSchema = new mongoose.Schema({
  batchNo: String,
  quantity: Number,
  quantityUnit: { type: String, enum: QUANTITY_UNITS },
  weightKg: Number,
}, { _id: false });

// สรุปผลการตรวจ — ใช้ทั้งข้อ 1-4 และข้อ 5-6 โครงเดียวกัน
const InspectionSummarySchema = new mongoose.Schema({
  accepted: Boolean,
  note: String,
  rejectReason: String,
  inspectedBy: String,
  inspectedAt: Date,
}, { _id: false });

// F-WAR-03-02 ใบตรวจสอบวัตถุดิบ
const InspectionSchema = new mongoose.Schema({
  // 1. ลักษณะภาชนะที่ใส่
  containerType: {
    type: String,
    enum: ['paperDrum', 'steelDrum', 'plasticDrum', 'paperSack',
           'plasticSack', 'paperBox', 'jar', 'other'],
  },
  containerTypeOther: String,

  // 2. สภาพภาชนะที่ใส่
  containerCondition: { type: String, enum: ['normal', 'leakOrBroken'] },
  containerConditionBatches: String,

  // 3. สัญลักษณ์บนภาชนะ (สำหรับสินค้าต่างประเทศ)
  labelStatus: { type: String, enum: ['has', 'none'] },
  sealMarkStatus: { type: String, enum: ['has', 'none'] },

  // 4. การสุ่มตัวอย่างชั่งน้ำหนัก
  specificGravity: Number,
  grossWeight: Number,
  grossWeightUnit: { type: String, enum: ['litre', 'kg'] },
  netWeightLitre: Number,
  netWeightKg: Number,
  toleranceKg: Number,
  weighBatches: [WeighBatchSchema],

  summary14: InspectionSummarySchema,

  // 5. ลักษณะของสินค้า
  appearanceSameBatches: String,
  appearance: [{
    type: String,
    enum: ['powder', 'flake', 'granule', 'lump', 'fine', 'coarse',
           'viscousLiquid', 'clearLiquid', 'other'],
  }],
  appearanceOther: String,
  appearanceDiffBatches: String,
  appearanceDiffDetail: String,

  // 6. สีของสินค้า
  colorSameBatches: String,
  colorSame: String,
  colorDiffBatches: String,
  colorDiff: String,

  summary56: InspectionSummarySchema,
}, { _id: false });

const GoodsReceiptSchema = new mongoose.Schema({
  receiptNo: { type: String, index: true },
  inspectionNo: { type: String, index: true },
  warehouse: String,
  petitionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Petition', required: true, index: true },
  petitionNo: { type: String, index: true },
  receipt: ReceiptSchema,
  inspection: InspectionSchema,
}, { timestamps: true });

GoodsReceiptSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('GoodsReceipt', GoodsReceiptSchema);
```

- [ ] **Step 7: ตรวจว่า model โหลดได้ไม่พัง**

Run: `cd server && node -e "require('./models/GoodsReceipt'); console.log('ok')"`
Expected: พิมพ์ `ok` ไม่มี error

- [ ] **Step 8: Commit**

```bash
git add -- server/models/GoodsReceipt.js server/lib/documentNumber.js server/lib/documentNumber.test.js server/models/DocumentNumberConfig.js
git commit -m "feat: add GoodsReceipt model for F-WAR-03-01,02

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: pure validation + route `/goods-receipts`

**Files:**
- Create: `server/lib/goodsReceipt.js`, `server/lib/goodsReceipt.test.js`, `server/routes/goodsReceipts.js`
- Modify: `server/index.js` (บรรทัดกลุ่ม `mountApi`)

**Interfaces:**
- Consumes: model `GoodsReceipt` (Task 1), `nextDocumentNumber` จาก `../lib/documentNumber`
- Produces:
  - `validateGoodsReceiptInput(body) -> string | null` — คืนข้อความ error ภาษาไทย หรือ `null` เมื่อผ่าน
  - `sendToLabBatches(receipt) -> Array<{ batchNo, amount, unit, sendToLab }>` — แบชที่ติ๊กส่งตรวจ
  - REST: `GET /api/goods-receipts?petitionId=`, `GET /api/goods-receipts/:id`, `POST /api/goods-receipts`, `PATCH /api/goods-receipts/:id`, `DELETE /api/goods-receipts/:id`

- [ ] **Step 1: เขียนเทสที่ยังแดง**

Create `server/lib/goodsReceipt.test.js`:

```js
const { validateGoodsReceiptInput, sendToLabBatches } = require('./goodsReceipt');

describe('sendToLabBatches', () => {
  it('คืนเฉพาะแบชที่ติ๊กส่งตรวจ', () => {
    const receipt = {
      productBatches: [
        { batchNo: 'A1', sendToLab: true },
        { batchNo: 'A2', sendToLab: false },
        { batchNo: 'A3', sendToLab: true },
      ],
    };
    expect(sendToLabBatches(receipt).map((b) => b.batchNo)).toEqual(['A1', 'A3']);
  });

  it('ไม่มี productBatches ก็ไม่พัง', () => {
    expect(sendToLabBatches({})).toEqual([]);
    expect(sendToLabBatches(null)).toEqual([]);
  });
});

describe('validateGoodsReceiptInput', () => {
  const valid = {
    petitionId: '000000000000000000000001',
    receipt: { productName: 'Glyphosate', productBatches: [{ batchNo: 'A1', sendToLab: true }] },
  };

  it('ผ่านเมื่อข้อมูลครบ', () => {
    expect(validateGoodsReceiptInput(valid)).toBeNull();
  });

  it('ไม่มี petitionId → error', () => {
    expect(validateGoodsReceiptInput({ ...valid, petitionId: undefined }))
      .toBe('ต้องระบุ petitionId');
  });

  it('ไม่มี receipt → error', () => {
    expect(validateGoodsReceiptInput({ petitionId: valid.petitionId }))
      .toBe('ต้องระบุข้อมูลใบรับสินค้า');
  });

  it('ไม่ระบุชื่อสินค้า → error', () => {
    const body = { ...valid, receipt: { ...valid.receipt, productName: '  ' } };
    expect(validateGoodsReceiptInput(body)).toBe('ต้องระบุชื่อสินค้า');
  });

  it('ไม่ติ๊กแบชส่งตรวจเลย → error', () => {
    const body = { ...valid, receipt: { ...valid.receipt, productBatches: [{ batchNo: 'A1' }] } };
    expect(validateGoodsReceiptInput(body)).toBe('ต้องเลือกแบชที่ส่งตรวจอย่างน้อย 1 แบช');
  });

  it('แบชที่ติ๊กแต่ไม่มีแบชนัมเบอร์ → error', () => {
    const body = { ...valid, receipt: { ...valid.receipt, productBatches: [{ batchNo: '', sendToLab: true }] } };
    expect(validateGoodsReceiptInput(body)).toBe('แบชที่ส่งตรวจต้องระบุแบชนัมเบอร์');
  });

  it('body เป็น null → error ไม่ throw', () => {
    expect(validateGoodsReceiptInput(null)).toBe('ต้องระบุ petitionId');
  });
});
```

- [ ] **Step 2: รันเทสให้เห็นว่าแดง**

Run: `cd server && npx jest lib/goodsReceipt.test.js`
Expected: FAIL — `Cannot find module './goodsReceipt'`

- [ ] **Step 3: เขียน pure lib**

Create `server/lib/goodsReceipt.js`:

```js
// Pure validation/helper ของฟอร์ม F-WAR-03-01,02
// แยกออกจาก routes/goodsReceipts.js เพราะ server ไม่มี supertest — เทสได้เฉพาะ pure function

// แบชฝั่ง "ข้อมูลจากสินค้า" ที่ RM ติ๊กว่าส่งตรวจ
function sendToLabBatches(receipt) {
  const batches = (receipt && receipt.productBatches) || [];
  return batches.filter((b) => b && b.sendToLab === true);
}

// คืนข้อความ error ภาษาไทย หรือ null เมื่อผ่าน
function validateGoodsReceiptInput(body) {
  const b = body || {};
  if (!b.petitionId) return 'ต้องระบุ petitionId';
  if (!b.receipt) return 'ต้องระบุข้อมูลใบรับสินค้า';
  if (!String(b.receipt.productName || '').trim()) return 'ต้องระบุชื่อสินค้า';

  const selected = sendToLabBatches(b.receipt);
  if (selected.length === 0) return 'ต้องเลือกแบชที่ส่งตรวจอย่างน้อย 1 แบช';
  if (selected.some((x) => !String(x.batchNo || '').trim())) {
    return 'แบชที่ส่งตรวจต้องระบุแบชนัมเบอร์';
  }
  return null;
}

module.exports = { sendToLabBatches, validateGoodsReceiptInput };
```

- [ ] **Step 4: รันเทสให้เขียว**

Run: `cd server && npx jest lib/goodsReceipt.test.js`
Expected: PASS ทั้ง 9 เคส

- [ ] **Step 5: เขียน route**

Create `server/routes/goodsReceipts.js`:

```js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const GoodsReceipt = require('../models/GoodsReceipt');
const Petition = require('../models/Petition');
const { nextDocumentNumber } = require('../lib/documentNumber');
const { validateGoodsReceiptInput } = require('../lib/goodsReceipt');

function badRequest(res, message) {
  return res.status(400).json({ error: { message } });
}

// GET /api/goods-receipts?page=1&limit=20&petitionId=&petitionNo=
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const q = {};
    if (req.query.petitionId) q.petitionId = req.query.petitionId;
    if (req.query.petitionNo) q.petitionNo = req.query.petitionNo;
    const [items, total] = await Promise.all([
      GoodsReceipt.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      GoodsReceipt.countDocuments(q),
    ]);
    res.json({ items, total, page, limit });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// GET /api/goods-receipts/:id
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const doc = mongoose.Types.ObjectId.isValid(id)
      ? await GoodsReceipt.findById(id).lean()
      : await GoodsReceipt.findOne({ receiptNo: id }).lean();
    if (!doc) return res.status(404).json({ error: { message: 'ไม่พบใบรับสินค้า' } });
    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

// POST /api/goods-receipts
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const invalid = validateGoodsReceiptInput(body);
    if (invalid) return badRequest(res, invalid);

    const petition = await Petition.findById(body.petitionId).lean();
    if (!petition) return badRequest(res, 'ไม่พบคำร้องอ้างอิง');
    if (petition.dept !== 'rm') return badRequest(res, 'ใบรับสินค้าใช้ได้เฉพาะคำขอของแผนก RM');

    // 1 petition มีได้ใบเดียว — กันกดส่งซ้ำแล้วได้ฟอร์มซ้อน
    const existing = await GoodsReceipt.findOne({ petitionId: body.petitionId }).lean();
    if (existing) return res.status(409).json({ error: { message: 'คำร้องนี้มีใบรับสินค้าอยู่แล้ว' } });

    const [receiptNo, inspectionNo] = await Promise.all([
      nextDocumentNumber('goodsReceipt', GoodsReceipt, 'receiptNo'),
      nextDocumentNumber('rawMaterialInspection', GoodsReceipt, 'inspectionNo'),
    ]);
    const doc = await GoodsReceipt.create({
      ...body,
      receiptNo,
      inspectionNo,
      petitionNo: petition.petitionNo,
    });
    res.status(201).json(doc);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

// PATCH /api/goods-receipts/:id
router.patch('/:id', async (req, res) => {
  try {
    const updates = { ...req.body };
    delete updates._id;
    delete updates.receiptNo;
    delete updates.inspectionNo;
    delete updates.petitionId;
    delete updates.petitionNo;
    const doc = await GoodsReceipt.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!doc) return res.status(404).json({ error: { message: 'ไม่พบใบรับสินค้า' } });
    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

// DELETE /api/goods-receipts/:id
router.delete('/:id', async (req, res) => {
  try {
    const actor = req.query.actor || (req.body && req.body.actor) || 'system';
    const doc = await GoodsReceipt.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: { message: 'ไม่พบใบรับสินค้า' } });
    await doc.softDelete(actor);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

module.exports = router;
```

- [ ] **Step 6: mount route**

`server/index.js` — เพิ่มบรรทัดถัดจาก `mountApi('/lab-requests', ...)`:

```js
mountApi('/goods-receipts', require('./routes/goodsReceipts'));
```

- [ ] **Step 7: ตรวจว่า server boot ได้**

Run: `cd server && node -e "require('./routes/goodsReceipts'); console.log('ok')"`
Expected: พิมพ์ `ok`

- [ ] **Step 8: Commit**

```bash
git add -- server/lib/goodsReceipt.js server/lib/goodsReceipt.test.js server/routes/goodsReceipts.js server/index.js
git commit -m "feat: add goods-receipts API

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: ยกเว้นกฎ LabRequest สำหรับ dept 'rm'

`isLabBatch()` บังคับว่าแบชลงท้าย `1`/`6` ต้องมีใบคำขอรับบริการ แต่แบชของ RM คือแบชนัมเบอร์ของผู้ขาย เลขลงท้ายไม่มีความหมาย → RM ไม่มี LabRequest เลย

**Files:**
- Create: `server/lib/labRequestEligibility.js`, `server/lib/labRequestEligibility.test.js`
- Modify: `server/routes/labRequests.js:6` (import), `:58-69` (guard)

**Interfaces:**
- Produces: `canHaveLabRequest(petition) -> boolean` — `false` เมื่อ `petition.dept === 'rm'`

- [ ] **Step 1: เขียนเทสที่ยังแดง**

Create `server/lib/labRequestEligibility.test.js`:

```js
const { canHaveLabRequest } = require('./labRequestEligibility');

describe('canHaveLabRequest', () => {
  it('คำขอของ RM ไม่มีใบคำขอรับบริการ', () => {
    expect(canHaveLabRequest({ dept: 'rm' })).toBe(false);
  });

  it('ฝ่ายผลิตและ FG มีได้', () => {
    expect(canHaveLabRequest({ dept: 'production' })).toBe(true);
    expect(canHaveLabRequest({ dept: 'fg' })).toBe(true);
  });

  it('ไม่มี petition หรือไม่ระบุ dept → ถือว่ามีได้ (ของเดิมไม่เปลี่ยนพฤติกรรม)', () => {
    expect(canHaveLabRequest(null)).toBe(true);
    expect(canHaveLabRequest({})).toBe(true);
  });
});
```

- [ ] **Step 2: รันเทสให้เห็นว่าแดง**

Run: `cd server && npx jest lib/labRequestEligibility.test.js`
Expected: FAIL — `Cannot find module './labRequestEligibility'`

- [ ] **Step 3: เขียน predicate**

Create `server/lib/labRequestEligibility.js`:

```js
// คำขอของแผนก RM ใช้ฟอร์ม F-WAR-03-01,02 แทนใบคำขอรับบริการ และแบชของ RM คือ
// แบชนัมเบอร์ของผู้ขาย ซึ่งเลขลงท้ายไม่มีความหมาย — กฎ "ลงท้าย 1 หรือ 6" จึงใช้ไม่ได้
function canHaveLabRequest(petition) {
  return !petition || petition.dept !== 'rm';
}

module.exports = { canHaveLabRequest };
```

- [ ] **Step 4: รันเทสให้เขียว**

Run: `cd server && npx jest lib/labRequestEligibility.test.js`
Expected: PASS ทั้ง 3 เคส

- [ ] **Step 5: เสียบ guard เข้า route**

`server/routes/labRequests.js` บรรทัด 6 เพิ่ม import ต่อจากบรรทัดเดิม:

```js
const { canHaveLabRequest } = require('../lib/labRequestEligibility');
```

แล้วใน `POST /` แทรก guard ต่อจากบรรทัด 59 (`if (!petition) return badRequest(...)`) ก่อนบรรทัดที่คำนวณ `deliveryAndBatchRequired`:

```js
    if (!canHaveLabRequest(petition)) {
      return badRequest(res, 'คำขอของแผนก RM ไม่ต้องมีใบคำขอรับบริการ');
    }
```

- [ ] **Step 6: รันเทส server ทั้งชุดกันพังของเดิม**

Run: `cd server && npm test`
Expected: PASS ทุกไฟล์

- [ ] **Step 7: Commit**

```bash
git add -- server/lib/labRequestEligibility.js server/lib/labRequestEligibility.test.js server/routes/labRequests.js
git commit -m "feat: exclude RM petitions from lab-request rule

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: TypeScript types + label maps

**Files:**
- Create: `src/types/goodsReceipt.types.ts`, `src/lib/goodsReceipt.ts`, `src/lib/goodsReceipt.test.ts`

**Interfaces:**
- Produces: types `GoodsReceipt`, `GoodsReceiptReceipt`, `RawMaterialInspection`, `ProductBatch`, `CaBatch`, `WeighBatch`, `InspectionSummary` และ union ทุกตัว; label maps `QUANTITY_UNIT_LABELS`, `WEIGHT_UNIT_LABELS`, `RECEIPT_REFERENCE_LABELS`, `TOLERANCE_RESULT_LABELS`, `LATE_DELIVERY_LABELS`, `CONTAINER_TYPE_LABELS`, `CONTAINER_CONDITION_LABELS`, `PRESENCE_LABELS`, `APPEARANCE_LABELS`; predicates `isReceiptFilled`, `isInspectionFilled`

- [ ] **Step 1: เขียน types**

Create `src/types/goodsReceipt.types.ts`:

```ts
// mirror ของ server/models/GoodsReceipt.js — แก้ที่ไหนต้องแก้อีกที่ให้ตรงกัน

export type QuantityUnit = 'drum' | 'sack' | 'box' | 'can';
export type WeightUnit = 'litre' | 'kg' | 'piece';
export type GrossWeightUnit = 'litre' | 'kg';
export type BatchMode = 'has' | 'none';
export type ReceiptReference = 'foreign' | 'domestic' | 'deliveryNote';
export type ToleranceResult = 'within' | 'outside';
export type LateDelivery = 'vsReport' | 'vsPurchaseOrder';
export type ContainerType =
  | 'paperDrum' | 'steelDrum' | 'plasticDrum' | 'paperSack'
  | 'plasticSack' | 'paperBox' | 'jar' | 'other';
export type ContainerCondition = 'normal' | 'leakOrBroken';
export type PresenceStatus = 'has' | 'none';
export type Appearance =
  | 'powder' | 'flake' | 'granule' | 'lump' | 'fine' | 'coarse'
  | 'viscousLiquid' | 'clearLiquid' | 'other';

export interface CaBatch {
  batchNo?: string;
  amount?: number;
  unit?: WeightUnit;
}

export interface ProductBatch extends CaBatch {
  sendToLab?: boolean;
}

export interface WeighBatch {
  batchNo?: string;
  quantity?: number;
  quantityUnit?: QuantityUnit;
  weightKg?: number;
}

export interface InspectionSummary {
  accepted?: boolean;
  note?: string;
  rejectReason?: string;
  inspectedBy?: string;
  inspectedAt?: string;
}

// F-WAR-03-01 ใบรับสินค้า (ลัดดา)
export interface GoodsReceiptReceipt {
  references?: ReceiptReference[];
  purchaseOrderNo?: string;
  purchaseOrderDate?: string;
  deliveryNoteNo?: string;

  productCode?: string;
  productName?: string;
  activeIngredientPercent?: string;
  packageSize?: string;
  quantity?: number;
  quantityUnit?: QuantityUnit;
  totalWeight?: number;
  totalWeightUnit?: WeightUnit;
  sellerGrossWeightKg?: number;
  sellerNetWeightLitre?: number;
  sellerNetWeightKg?: number;

  caBatchMode?: BatchMode;
  caBatches?: CaBatch[];
  productBatchMode?: BatchMode;
  productBatches?: ProductBatch[];

  seller?: string;
  sellerCountry?: string;
  manufacturer?: string;
  manufacturerCountry?: string;
  activeIngredientTolerance?: string;
  toleranceResult?: ToleranceResult;
  toleranceOutsideReason?: string;
  lateDelivery?: LateDelivery[];

  receivedByName?: string;
  receivedAt?: string;
}

// F-WAR-03-02 ใบตรวจสอบวัตถุดิบ
export interface RawMaterialInspection {
  containerType?: ContainerType;
  containerTypeOther?: string;

  containerCondition?: ContainerCondition;
  containerConditionBatches?: string;

  labelStatus?: PresenceStatus;
  sealMarkStatus?: PresenceStatus;

  specificGravity?: number;
  grossWeight?: number;
  grossWeightUnit?: GrossWeightUnit;
  netWeightLitre?: number;
  netWeightKg?: number;
  toleranceKg?: number;
  weighBatches?: WeighBatch[];

  summary14?: InspectionSummary;

  appearanceSameBatches?: string;
  appearance?: Appearance[];
  appearanceOther?: string;
  appearanceDiffBatches?: string;
  appearanceDiffDetail?: string;

  colorSameBatches?: string;
  colorSame?: string;
  colorDiffBatches?: string;
  colorDiff?: string;

  summary56?: InspectionSummary;
}

export interface GoodsReceipt {
  _id?: string;
  receiptNo?: string;
  inspectionNo?: string;
  warehouse?: string;
  petitionId: string;
  petitionNo?: string;
  receipt?: GoodsReceiptReceipt;
  inspection?: RawMaterialInspection;
  createdAt?: string;
  updatedAt?: string;
}

export interface GoodsReceiptInput {
  warehouse?: string;
  petitionId: string;
  receipt: GoodsReceiptReceipt;
  inspection?: RawMaterialInspection;
}
```

- [ ] **Step 2: เขียนเทสที่ยังแดง**

Create `src/lib/goodsReceipt.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  QUANTITY_UNIT_LABELS, WEIGHT_UNIT_LABELS, RECEIPT_REFERENCE_LABELS,
  TOLERANCE_RESULT_LABELS, LATE_DELIVERY_LABELS, CONTAINER_TYPE_LABELS,
  CONTAINER_CONDITION_LABELS, PRESENCE_LABELS, APPEARANCE_LABELS,
  isReceiptFilled, isInspectionFilled,
} from './goodsReceipt';

// label map ต้องครอบทุกค่า enum — กันลืมเวลาเพิ่มตัวเลือกใหม่
describe('label maps ครอบทุกค่า enum', () => {
  it('หน่วยจำนวน 4 ค่า', () => {
    expect(Object.keys(QUANTITY_UNIT_LABELS).sort())
      .toEqual(['box', 'can', 'drum', 'sack']);
  });

  it('หน่วยน้ำหนัก 3 ค่า', () => {
    expect(Object.keys(WEIGHT_UNIT_LABELS).sort())
      .toEqual(['kg', 'litre', 'piece']);
  });

  it('อ้างถึง 3 ค่า', () => {
    expect(Object.keys(RECEIPT_REFERENCE_LABELS).sort())
      .toEqual(['deliveryNote', 'domestic', 'foreign']);
  });

  it('เกณฑ์สารออกฤทธิ์ 2 ค่า', () => {
    expect(Object.keys(TOLERANCE_RESULT_LABELS).sort()).toEqual(['outside', 'within']);
  });

  it('การส่งมอบล่าช้า 2 ค่า', () => {
    expect(Object.keys(LATE_DELIVERY_LABELS).sort())
      .toEqual(['vsPurchaseOrder', 'vsReport']);
  });

  it('ลักษณะภาชนะ 8 ค่า', () => {
    expect(Object.keys(CONTAINER_TYPE_LABELS)).toHaveLength(8);
    expect(CONTAINER_TYPE_LABELS.paperDrum).toBe('ถังกระดาษ');
    expect(CONTAINER_TYPE_LABELS.jar).toBe('กระปุก');
  });

  it('สภาพภาชนะ 2 ค่า', () => {
    expect(Object.keys(CONTAINER_CONDITION_LABELS).sort())
      .toEqual(['leakOrBroken', 'normal']);
  });

  it('มี/ไม่มี 2 ค่า', () => {
    expect(Object.keys(PRESENCE_LABELS).sort()).toEqual(['has', 'none']);
  });

  it('ลักษณะสินค้า 9 ค่า', () => {
    expect(Object.keys(APPEARANCE_LABELS)).toHaveLength(9);
    expect(APPEARANCE_LABELS.viscousLiquid).toBe('ของเหลวข้น');
  });
});

describe('isReceiptFilled', () => {
  it('ยังไม่ลงชื่อผู้รับสินค้า → false', () => {
    expect(isReceiptFilled({ productName: 'Glyphosate' })).toBe(false);
    expect(isReceiptFilled(undefined)).toBe(false);
  });

  it('ลงชื่อ + วันที่ครบ → true', () => {
    expect(isReceiptFilled({ receivedByName: 'สมชาย', receivedAt: '2026-07-20' })).toBe(true);
  });
});

describe('isInspectionFilled', () => {
  it('ยังไม่มีผู้ตรวจสอบทั้งสองสรุป → false', () => {
    expect(isInspectionFilled(undefined)).toBe(false);
    expect(isInspectionFilled({ containerType: 'jar' })).toBe(false);
  });

  it('ต้องลงชื่อครบทั้งสรุป 1-4 และ 5-6', () => {
    expect(isInspectionFilled({ summary14: { inspectedBy: 'ก' } })).toBe(false);
    expect(isInspectionFilled({
      summary14: { inspectedBy: 'ก' },
      summary56: { inspectedBy: 'ข' },
    })).toBe(true);
  });
});
```

- [ ] **Step 3: รันเทสให้เห็นว่าแดง**

Run: `npx vitest run src/lib/goodsReceipt.test.ts`
Expected: FAIL — resolve module `./goodsReceipt` ไม่ได้

- [ ] **Step 4: เขียน label maps + predicates**

Create `src/lib/goodsReceipt.ts`:

```ts
// แหล่งเดียวของข้อความไทยสำหรับฟอร์ม F-WAR-03-01,02 — ใช้ทั้งฝั่งกรอก view และ print
import type {
  Appearance, ContainerCondition, ContainerType, GoodsReceiptReceipt,
  LateDelivery, PresenceStatus, QuantityUnit, RawMaterialInspection,
  ReceiptReference, ToleranceResult, WeightUnit,
} from '@/types/goodsReceipt.types';

export const QUANTITY_UNIT_LABELS: Record<QuantityUnit, string> = {
  drum: 'ถัง',
  sack: 'กส',
  box: 'กล่อง',
  can: 'กป',
};

export const WEIGHT_UNIT_LABELS: Record<WeightUnit, string> = {
  litre: 'ลิตร',
  kg: 'กก.',
  piece: 'ชิ้น',
};

export const RECEIPT_REFERENCE_LABELS: Record<ReceiptReference, string> = {
  foreign: 'รายงานสินค้าต่างประเทศเข้าโรงงาน',
  domestic: 'รายงานสินค้าในประเทศเข้าโรงงาน',
  deliveryNote: 'เลขที่ใบส่งของ',
};

export const TOLERANCE_RESULT_LABELS: Record<ToleranceResult, string> = {
  within: 'อยู่ในเกณฑ์',
  outside: 'ไม่อยู่ในเกณฑ์',
};

export const LATE_DELIVERY_LABELS: Record<LateDelivery, string> = {
  vsReport: 'ส่งมอบล่าช้าเมื่อเปรียบเทียบกับรายงานสินค้าในประเทศ หรือรายงานสินค้าต่างประเทศเข้าโรงงาน',
  vsPurchaseOrder: 'ส่งมอบล่าช้าเมื่อเปรียบเทียบกับใบสั่งซื้อ (กรณีรับที่สำนักงาน)',
};

export const CONTAINER_TYPE_LABELS: Record<ContainerType, string> = {
  paperDrum: 'ถังกระดาษ',
  steelDrum: 'ถังเหล็ก',
  plasticDrum: 'ถังพลาสติก',
  paperSack: 'กระสอบกระดาษ',
  plasticSack: 'กระสอบพลาสติก',
  paperBox: 'กล่องกระดาษ',
  jar: 'กระปุก',
  other: 'อื่นๆ',
};

export const CONTAINER_CONDITION_LABELS: Record<ContainerCondition, string> = {
  normal: 'ปกติ',
  leakOrBroken: 'รั่วซึม/แตก',
};

export const PRESENCE_LABELS: Record<PresenceStatus, string> = {
  has: 'มี',
  none: 'ไม่มี',
};

export const APPEARANCE_LABELS: Record<Appearance, string> = {
  powder: 'ผง',
  flake: 'เกร็ด',
  granule: 'เม็ด',
  lump: 'ก้อน',
  fine: 'ละเอียด',
  coarse: 'หยาบ',
  viscousLiquid: 'ของเหลวข้น',
  clearLiquid: 'ของเหลวใส',
  other: 'อื่นๆ',
};

// แปลง array ของ enum เป็นข้อความไทยคั่นจุลภาค — ใช้ในหน้า view
export function joinLabels<T extends string>(
  keys: T[] | undefined,
  map: Record<T, string>,
): string {
  return (keys ?? []).map((k) => map[k]).filter(Boolean).join(', ');
}

// "กรอกแล้ว" = ลงชื่อครบ ตามช่องลายเซ็นบนกระดาษ
export function isReceiptFilled(r?: GoodsReceiptReceipt | null): boolean {
  return !!r && !!r.receivedByName && !!r.receivedAt;
}

export function isInspectionFilled(i?: RawMaterialInspection | null): boolean {
  return !!i && !!i.summary14?.inspectedBy && !!i.summary56?.inspectedBy;
}
```

- [ ] **Step 5: รันเทสให้เขียว**

Run: `npx vitest run src/lib/goodsReceipt.test.ts`
Expected: PASS ทุกเคส

- [ ] **Step 6: type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่จากไฟล์ที่เพิ่งเพิ่ม (repo มี latent error เดิมอยู่ ~12 ตัว — เทียบก่อน/หลังว่าไม่เพิ่ม)

- [ ] **Step 7: Commit**

```bash
git add -- src/types/goodsReceipt.types.ts src/lib/goodsReceipt.ts src/lib/goodsReceipt.test.ts
git commit -m "feat: add goods-receipt types and Thai label maps

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: map แบชที่ติ๊ก → Petition.items[]

**Files:**
- Create: `src/lib/rmPetitionMapping.ts`, `src/lib/rmPetitionMapping.test.ts`

**Interfaces:**
- Consumes: `GoodsReceiptReceipt` จาก Task 4
- Produces:
  - `export interface RmTestSelection { batchNo: string; commonName: string; testItems: string }`
  - `export interface RmPetitionItem { seq: number; sampleName: string; commonName: string; batchNo: string; testItems: string }`
  - `buildRmPetitionItems(receipt, selections): RmPetitionItem[]` — โยน `Error` พร้อมข้อความไทยเมื่อข้อมูลไม่ครบ

⚠️ **`testItems` เป็น `string` ไม่ใช่ array** — ยืนยันแล้วทั้ง stack: `server/models/Petition.js:15` (`testItems: String`), `src/types/petition.types.ts:71` (`testItems?: string`), `src/lib/validations.ts:25` (`z.string().optional().default('')`) ห้ามทำเป็น `string[]` ไม่งั้น payload จะไม่ผ่าน zod

- [ ] **Step 1: เขียนเทสที่ยังแดง**

Create `src/lib/rmPetitionMapping.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildRmPetitionItems } from './rmPetitionMapping';
import type { GoodsReceiptReceipt } from '@/types/goodsReceipt.types';

const receipt: GoodsReceiptReceipt = {
  productName: 'Glyphosate 48% SL',
  productBatches: [
    { batchNo: 'B-001', sendToLab: true },
    { batchNo: 'B-002', sendToLab: false },
    { batchNo: 'B-003', sendToLab: true },
    { batchNo: 'B-004', sendToLab: true },
    { batchNo: 'B-005' },
  ],
};

const selections = [
  { batchNo: 'B-001', commonName: 'Glyphosate', testItems: 'Active Ingredient' },
  { batchNo: 'B-003', commonName: 'Glyphosate', testItems: 'Active Ingredient, pH' },
  { batchNo: 'B-004', commonName: 'Glyphosate', testItems: 'pH' },
];

describe('buildRmPetitionItems', () => {
  it('ติ๊ก 3 จาก 5 แบช → ได้ 3 item เรียง seq 1-3', () => {
    const items = buildRmPetitionItems(receipt, selections);
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.seq)).toEqual([1, 2, 3]);
    expect(items.map((i) => i.batchNo)).toEqual(['B-001', 'B-003', 'B-004']);
  });

  it('sampleName มาจากชื่อสินค้า ทุก item เหมือนกัน', () => {
    const items = buildRmPetitionItems(receipt, selections);
    expect(items.every((i) => i.sampleName === 'Glyphosate 48% SL')).toBe(true);
  });

  it('commonName กับ testItems มาจาก selection ของแบชนั้น', () => {
    const items = buildRmPetitionItems(receipt, selections);
    expect(items[1].commonName).toBe('Glyphosate');
    expect(items[1].testItems).toBe('Active Ingredient, pH');
  });

  it('ไม่ติ๊กแบชเลย → โยน error', () => {
    expect(() => buildRmPetitionItems({ ...receipt, productBatches: [{ batchNo: 'X' }] }, []))
      .toThrow('ต้องเลือกแบชที่ส่งตรวจอย่างน้อย 1 แบช');
  });

  it('ไม่ระบุชื่อสินค้า → โยน error', () => {
    expect(() => buildRmPetitionItems({ ...receipt, productName: '   ' }, selections))
      .toThrow('ต้องระบุชื่อสินค้า');
  });

  it('แบชที่ติ๊กแต่ไม่มีแบชนัมเบอร์ → โยน error', () => {
    const bad = { ...receipt, productBatches: [{ batchNo: ' ', sendToLab: true }] };
    expect(() => buildRmPetitionItems(bad, selections))
      .toThrow('แบชที่ส่งตรวจต้องระบุแบชนัมเบอร์');
  });

  it('แบชที่ติ๊กแต่ยังไม่เลือกรายการทดสอบ → โยน error ระบุแบช', () => {
    expect(() => buildRmPetitionItems(receipt, selections.slice(0, 2)))
      .toThrow('ยังไม่ได้เลือกรายการทดสอบของแบช B-004');
  });

  it('เลือกรายการทดสอบเป็นข้อความว่าง → โยน error ระบุแบช', () => {
    const bad = [...selections.slice(0, 2), { batchNo: 'B-004', commonName: 'Glyphosate', testItems: '  ' }];
    expect(() => buildRmPetitionItems(receipt, bad))
      .toThrow('ยังไม่ได้เลือกรายการทดสอบของแบช B-004');
  });

  it('แบชที่ติ๊กแต่ยังไม่เลือก master item → โยน error ระบุแบช', () => {
    const bad = [...selections.slice(0, 2), { batchNo: 'B-004', commonName: '', testItems: 'pH' }];
    expect(() => buildRmPetitionItems(receipt, bad))
      .toThrow('ยังไม่ได้เลือกรายการสินค้าอ้างอิงของแบช B-004');
  });
});
```

- [ ] **Step 2: รันเทสให้เห็นว่าแดง**

Run: `npx vitest run src/lib/rmPetitionMapping.test.ts`
Expected: FAIL — resolve `./rmPetitionMapping` ไม่ได้

- [ ] **Step 3: เขียน mapping**

Create `src/lib/rmPetitionMapping.ts`:

```ts
// แปลงแบชที่ RM ติ๊ก "ส่งตรวจ" ในฟอร์ม F-WAR-03-01 เป็น Petition.items[]
// 1 แบชที่ติ๊ก = 1 item — ผูกกลับหาฟอร์มด้วย batchNo
import type { GoodsReceiptReceipt } from '@/types/goodsReceipt.types';

// testItems เป็น string เดียว (ไม่ใช่ array) ให้ตรงกับ Petition.items[].testItems ทั้ง stack
export interface RmTestSelection {
  batchNo: string;
  commonName: string;
  testItems: string;
}

export interface RmPetitionItem {
  seq: number;
  sampleName: string;
  commonName: string;
  batchNo: string;
  testItems: string;
}

export function buildRmPetitionItems(
  receipt: Pick<GoodsReceiptReceipt, 'productName' | 'productBatches'>,
  selections: RmTestSelection[],
): RmPetitionItem[] {
  const sampleName = String(receipt?.productName ?? '').trim();
  if (!sampleName) throw new Error('ต้องระบุชื่อสินค้า');

  const selected = (receipt?.productBatches ?? []).filter((b) => b?.sendToLab === true);
  if (selected.length === 0) throw new Error('ต้องเลือกแบชที่ส่งตรวจอย่างน้อย 1 แบช');
  if (selected.some((b) => !String(b.batchNo ?? '').trim())) {
    throw new Error('แบชที่ส่งตรวจต้องระบุแบชนัมเบอร์');
  }

  const byBatch = new Map(selections.map((s) => [String(s.batchNo ?? '').trim(), s]));

  return selected.map((batch, index) => {
    const batchNo = String(batch.batchNo).trim();
    const pick = byBatch.get(batchNo);
    // commonName เป็นตัวขับการจับคู่ simple-method ตอน assign เครื่องมือ — ขาดไม่ได้
    if (!pick || !String(pick.commonName ?? '').trim()) {
      throw new Error(`ยังไม่ได้เลือกรายการสินค้าอ้างอิงของแบช ${batchNo}`);
    }
    const testItems = String(pick.testItems ?? '').trim();
    if (!testItems) {
      throw new Error(`ยังไม่ได้เลือกรายการทดสอบของแบช ${batchNo}`);
    }
    return {
      seq: index + 1,
      sampleName,
      commonName: String(pick.commonName).trim(),
      batchNo,
      testItems,
    };
  });
}
```

- [ ] **Step 4: รันเทสให้เขียว**

Run: `npx vitest run src/lib/rmPetitionMapping.test.ts`
Expected: PASS ทั้ง 9 เคส

- [ ] **Step 5: Commit**

```bash
git add -- src/lib/rmPetitionMapping.ts src/lib/rmPetitionMapping.test.ts
git commit -m "feat: map ticked RM batches to petition items

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: API client + docType `goods-receipt`

**Files:**
- Modify: `src/lib/api.ts` (block Print ที่บรรทัด ~577 + เพิ่ม endpoints), `src/lib/printConfig.ts:1,53-59,115-121`, `src/lib/printConfig.test.ts:23-25,37-43`, `server/lib/printerRouting.js:8-14,23-27`, `src/components/lis/PrintPreviewDialog.tsx:53-55`

**Interfaces:**
- Consumes: `GoodsReceipt`, `GoodsReceiptInput` (Task 4)
- Produces: `api.getGoodsReceiptsByPetition(petitionId)`, `api.createGoodsReceipt(input)`; `PrintDocType` เพิ่มค่า `"goods-receipt"`

- [ ] **Step 1: แก้เทส printConfig ให้แดงก่อน**

`src/lib/printConfig.test.ts` แก้ assertion บรรทัด 23-25 เป็น:

```ts
    expect(PRINT_DOC_TYPES.map((d) => d.slug)).toEqual([
      "sample-label", "coa", "service-request", "stock-label", "daily-check-report", "goods-receipt",
    ]);
```

และเพิ่มบรรทัดใน `describe("docTypeToKind")` ต่อจากบรรทัด 43:

```ts
    expect(docTypeToKind("goods-receipt")).toBe("a4");
```

- [ ] **Step 2: รันเทสให้เห็นว่าแดง**

Run: `npx vitest run src/lib/printConfig.test.ts`
Expected: FAIL — `PRINT_DOC_TYPES` ยังไม่มี `goods-receipt`

- [ ] **Step 3: เพิ่ม docType ฝั่ง client**

`src/lib/printConfig.ts` บรรทัด 1:

```ts
export type PrintDocType = "sample-label" | "coa" | "service-request" | "stock-label" | "daily-check-report" | "goods-receipt";
```

ใน `DOC_TYPE_KIND` (บรรทัด 53-59) เพิ่มบรรทัดสุดท้ายก่อนปิดปีกกา:

```ts
  "goods-receipt": "a4",
```

ใน `PRINT_DOC_TYPES` (บรรทัด 115-121) เพิ่มบรรทัดสุดท้ายก่อนปิดวงเล็บ:

```ts
  { slug: "goods-receipt", label: "ใบรับสินค้า/ใบตรวจสอบวัตถุดิบ (RM)", defaultPaper: "A4" },
```

- [ ] **Step 4: เพิ่ม docType ฝั่ง server ให้ mirror ตรงกัน**

`server/lib/printerRouting.js` ใน `DOC_TYPE_KIND` (บรรทัด 8-14) เพิ่ม:

```js
  'goods-receipt': 'a4',
```

`paperSizeForSlug` ไม่ต้องแก้ — `goods-receipt` ตกไปที่ `return 'A4'` อยู่แล้ว

- [ ] **Step 5: รันเทสให้เขียวทั้ง 2 ฝั่ง**

Run: `npx vitest run src/lib/printConfig.test.ts`
Expected: PASS

Run: `cd server && npx jest lib/printerRouting.test.js`
Expected: PASS

- [ ] **Step 6: เพิ่ม docType เข้า array ที่ hardcode ใน api.ts**

`src/lib/api.ts` บรรทัด 577 — แก้ array ใน `getPrintConfigs`:

```ts
      (["sample-label", "coa", "service-request", "stock-label", "daily-check-report", "goods-receipt"] as PrintDocType[]).map((docType) =>
```

- [ ] **Step 7: เพิ่ม endpoints ของ goods-receipts**

`src/lib/api.ts` — เพิ่ม import ที่กลุ่ม import ด้านบนไฟล์:

```ts
import type { GoodsReceipt, GoodsReceiptInput } from "@/types/goodsReceipt.types";
```

แล้วเพิ่ม 2 method เข้าไปใน object `api` (วางต่อจากกลุ่ม lab-requests):

```ts
  // Goods receipts (ฟอร์ม F-WAR-03-01,02 ของแผนก RM)
  getGoodsReceiptsByPetition: (petitionId: string) =>
    request<{ items: GoodsReceipt[] }>(`/goods-receipts?petitionId=${encodeURIComponent(petitionId)}`)
      .then((r) => r.items),
  createGoodsReceipt: (input: GoodsReceiptInput) =>
    request<GoodsReceipt>("/goods-receipts", {
      method: "POST",
      body: JSON.stringify(input),
    }),
```

- [ ] **Step 8: เพิ่ม sheet class เข้า PrintPreviewDialog**

`src/components/lis/PrintPreviewDialog.tsx` บรรทัด 53-55 — เพิ่ม `.gr-page1` เข้า selector ของ `getSheetSize()`:

```ts
    "section, .label-page, .lr-page, .pr-page1, .pr-page2, .rr-page, .gr-page1",
```

- [ ] **Step 9: type-check + เทสทั้งชุด**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่

Run: `npm run test`
Expected: PASS ทั้งชุด

- [ ] **Step 10: Commit**

```bash
git add -- src/lib/api.ts src/lib/printConfig.ts src/lib/printConfig.test.ts server/lib/printerRouting.js src/components/lis/PrintPreviewDialog.tsx
git commit -m "feat: register goods-receipt doc type and API client

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: form controls ที่ใช้ร่วมกัน

**Files:**
- Create: `src/components/warehouse/formControls.tsx`

**Interfaces:**
- Produces: `RadioRow`, `CheckRow`, `Field`, `toggle<T>(arr, v, on): T[]` — ใช้ใน Task 8, 9, 10

- [ ] **Step 1: เขียน component**

Create `src/components/warehouse/formControls.tsx` (ยกมาจาก `LabAgreementReviewDialog.tsx:37-58` แล้วเพิ่ม `Field` สำหรับช่องกรอกที่มี label):

```tsx
// ตัวควบคุมฟอร์มที่ใช้ร่วมกันทุก step ของฟอร์ม F-WAR-03-01,02
// RadioRow / CheckRow / toggle ยกมาจาก LabAgreementReviewDialog เพื่อให้หน้าตาเหมือนกันทั้งระบบ
import { Checkbox } from '@/components/ui/checkbox';

export function toggle<T>(arr: T[] | undefined, v: T, on: boolean): T[] {
  const set = new Set(arr ?? []);
  if (on) set.add(v); else set.delete(v);
  return Array.from(set);
}

export const RadioRow = ({ checked, onSelect, children }:
  { checked: boolean; onSelect: () => void; children: React.ReactNode }) => (
  <button type="button" onClick={onSelect}
    className={`flex items-start gap-2 text-left text-sm w-full py-1 ${checked ? 'font-medium text-sky-700' : 'text-grey-700'}`}>
    <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border ${checked ? 'border-sky-600 bg-sky-600' : 'border-grey-400'}`} />
    <span>{children}</span>
  </button>
);

export const CheckRow = ({ checked, onChange, children }:
  { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) => (
  <label className="flex items-start gap-2 text-sm py-1 cursor-pointer">
    <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} className="mt-0.5" />
    <span>{children}</span>
  </label>
);

// ช่องกรอกพร้อม label — ใช้กับช่องเติมคำบนกระดาษ
export const Field = ({ label, children, className }:
  { label: string; children: React.ReactNode; className?: string }) => (
  <label className={`flex flex-col gap-1 text-sm ${className ?? ''}`}>
    <span className="text-grey-600">{label}</span>
    {children}
  </label>
);
```

- [ ] **Step 2: type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่

- [ ] **Step 3: Commit**

```bash
git add -- src/components/warehouse/formControls.tsx
git commit -m "feat: add shared warehouse form controls

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Step 1 — ฟอร์มใบรับสินค้า (F-WAR-03-01)

**Files:**
- Create: `src/components/warehouse/GoodsReceiptStep.tsx`

**Interfaces:**
- Consumes: `GoodsReceiptReceipt`, `ProductBatch`, `CaBatch` (Task 4); labels จาก `@/lib/goodsReceipt`; `RadioRow`/`CheckRow`/`Field`/`toggle` (Task 7)
- Produces: `export default function GoodsReceiptStep({ value, onChange, warehouse, onWarehouseChange })` โดย `value: GoodsReceiptReceipt`, `onChange: (next: GoodsReceiptReceipt) => void`

- [ ] **Step 1: เขียน component**

Create `src/components/warehouse/GoodsReceiptStep.tsx`:

```tsx
// F-WAR-03-01 ใบรับสินค้า (ลัดดา) — step แรกของ wizard สร้างคำขอ RM
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';
import type {
  CaBatch, GoodsReceiptReceipt, ProductBatch, QuantityUnit, WeightUnit,
} from '@/types/goodsReceipt.types';
import {
  QUANTITY_UNIT_LABELS, WEIGHT_UNIT_LABELS, RECEIPT_REFERENCE_LABELS,
  TOLERANCE_RESULT_LABELS, LATE_DELIVERY_LABELS,
} from '@/lib/goodsReceipt';
import { CheckRow, Field, RadioRow, toggle } from './formControls';

interface Props {
  value: GoodsReceiptReceipt;
  onChange: (next: GoodsReceiptReceipt) => void;
  warehouse: string;
  onWarehouseChange: (v: string) => void;
}

const num = (v: string) => (v.trim() === '' ? undefined : Number(v));

export default function GoodsReceiptStep({ value, onChange, warehouse, onWarehouseChange }: Props) {
  const set = <K extends keyof GoodsReceiptReceipt>(k: K, v: GoodsReceiptReceipt[K]) =>
    onChange({ ...value, [k]: v });

  // ตารางแบชแก้ทีละแถว — เพิ่มแถวผ่านปุ่มเท่านั้น ไม่เด้งแถวว่างอัตโนมัติ
  const setCaBatch = (i: number, patch: Partial<CaBatch>) => {
    const rows = [...(value.caBatches ?? [])];
    rows[i] = { ...rows[i], ...patch };
    set('caBatches', rows);
  };
  const setProductBatch = (i: number, patch: Partial<ProductBatch>) => {
    const rows = [...(value.productBatches ?? [])];
    rows[i] = { ...rows[i], ...patch };
    set('productBatches', rows);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">หัวใบ</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field label="คลังสินค้า">
            <Input value={warehouse} onChange={(e) => onWarehouseChange(e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">อ้างถึง</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(Object.keys(RECEIPT_REFERENCE_LABELS) as (keyof typeof RECEIPT_REFERENCE_LABELS)[]).map((k) => (
            <CheckRow key={k}
              checked={(value.references ?? []).includes(k)}
              onChange={(on) => set('references', toggle(value.references, k, on))}>
              {RECEIPT_REFERENCE_LABELS[k]}
            </CheckRow>
          ))}
          <div className="grid gap-3 sm:grid-cols-3 pt-2">
            <Field label="ใบสั่งซื้อเลขที่">
              <Input value={value.purchaseOrderNo ?? ''} onChange={(e) => set('purchaseOrderNo', e.target.value)} />
            </Field>
            <Field label="วันที่">
              <Input type="date" value={value.purchaseOrderDate ?? ''} onChange={(e) => set('purchaseOrderDate', e.target.value)} />
            </Field>
            <Field label="เลขที่ใบส่งของ">
              <Input value={value.deliveryNoteNo ?? ''} onChange={(e) => set('deliveryNoteNo', e.target.value)} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">รายการที่ตรวจรับ</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="1. รหัสสินค้า">
              <Input value={value.productCode ?? ''} onChange={(e) => set('productCode', e.target.value)} />
            </Field>
            <Field label="ชื่อสินค้า">
              <Input value={value.productName ?? ''} onChange={(e) => set('productName', e.target.value)} />
            </Field>
            <Field label="% สารออกฤทธิ์">
              <Input value={value.activeIngredientPercent ?? ''} onChange={(e) => set('activeIngredientPercent', e.target.value)} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="2. ขนาดบรรจุ">
              <Input value={value.packageSize ?? ''} onChange={(e) => set('packageSize', e.target.value)} />
            </Field>
            <Field label="จำนวน">
              <Input type="number" value={value.quantity ?? ''} onChange={(e) => set('quantity', num(e.target.value))} />
            </Field>
            <Field label="หน่วย">
              <select className="h-9 rounded-md border px-2 text-sm"
                value={value.quantityUnit ?? ''}
                onChange={(e) => set('quantityUnit', (e.target.value || undefined) as QuantityUnit)}>
                <option value="">—</option>
                {(Object.keys(QUANTITY_UNIT_LABELS) as QuantityUnit[]).map((u) => (
                  <option key={u} value={u}>{QUANTITY_UNIT_LABELS[u]}</option>
                ))}
              </select>
            </Field>
            <Field label="น้ำหนักรวม">
              <div className="flex gap-2">
                <Input type="number" value={value.totalWeight ?? ''} onChange={(e) => set('totalWeight', num(e.target.value))} />
                <select className="h-9 rounded-md border px-2 text-sm"
                  value={value.totalWeightUnit ?? ''}
                  onChange={(e) => set('totalWeightUnit', (e.target.value || undefined) as WeightUnit)}>
                  <option value="">—</option>
                  {(Object.keys(WEIGHT_UNIT_LABELS) as WeightUnit[]).map((u) => (
                    <option key={u} value={u}>{WEIGHT_UNIT_LABELS[u]}</option>
                  ))}
                </select>
              </div>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="3. ข้อมูลจากผู้ขาย Gross Weight (กก.)">
              <Input type="number" value={value.sellerGrossWeightKg ?? ''} onChange={(e) => set('sellerGrossWeightKg', num(e.target.value))} />
            </Field>
            <Field label="Net Weight (ลิตร)">
              <Input type="number" value={value.sellerNetWeightLitre ?? ''} onChange={(e) => set('sellerNetWeightLitre', num(e.target.value))} />
            </Field>
            <Field label="Net Weight (กก.)">
              <Input type="number" value={value.sellerNetWeightKg ?? ''} onChange={(e) => set('sellerNetWeightKg', num(e.target.value))} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">กรณีมีแบชนัมเบอร์ — ข้อมูลจากผู้ขาย (CA)</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-4">
            <RadioRow checked={value.caBatchMode === 'has'} onSelect={() => set('caBatchMode', 'has')}>มีแบชนัมเบอร์</RadioRow>
            <RadioRow checked={value.caBatchMode === 'none'} onSelect={() => set('caBatchMode', 'none')}>ไม่มีแบชนัมเบอร์</RadioRow>
          </div>
          {(value.caBatches ?? []).map((b, i) => (
            <div key={i} className="flex gap-2 items-end">
              <Field label="แบชนัมเบอร์" className="flex-1">
                <Input value={b.batchNo ?? ''} onChange={(e) => setCaBatch(i, { batchNo: e.target.value })} />
              </Field>
              <Field label="จำนวน" className="w-28">
                <Input type="number" value={b.amount ?? ''} onChange={(e) => setCaBatch(i, { amount: num(e.target.value) })} />
              </Field>
              <Field label="หน่วย" className="w-24">
                <select className="h-9 rounded-md border px-2 text-sm" value={b.unit ?? ''}
                  onChange={(e) => setCaBatch(i, { unit: (e.target.value || undefined) as WeightUnit })}>
                  <option value="">—</option>
                  {(Object.keys(WEIGHT_UNIT_LABELS) as WeightUnit[]).map((u) => (
                    <option key={u} value={u}>{WEIGHT_UNIT_LABELS[u]}</option>
                  ))}
                </select>
              </Field>
              <Button type="button" variant="ghost" size="icon"
                onClick={() => set('caBatches', (value.caBatches ?? []).filter((_, x) => x !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm"
            onClick={() => set('caBatches', [...(value.caBatches ?? []), {}])}>
            <Plus className="h-4 w-4 mr-1" /> เพิ่มแบช (CA)
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">กรณีมีแบชนัมเบอร์ — ข้อมูลจากสินค้า</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-4">
            <RadioRow checked={value.productBatchMode === 'has'} onSelect={() => set('productBatchMode', 'has')}>มีแบชนัมเบอร์</RadioRow>
            <RadioRow checked={value.productBatchMode === 'none'} onSelect={() => set('productBatchMode', 'none')}>ไม่มีแบชนัมเบอร์</RadioRow>
          </div>
          <p className="text-xs text-grey-500">ติ๊ก "ส่งตรวจ" แบชที่ต้องการส่งให้ Lab — แบชที่ติ๊กจะกลายเป็นรายการในคำขอ</p>
          {(value.productBatches ?? []).map((b, i) => (
            <div key={i} className="flex gap-2 items-end">
              <Field label="แบชนัมเบอร์" className="flex-1">
                <Input value={b.batchNo ?? ''} onChange={(e) => setProductBatch(i, { batchNo: e.target.value })} />
              </Field>
              <Field label="จำนวน" className="w-28">
                <Input type="number" value={b.amount ?? ''} onChange={(e) => setProductBatch(i, { amount: num(e.target.value) })} />
              </Field>
              <Field label="หน่วย" className="w-24">
                <select className="h-9 rounded-md border px-2 text-sm" value={b.unit ?? ''}
                  onChange={(e) => setProductBatch(i, { unit: (e.target.value || undefined) as WeightUnit })}>
                  <option value="">—</option>
                  {(Object.keys(WEIGHT_UNIT_LABELS) as WeightUnit[]).map((u) => (
                    <option key={u} value={u}>{WEIGHT_UNIT_LABELS[u]}</option>
                  ))}
                </select>
              </Field>
              <div className="pb-1">
                <CheckRow checked={!!b.sendToLab} onChange={(on) => setProductBatch(i, { sendToLab: on })}>
                  ส่งตรวจ
                </CheckRow>
              </div>
              <Button type="button" variant="ghost" size="icon"
                onClick={() => set('productBatches', (value.productBatches ?? []).filter((_, x) => x !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm"
            onClick={() => set('productBatches', [...(value.productBatches ?? []), {}])}>
            <Plus className="h-4 w-4 mr-1" /> เพิ่มแบช
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">ผู้ขาย / ผู้ผลิต / เกณฑ์ / การส่งมอบ</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="5. ชื่อผู้ขาย">
              <Input value={value.seller ?? ''} onChange={(e) => set('seller', e.target.value)} />
            </Field>
            <Field label="ประเทศ">
              <Input value={value.sellerCountry ?? ''} onChange={(e) => set('sellerCountry', e.target.value)} />
            </Field>
            <Field label="6. ชื่อผู้ผลิต">
              <Input value={value.manufacturer ?? ''} onChange={(e) => set('manufacturer', e.target.value)} />
            </Field>
            <Field label="ประเทศ">
              <Input value={value.manufacturerCountry ?? ''} onChange={(e) => set('manufacturerCountry', e.target.value)} />
            </Field>
          </div>
          <Field label="7. เกณฑ์คลาดเคลื่อนมาตรฐานสารออกฤทธิ์ (สารเคมีหลัก)">
            <Input value={value.activeIngredientTolerance ?? ''} onChange={(e) => set('activeIngredientTolerance', e.target.value)} />
          </Field>
          <div className="flex gap-4">
            <RadioRow checked={value.toleranceResult === 'within'} onSelect={() => set('toleranceResult', 'within')}>
              {TOLERANCE_RESULT_LABELS.within}
            </RadioRow>
            <RadioRow checked={value.toleranceResult === 'outside'} onSelect={() => set('toleranceResult', 'outside')}>
              {TOLERANCE_RESULT_LABELS.outside}
            </RadioRow>
          </div>
          {value.toleranceResult === 'outside' && (
            <Field label="คือ">
              <Input value={value.toleranceOutsideReason ?? ''} onChange={(e) => set('toleranceOutsideReason', e.target.value)} />
            </Field>
          )}
          <div className="pt-2">
            <p className="text-sm text-grey-600 mb-1">8. การส่งมอบ (กรอกเฉพาะกรณีส่งมอบล่าช้า)</p>
            {(Object.keys(LATE_DELIVERY_LABELS) as (keyof typeof LATE_DELIVERY_LABELS)[]).map((k) => (
              <CheckRow key={k}
                checked={(value.lateDelivery ?? []).includes(k)}
                onChange={(on) => set('lateDelivery', toggle(value.lateDelivery, k, on))}>
                {LATE_DELIVERY_LABELS[k]}
              </CheckRow>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 pt-2">
            <Field label="ผู้รับสินค้า">
              <Input value={value.receivedByName ?? ''} onChange={(e) => set('receivedByName', e.target.value)} />
            </Field>
            <Field label="วันที่">
              <Input type="date" value={value.receivedAt ?? ''} onChange={(e) => set('receivedAt', e.target.value)} />
            </Field>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่

- [ ] **Step 3: Commit**

```bash
git add -- src/components/warehouse/GoodsReceiptStep.tsx
git commit -m "feat: add F-WAR-03-01 goods receipt form step

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Step 2 — ฟอร์มใบตรวจสอบวัตถุดิบ (F-WAR-03-02)

**Files:**
- Create: `src/components/warehouse/RawMaterialInspectionStep.tsx`

**Interfaces:**
- Consumes: `RawMaterialInspection`, `WeighBatch`, `InspectionSummary` (Task 4); labels จาก `@/lib/goodsReceipt`; controls (Task 7)
- Produces: `export default function RawMaterialInspectionStep({ value, onChange, receiptNoHint, receiptDateHint })`

- [ ] **Step 1: เขียน component**

Create `src/components/warehouse/RawMaterialInspectionStep.tsx`:

```tsx
// F-WAR-03-02 ใบตรวจสอบวัตถุดิบ — step ที่ 2 ของ wizard
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';
import type {
  Appearance, ContainerType, GrossWeightUnit, InspectionSummary,
  QuantityUnit, RawMaterialInspection, WeighBatch,
} from '@/types/goodsReceipt.types';
import {
  APPEARANCE_LABELS, CONTAINER_CONDITION_LABELS, CONTAINER_TYPE_LABELS,
  PRESENCE_LABELS, QUANTITY_UNIT_LABELS,
} from '@/lib/goodsReceipt';
import { CheckRow, Field, RadioRow, toggle } from './formControls';

interface Props {
  value: RawMaterialInspection;
  onChange: (next: RawMaterialInspection) => void;
  // "อ้างถึงใบรับวัตถุดิบ เลขที่/วันที่" — เลขที่ยังไม่มีจนกว่าจะบันทึก จึงโชว์เป็นข้อความอ่านอย่างเดียว
  receiptNoHint: string;
  receiptDateHint: string;
}

const num = (v: string) => (v.trim() === '' ? undefined : Number(v));

// สรุปผลการตรวจ ใช้โครงเดียวกันทั้งข้อ 1-4 และ 5-6
const SummaryBlock = ({ title, value, onChange }:
  { title: string; value?: InspectionSummary; onChange: (next: InspectionSummary) => void }) => {
  const set = <K extends keyof InspectionSummary>(k: K, v: InspectionSummary[K]) =>
    onChange({ ...(value ?? {}), [k]: v });
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <RadioRow checked={value?.accepted === true} onSelect={() => set('accepted', true)}>ยอมรับได้</RadioRow>
        {value?.accepted === true && (
          <Field label="หมายเหตุ">
            <Input value={value?.note ?? ''} onChange={(e) => set('note', e.target.value)} />
          </Field>
        )}
        <RadioRow checked={value?.accepted === false} onSelect={() => set('accepted', false)}>ยอมรับไม่ได้</RadioRow>
        {value?.accepted === false && (
          <Field label="เพราะ">
            <Textarea rows={2} value={value?.rejectReason ?? ''} onChange={(e) => set('rejectReason', e.target.value)} />
          </Field>
        )}
        <div className="grid gap-3 sm:grid-cols-2 pt-2">
          <Field label="ผู้ตรวจสอบ">
            <Input value={value?.inspectedBy ?? ''} onChange={(e) => set('inspectedBy', e.target.value)} />
          </Field>
          <Field label="วันที่">
            <Input type="date" value={value?.inspectedAt ?? ''} onChange={(e) => set('inspectedAt', e.target.value)} />
          </Field>
        </div>
      </CardContent>
    </Card>
  );
};

export default function RawMaterialInspectionStep({ value, onChange, receiptNoHint, receiptDateHint }: Props) {
  const set = <K extends keyof RawMaterialInspection>(k: K, v: RawMaterialInspection[K]) =>
    onChange({ ...value, [k]: v });

  const setWeighBatch = (i: number, patch: Partial<WeighBatch>) => {
    const rows = [...(value.weighBatches ?? [])];
    rows[i] = { ...rows[i], ...patch };
    set('weighBatches', rows);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-grey-600">
        อ้างถึงใบรับวัตถุดิบ เลขที่ <span className="font-medium">{receiptNoHint}</span>
        {' '}วันที่ <span className="font-medium">{receiptDateHint}</span>
      </p>

      <Card>
        <CardHeader><CardTitle className="text-base">1. ลักษณะภาชนะที่ใส่</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {(Object.keys(CONTAINER_TYPE_LABELS) as ContainerType[]).map((k) => (
            <RadioRow key={k} checked={value.containerType === k} onSelect={() => set('containerType', k)}>
              {CONTAINER_TYPE_LABELS[k]}
            </RadioRow>
          ))}
          {value.containerType === 'other' && (
            <Field label="ระบุ">
              <Input value={value.containerTypeOther ?? ''} onChange={(e) => set('containerTypeOther', e.target.value)} />
            </Field>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">2. สภาพภาชนะที่ใส่</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          <RadioRow checked={value.containerCondition === 'normal'} onSelect={() => set('containerCondition', 'normal')}>
            {CONTAINER_CONDITION_LABELS.normal}
          </RadioRow>
          <RadioRow checked={value.containerCondition === 'leakOrBroken'} onSelect={() => set('containerCondition', 'leakOrBroken')}>
            {CONTAINER_CONDITION_LABELS.leakOrBroken}
          </RadioRow>
          {value.containerCondition === 'leakOrBroken' && (
            <Field label="แบชที่">
              <Input value={value.containerConditionBatches ?? ''} onChange={(e) => set('containerConditionBatches', e.target.value)} />
            </Field>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">3. สัญลักษณ์บนภาชนะ (สำหรับสินค้าต่างประเทศ)</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-grey-600 mb-1">ฉลากปิด</p>
            <RadioRow checked={value.labelStatus === 'has'} onSelect={() => set('labelStatus', 'has')}>{PRESENCE_LABELS.has}ฉลากปิด</RadioRow>
            <RadioRow checked={value.labelStatus === 'none'} onSelect={() => set('labelStatus', 'none')}>{PRESENCE_LABELS.none}ฉลากปิด</RadioRow>
          </div>
          <div>
            <p className="text-sm text-grey-600 mb-1">ซีลปิ๊งมาร์ค</p>
            <RadioRow checked={value.sealMarkStatus === 'has'} onSelect={() => set('sealMarkStatus', 'has')}>{PRESENCE_LABELS.has}ซีลปิ๊งมาร์ค</RadioRow>
            <RadioRow checked={value.sealMarkStatus === 'none'} onSelect={() => set('sealMarkStatus', 'none')}>{PRESENCE_LABELS.none}ซีลปิ๊งมาร์ค</RadioRow>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">4. การสุ่มตัวอย่างชั่งน้ำหนัก</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="ถพ. (กรณีวัดได้)">
              <Input type="number" value={value.specificGravity ?? ''} onChange={(e) => set('specificGravity', num(e.target.value))} />
            </Field>
            <Field label="Gross weight">
              <div className="flex gap-2">
                <Input type="number" value={value.grossWeight ?? ''} onChange={(e) => set('grossWeight', num(e.target.value))} />
                <select className="h-9 rounded-md border px-2 text-sm" value={value.grossWeightUnit ?? ''}
                  onChange={(e) => set('grossWeightUnit', (e.target.value || undefined) as GrossWeightUnit)}>
                  <option value="">—</option>
                  <option value="litre">ลิตร</option>
                  <option value="kg">กก.</option>
                </select>
              </div>
            </Field>
            <Field label="ช่วงยอมรับ (กก.) — ต่ำกว่า Gross ไม่เกิน 0.2% / สูงกว่าไม่เกิน 1.5%">
              <Input type="number" value={value.toleranceKg ?? ''} onChange={(e) => set('toleranceKg', num(e.target.value))} />
            </Field>
            <Field label="Net weight (ลิตร)">
              <Input type="number" value={value.netWeightLitre ?? ''} onChange={(e) => set('netWeightLitre', num(e.target.value))} />
            </Field>
            <Field label="Net weight (กก.)">
              <Input type="number" value={value.netWeightKg ?? ''} onChange={(e) => set('netWeightKg', num(e.target.value))} />
            </Field>
          </div>
          {(value.weighBatches ?? []).map((b, i) => (
            <div key={i} className="flex gap-2 items-end">
              <Field label="แบช" className="flex-1">
                <Input value={b.batchNo ?? ''} onChange={(e) => setWeighBatch(i, { batchNo: e.target.value })} />
              </Field>
              <Field label="จำนวน" className="w-28">
                <Input type="number" value={b.quantity ?? ''} onChange={(e) => setWeighBatch(i, { quantity: num(e.target.value) })} />
              </Field>
              <Field label="หน่วย" className="w-24">
                <select className="h-9 rounded-md border px-2 text-sm" value={b.quantityUnit ?? ''}
                  onChange={(e) => setWeighBatch(i, { quantityUnit: (e.target.value || undefined) as QuantityUnit })}>
                  <option value="">—</option>
                  {(Object.keys(QUANTITY_UNIT_LABELS) as QuantityUnit[]).map((u) => (
                    <option key={u} value={u}>{QUANTITY_UNIT_LABELS[u]}</option>
                  ))}
                </select>
              </Field>
              <Field label="น้ำหนัก (กก.)" className="w-32">
                <Input type="number" value={b.weightKg ?? ''} onChange={(e) => setWeighBatch(i, { weightKg: num(e.target.value) })} />
              </Field>
              <Button type="button" variant="ghost" size="icon"
                onClick={() => set('weighBatches', (value.weighBatches ?? []).filter((_, x) => x !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm"
            onClick={() => set('weighBatches', [...(value.weighBatches ?? []), {}])}>
            <Plus className="h-4 w-4 mr-1" /> เพิ่มแถวชั่ง
          </Button>
        </CardContent>
      </Card>

      <SummaryBlock title="สรุปผลการตรวจ ข้อ 1-4"
        value={value.summary14} onChange={(v) => set('summary14', v)} />

      <Card>
        <CardHeader><CardTitle className="text-base">5. ลักษณะของสินค้า</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="แบชที่ลักษณะเหมือนเดิม คือ แบชที่">
            <Input value={value.appearanceSameBatches ?? ''} onChange={(e) => set('appearanceSameBatches', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 sm:grid-cols-3">
            {(Object.keys(APPEARANCE_LABELS) as Appearance[]).map((k) => (
              <CheckRow key={k}
                checked={(value.appearance ?? []).includes(k)}
                onChange={(on) => set('appearance', toggle(value.appearance, k, on))}>
                {APPEARANCE_LABELS[k]}
              </CheckRow>
            ))}
          </div>
          {(value.appearance ?? []).includes('other') && (
            <Field label="ระบุ">
              <Input value={value.appearanceOther ?? ''} onChange={(e) => set('appearanceOther', e.target.value)} />
            </Field>
          )}
          <Field label="แบชที่ลักษณะไม่เหมือนเดิม คือ แบชที่">
            <Input value={value.appearanceDiffBatches ?? ''} onChange={(e) => set('appearanceDiffBatches', e.target.value)} />
          </Field>
          <Field label="ระบุสิ่งที่ไม่เหมือนเดิม">
            <Textarea rows={2} value={value.appearanceDiffDetail ?? ''} onChange={(e) => set('appearanceDiffDetail', e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">6. สีของสินค้า</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field label="แบชที่สีเหมือนเดิม คือ แบชที่">
            <Input value={value.colorSameBatches ?? ''} onChange={(e) => set('colorSameBatches', e.target.value)} />
          </Field>
          <Field label="สี">
            <Input value={value.colorSame ?? ''} onChange={(e) => set('colorSame', e.target.value)} />
          </Field>
          <Field label="แบชที่สีไม่เหมือนเดิม คือ แบชที่">
            <Input value={value.colorDiffBatches ?? ''} onChange={(e) => set('colorDiffBatches', e.target.value)} />
          </Field>
          <Field label="สี">
            <Input value={value.colorDiff ?? ''} onChange={(e) => set('colorDiff', e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <SummaryBlock title="สรุปผลการตรวจสอบ ข้อ 5-6"
        value={value.summary56} onChange={(v) => set('summary56', v)} />
    </div>
  );
}
```

- [ ] **Step 2: type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่

- [ ] **Step 3: Commit**

```bash
git add -- src/components/warehouse/RawMaterialInspectionStep.tsx
git commit -m "feat: add F-WAR-03-02 inspection form step

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Step 3 — เลือก master item + รายการทดสอบต่อแบช

**Files:**
- Create: `src/components/warehouse/RmTestItemsStep.tsx`

**Interfaces:**
- Consumes: `ProductBatch` (Task 4), `RmTestSelection` (Task 5), `PetitionMasterItemOption` จาก `@/lib/petitionMasterItem`
- Produces: `export default function RmTestItemsStep({ batches, value, onChange, masterItemOptions, masterItemsLoading })` โดย `batches: ProductBatch[]` (เฉพาะที่ติ๊กส่งตรวจ), `value: RmTestSelection[]`, `onChange: (next: RmTestSelection[]) => void`

**pattern ที่ยึดตามของเดิม:** `src/components/petition/wizard/ItemsStep.tsx` รับ `masterItemOptions: PetitionMasterItemOption[]` + `masterItemsLoading` มาจาก parent แล้วเรนเดอร์ combobox ด้วย `Popover` + `Command` (บรรทัด 244-298) ส่วน `testItems` เป็นช่อง `<Input>` ข้อความธรรมดา — ทำแบบเดียวกัน

`PetitionMasterItemOption` = `{ itemNo, sampleName, commonName, packageUnit }` (`src/lib/petitionMasterItem.ts:5-10`)

- [ ] **Step 1: เขียน component**

Create `src/components/warehouse/RmTestItemsStep.tsx`:

```tsx
// Step 3 — แบชที่ติ๊กส่งตรวจ ต้องเลือกสินค้าอ้างอิง (ได้ commonName) + รายการทดสอบ
// commonName เป็นตัวขับการจับคู่ simple-method ตอน assign เครื่องมือ จึงต้องมาจาก master item
// ไม่ใช่พิมพ์เอง — ดู CLAUDE.md gotcha เรื่อง simple-method positional
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronsUpDown } from 'lucide-react';
import type { ProductBatch } from '@/types/goodsReceipt.types';
import type { RmTestSelection } from '@/lib/rmPetitionMapping';
import type { PetitionMasterItemOption } from '@/lib/petitionMasterItem';
import { Field } from './formControls';

interface Props {
  batches: ProductBatch[];
  value: RmTestSelection[];
  onChange: (next: RmTestSelection[]) => void;
  masterItemOptions: PetitionMasterItemOption[];
  masterItemsLoading?: boolean;
}

// combobox เลือก master item — pattern เดียวกับ ItemsStep.tsx:244-298
const MasterItemPicker = ({ options, loading, commonName, onPick }: {
  options: PetitionMasterItemOption[];
  loading?: boolean;
  commonName: string;
  onPick: (option: PetitionMasterItemOption) => void;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox"
          className="w-full justify-between font-normal">
          <span className={commonName ? '' : 'text-grey-500'}>
            {commonName || (loading ? 'กำลังโหลด Master Item...' : 'เลือกสินค้าอ้างอิง')}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="ค้นหาชื่อตัวอย่างจาก Master Item..." />
          <CommandList>
            <CommandEmpty>ไม่พบชื่อตัวอย่างใน Master Item</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={`${option.itemNo}-${option.sampleName}-${option.commonName}-${option.packageUnit}`}
                  value={[option.sampleName, option.commonName, option.itemNo].filter(Boolean).join(' ')}
                  onSelect={() => { onPick(option); setOpen(false); }}>
                  <div className="flex flex-col">
                    <span>{option.sampleName}</span>
                    <span className="text-xs text-grey-500">
                      {[option.commonName, option.packageUnit].filter(Boolean).join(' · ') || option.itemNo}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default function RmTestItemsStep({
  batches, value, onChange, masterItemOptions, masterItemsLoading,
}: Props) {
  const find = (batchNo: string) => value.find((s) => s.batchNo === batchNo);

  const patch = (batchNo: string, next: Partial<RmTestSelection>) => {
    const existing = find(batchNo);
    const merged: RmTestSelection = {
      batchNo,
      commonName: existing?.commonName ?? '',
      testItems: existing?.testItems ?? '',
      ...next,
    };
    onChange([...value.filter((s) => s.batchNo !== batchNo), merged]);
  };

  if (batches.length === 0) {
    return <p className="text-sm text-grey-600">ยังไม่ได้ติ๊กแบชที่ส่งตรวจในขั้นตอนใบรับสินค้า</p>;
  }

  return (
    <div className="space-y-3">
      {batches.map((b) => {
        const batchNo = String(b.batchNo ?? '').trim();
        const sel = find(batchNo);
        return (
          <Card key={batchNo}>
            <CardHeader><CardTitle className="text-base">แบช {batchNo}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Field label="สินค้าอ้างอิง (Master Item) — ได้ common name">
                <MasterItemPicker
                  options={masterItemOptions}
                  loading={masterItemsLoading}
                  commonName={sel?.commonName ?? ''}
                  onPick={(option) => patch(batchNo, { commonName: option.commonName })} />
              </Field>
              <Field label="รายการทดสอบ">
                <Input value={sel?.testItems ?? ''}
                  onChange={(e) => patch(batchNo, { testItems: e.target.value })} />
              </Field>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่

- [ ] **Step 3: Commit**

```bash
git add -- src/components/warehouse/RmTestItemsStep.tsx
git commit -m "feat: add RM test-item selection step

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: หน้า wizard + route + เมนู

**Files:**
- Create: `src/pages/petitions/RmPetitionNewPage.tsx`
- Modify: `src/App.tsx` (lazy import + route ก่อนบรรทัด 147), `src/lib/navItems.ts`

**Interfaces:**
- Consumes: ทุก step (Task 8-10), `buildRmPetitionItems` (Task 5), `api.createGoodsReceipt` (Task 6), `useAuth()`, และ **`createPetition` / `deletePetition` ที่ export เป็น function แยกจาก `@/hooks/usePetition`** (ไม่ใช่ method บน `api` — `src/hooks/usePetition.ts:251,269`)
- Produces: route `/petition/rm/new`

**Signature ของเดิมที่ต้องเรียกให้ตรง:**

```ts
// src/hooks/usePetition.ts:251
createPetition(payload: CreatePetitionPayload): Promise<Petition>   // คืน doc ที่มี _id
// src/hooks/usePetition.ts:269
deletePetition(id: string, actor?: string): Promise<void>
```

payload ของ dept 'rm' ยึดตาม `rmPetitionFormSchema` (`src/lib/validations.ts:89-95`) ซึ่งเหมือน production แต่**ไม่มี `labRequests`**

**หมายเหตุก่อนลงมือ:** อ่าน `src/pages/petitions/ProductionPetitionNewPage.tsx` เพื่อดูโครง stepper + วิธีเรียก `createPetition` + toast ที่ระบบใช้ แล้วทำตามให้ตรงกัน

- [ ] **Step 1: เขียนหน้า wizard**

Create `src/pages/petitions/RmPetitionNewPage.tsx`:

```tsx
// สร้างคำขอของแผนก RM จากฟอร์ม F-WAR-03-01,02
// submit 2 จังหวะ: สร้าง petition ก่อน แล้วค่อยผูกฟอร์ม — ถ้าจังหวะ 2 พังต้องลบ petition ทิ้ง
// ไม่งั้นจะเหลือคำขอลอยที่ไม่มีฟอร์มผูกอยู่
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { buildPetitionMasterItemOptions, normalizeMasterItemPayload } from '@/lib/petitionMasterItem';
import { createPetition, deletePetition } from '@/hooks/usePetition';
import { useAuth } from '@/hooks/useAuth';
import { buildRmPetitionItems, type RmTestSelection } from '@/lib/rmPetitionMapping';
import type { GoodsReceiptReceipt, RawMaterialInspection } from '@/types/goodsReceipt.types';
import GoodsReceiptStep from '@/components/warehouse/GoodsReceiptStep';
import RawMaterialInspectionStep from '@/components/warehouse/RawMaterialInspectionStep';
import RmTestItemsStep from '@/components/warehouse/RmTestItemsStep';

const STEPS = ['ใบรับสินค้า', 'ใบตรวจสอบวัตถุดิบ', 'รายการทดสอบ', 'ตรวจทาน'];

export default function RmPetitionNewPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [warehouse, setWarehouse] = useState('');
  const [receipt, setReceipt] = useState<GoodsReceiptReceipt>({});
  const [inspection, setInspection] = useState<RawMaterialInspection>({});
  const [selections, setSelections] = useState<RmTestSelection[]>([]);

  const sendBatches = useMemo(
    () => (receipt.productBatches ?? []).filter((b) => b.sendToLab),
    [receipt.productBatches],
  );

  // โหลด master item แบบเดียวกับ ProductionPetitionNewPage.tsx:566-580
  const { data: masterItemRows = [], isLoading: masterItemsLoading } = useQuery({
    queryKey: ['master-items-for-petition-new'],
    queryFn: async () => {
      const res = await api.get<unknown>('/master-items');
      return normalizeMasterItemPayload(res.data.data);
    },
  });
  const masterItemOptions = useMemo(
    () => buildPetitionMasterItemOptions(masterItemRows),
    [masterItemRows],
  );

  const handleSubmit = async () => {
    let items;
    try {
      items = buildRmPetitionItems(receipt, selections);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ข้อมูลไม่ครบ');
      return;
    }

    setSaving(true);
    let petitionId: string | undefined;
    try {
      // payload ตาม rmPetitionFormSchema — ไม่มี labRequests เพราะ RM ไม่มีใบคำขอรับบริการ
      const created = await createPetition({
        dept: 'rm' as const,
        submittedBy: {
          employeeId: user?.employeeId || undefined,
          name: user?.name ?? '',
          department: 'คลังสินค้า RM',
        },
        items,
        cause: '',
      } as Parameters<typeof createPetition>[0]);
      petitionId = created._id;

      await api.createGoodsReceipt({
        petitionId: petitionId as string,
        warehouse,
        receipt,
        inspection,
      });

      toast.success('สร้างคำขอเรียบร้อย');
      navigate(`/petition/${petitionId}`);
    } catch (err) {
      // ผูกฟอร์มไม่สำเร็จ — ลบคำขอที่เพิ่งสร้างทิ้ง กันคำขอลอยไม่มีฟอร์ม
      if (petitionId) {
        try {
          await deletePetition(petitionId, user?.name);
        } catch {
          toast.error('บันทึกฟอร์มไม่สำเร็จ และลบคำขอที่ค้างไม่ได้ กรุณาแจ้งผู้ดูแลระบบ');
          setSaving(false);
          return;
        }
      }
      toast.error(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      <h1 className="text-xl font-semibold">คำขอตรวจวัตถุดิบ (RM)</h1>

      <ol className="flex flex-wrap gap-2 text-sm">
        {STEPS.map((label, i) => (
          <li key={label}
            className={`px-3 py-1 rounded-full border ${i === step ? 'bg-sky-600 text-white border-sky-600' : 'text-grey-600'}`}>
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <GoodsReceiptStep value={receipt} onChange={setReceipt}
          warehouse={warehouse} onWarehouseChange={setWarehouse} />
      )}
      {step === 1 && (
        <RawMaterialInspectionStep value={inspection} onChange={setInspection}
          receiptNoHint="(ออกให้อัตโนมัติเมื่อบันทึก)"
          receiptDateHint={receipt.receivedAt ?? '—'} />
      )}
      {step === 2 && (
        <RmTestItemsStep batches={sendBatches} value={selections} onChange={setSelections}
          masterItemOptions={masterItemOptions} masterItemsLoading={masterItemsLoading} />
      )}
      {step === 3 && (
        <div className="space-y-2 text-sm">
          <p>สินค้า: <span className="font-medium">{receipt.productName || '—'}</span></p>
          <p>แบชที่ส่งตรวจ: <span className="font-medium">
            {sendBatches.map((b) => b.batchNo).filter(Boolean).join(', ') || '—'}
          </span></p>
          <p className="text-grey-600">กดส่งเพื่อสร้างคำขอและบันทึกฟอร์ม</p>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" disabled={step === 0 || saving}
          onClick={() => setStep((s) => s - 1)}>ย้อนกลับ</Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={() => setStep((s) => s + 1)}>ถัดไป</Button>
        ) : (
          <Button type="button" onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            ส่งคำขอ
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: ยืนยันว่า import ถูกที่**

Run: `grep -n "export async function createPetition\|export async function deletePetition" src/hooks/usePetition.ts`
Expected: เจอทั้งสองบรรทัด (ประมาณบรรทัด 251 และ 269) — ทั้งคู่เป็น function แยก **ไม่ใช่** method บน `api` ถ้า grep ไม่เจอแปลว่ามีคนย้ายไฟล์ ให้หาที่อยู่ใหม่แล้วแก้ import ให้ตรง

- [ ] **Step 3: เพิ่ม route**

`src/App.tsx` — เพิ่ม lazy import รวมกับกลุ่ม lazy import เดิม:

```tsx
const RmPetitionNewPage = lazy(() => import("./pages/petitions/RmPetitionNewPage"));
```

แล้วเพิ่ม route **ก่อน** บรรทัด `/petition/:id` (บรรทัด 147):

```tsx
              <Route path="/petition/rm/new" element={<PrivateRoute><RmPetitionNewPage /></PrivateRoute>} />
```

- [ ] **Step 4: เพิ่มเมนู**

`src/lib/navItems.ts` — เพิ่มเข้า `NAV_ITEMS` ต่อจากบรรทัด `{ icon: FileText, label: "รายการคำร้อง", path: "/petition" }`:

```ts
  { icon: FileText, label: "คำขอตรวจวัตถุดิบ (RM)", path: "/petition/rm/new" },
```

- [ ] **Step 5: type-check + เทส**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่

Run: `npm run test`
Expected: PASS ทั้งชุด

- [ ] **Step 6: ลองจริงในเบราว์เซอร์**

รัน backend (`cd server && npm run dev`) และ frontend (`npm run dev`) แล้วเปิด `http://localhost:8000/LIS/petition/rm/new`
กรอกอย่างน้อย: ชื่อสินค้า, เพิ่มแบช 2 แถวติ๊กส่งตรวจ 1 แถว, step 3 กรอก common name + รายการทดสอบ, แล้วกดส่ง
Expected: เด้งไปหน้า `/petition/<id>` และ `GET /LIS/api/goods-receipts?petitionId=<id>` คืนฟอร์มที่บันทึก

- [ ] **Step 7: Commit**

```bash
git add -- src/pages/petitions/RmPetitionNewPage.tsx src/App.tsx src/lib/navItems.ts
git commit -m "feat: add RM petition wizard at /petition/rm/new

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: read-only view บนหน้า detail

**Files:**
- Create: `src/components/warehouse/GoodsReceiptView.tsx`
- Modify: `src/pages/petitions/PetitionTimelineDetailPage.tsx`

**Interfaces:**
- Consumes: `GoodsReceipt` (Task 4), `joinLabels` + label maps (Task 4), `api.getGoodsReceiptsByPetition` (Task 6)
- Produces: `export default function GoodsReceiptView({ doc }: { doc: GoodsReceipt })`

- [ ] **Step 1: เขียน view**

Create `src/components/warehouse/GoodsReceiptView.tsx`:

```tsx
// อ่านอย่างเดียว — ฟิลด์ที่ว่างจะไม่แสดง (pattern เดียวกับ LabAgreementReviewView)
import type { GoodsReceipt } from '@/types/goodsReceipt.types';
import {
  APPEARANCE_LABELS, CONTAINER_CONDITION_LABELS, CONTAINER_TYPE_LABELS,
  LATE_DELIVERY_LABELS, PRESENCE_LABELS, QUANTITY_UNIT_LABELS,
  RECEIPT_REFERENCE_LABELS, TOLERANCE_RESULT_LABELS, WEIGHT_UNIT_LABELS,
  joinLabels,
} from '@/lib/goodsReceipt';

const Line = ({ label, value }: { label: string; value?: string | number | null }) => {
  if (value === undefined || value === null || value === '') return null;
  return (
    <p className="text-sm">
      <span className="text-grey-600">{label}: </span>
      <span>{value}</span>
    </p>
  );
};

const thDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('th-TH') : undefined);

export default function GoodsReceiptView({ doc }: { doc: GoodsReceipt }) {
  const r = doc.receipt ?? {};
  const i = doc.inspection ?? {};

  return (
    <div className="space-y-4">
      <section className="space-y-1">
        <h3 className="font-medium">ใบรับสินค้า {doc.receiptNo ?? ''}</h3>
        <Line label="คลังสินค้า" value={doc.warehouse} />
        <Line label="อ้างถึง" value={joinLabels(r.references, RECEIPT_REFERENCE_LABELS)} />
        <Line label="ใบสั่งซื้อเลขที่" value={r.purchaseOrderNo} />
        <Line label="วันที่ใบสั่งซื้อ" value={thDate(r.purchaseOrderDate)} />
        <Line label="เลขที่ใบส่งของ" value={r.deliveryNoteNo} />
        <Line label="รหัสสินค้า" value={r.productCode} />
        <Line label="ชื่อสินค้า" value={r.productName} />
        <Line label="% สารออกฤทธิ์" value={r.activeIngredientPercent} />
        <Line label="ขนาดบรรจุ" value={r.packageSize} />
        <Line label="จำนวน" value={r.quantity != null
          ? `${r.quantity} ${r.quantityUnit ? QUANTITY_UNIT_LABELS[r.quantityUnit] : ''}`.trim()
          : undefined} />
        <Line label="น้ำหนักรวม" value={r.totalWeight != null
          ? `${r.totalWeight} ${r.totalWeightUnit ? WEIGHT_UNIT_LABELS[r.totalWeightUnit] : ''}`.trim()
          : undefined} />
        <Line label="Gross Weight จากผู้ขาย (กก.)" value={r.sellerGrossWeightKg} />
        <Line label="Net Weight จากผู้ขาย (ลิตร)" value={r.sellerNetWeightLitre} />
        <Line label="Net Weight จากผู้ขาย (กก.)" value={r.sellerNetWeightKg} />
        <Line label="ผู้ขาย" value={r.seller} />
        <Line label="ประเทศผู้ขาย" value={r.sellerCountry} />
        <Line label="ผู้ผลิต" value={r.manufacturer} />
        <Line label="ประเทศผู้ผลิต" value={r.manufacturerCountry} />
        <Line label="เกณฑ์คลาดเคลื่อนสารออกฤทธิ์" value={r.activeIngredientTolerance} />
        <Line label="ผลเทียบเกณฑ์" value={r.toleranceResult ? TOLERANCE_RESULT_LABELS[r.toleranceResult] : undefined} />
        <Line label="เหตุที่ไม่อยู่ในเกณฑ์" value={r.toleranceOutsideReason} />
        <Line label="การส่งมอบล่าช้า" value={joinLabels(r.lateDelivery, LATE_DELIVERY_LABELS)} />
        <Line label="ผู้รับสินค้า" value={r.receivedByName} />
        <Line label="วันที่รับ" value={thDate(r.receivedAt)} />
      </section>

      {(r.caBatches?.length || r.productBatches?.length) ? (
        <section className="space-y-1">
          <h4 className="font-medium text-sm">แบชนัมเบอร์</h4>
          {(r.caBatches ?? []).map((b, idx) => (
            <Line key={`ca-${idx}`} label={`CA ${b.batchNo ?? ''}`}
              value={b.amount != null ? `${b.amount} ${b.unit ? WEIGHT_UNIT_LABELS[b.unit] : ''}`.trim() : '—'} />
          ))}
          {(r.productBatches ?? []).map((b, idx) => (
            <Line key={`p-${idx}`} label={`สินค้า ${b.batchNo ?? ''}${b.sendToLab ? ' (ส่งตรวจ)' : ''}`}
              value={b.amount != null ? `${b.amount} ${b.unit ? WEIGHT_UNIT_LABELS[b.unit] : ''}`.trim() : '—'} />
          ))}
        </section>
      ) : null}

      <section className="space-y-1">
        <h3 className="font-medium">ใบตรวจสอบวัตถุดิบ {doc.inspectionNo ?? ''}</h3>
        <Line label="ลักษณะภาชนะ" value={i.containerType
          ? (i.containerType === 'other' ? i.containerTypeOther : CONTAINER_TYPE_LABELS[i.containerType])
          : undefined} />
        <Line label="สภาพภาชนะ" value={i.containerCondition ? CONTAINER_CONDITION_LABELS[i.containerCondition] : undefined} />
        <Line label="แบชที่รั่วซึม/แตก" value={i.containerConditionBatches} />
        <Line label="ฉลากปิด" value={i.labelStatus ? PRESENCE_LABELS[i.labelStatus] : undefined} />
        <Line label="ซีลปิ๊งมาร์ค" value={i.sealMarkStatus ? PRESENCE_LABELS[i.sealMarkStatus] : undefined} />
        <Line label="ถพ." value={i.specificGravity} />
        <Line label="Gross weight" value={i.grossWeight} />
        <Line label="Net weight (ลิตร)" value={i.netWeightLitre} />
        <Line label="Net weight (กก.)" value={i.netWeightKg} />
        <Line label="ช่วงยอมรับ (กก.)" value={i.toleranceKg} />
        <Line label="สรุปข้อ 1-4" value={i.summary14?.accepted === undefined ? undefined
          : i.summary14.accepted ? `ยอมรับได้ ${i.summary14.note ?? ''}`.trim()
          : `ยอมรับไม่ได้ เพราะ ${i.summary14.rejectReason ?? ''}`.trim()} />
        <Line label="ผู้ตรวจสอบ ข้อ 1-4" value={i.summary14?.inspectedBy} />
        <Line label="ลักษณะสินค้า" value={joinLabels(i.appearance, APPEARANCE_LABELS)} />
        <Line label="ลักษณะอื่นๆ" value={i.appearanceOther} />
        <Line label="แบชที่ลักษณะเหมือนเดิม" value={i.appearanceSameBatches} />
        <Line label="แบชที่ลักษณะไม่เหมือนเดิม" value={i.appearanceDiffBatches} />
        <Line label="สิ่งที่ไม่เหมือนเดิม" value={i.appearanceDiffDetail} />
        <Line label="แบชที่สีเหมือนเดิม" value={i.colorSameBatches} />
        <Line label="สี" value={i.colorSame} />
        <Line label="แบชที่สีไม่เหมือนเดิม" value={i.colorDiffBatches} />
        <Line label="สี (ไม่เหมือนเดิม)" value={i.colorDiff} />
        <Line label="สรุปข้อ 5-6" value={i.summary56?.accepted === undefined ? undefined
          : i.summary56.accepted ? `ยอมรับได้ ${i.summary56.note ?? ''}`.trim()
          : `ยอมรับไม่ได้ เพราะ ${i.summary56.rejectReason ?? ''}`.trim()} />
        <Line label="ผู้ตรวจสอบ ข้อ 5-6" value={i.summary56?.inspectedBy} />
      </section>
    </div>
  );
}
```

- [ ] **Step 2: เสียบการ์ดเข้าหน้า detail**

`src/pages/petitions/PetitionTimelineDetailPage.tsx` — อ่านไฟล์หาว่า petition ถูกโหลดมาในตัวแปรชื่ออะไร แล้วเพิ่ม state + effect โหลดฟอร์ม และเรนเดอร์การ์ดเมื่อ `dept === 'rm'`:

```tsx
// import เพิ่มด้านบนไฟล์
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { GoodsReceipt } from '@/types/goodsReceipt.types';
import GoodsReceiptView from '@/components/warehouse/GoodsReceiptView';

// ในตัว component (ใช้ชื่อตัวแปร petition ให้ตรงกับของจริงในไฟล์)
const [goodsReceipt, setGoodsReceipt] = useState<GoodsReceipt | null>(null);
useEffect(() => {
  const id = petition?._id;
  if (!id || petition?.dept !== 'rm') { setGoodsReceipt(null); return; }
  let cancelled = false;
  api.getGoodsReceiptsByPetition(id)
    .then((list) => { if (!cancelled) setGoodsReceipt(list[0] ?? null); })
    .catch(() => { if (!cancelled) setGoodsReceipt(null); });
  return () => { cancelled = true; };
}, [petition?._id, petition?.dept]);

// ใน JSX วางไว้ในกลุ่มการ์ดรายละเอียด
{petition?.dept === 'rm' && goodsReceipt && (
  <Card>
    <CardHeader><CardTitle className="text-base">ใบรับสินค้า / ใบตรวจสอบวัตถุดิบ</CardTitle></CardHeader>
    <CardContent><GoodsReceiptView doc={goodsReceipt} /></CardContent>
  </Card>
)}
```

- [ ] **Step 3: type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่

- [ ] **Step 4: ตรวจในเบราว์เซอร์**

เปิดหน้า `/petition/<id>` ของคำขอ RM ที่สร้างไว้ใน Task 11
Expected: เห็นการ์ด "ใบรับสินค้า / ใบตรวจสอบวัตถุดิบ" พร้อมข้อมูลที่กรอก และ**ไม่**เห็นการ์ดนี้ในคำขอของฝ่ายผลิต

- [ ] **Step 5: Commit**

```bash
git add -- src/components/warehouse/GoodsReceiptView.tsx src/pages/petitions/PetitionTimelineDetailPage.tsx
git commit -m "feat: show goods receipt form on RM petition detail

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: print template A4 2 แผ่น

**Files:**
- Create: `src/components/warehouse/GoodsReceiptPrintTemplate.tsx`
- Modify: `src/pages/petitions/PetitionTimelineDetailPage.tsx` (ปุ่มปริ้น + `PrintPreviewDialog`)

**Interfaces:**
- Consumes: `GoodsReceipt` (Task 4), label maps (Task 4), `A4_PRINT_FONT_FAMILY`/`A4_PRINT_FONT_SIZE` จาก `@/lib/printConfig`, `FitToBox` จาก `@/components/petition/FitToBox`
- Produces: `export default function GoodsReceiptPrintTemplate({ doc })` + `export const GOODS_RECEIPT_CSS: string`

**หมายเหตุก่อนลงมือ:** อ่าน `src/components/petition/PetitionPrintTemplate.tsx` บรรทัด 31-45 (primitive `CB`/`RD`/`Line`) และ 606-683 (บล็อก CSS) — ยกมาทั้งชุดแล้วเปลี่ยน prefix `.pr-` เป็น `.gr-` ข้อกำหนดที่ห้ามพลาด: หน่วยเป็น `pt`/`cm`/`mm` ล้วน ห้าม `px` ห้าม Tailwind spacing, ประกาศ `@page { size: A4; margin: 0 }`, sheet เป็น `width: 210mm; height: 297mm`, และ re-assert font ด้วย `!important` เพื่อไม่ให้ Tailwind ที่ `collectDocumentCss()` ลากมาทับ

- [ ] **Step 1: เขียน template**

Create `src/components/warehouse/GoodsReceiptPrintTemplate.tsx` — โครงที่ต้องได้:

```tsx
// ปริ้นฟอร์ม F-WAR-03-01,02 ให้เหมือนกระดาษ — A4 แนวตั้ง 2 แผ่น
// primitive CB/RD/Line + CSS ยกมาจาก PetitionPrintTemplate แล้วเปลี่ยน prefix เป็น .gr-
import { A4_PRINT_FONT_FAMILY, A4_PRINT_FONT_SIZE } from '@/lib/printConfig';
import FitToBox from '@/components/petition/FitToBox';
import type { GoodsReceipt } from '@/types/goodsReceipt.types';
import {
  APPEARANCE_LABELS, CONTAINER_TYPE_LABELS, QUANTITY_UNIT_LABELS,
  RECEIPT_REFERENCE_LABELS, WEIGHT_UNIT_LABELS,
} from '@/lib/goodsReceipt';

const CB = ({ checked }: { checked?: boolean }) =>
  <span className={`gr-cb${checked ? ' gr-cb-x' : ''}`} aria-hidden />;
const RD = ({ checked }: { checked?: boolean }) =>
  <span className={`gr-rd${checked ? ' gr-rd-x' : ''}`} aria-hidden />;
const Line = ({ value, width }: { value?: string | number | null; width?: string }) =>
  <span className="gr-line" style={width ? { minWidth: width } : undefined}>{value || ' '}</span>;

// วันที่แบบ พ.ศ. dd/mm/yy ตาม buddhistShort() ใน PetitionPrintTemplate
const buddhistShort = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String((d.getFullYear() + 543) % 100).padStart(2, '0');
  return `${dd}/${mm}/${yy}`;
};

export const GOODS_RECEIPT_CSS = `
@page { size: A4; margin: 0 }
.gr-root { font-family: ${A4_PRINT_FONT_FAMILY} !important;
           font-size: ${A4_PRINT_FONT_SIZE} !important; color: #000 !important }
.gr-page1, .gr-page2 { width: 210mm; height: 297mm; padding: 6mm 8mm 6mm 10mm;
                       display: flex; flex-direction: column; overflow: hidden;
                       background: #fff; box-sizing: border-box }
.gr-page1 { page-break-after: always }
.gr-cb { position: relative; display: inline-block; width: 9pt; height: 9pt;
         border: 0.6pt solid #000; vertical-align: -1pt; margin-right: 3pt }
.gr-cb-x::before { content: '✓'; position: absolute; inset: -2pt 0 0 0.5pt; font-size: 9pt }
.gr-rd { position: relative; display: inline-block; width: 7pt; height: 7pt;
         border: 0.6pt solid #000; border-radius: 50%; vertical-align: -1pt; margin-right: 3pt }
.gr-rd-x::before { content: ''; position: absolute; inset: 1pt; background: #000; border-radius: 50% }
.gr-line { display: inline-block; min-width: 2cm; border-bottom: 0.4pt dotted #000;
           white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
.gr-footer { margin-top: auto; font-size: 9pt }
.gr-title { text-align: center; font-weight: 700; font-size: 18pt; margin-bottom: 4mm }
.gr-ind2 { margin-left: 0.5cm }
@media print { .gr-page1, .gr-page2 { break-inside: avoid } }
@media screen { .gr-page1, .gr-page2 { box-shadow: 0 0 0 1px #ddd; margin: 0 auto 4mm } }
`;

export default function GoodsReceiptPrintTemplate({ doc }: { doc: GoodsReceipt }) {
  const r = doc.receipt ?? {};
  const i = doc.inspection ?? {};
  return (
    <div className="gr-root">
      <style>{GOODS_RECEIPT_CSS}</style>

      <section className="gr-page1">
        <FitToBox>
          <div className="gr-title">ใบรับสินค้า (ลัดดา)</div>
          <p>คลังสินค้า <Line value={doc.warehouse} width="4cm" />
             {' '}เลขที่ <Line value={doc.receiptNo} width="4cm" /></p>

          <p>อ้างถึง</p>
          <p className="gr-ind2">
            <CB checked={r.references?.includes('foreign')} />{RECEIPT_REFERENCE_LABELS.foreign}
            {' '}ใบสั่งซื้อเลขที่ <Line value={r.purchaseOrderNo} width="3.5cm" />
            {' '}วันที่ <Line value={buddhistShort(r.purchaseOrderDate)} width="2.5cm" />
          </p>
          <p className="gr-ind2">
            <CB checked={r.references?.includes('domestic')} />{RECEIPT_REFERENCE_LABELS.domestic}
          </p>
          <p className="gr-ind2">
            <CB checked={r.references?.includes('deliveryNote')} />เลขที่ใบส่งของ
            {' '}<Line value={r.deliveryNoteNo} width="5cm" />
          </p>

          {/* ต่อด้วยข้อ 1-3, ตารางแบช 2 ฝั่ง, ข้อ 5-8 และช่องลงชื่อผู้รับสินค้า
              ใช้ <CB>/<RD>/<Line> กับ label map เดียวกับหน้า view */}

          <div className="gr-footer">F-WAR-03-01 Rev:03 01/09/60</div>
        </FitToBox>
      </section>

      <section className="gr-page2">
        <FitToBox>
          <div className="gr-title">ใบตรวจสอบวัตถุดิบ</div>
          <p>คลังสินค้า <Line value={doc.warehouse} width="4cm" />
             {' '}เลขที่ <Line value={doc.inspectionNo} width="4cm" /></p>
          <p>อ้างถึงใบรับวัตถุดิบ เลขที่ <Line value={doc.receiptNo} width="4cm" />
             {' '}วันที่ <Line value={buddhistShort(r.receivedAt)} width="2.5cm" /></p>

          {/* ต่อด้วยข้อ 1-6 และสรุป 2 ช่วง ตามลำดับบนกระดาษ */}

          <div className="gr-footer">F-WAR-03-02 Rev:03 01/09/60</div>
        </FitToBox>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: เติมเนื้อฟอร์มให้ครบทุกช่อง**

ไล่เทียบกับ PDF ต้นฉบับ `เอกสารที่เกี่ยวข้อง/F-WAR-03-01,02 ใบรับสินค้า-ใบตรวจสอบวัตถุดิบ Rev 03 01-09-60.pdf` ทีละข้อ
ทุกฟิลด์ใน `GoodsReceiptReceipt` และ `RawMaterialInspection` ต้องมีที่อยู่บนกระดาษ ไม่มีฟิลด์ไหนตกหล่น
ตารางแบชใช้ `<table>` ธรรมดา ความกว้างคอลัมน์เป็น `cm`

- [ ] **Step 3: ต่อปุ่มปริ้นในหน้า detail**

`src/pages/petitions/PetitionTimelineDetailPage.tsx` — เพิ่มปุ่มในการ์ดที่สร้างไว้ Task 12 และ mount dialog แบบ guard ให้ template ไม่ mount จนกว่าจะเปิด:

```tsx
const [grPrintOpen, setGrPrintOpen] = useState(false);

// ในการ์ด
<Button type="button" variant="outline" size="sm" onClick={() => setGrPrintOpen(true)}>พิมพ์ฟอร์ม</Button>

// ท้าย JSX
{grPrintOpen && goodsReceipt && (
  <PrintPreviewDialog open={grPrintOpen} onOpenChange={setGrPrintOpen}
    docType="goods-receipt" css={GOODS_RECEIPT_CSS}>
    <GoodsReceiptPrintTemplate doc={goodsReceipt} />
  </PrintPreviewDialog>
)}
```

- [ ] **Step 4: ตรวจ preview**

เปิดหน้า `/petition/<id>` ของคำขอ RM แล้วกด "พิมพ์ฟอร์ม"
Expected: preview แสดง A4 2 แผ่น ข้อความไม่ล้นออกนอกขอบกระดาษ **และไม่มี horizontal scroll** ในหน้า preview (ต้องย่อพอดีจอเสมอ)

- [ ] **Step 5: type-check + เทส**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่

Run: `npm run test`
Expected: PASS ทั้งชุด

- [ ] **Step 6: Commit**

```bash
git add -- src/components/warehouse/GoodsReceiptPrintTemplate.tsx src/pages/petitions/PetitionTimelineDetailPage.tsx
git commit -m "feat: print F-WAR-03-01,02 as A4 two-page form

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: สิทธิ์เข้าถึง + seed export

**Files:**
- Modify: `server/seed-data/accessgroups.json`
- Run: `npm run seed:export`

- [ ] **Step 1: ดูโครง access group ปัจจุบัน**

Run: `node -e "const g=require('./server/seed-data/accessgroups.json'); console.log(JSON.stringify(g,null,2).slice(0,1500))"`
Expected: เห็นรูปแบบ `{ id, name, paths: [...] }` ของแต่ละกลุ่ม

- [ ] **Step 2: เพิ่ม path เข้ากลุ่มที่เหมาะสม**

เพิ่ม `/petition/rm/new` เข้า `paths` ของกลุ่มคลังสินค้า ถ้ายังไม่มีกลุ่มนี้ ให้สร้างกลุ่มใหม่ตามรูปแบบเดิมของไฟล์:

```json
{ "id": "warehouse", "name": "คลังสินค้า (RM)", "paths": ["/petition", "/petition/:id", "/petition/rm/new"] }
```

- [ ] **Step 3: ตรวจสิทธิ์จริงในเบราว์เซอร์**

ใช้ DevRoleSwitcher สลับเป็น role ที่**ไม่มี**สิทธิ์ แล้วเปิด `/petition/rm/new`
Expected: เห็นข้อความ 403 ภาษาไทย และเมนู "คำขอตรวจวัตถุดิบ (RM)" ไม่โผล่ในแถบข้าง
จากนั้นสลับเป็น role ที่มีสิทธิ์ Expected: เข้าได้ปกติ

- [ ] **Step 4: export seed data**

Run: `cd server && npm run seed:export`
Expected: `server/seed-data/goodsreceipts.json` ถูกสร้าง และไฟล์อื่นอัปเดตตามข้อมูลปัจจุบัน

- [ ] **Step 5: รันเทสทั้งหมดรอบสุดท้าย**

Run: `npm run test`
Expected: PASS

Run: `cd server && npm test`
Expected: PASS

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: จำนวน error เท่าเดิมกับก่อนเริ่มงาน (repo มี latent error ~12 ตัว)

- [ ] **Step 6: Commit**

```bash
git add -- server/seed-data/accessgroups.json server/seed-data/goodsreceipts.json
git commit -m "chore: grant warehouse access to RM petition form

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```
