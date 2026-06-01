# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

This is a **two-process app**: a Vite/React frontend and an Express/MongoDB backend. Run both.

```bash
# Frontend (repo root) — Vite dev server on port 8000
npm run dev          # proxies /LIS/api and /LIS/uploads → http://localhost:3001
npm run lint         # ESLint
npm run test         # Vitest (run once)
npm run test:watch   # Vitest watch
npx tsc --noEmit     # Type-check (preferred over a full build — see Gotchas)
npx playwright test  # E2E tests (@playwright/test)

# Backend (cd server) — Express API on port 3001
cd server && npm run dev     # nodemon index.js
cd server && npm start       # node index.js (no reload)
cd server && npm run seed    # seed access-control data
```

⚠️ **Avoid `npm run build` during normal development** — its `postbuild` step rewrites root files and can disrupt the running dev/prod setup. Use `npx tsc --noEmit` to type-check. Only build when intentionally producing a production artifact (see Gotchas → Build & deploy).

## Architecture

**ICPLadda LIS** — a React SPA + Node API for laboratory information management (sample/petition tracking, lab & QC testing, approval, stock, daily checks, access control). Thai pharmaceutical/lab company internal tool. Most UI labels are in Thai.

**Frontend**: React 18 + TypeScript + Vite + Tailwind + shadcn/ui + TanStack React Query + React Router DOM v6
**Backend**: Express 4 + Mongoose 8 + MongoDB (`server/`), Multer for QC photo uploads

**Production base path is `/LIS/`** — enforced in `vite.config.ts` (`base: "/LIS/"`) and every `<BrowserRouter basename="/LIS">`. Frontend API base = `import.meta.env.BASE_URL + "api"` (see `src/lib/api.ts`). The backend mounts **every route twice** — at `/api/*` and `/LIS/api/*` (see `mountApi()` in `server/index.js`) — so it works both behind the `/LIS/` proxy and directly.

### Backend (`server/`)

- **Entry**: `server/index.js`. Connects to `MONGODB_URI` (default `mongodb://localhost:27017/LIS-DB`), then `loadAllModels()` + `ensureCollections()` auto-creates collections and runs `syncIndexes()` on boot. Config via `server/.env`.
- **Models** (`server/models/`): `Sample`, `Petition`, `PetitionAuditLog`, `LabRequest`, `SampleReceipt`, `PhysicalResult`, `QCTestResult`, `Approval`, `Stock`, `StockTransaction`, `RealtimeDensity`, `DailyCheck`, `Machine`, `Parameter`, `SimpleMethod`, `SimpleMethodExclusion`, `StandardConfig`, `MasterItemMeta`, `User`, `Role`, `AccessGroup`.
- **Routes** (`server/routes/`): mounted in `server/index.js` — `samples`, `petitions`, `lab-requests`, `sample-receipts`, `physical-results`, `qc-results`, `approvals`, `densities`, `stock`, `daily-checks`, `machines`, `parameters`, `master-items`, `master-item-meta`, `simple-methods`, `simple-method-exclusions`, `standard-configs`, `employees`, `uploads`, `auth`, `access-control`.
- **Uploads**: QC photos served from `server/uploads/` at `/uploads` and `/LIS/uploads`.
- **Data scripts**: `server/seed-access-control.js`, `export-data.js`, `import-data.js`, `sync-to-remote.js`; one-off migrations live in `server/scripts/` (e.g. `map-instruments-*.js` for GC/HPLC simple-method mapping).
- **Seed-data backup (DB is recoverable from git)**: `npm run seed:export` dumps every collection (dynamic `listCollections()`, so new models need no wiring) to `server/seed-data/*.json` as EJSON; `npm run seed:import` rebuilds a DB non-destructively from them. `scripts/auto-sync.ps1` runs `export-data.js` on the prod box each sync cycle, so live data (UI-entered rows **and** any new collection) is committed/pushed automatically — a DB wipe is restorable with `seed:import`. When adding a model or doing a manual data/config change off-cycle, run `npm run seed:export` and commit so `seed-data/` stays current.

### Authentication

Two auth modes; the switch is `DEV_MODE` in `src/config/dev.ts`:

- **Dev** (`DEV_MODE` = `import.meta.env.DEV && VITE_DEV_MODE !== "false"`, on by default in `npm run dev`): bypasses Microsoft login and injects a synthetic user (`synthesizeDevUser`). A **DevRoleSwitcher** lets you switch roles live to test permissions. Production builds set `import.meta.env.DEV = false`, so dev auth turns off automatically — no manual flag flip needed. To force-disable in dev, set `VITE_DEV_MODE=false`.
- **Production**: Azure AD (MSAL) via `src/lib/msalConfig.ts`, redirecting through a separate `auth.html` entry point. After login the user is synced via `POST /access-control/users/microsoft`, then permissions load from `GET /access-control`.

Auth state lives in `src/context/AuthContext.tsx`; access it through the `useAuth()` hook (`src/hooks/useAuth.ts`). A minimal Zustand store (`src/store/authStore.ts`) holds MSAL token state.

### Access Control

Permissions are **path-based**, not a fixed module matrix. `src/components/PrivateRoute.tsx` wraps protected routes and calls `userCanAccessPath()` (`src/lib/accessControl.ts`):

- `admin` role bypasses all checks.
- Otherwise a user's `permissions[]` is a mix of literal route paths (`/petitions`, supports `/*` wildcards and `:param` segments) and **permission-group IDs** backed by the `AccessGroup` model (each group is a named bundle of paths). A special `others` permission grants any path not claimed by another group.
- `useCanAccessPath()` (`src/hooks/useCanAccessPath.ts`) is the hook form, used for role-based show/hide in nav and home pages.

Route metadata (labels, icons, sidebar order) lives in `src/lib/navItems.ts`. Unauthorized access shows a Thai 403 message.

### Data Flow

- **Server state**: TanStack React Query (caching, refetching, mutations).
- **API layer**: `src/lib/api.ts` — thin `fetch()` wrapper; all endpoints defined here.
- **Global client state**: `SampleContext` (`src/context/SampleContext.tsx`) holds sample lists across pages; `NotificationContext` (`src/context/NotificationContext.tsx`) drives the bell + daily-check reminders.
- **Domain logic** (`src/lib/`): `petitionTestItems.ts` (centralized param↔item classification matching), `qcProgress.ts`, `substances.ts` (positional `+`-split parsing), `standardConfig.ts`, `revisionHelpers.ts` (QC reject/revision chains), `productClassification.ts`, `parameterValidation.ts`. Several have co-located `*.test.ts` (Vitest).

### UI Components

UI primitives come from shadcn/ui (`src/components/ui/`). Domain components live in `src/components/lis/`. Custom Tailwind colors use the `lis.*` prefix (e.g. `lis.sidebar`, `lis.status-*`).

**29 pages** under `src/pages/`. Major workflows:
- **Petitions**: list → new/edit → detail → **assign** (per-substance instrument picking) → audit log.
- **Testing**: Lab testing & QC testing (list + detail), record results, QC approval, queue TV displays.
- **Config/admin**: Master Items, Simple Method, Standard Config, Parameter Settings, Machines, Daily Check, Access Control, Admin Data, Stock / Stock Deduction, Reports, role-specific Home.

## Gotchas

- **Simple-method instruments are positional.** A `SimpleMethod` entry stores instruments as an array aligned to substance position (substances are split on `+`), **not** a flattened set. Any read must keep index alignment with `parseSubstances`. A `commonName` with no simple-method entry is a data gap that intentionally blocks petition assignment — do not auto-fix or add a fallback.
- **Build & deploy / dev-prod HTML split.** `prebuild`/`predev` run `scripts/restore-index.mjs`; `postbuild` runs `scripts/deploy-dist-to-root.mjs`. The root `index.html` must **always** be the Vite dev template (loads `/src/main.tsx`). Production is served from `app.html` (built, hashed assets): `.htaccess` uses **`mod_rewrite` only** (no `DirectoryIndex` — an unpermitted one 500s the whole dir) to map the directory root and any `index.html` request → `app.html`, plus the SPA fallback → `app.html`. `npm run build` copies `dist/` to root, renames the built `index.html` → `app.html`, and restores `index.html` to the dev template. `auto-sync.ps1` commits & pushes the prod root files hourly. Because of this, a stray `npm run build` can leave the dev server broken — prefer `npx tsc --noEmit`.
- **Backend must be running** for the app to do anything; the frontend proxies to port 3001. A 404 on `/LIS/api/...` usually means the server isn't up.

### TypeScript

`tsconfig.json` is lenient (`noImplicitAny: false`, `strictNullChecks: false`). Path alias `@/*` → `src/*`.
