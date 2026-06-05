// Decide the value to persist for an HR field (department/position) when a
// Microsoft login syncs the user.
//
// Rules, in priority order:
//   1. A fresh, non-empty value from Microsoft Graph wins.
//   2. Otherwise keep whatever is already stored — this protects values an
//      admin set by hand in Access Control from being wiped when Graph has no
//      department/jobTitle for the user.
//   3. Only fall back to 'Unassigned' when nothing at all is known.
function resolveHrField(incoming, existing) {
  const fresh = typeof incoming === 'string' ? incoming.trim() : '';
  if (fresh) return fresh;
  const current = typeof existing === 'string' ? existing.trim() : '';
  if (current) return current;
  return 'Unassigned';
}

module.exports = { resolveHrField };
