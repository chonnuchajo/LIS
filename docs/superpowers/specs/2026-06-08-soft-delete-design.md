# Soft Delete — Design

**Date:** 2026-06-08
**Branch:** develop
**Status:** Approved (design), pending implementation plan

## Problem

Every delete endpoint in the backend is a **hard delete** (`findByIdAndDelete`,
`deleteOne`, `deleteMany`, `findOneAndDelete`). Deleting a Petition even cascades
`deleteMany` into Sample, PhysicalResult, Approval and RealtimeDensity — data is
gone for good. We want deletions to be recoverable: removed rows should be hidden
from the app but stay in the database.

## Goal & Scope

- Convert **all DB delete endpoints** to soft delete (mark hidden, keep the row).
- **Hide-only** scope: no restore/purge UI for now. Recovery is done directly in
  the DB / by an admin. A restore UI can be a later follow-up.
- Frontend untouched — the API hides deleted rows, so the UI already behaves.

### Out of scope (stay hard delete)
- **Upload deletes** (`uploads.js` `qc-photo`, `param-file`) — these remove real
  files on disk, not DB rows.
- **masterItems delete** (`masterItems.js`) — forwards to an ERP webhook we don't
  control.
- **StockUnit discard** — already a soft pattern (`status: 'discarded'` +
  `discardedAt/discardedBy/discardReason`). Left as-is.

## Approach

Chosen: **Mongoose plugin + query middleware.** One shared plugin adds the
soft-delete fields and auto-filters reads. The read side needs **zero** changes,
which removes the risk of forgetting a filter and leaking deleted rows. (There is
no `aggregate()` usage in any route, so query hooks cover every read path.)

Rejected:
- *Manual per-route filters* — must touch every read query; easy to miss → leaks.
- *Archive collection* — much more code per entity and harder recovery;
  overkill for a hide-only requirement.

## Design

### 1. Shared plugin — `server/lib/softDelete.js`

Adds to each schema it's applied to:

- **Fields:** `deletedAt: Date | null` (default `null`), `deletedBy: String`.
- **Query pre-hooks** on `find`, `findOne`, `findOneAndUpdate`,
  `findOneAndReplace`, `count`, `countDocuments`, `updateOne`, `updateMany`:
  inject `deletedAt: null` into the filter unless the query was given the
  `withDeleted` option (`Model.find(...).setOptions({ withDeleted: true })`),
  so admin/maintenance code can still see deleted rows.
- **Instance method** `doc.softDelete(by)` — sets `deletedAt = new Date()`,
  `deletedBy = by`, saves.
- **Static** `Model.softDeleteMany(filter, by)` — `updateMany` setting
  `deletedAt`/`deletedBy` on all matching live rows.

Applied **explicitly per model** (`schema.plugin(softDelete)` before
`mongoose.model(...)`), **not** as a global `mongoose.plugin`, so embedded
subdocument schemas (e.g. `PetitionItemSchema`) don't get polluted with stray
`deletedAt` fields.

### 2. Models that get the plugin

Endpoint-backed deletes plus Petition cascade targets:

`Petition`, `Sample`, `PhysicalResult`, `Approval`, `RealtimeDensity`,
`LabRequest`, `Machine`, `Parameter`, `Method`, `StandardConfig`,
`MasterItemMeta`, `CommonNameOverride`, `SimpleMethodExclusion`,
`StockStandard`, `StockSolvent`, `StockGlassware`, `User`, `Role`, `AccessGroup`.

Excluded: `StockUnit` (own discard pattern), `PetitionAuditLog` (append-only),
`TempHum` (in-memory live cache).

### 3. Delete routes → soft delete

Replace the hard-delete call in each route, keeping existing audit logging:

| Route | Was | Becomes |
|---|---|---|
| `petitions.js:611` | `findByIdAndDelete` + cascade `deleteMany` ×4 | load doc → `softDelete(actor)`; cascade via `softDeleteMany` ×4 (Sample, PhysicalResult, Approval, RealtimeDensity) |
| `samples.js:51` | `findOneAndDelete` | load → `softDelete` |
| `labRequests.js:102` | `findByIdAndDelete` | load → `softDelete` |
| `machines.js:48` | `findByIdAndDelete` | load → `softDelete` |
| `parameters.js:51` | `findByIdAndDelete` | load → `softDelete` |
| `methods.js:100` | `findByIdAndDelete` | load → `softDelete` |
| `standardConfigs.js:147` | `findByIdAndDelete` | load → `softDelete` |
| `masterItemMeta.js:71` | `deleteOne` | `softDeleteMany({itemNo}, actor)` |
| `commonNameOverrides.js:43` | `findByIdAndDelete` | load → `softDelete` |
| `simpleMethodExclusions.js:39` | `findByIdAndDelete` | load → `softDelete` |
| `densities.js:29` | `findOneAndDelete` | load → `softDelete` |
| `stock.js:124/480/608` | `findByIdAndDelete` ×3 | load → `softDelete` |
| `accessControl.js:308/335/430` | `deleteOne` ×3 (User/Role/AccessGroup) | load → `softDelete` |

The `deletedBy` value comes from the request's actor (`req.query.actor` /
current user), `'system'` when absent — matching the existing audit-log actor
convention.

Note: `standardConfigs.js:36` does a maintenance `deleteMany` (prune configs whose
instrument no longer exists). Treated as system cleanup → convert to
`softDeleteMany` for consistency.

### 4. Unique indexes → partial

Models that are soft-deletable **and** have a `unique` index need the unique
constraint scoped to live rows only, so re-creating a value after a soft delete
doesn't collide with the hidden row. Convert these to
**partial unique indexes** with `partialFilterExpression: { deletedAt: null }`:

- `Petition.petitionNo`
- `Sample.id`
- `Approval.sampleId`, `PhysicalResult.sampleId`, `RealtimeDensity.sampleId`
- `LabRequest.labRequestNo`
- `Machine.code`
- `Method.code`
- `StandardConfig` (compound unique)
- `MasterItemMeta.itemNo`
- `CommonNameOverride.rawKey`
- `SimpleMethodExclusion` (compound `{pattern, matchType}`)
- `StockStandard.code`, `StockSolvent.code`, `StockGlassware.code`
- `User.email`
- `Role.id`
- `AccessGroup.id`

`syncIndexes()` runs on boot (`ensureCollections` in `server/index.js`), so the
old plain-unique indexes are dropped and rebuilt as partial automatically.

### 5. Data backup / export

No change. Soft-deleted rows remain in their collections, so `seed:export`
(`auto-sync.ps1` hourly) backs them up too — which is exactly what we want for
recovery.

## Testing

- Unit tests for the plugin: `softDelete()` sets fields; `find`/`findOne`/`count`
  exclude soft-deleted rows; `withDeleted` option includes them;
  `softDeleteMany` marks the right set.
- Per-entity smoke: delete via endpoint → row hidden from list/get; row still in
  DB with `deletedAt` set.
- Petition cascade: deleting a petition hides its Sample/PhysicalResult/
  Approval/RealtimeDensity from reads.
- Partial-index: soft-delete a record, create a new one with the same unique
  value → succeeds; two live records with the same value still rejected.

## Risks / Notes

- **Reads via `aggregate`** would bypass the hooks — none exist in routes today;
  if added later they must filter `deletedAt: null` manually.
- **`lean()` reads** still pass through the `find` hook, so they're covered.
- No restore UI: an accidental delete is recovered by unsetting `deletedAt` in the
  DB. Acceptable for this scope; revisit if it happens often.
