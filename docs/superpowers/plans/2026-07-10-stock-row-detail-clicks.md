# Stock Row Detail Clicks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/LIS/stock` rows open details by single click or double click across Standards, Solvents, and Glassware.

**Architecture:** Reuse the existing Standards drawer. Add small local sheet components for Solvents and Glassware in `Stock.tsx`, with tab state storing selected ids and deriving selected items from query data.

**Tech Stack:** React, TypeScript, TanStack Query, shadcn Sheet/Dialog/Table/Button, Vitest, React Testing Library.

## Global Constraints

- Do not run `npm run build`, `npm run build:dev`, `npm run build:watch`, `vite build`, or equivalent build commands.
- Do not run scripts that indirectly trigger the build or `postbuild` workflow.
- Use `npx vitest run` or focused npm test/lint/typecheck commands for validation.

---

### Task 1: Stock Row Interaction Tests

**Files:**
- Modify: `src/pages/__tests__/Stock.delete.test.tsx`

**Interfaces:**
- Consumes: mocked `StockPage` and mocked API methods in the existing test file.
- Produces: failing tests that describe the requested row interaction behavior.

- [ ] **Step 1: Add fixture data for one standard, one solvent, and one glassware item**

Use the existing `beforeEach` API mocks and add `getSolvents` and `getGlassware` results with deterministic names.

- [ ] **Step 2: Add tests for single click and double click**

Assert that row clicks open detail content for Standards, Solvents, and Glassware.

- [ ] **Step 3: Run focused test and verify failure**

Run: `npx vitest run src/pages/__tests__/Stock.delete.test.tsx`

Expected before implementation: Solvents/Glassware detail tests fail because no detail sheet exists.

### Task 2: Stock Row Detail Implementation

**Files:**
- Modify: `src/pages/Stock.tsx`

**Interfaces:**
- Consumes: `StockSolventItem`, `StockGlasswareItem`, existing `SimpleMoveDialog`, `SimpleItemDialog`, `DeleteConfirmDialog`.
- Produces: row click handlers and detail sheet components for solvent and glassware items.

- [ ] **Step 1: Add selected id state to SolventsTab and GlasswareTab**

Store selected row ids and derive selected items from query data.

- [ ] **Step 2: Add row `onClick` and `onDoubleClick` handlers**

Rows call the same setter for single and double click. Row action buttons call `event.stopPropagation()`.

- [ ] **Step 3: Render solvent and glassware detail sheets**

Use shadcn `Sheet` with accessible titles, details, receive button, and edit button.

- [ ] **Step 4: Run focused test and verify pass**

Run: `npx vitest run src/pages/__tests__/Stock.delete.test.tsx`

Expected after implementation: all stock page row interaction tests pass.

### Task 3: Verification

**Files:**
- No source changes unless verification exposes an issue.

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`

Expected: typecheck passes without build output.

- [ ] **Step 2: Review changed files**

Run: `git diff -- src/pages/Stock.tsx src/pages/__tests__/Stock.delete.test.tsx docs/superpowers/specs/2026-07-10-stock-row-detail-clicks-design.md docs/superpowers/plans/2026-07-10-stock-row-detail-clicks.md`

Expected: diff is scoped to requested behavior.
