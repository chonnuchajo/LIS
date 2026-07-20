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

// หา field ที่ชนกันจาก MongoDB duplicate-key error โดยตัด deletedAt ออก
// (ทุก unique index ของโมเดลนี้เป็น compound คู่กับ deletedAt สำหรับ soft delete)
function primaryDuplicateKey(err) {
  const pattern = (err && err.keyPattern) || (err && err.keyValue) || {};
  const keys = Object.keys(pattern).filter((k) => k !== 'deletedAt');
  return keys[0] || Object.keys(pattern)[0] || '';
}

// แปล error ที่ throw จาก create/save เป็นข้อความไทย + HTTP status สำหรับ route
// PURE — รับ error (หรือ object หน้าตาเหมือน MongoDB duplicate-key error) คืน { status, message }
// ไม่รู้จัก mongoose/express เอง route เป็นคนเรียก res.status(status).json({ error: { message } })
function mapGoodsReceiptError(err) {
  const e = err || {};
  if (e.code === 11000) {
    const key = primaryDuplicateKey(e);
    if (key === 'petitionId') {
      return { status: 409, message: 'คำร้องนี้มีใบรับสินค้าอยู่แล้ว' };
    }
    if (key === 'receiptNo' || key === 'inspectionNo') {
      return { status: 409, message: 'เลขที่เอกสารชนกัน กรุณาลองบันทึกใหม่อีกครั้ง' };
    }
    return { status: 409, message: 'ข้อมูลซ้ำกับที่มีอยู่แล้ว' };
  }
  return { status: 400, message: e.message };
}

module.exports = { sendToLabBatches, validateGoodsReceiptInput, mapGoodsReceiptError };
