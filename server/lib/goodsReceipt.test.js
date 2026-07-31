const { validateGoodsReceiptInput, sendToLabBatches, mapGoodsReceiptError } = require('./goodsReceipt');
const GoodsReceipt = require('../models/GoodsReceipt');

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

describe('mapGoodsReceiptError', () => {
  it('duplicate petitionId (E11000) → 409 ข้อความคำร้องมีใบรับสินค้าอยู่แล้ว', () => {
    const err = { code: 11000, keyPattern: { petitionId: 1, deletedAt: 1 } };
    expect(mapGoodsReceiptError(err)).toEqual({
      status: 409,
      message: 'คำร้องนี้มีใบรับสินค้าอยู่แล้ว',
    });
  });

  it('duplicate receiptNo (E11000) → 409 ข้อความเลขที่เอกสารชนกัน', () => {
    const err = { code: 11000, keyPattern: { receiptNo: 1, deletedAt: 1 } };
    const result = mapGoodsReceiptError(err);
    expect(result.status).toBe(409);
    expect(result.message).toMatch(/เลขที่เอกสาร/);
  });

  it('duplicate inspectionNo (E11000) → 409 ข้อความเลขที่เอกสารชนกัน', () => {
    const err = { code: 11000, keyPattern: { inspectionNo: 1, deletedAt: 1 } };
    const result = mapGoodsReceiptError(err);
    expect(result.status).toBe(409);
    expect(result.message).toMatch(/เลขที่เอกสาร/);
  });

  it('error อื่นที่ไม่ใช่ duplicate key → ตกไปพฤติกรรมเดิม (400 + err.message)', () => {
    const err = { message: 'ข้อมูลไม่ถูกต้อง' };
    expect(mapGoodsReceiptError(err)).toEqual({
      status: 400,
      message: 'ข้อมูลไม่ถูกต้อง',
    });
  });
});

describe('GoodsReceipt model — receiptNo/inspectionNo required (validateSync, no DB)', () => {
  it('ขาด receiptNo และ inspectionNo → validateSync คืน error ทั้งสอง field', () => {
    const doc = new GoodsReceipt({ petitionId: '000000000000000000000001' });
    const err = doc.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.receiptNo).toBeDefined();
    expect(err.errors.inspectionNo).toBeDefined();
  });

  it('มี receiptNo, inspectionNo, petitionId ครบ → ไม่มี validate error ที่ field เหล่านี้', () => {
    const doc = new GoodsReceipt({
      receiptNo: 'GR-2607-0001',
      inspectionNo: 'RMI-2607-0001',
      petitionId: '000000000000000000000001',
    });
    const err = doc.validateSync();
    expect(err === undefined || err.errors.receiptNo === undefined).toBe(true);
    expect(err === undefined || err.errors.inspectionNo === undefined).toBe(true);
  });
});
