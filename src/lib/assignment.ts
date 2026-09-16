// Identity match between a logged-in user and a petition's assignee.
//
// Petitions store `assignedTo` from the HR employee directory at assign time,
// so `assignedTo.name` is the directory display name. The logged-in user's
// `name`, however, comes from Azure AD (`syncedUser?.name ?? account.name`),
// which routinely differs from the directory name (title prefixes, EN vs TH,
// spacing, married-name changes). Matching on name alone silently hides a
// petition from the very person it was assigned to.
//
// The user↔employee link feature gives every user a stable HR `employeeId`, so
// match on that first and fall back to name only for users not yet linked.

export interface AssigneeRef {
  employeeId?: string;
  name?: string;
}

const DEV_LAB_ANALYZE_NAME = 'Dev Lab Analyze';
const DEV_LAB_ANALYST_NAME = 'Dev Lab Analyst';

export function assigneeNamesForUser(user: AssigneeRef | null | undefined): string[] {
  const names = new Set<string>();
  const name = user?.name?.trim();
  if (name) names.add(name);
  if (name === DEV_LAB_ANALYZE_NAME) names.add(DEV_LAB_ANALYST_NAME);
  return [...names];
}

/** True when `user` is the person `assignedTo` refers to. employeeId wins;
 *  name is a fallback for unlinked users. Returns false when either side is
 *  missing — never matches on two absent values. */
export function isAssignedTo(
  assignedTo: AssigneeRef | null | undefined,
  user: AssigneeRef | null | undefined,
): boolean {
  if (!assignedTo || !user) return false;
  if (user.employeeId && assignedTo.employeeId) {
    return assignedTo.employeeId === user.employeeId;
  }
  return Boolean(assignedTo.name && assigneeNamesForUser(user).includes(assignedTo.name));
}
