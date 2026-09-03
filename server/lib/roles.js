// Mirror of src/lib/roles.ts — keep in sync. One user can hold several roles;
// permissions union over all of them, single-behaviour branches use the primary.

const ROLE_PRIORITY = {
  viewer: 0,
  admin: 10,
  'qc-head': 9,
  'lab-head': 8,
  'lab-analyze': 5,
  'qc-staff': 5,
};

const ADMIN_ROLE_ID = 'admin';
const DENY_PREFIX = 'deny:';

function roleRank(role) {
  return ROLE_PRIORITY[role] ?? 4;
}

function primaryRole(roles) {
  if (!roles || roles.length === 0) return 'viewer';
  let best = roles[0];
  let bestRank = roleRank(best);
  for (let i = 1; i < roles.length; i += 1) {
    const rank = roleRank(roles[i]);
    if (rank > bestRank) {
      best = roles[i];
      bestRank = rank;
    }
  }
  return best;
}

function normalizeRoles(user) {
  if (!user) return [];
  if (Array.isArray(user.roles) && user.roles.length > 0) return user.roles;
  if (user.role) return [user.role];
  return [];
}

function unionPermissions(roles, permsByRole) {
  const adminMode = roles.includes(ADMIN_ROLE_ID);
  const sourceRoles = adminMode
    ? roles.concat(Object.keys(permsByRole).filter((role) => !roles.includes(role)))
    : roles;
  const seen = new Set();
  const out = [];
  for (const role of sourceRoles) {
    for (const perm of permsByRole[role] || []) {
      if (adminMode && perm.startsWith(DENY_PREFIX)) continue;
      if (!seen.has(perm)) {
        seen.add(perm);
        out.push(perm);
      }
    }
  }
  return out;
}

module.exports = { primaryRole, normalizeRoles, unionPermissions };
