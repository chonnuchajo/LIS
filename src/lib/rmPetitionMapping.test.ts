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
