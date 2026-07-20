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

module.exports = { sendToLabBatches, validateGoodsReceiptInput };
