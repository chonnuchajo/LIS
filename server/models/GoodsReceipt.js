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
