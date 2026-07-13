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
  const preferred = safeGroups.find((group) => group && group.id === preferredGroupId);
  if (preferred) return preferred.id;
  const anchored = safeGroups.find((group) => ((group && group.paths) || []).includes(anchorPath));
  return anchored ? anchored.id : null;
}

module.exports = { BACKFILL_PATHS, findOrphanBackfillPaths, findGroupForBackfill };
