// Mirror of src/lib/roles.ts — keep in sync. One user can hold several roles;
// permissions union over all of them, single-behaviour branches use the primary.

function roleRank(role) {
  if (role === 'admin') return 4;
  if (role === 'qc' || role.startsWith('qc-') || role.startsWith('qc_')) return 3;
  if (role === 'lab' || role.startsWith('lab-') || role.startsWith('lab_')) return 2;
  if (role === 'viewer') return 0;
  return 1;
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
  const seen = new Set();
  const out = [];
  for (const role of roles) {
    for (const perm of permsByRole[role] || []) {
      if (!seen.has(perm)) {
        seen.add(perm);
        out.push(perm);
      }
    }
  }
  return out;
}

module.exports = { primaryRole, normalizeRoles, unionPermissions };
