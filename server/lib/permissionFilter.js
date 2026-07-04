const DENY_PREFIX = "deny:";

// A permission token is storable if it is a known group id / group path, any
// route-shaped string (`/...` — covers per-page 'others' entries that live only in
// the frontend PAGE_ITEMS), or a tab-deny token (`deny:/parent/key`). Everything
// else is dropped to keep the array clean.
function isStorablePermission(id, validIds) {
  if (typeof id !== "string") return false;
  return validIds.has(id) || id.startsWith("/") || id.startsWith(DENY_PREFIX);
}

module.exports = { isStorablePermission, DENY_PREFIX };
