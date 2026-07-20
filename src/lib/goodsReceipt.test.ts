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
