// รายการ "กำลังใช้งานอยู่" = การเบิก standard ที่ยังไม่มี deductionResolution
// pure ล้วน (ไม่แตะ DB) — route แค่ query แล้วส่งผลลัพธ์เข้าฟังก์ชันนี้
// สถานะ (ใกล้ครบ/หมดอายุ) ไม่คำนวณที่นี่ ตั้งใจให้ FE ตัดสินที่เดียวจาก dueAt

const { dueAtFor } = require('./workingLifecycle');
const { sumWeights } = require('./requisitionWeights');

function totalMgOf(tx) {
  if (Array.isArray(tx.weights) && tx.weights.length) return sumWeights(tx.weights);
  const v = Number(tx.volumeDelta);
  return Number.isFinite(v) ? Math.abs(v) : 0;
}

function isoOrEmpty(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

/**
 * txs: lean StockTransaction (deduct/standard ที่ยังไม่ปิด)
 * standards: lean StockStandard (ต้องมีอย่างน้อย { code, frequency })
 */
function buildInUseItems(txs = [], standards = []) {
  const freqByCode = new Map(standards.map((s) => [String(s.code), String(s.frequency || '')]));
  return txs.map((tx) => {
    const frequency = freqByCode.get(String(tx.itemCode || '')) || '';
    const withdrawnAt = isoOrEmpty(tx.createdAt);
    const dueAt = withdrawnAt ? dueAtFor(withdrawnAt, frequency) : null;
    return {
      _id: String(tx._id),
      itemCode: tx.itemCode || '',
      itemName: tx.itemName || '',
      qrId: tx.qrId || '',
      weights: Array.isArray(tx.weights) ? tx.weights : [],
      totalMg: totalMgOf(tx),
      instrumentGroup: tx.instrumentGroup || null,
      note: tx.note || '',
      withdrawnAt,
      frequency,
      dueAt: dueAt ? dueAt.toISOString() : null,
      userEmail: tx.userEmail || '',
      userName: tx.userName || '',
    };
  });
}

/**
 * กดรับทราบหมดอายุได้เฉพาะคนที่เบิกรายการนั้น
 * ยกเว้น tx ที่ไม่มีทั้งอีเมลและชื่อผู้เบิก — ระบุเจ้าของไม่ได้ ใครก็รับทราบได้
 * (กติกาเดียวกับ canAcknowledge ฝั่ง FE — แก้ที่ไหนต้องแก้ทั้งคู่)
 */
function canAcknowledgeDeduction(tx, actorEmail) {
  if (!tx) return false;
  const owner = String(tx.userEmail || '').trim().toLowerCase();
  const ownerName = String(tx.userName || '').trim();
  if (!owner && !ownerName) return true;
  const me = String(actorEmail || '').trim().toLowerCase();
  return Boolean(owner) && owner === me;
}

module.exports = { buildInUseItems, canAcknowledgeDeduction };
