// helper สำหรับทิ้งขวดแบบ cascade (ทั้งขวด = ขวดแม่ + working ลูกทุกตัว)
function resolveCascadeRootId(unit) {
  return unit.kind === 'working' && unit.parentId ? unit.parentId : unit._id;
}

// คืน root + children ที่ยังไม่ถูกทิ้ง (idempotent: ข้ามตัว status 'discarded')
function selectDiscardTargets({ root, children }) {
  return [root, ...(children || [])].filter(Boolean).filter((u) => u.status !== 'discarded');
}

module.exports = { resolveCascadeRootId, selectDiscardTargets };
