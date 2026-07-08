'use strict';
// รวม/ตรวจ mg รายน้ำหนัก (mirror ของ FE src/lib/standardRequisition.ts)

function sumWeights(weights) {
  if (!Array.isArray(weights)) return 0;
  return weights.reduce((s, w) => {
    const n = Number(w);
    return Number.isFinite(n) ? s + n : s;
  }, 0);
}

// '' = ผ่าน; ไม่งั้นข้อความ error (คงคำเดียวกับ planDeductMg เพื่อ UX สม่ำเสมอ)
function validateWeights(weights, remainingMg) {
  if (!Array.isArray(weights) || weights.length === 0) return 'จำนวน mg ไม่ถูกต้อง';
  for (const w of weights) {
    const n = Number(w);
    if (!Number.isFinite(n) || n <= 0) return 'จำนวน mg ไม่ถูกต้อง';
  }
  if (sumWeights(weights) > Number(remainingMg)) return 'ปริมาณคงเหลือไม่พอ';
  return '';
}

module.exports = { sumWeights, validateWeights };
