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
