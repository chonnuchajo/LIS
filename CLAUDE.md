# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server on port 8000
npm run build        # Production build (runs prebuild first)
npm run build:dev    # Build in development mode
npm run lint         # ESLint
npm run test         # Run tests once (Vitest)
npm run test:watch   # Run tests in watch mode
npm run preview      # Preview production build
```

## Architecture

**ICPLadda LIS** — a React SPA for laboratory information management (sample tracking, QC approval, stock, access control). Thai pharmaceutical/lab company internal tool.

**Stack**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + TanStack React Query + React Router DOM v6

**Production base path is `/LIS/`** — enforced in `vite.config.ts` and all `<BrowserRouter basename="/LIS">` usage. API calls construct their base via `import.meta.env.BASE_URL + "api"`. Dev server proxies `/LIS/api` → `http://localhost:3001`.

### Authentication

Two auth modes controlled by `src/config/dev.ts`:

- **DEV_MODE = true** (currently on): bypasses Microsoft login, injects a hardcoded dev user (`dev@icpladda.com`, role `admin`). **Must be set to `false` before any production deployment.**
- **Production**: Azure AD (MSAL) via `src/lib/msalConfig.ts`. Login redirects through a separate `auth.html` entry point. After login, the user is synced to the backend via `POST /access-control/users/microsoft`, and permissions are fetched from `GET /access-control`.

Auth state lives in `src/context/AuthContext.tsx`. The `useAuth()` hook from `src/hooks/useAuth.ts` is the standard way to access user/permissions.

### Access Control

`src/components/PrivateRoute.tsx` wraps all protected routes. It checks the user's role against a module permission matrix fetched from the backend. Module IDs: `dashboard`, `samples`, `qc`, `results`, `stock`, `reports`, `admin`, `access`. Unauthorized access shows a Thai-language 403 message.

Permission utilities live in `src/lib/accessControl.ts`.

### Data Flow

- **Server state**: TanStack React Query (caching, refetching, mutations)
- **Global client state**: `SampleContext` (`src/context/SampleContext.tsx`) holds sample lists across pages (sent, testing, done, approvals)
- **API layer**: `src/lib/api.ts` — thin `fetch()` wrapper, all backend endpoints defined here
- **Local auth state**: Zustand store in `src/store/authStore.ts` (minimal, mostly for MSAL token state)

### UI Components

All UI primitives are from shadcn/ui (`src/components/ui/`). Domain-specific components are in `src/components/lis/`. Custom Tailwind theme colors use the `lis.*` prefix (e.g., `lis.sidebar`, `lis.status-*`).

The app has 28 pages under `src/pages/`. Major workflows: sample submission → physical inspection → result recording → QC approval → reporting. Stock management and petition workflows are separate feature areas.

### TypeScript

`tsconfig.json` uses lenient settings (`noImplicitAny: false`, `strictNullChecks: false`). Path alias `@/*` maps to `src/*`.
