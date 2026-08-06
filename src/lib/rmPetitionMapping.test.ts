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
  { batchNo: 'B-001', commonName: 'Glyphosate', itemNo: 'RO-0123' },
  { batchNo: 'B-003', commonName: 'Glyphosate', itemNo: 'RO-0123' },
  { batchNo: 'B-004', commonName: 'Glyphosate', itemNo: 'RI-0044' },
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

  it('commonName มาจาก selection ของแบชนั้น', () => {
    const items = buildRmPetitionItems(receipt, selections);
    expect(items[1].commonName).toBe('Glyphosate');
  });

  // itemNo คือรหัส Master Item ที่ขับ "หมวดหมู่ย่อย (prefix code)" ของ parameter —
  // ขาดไปแล้วเงื่อนไข RO/RI/RS ตายทั้งหมด
  it('itemNo ติดไปกับ item ตาม selection ของแบชนั้น', () => {
    const items = buildRmPetitionItems(receipt, selections);
    expect(items.map((i) => i.itemNo)).toEqual(['RO-0123', 'RO-0123', 'RI-0044']);
  });

  it('selection ที่ยังไม่มี itemNo → itemNo ว่าง (ไม่พัง)', () => {
    const items = buildRmPetitionItems(receipt, selections.map(({ itemNo: _drop, ...rest }) => rest));
    expect(items.every((i) => i.itemNo === '')).toBe(true);
  });

  it('testItems ว่างเสมอ — RM ใช้ classification-based matching เหมือน production (ไม่ exact-match ชื่อพารามิเตอร์)', () => {
    const items = buildRmPetitionItems(receipt, selections);
    expect(items.every((i) => i.testItems === '')).toBe(true);
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

  it('แบชที่ติ๊กแต่ไม่มี selection เลย → โยน error รายการสินค้าอ้างอิง', () => {
    expect(() => buildRmPetitionItems(receipt, selections.slice(0, 2)))
      .toThrow('ยังไม่ได้เลือกรายการสินค้าอ้างอิงของแบช B-004');
  });

  it('แบชที่ติ๊กแต่ยังไม่เลือก master item (commonName ว่าง) → โยน error ระบุแบช', () => {
    const bad = [...selections.slice(0, 2), { batchNo: 'B-004', commonName: '' }];
    expect(() => buildRmPetitionItems(receipt, bad))
      .toThrow('ยังไม่ได้เลือกรายการสินค้าอ้างอิงของแบช B-004');
  });

  it('ติ๊กส่งตรวจ 2 แบชด้วยแบชนัมเบอร์เดียวกัน → โยน error ระบุแบชนัมเบอร์ที่ซ้ำ', () => {
    const dupReceipt: GoodsReceiptReceipt = {
      productName: 'Glyphosate 48% SL',
      productBatches: [
        { batchNo: 'B-001', sendToLab: true },
        { batchNo: 'B-001', sendToLab: true },
        { batchNo: 'B-002', sendToLab: true },
      ],
    };
    const dupSelections = [
      { batchNo: 'B-001', commonName: 'Glyphosate' },
      { batchNo: 'B-002', commonName: 'Glyphosate' },
    ];
    expect(() => buildRmPetitionItems(dupReceipt, dupSelections)).toThrow('B-001');
  });

  it('แบชที่ไม่ได้ติ๊กมีแบชนัมเบอร์ซ้ำกับแบชที่ติ๊ก → ไม่โยน error (นับเฉพาะแบชที่ติ๊ก)', () => {
    const withUntickedDup: GoodsReceiptReceipt = {
      ...receipt,
      productBatches: [...receipt.productBatches, { batchNo: 'B-001', sendToLab: false }],
    };
    const items = buildRmPetitionItems(withUntickedDup, selections);
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.batchNo)).toEqual(['B-001', 'B-003', 'B-004']);
  });
});
