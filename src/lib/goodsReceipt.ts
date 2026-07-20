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
