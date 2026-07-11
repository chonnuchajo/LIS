const { normalizeRoles } = require('./roles');

const LAB_BASE_ROLE = 'lab-analyze';
const QC_BASE_ROLE = 'qc-staff';

function normalizeRoleFamily(value) {
  const family = String(value ?? '').trim().toLowerCase();
  return family === 'lab' || family === 'qc' ? family : '';
}

function normalizeRoleId(value) {
  return String(value ?? '').trim().toLowerCase();
}

function roleFamilyForId(roleId, explicitFamily) {
  const family = normalizeRoleFamily(explicitFamily);
  if (family) return family;
  const id = normalizeRoleId(roleId);
  if (id === 'lab' || id.startsWith('lab-') || id.startsWith('lab_')) return 'lab';
  if (id === 'qc' || id.startsWith('qc-') || id.startsWith('qc_')) return 'qc';
  return '';
}

function baseRoleForFamily(family) {
  const normalized = normalizeRoleFamily(family);
  if (normalized === 'lab') return LAB_BASE_ROLE;
  if (normalized === 'qc') return QC_BASE_ROLE;
  return '';
}

function docsById(roleDocs) {
  const map = new Map();
  for (const doc of Array.isArray(roleDocs) ? roleDocs : []) {
    const id = normalizeRoleId(doc?.id);
    if (id) map.set(id, doc);
  }
  return map;
}

function stableUniqueRoleIds(values) {
  const seen = new Set();
  const out = [];
  for (const value of Array.isArray(values) ? values : []) {
    const id = normalizeRoleId(value);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function mergeBaseRolesForFamilies(roleIds, roleDocs = []) {
  const merged = stableUniqueRoleIds(roleIds);
  const seen = new Set(merged);
  const byId = docsById(roleDocs);
  const baseRoles = [];

  for (const id of merged) {
    const doc = byId.get(id);
    const family = roleFamilyForId(id, doc?.family);
    const baseRole = baseRoleForFamily(family);
    if (baseRole && !seen.has(baseRole)) {
      seen.add(baseRole);
      baseRoles.push(baseRole);
    }
  }

  return [...merged, ...baseRoles];
}

function applyBaseRolesToUser(user, roleDocs = []) {
  if (!user) return user;
  user.roles = mergeBaseRolesForFamilies(normalizeRoles(user), roleDocs);
  return user;
}

module.exports = {
  LAB_BASE_ROLE,
  QC_BASE_ROLE,
  normalizeRoleFamily,
  roleFamilyForId,
  baseRoleForFamily,
  mergeBaseRolesForFamilies,
  applyBaseRolesToUser,
};
