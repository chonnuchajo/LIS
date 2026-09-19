// Pages introduced after the original access-control seed. Databases seeded
// before these pages existed won't have them in any group, so ensureGroups()
// gives them a default home in the 'stock' group on load — but ONLY while no
// group claims them yet.
//
// This MUST stay an orphan-only backfill. Forcing these paths into 'stock'
// unconditionally (the previous behaviour) made it impossible to move the
// pages to another group: any regrouping snapped back to 'stock' on the next
// reload. That was the root cause of the "can't manage Simple Method in
// grouping" bug.
const BACKFILL_PATHS = ['/simple-method', '/machines'];
const PETITION_BACKFILL_PATHS = ['/petition', '/petition/:id'];

const DEFAULT_ACCESS_GROUPS = [
  { id: 'dashboard', name: 'หน้าหลัก', description: 'ภาพรวมแล็บและงานที่กำลังดำเนินการ', paths: ['/', '/home', '/dashboard/lab'], locked: false, sortOrder: 10 },
  { id: 'samples', name: 'งานตัวอย่าง', description: 'รับ ส่ง และตรวจกายภาพตัวอย่าง', paths: ['/petition', '/petition/:id', '/petitions/new', '/physical-inspection'], locked: false, sortOrder: 20 },
  { id: 'audit-log', name: 'Audit Log', description: 'ประวัติการเปลี่ยนสถานะคำร้อง', paths: ['/adutuilog', '/auditlog'], locked: false, sortOrder: 25 },
  { id: 'results', name: 'ผลวิเคราะห์', description: 'บันทึกผลและมาตรฐาน', paths: ['/record-results', '/stock-deduction', '/daily-check'], locked: false, sortOrder: 30 },
  { id: 'qc', name: 'ควบคุมคุณภาพ', description: 'อนุมัติหรือปฏิเสธผล', paths: ['/dashboard/qc', '/qc-approval', '/coa', '/coa/:id'], locked: false, sortOrder: 40 },
  { id: 'stock', name: 'สต๊อก', description: 'จัดการ standard ตัวทำละลาย master item simple method และเครื่องมือ', paths: ['/stock', '/master-items', '/simple-method', '/machines'], locked: false, sortOrder: 50 },
  { id: 'reports', name: 'รายงาน', description: 'ดูรายงานและส่งออกข้อมูล', paths: ['/report'], locked: false, sortOrder: 60 },
  { id: 'admin', name: 'ข้อมูลแอดมิน', description: 'ข้อมูลที่อนุมัติแล้วและบันทึกการใช้งาน', paths: ['/admin-data'], locked: false, sortOrder: 70 },
  { id: 'access', name: 'สิทธิ์เข้าใช้งาน', description: 'จัดการผู้ใช้ บทบาท และสิทธิ์', paths: ['/access-control', '/settings'], locked: false, sortOrder: 80 },
  { id: 'others', name: 'อื่นๆ', description: 'หน้าที่ยังไม่ถูกกำหนดกลุ่ม (รับช่วงต่ออัตโนมัติเมื่อลบกลุ่มอื่น)', paths: [], locked: true, sortOrder: 999 },
];

// Returns the subset of candidatePaths that no group currently claims. Those
// are the only paths safe to auto-add; anything already assigned to a group is
// left untouched so admins can freely regroup it.
function findOrphanBackfillPaths(groups, candidatePaths = BACKFILL_PATHS) {
  const assigned = new Set(
    (groups || []).flatMap((group) => (group && group.paths) || []),
  );
  return candidatePaths.filter((path) => !assigned.has(path));
}

function findGroupForBackfill(groups, preferredGroupId, anchorPath) {
  const safeGroups = groups || [];
  const anchored = safeGroups.find((group) => ((group && group.paths) || []).includes(anchorPath));
  if (anchored) return anchored.id;
  const preferred = safeGroups.find((group) => group && group.id === preferredGroupId);
  return preferred ? preferred.id : null;
}

module.exports = {
  BACKFILL_PATHS,
  DEFAULT_ACCESS_GROUPS,
  PETITION_BACKFILL_PATHS,
  findOrphanBackfillPaths,
  findGroupForBackfill,
};
