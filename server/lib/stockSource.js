'use strict';

// แหล่งความจริงเดียวของตรรกะ "ที่มาของขวด" (primary / supply)
// '' = ไม่ทราบ/ยังไม่ระบุ (เช่น ขวด working tier เก่าที่ migrate มาตรงๆ)

const RECEIVE_SOURCES = Object.freeze(['primary', 'supply']);
// ค่าที่เก็บได้บนขวด: รวม '' (ไม่ระบุ) — ใช้ตอนแก้ไขรายขวด
const UNIT_SOURCES = Object.freeze(['primary', 'supply', '']);

function isValidReceiveSource(v) {
  return RECEIVE_SOURCES.includes(v);
}

// ค่า source ที่ยอมรับให้เซ็ตบนขวด (รวมเคลียร์เป็น '')
function isValidUnitSource(v) {
  return UNIT_SOURCES.includes(v);
}

// map ชื่อ tier เดิม (StockStandard) → source ของขวด
function tierSourceFor(tierName) {
  if (tierName === 'primary') return 'primary';
  if (tierName === 'supplier') return 'supply';
  return ''; // working หรืออื่นๆ = ไม่ทราบ
}

// ขวด sealed ที่เรียงตามลำดับ insertion เดิม (primary ก่อน แล้ว supplier):
// ตัวแรก primaryQty ใบ → 'primary', ที่เหลือ → 'supply'
function assignSealedSources(sealedCount, primaryQty) {
  const count = Math.max(0, Math.floor(Number(sealedCount) || 0));
  const p = Math.max(0, Math.floor(Number(primaryQty) || 0));
  return Array.from({ length: count }, (_, i) => (i < p ? 'primary' : 'supply'));
}

module.exports = { RECEIVE_SOURCES, UNIT_SOURCES, isValidReceiveSource, isValidUnitSource, tierSourceFor, assignSealedSources };
