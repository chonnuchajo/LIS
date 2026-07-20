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
