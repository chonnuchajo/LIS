import { describe, it, expect } from 'vitest';
import {
  QUANTITY_UNIT_LABELS, WEIGHT_UNIT_LABELS, RECEIPT_REFERENCE_LABELS,
  TOLERANCE_RESULT_LABELS, LATE_DELIVERY_LABELS, CONTAINER_TYPE_LABELS,
  CONTAINER_CONDITION_LABELS, PRESENCE_LABELS, APPEARANCE_LABELS,
  joinLabels, isReceiptFilled, isInspectionFilled,
} from './goodsReceipt';

// pin ข้อความไทยทั้ง map — กันแก้/พิมพ์ผิดคำแปลของฟอร์ม F-WAR-03-01,02
// (Record<Enum, string> คุม key set ครบ/ขาดให้แล้วที่ compile time; ที่นี่คุมแค่ค่า string)
describe('label maps ข้อความไทยตรงกับฟอร์ม', () => {
  it('หน่วยจำนวน', () => {
    expect(QUANTITY_UNIT_LABELS).toEqual({
      drum: 'ถัง',
      sack: 'กส',
      box: 'กล่อง',
      can: 'กป',
    });
  });

  it('หน่วยน้ำหนัก', () => {
    expect(WEIGHT_UNIT_LABELS).toEqual({
      litre: 'ลิตร',
      kg: 'กก.',
      piece: 'ชิ้น',
    });
  });

  it('อ้างถึง', () => {
    expect(RECEIPT_REFERENCE_LABELS).toEqual({
      foreign: 'รายงานสินค้าต่างประเทศเข้าโรงงาน',
      domestic: 'รายงานสินค้าในประเทศเข้าโรงงาน',
      deliveryNote: 'เลขที่ใบส่งของ',
    });
  });

  it('เกณฑ์สารออกฤทธิ์', () => {
    expect(TOLERANCE_RESULT_LABELS).toEqual({
      within: 'อยู่ในเกณฑ์',
      outside: 'ไม่อยู่ในเกณฑ์',
    });
  });

  it('การส่งมอบล่าช้า', () => {
    expect(LATE_DELIVERY_LABELS).toEqual({
      vsReport: 'ส่งมอบล่าช้าเมื่อเปรียบเทียบกับรายงานสินค้าในประเทศ หรือรายงานสินค้าต่างประเทศเข้าโรงงาน',
      vsPurchaseOrder: 'ส่งมอบล่าช้าเมื่อเปรียบเทียบกับใบสั่งซื้อ (กรณีรับที่สำนักงาน)',
    });
  });

  it('ลักษณะภาชนะ', () => {
    expect(CONTAINER_TYPE_LABELS).toEqual({
      paperDrum: 'ถังกระดาษ',
      steelDrum: 'ถังเหล็ก',
      plasticDrum: 'ถังพลาสติก',
      paperSack: 'กระสอบกระดาษ',
      plasticSack: 'กระสอบพลาสติก',
      paperBox: 'กล่องกระดาษ',
      jar: 'กระปุก',
      other: 'อื่นๆ',
    });
  });

  it('สภาพภาชนะ', () => {
    expect(CONTAINER_CONDITION_LABELS).toEqual({
      normal: 'ปกติ',
      leakOrBroken: 'รั่วซึม/แตก',
    });
  });

  it('มี/ไม่มี', () => {
    expect(PRESENCE_LABELS).toEqual({
      has: 'มี',
      none: 'ไม่มี',
    });
  });

  it('ลักษณะสินค้า', () => {
    expect(APPEARANCE_LABELS).toEqual({
      powder: 'ผง',
      flake: 'เกร็ด',
      granule: 'เม็ด',
      lump: 'ก้อน',
      fine: 'ละเอียด',
      coarse: 'หยาบ',
      viscousLiquid: 'ของเหลวข้น',
      clearLiquid: 'ของเหลวใส',
      other: 'อื่นๆ',
    });
  });
});

describe('joinLabels', () => {
  it('หลายค่า → คั่นด้วย ", "', () => {
    expect(joinLabels(['drum', 'sack'], QUANTITY_UNIT_LABELS)).toBe('ถัง, กส');
  });

  it('array ว่าง → string ว่าง', () => {
    expect(joinLabels([], QUANTITY_UNIT_LABELS)).toBe('');
  });

  it('undefined → string ว่าง', () => {
    expect(joinLabels(undefined, QUANTITY_UNIT_LABELS)).toBe('');
  });

  it('มี key ที่ไม่อยู่ใน map ปน → key นั้นถูกกรองทิ้ง (ไม่ throw)', () => {
    expect(joinLabels(['drum', 'unknown' as 'drum'], QUANTITY_UNIT_LABELS)).toBe('ถัง');
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
