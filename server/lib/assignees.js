// Petition-assign assignee helpers.
//
// Assignees come from two sources, unioned: (1) HR monthly employees in the
// Lab/วิเคราะห์ department, and (2) LIS users who hold a lab-analyst role —
// so anyone with that role can be assigned (and then see their lab-testing
// queue) regardless of their HR department.

// Canonical role id is `lab-analyst`; some user docs carry the legacy/typo
// `lab-analyze`. Match both by prefix.
const LAB_ANALYST_ROLE_RX = /^lab-analy/;

/** True when any of the user's roles is a lab-analyst-type role. */
function hasLabAnalystRole(roles) {
  return Array.isArray(roles) && roles.some((r) => LAB_ANALYST_ROLE_RX.test(String(r || '')));
}

/** Map a User doc to the assignee shape used by the /petitions/assign picker.
 *  empType 'role' marks it as role-sourced (not from the HR monthly list). */
function userToAssignee(user) {
  return {
    id: 0,
    employeeId: String(user.employeeId || '').trim(),
    name: String(user.name || '').trim(),
    department: user.department || '',
    position: user.position || '',
    empType: 'role',
    isActive: (user.status || 'active') !== 'inactive',
  };
}

/** Union HR-department assignees with role-based ones, deduped. HR entries are
 *  listed first so they win dedupe (richer empType/department kept). Dedupe by
 *  employeeId when present, else by case-insensitive name. Entries with neither
 *  an employeeId nor a name are dropped (can't be assigned/matched). */
function mergeAssignees(deptAssignees, roleAssignees) {
  const seenEmp = new Set();
  const seenName = new Set();
  const out = [];
  for (const a of [...deptAssignees, ...roleAssignees]) {
    const emp = String(a.employeeId || '').trim();
    const name = String(a.name || '').trim().toLowerCase();
    if (emp) {
      if (seenEmp.has(emp)) continue;
    } else if (name) {
      if (seenName.has(name)) continue;
    } else {
      continue;
    }
    if (emp) seenEmp.add(emp);
    if (name) seenName.add(name);
    out.push(a);
  }
  return out;
}

module.exports = { LAB_ANALYST_ROLE_RX, hasLabAnalystRole, userToAssignee, mergeAssignees };
