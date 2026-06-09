# Design: ผูก LIS user ↔ รหัสพนักงาน (employeeId linking)

**Date:** 2026-06-09
**Status:** Approved (design), pending implementation plan
**Branch:** develop

## Problem

LIS users authenticate by **email** (Microsoft login) and are stored in the `users`
collection without any link to the company employee master. Meanwhile the frontend
already references `user.employeeId` in several places (`PetitionDetailPage`,
`PetitionListPage`, `HomeLab`) — but `AuthUser` never carries an `employeeId`, so
those values are always `undefined` and the dependent features (e.g. "ใบคำร้องที่ฉันส่ง",
assignee-self matching) silently do nothing.

We want each user to be linked to an employee record (`employeeId`), so that:
- `user.employeeId` becomes real and the existing dependent features activate.
- Department/Position are sourced from the authoritative HR employee record once linked.

## Goal & Scope

- **Auto-link by email first, manual entry as fallback.**
- Auto-link runs **on Microsoft login/sync** AND via a **"Sync พนักงาน" button** in AccessControl.
- When linked, store `employeeId` and source **department/position from the employee record**.
- Employee scope for both matching and the manual picker: **active + `emp_type === 'รายเดือน'` (monthly), all departments.**

### Out of scope
- No local employee cache collection (employees are fetched live from the webhook).
- No changes to daily-worker (`รายวัน`) handling — they don't log into LIS.
- No change to the assignee picker in `/petitions/assign` (`/employees/assignees` keeps its Lab filter).

## Data Source

n8n employee webhook: `https://n8n-plant.icpladda.com/webhook/api/employee`
(already used by `server/routes/employees.js`). Each row includes `employee_id`,
`name`, `department`, `position`, `emp_type`, `is_active`, and **`email`** (populated
for monthly staff, `null` for daily). Fetched live each time (Approach A — matches the
existing proxy pattern; employee set is small; webhook outage just skips that round and
never wipes already-linked data).

## Design

### 1. Backend — employee directory endpoint (`server/routes/employees.js`)

- Extend `normalizeEmployee` to include `email: String(row.email ?? '').trim().toLowerCase()`.
- Extract a shared helper `fetchMonthlyEmployees()` that fetches, normalizes, and filters
  to `isActive && empType === 'รายเดือน'` (all departments), so the directory, the
  auto-link resolver, and the manual link all use one fetch+normalize path.
- `GET /employees/directory` → returns `{ employeeId, name, department, position, email }[]`
  for monthly active employees, sorted by department then name. Used by the manual picker.
- `/employees/assignees` keeps its existing `ALLOWED_DEPARTMENTS` (Lab) filter — unchanged
  behavior, but refactored to reuse the shared fetch/normalize where practical.

### 2. Backend — User model (`server/models/User.js`)

- Add `employeeId: { type: String, default: '' }`.
- Add a **sparse** unique index on `{ employeeId, deletedAt }` so a non-empty employeeId
  maps to at most one active user (empty strings excluded). Pair the app-level duplicate
  check (below) with this index as the backstop.

### 3. Backend — auto-link on login/sync (`POST /access-control/users/microsoft`)

After the user is resolved/created:
- If `!user.employeeId`: call `fetchMonthlyEmployees()` and find the employee whose
  `email` equals the user's (lowercased) email.
  - **Match:** set `user.employeeId`, and set `user.department` / `user.position` from the
    employee record (employee = source of truth, overrides Graph values).
  - **No match:** leave `employeeId` empty and fall back to existing `resolveHrField`
    Graph-based department/position behavior.
- **Precedence:** auto-link only fills when `employeeId` is empty — it never overwrites a
  value an admin set manually, and re-running sync won't clobber manual links.
- Webhook failure must be **non-fatal**: wrap the fetch in try/catch so login never breaks
  if the webhook is down; that round simply skips auto-linking.

### 4. Backend — manual link + bulk sync (`server/routes/accessControl.js`)

- Extend `PATCH /users/:id` to accept `employeeId`:
  - Non-empty: look up the employee in the monthly directory by `employeeId`. If found,
    also set `department`/`position` from the record. If the `employeeId` is already used
    by another (active) user → **409**.
  - Empty string: clears the link (unlink). Department/position retain their last values
    (not reset) unless explicitly changed.
- New `POST /users/sync-employees` (admin): iterate users with empty `employeeId`, match by
  email against the monthly directory, and set `employeeId` + `department` + `position` for
  matches. Returns counts `{ linked, alreadyLinked, unmatched }`. Powers the button.
- `formatUser` includes `employeeId` in its output.

### 5. Frontend — AuthContext / type (`src/context/AuthContext.tsx`, `src/config/dev.ts`)

- Add `employeeId?: string` to `AuthUser`.
- Populate it from the synced user object (Microsoft sync response and production-token
  path). Dev mode keeps its synthetic `employeeId` (`DEV-${role.id}`).
- This is the change that activates the existing `user.employeeId` consumers.

### 6. Frontend — AccessControl UI (`src/pages/AccessControl.tsx`)

- Add `employeeId` to the local `User` type and `formatUser` mapping.
- User row: display `employeeId` under the email (or a dedicated column), with a link/edit
  action opening a **searchable picker** populated from `GET /employees/directory` (monthly).
  Selecting links the user (PATCH `employeeId`); a clear action unlinks. Department/Position
  remain read-only and reflect the record after linking.
- Add a **"Sync พนักงาน"** button (admin) → `POST /users/sync-employees`, then refetch and
  show a toast summarizing `{ linked, alreadyLinked, unmatched }`.
- Surface the 409 duplicate error as a clear Thai message.

### 7. Seed / persistence

`employeeId` lives in the `users` collection and is covered by the existing `seed:export`.
Run `npm run seed:export` and commit after the first real linking pass so `seed-data/`
stays current (per the off-cycle data-change convention).

## Testing

- **Unit:** email-matching helper (case-insensitive match, no-match, webhook-down →
  graceful skip); `normalizeEmployee` email normalization.
- **Backend routes:** auto-link on Microsoft sync (match / no-match / webhook-down);
  `PATCH employeeId` (link sets dept+position, duplicate → 409, empty clears);
  `sync-employees` returns correct counts; precedence (auto does not overwrite manual).
- **Frontend:** `AuthContext` exposes `employeeId`; AccessControl picker links/clears and
  the sync button reports results.

## Open decisions (resolved)

- One employee ↔ one user enforced via sparse unique index + app-level 409. ✅
- Auto-link never overwrites a manually-set link; re-sync is non-destructive. ✅
