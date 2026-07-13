# Dashboard KPI Card Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Arrange every dashboard KPI row according to the requested total-card desktop patterns while retaining two cards per mobile row.

**Architecture:** `KpiRow` derives its desktop grid from the count of rendered KPI and Daily Check cards. Default cards use three or four desktop grid columns; widget cards use six or eight grid tracks because each widget spans two tracks on desktop. Widget and Daily Check spans become desktop-only so both occupy one of the two mobile columns.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest, Testing Library.

## Global Constraints

- Count all KPI cards and the optional Daily Check card.
- Mobile is always two columns.
- Desktop patterns are: `1-4 = 4`; `5 = 3+2`; `6 = 3+3`; `7 = 4+3`; `8 = 4+4`; `9 = 3+3+3`; `10 = 4+4+2`; `11 = 4+4+3`.
- Counts greater than eleven use four desktop columns.
- Do not change KPI data, dashboard roles, API behavior, or card content.
- Do not run `npm run build`, `vite build`, or any command that triggers `postbuild`.
- Preserve the existing unrelated modification in `docs/superpowers/specs/2026-07-13-exec-dashboard-design.md`.

---

## File Structure

- `src/components/dashboard/KpiRow.tsx`: selects the count-aware grid class for default and widget presentation.
- `src/components/dashboard/KpiMetricWidgetCard.tsx`: uses a single grid column on mobile and two on desktop.
- `src/components/dashboard/DailyCheckProgressCard.tsx`: matches the widget span behavior for the injected Daily Check card.
- `src/components/dashboard/KpiRow.test.tsx`: proves all requested grid patterns and responsive spans.

### Task 1: Implement the Count-Based KPI Grid

**Files:**
- Modify: `src/components/dashboard/KpiRow.tsx:20-109`
- Modify: `src/components/dashboard/KpiMetricWidgetCard.tsx:53-66`
- Modify: `src/components/dashboard/DailyCheckProgressCard.tsx:27-42`
- Modify: `src/components/dashboard/KpiRow.test.tsx:1-101`

**Interfaces:**
- Consumes: `presentation: "default" | "widgets"`, `kpis`, and optional `extraCards`.
- Produces: Tailwind grid classes that select three or four desktop cards per row based on the combined rendered-card count.

- [ ] **Step 1: Write failing layout tests**

Add a reusable source of eleven unique KPI IDs and render each requested count with `presentation="default"`:

```ts
const KPI_IDS: KpiId[] = [
  "urgentTotal", "usersTotal", "usersActive", "rolesTotal", "activeTotal",
  "dailyCheckPending", "assignedToMe", "inProgress", "completedToday",
  "methodGaps", "masterItemsTotal",
];

it.each([
  [5, "md:grid-cols-3"], [6, "md:grid-cols-3"], [7, "md:grid-cols-4"],
  [8, "md:grid-cols-4"], [9, "md:grid-cols-3"], [10, "md:grid-cols-4"],
  [11, "md:grid-cols-4"],
] as const)("uses the requested desktop grid for %i cards", (count, gridClass) => {
  const { container } = render(
    <MemoryRouter><KpiRow kpis={KPI_IDS.slice(0, count)} ctx={ctx} /></MemoryRouter>,
  );

  expect(container.firstElementChild).toHaveClass("grid-cols-2", gridClass);
});
```

Replace the existing widget class expectations so a six-card widget row expects `md:grid-cols-6`, then add assertions that a widget KPI and `DailyCheckProgressCard` have `md:col-span-2` but not the unprefixed `col-span-2` class.

- [ ] **Step 2: Run the focused test to verify the requested patterns fail**

Run: `npx.cmd vitest run src/components/dashboard/KpiRow.test.tsx`

Expected: FAIL because the current widget layout treats all counts above four as six tracks, default KPI rows use six tracks at desktop, and widget/Daily Check cards occupy two mobile columns.

- [ ] **Step 3: Add the minimal count-aware grid selection and responsive spans**

In `KpiRow.tsx`, replace `usesThreeCardRows` with this helper and select a class from the total rendered-card count:

```ts
function usesThreeDesktopColumns(cardCount: number) {
  return cardCount === 5 || cardCount === 6 || cardCount === 9;
}

function gridClassFor(presentation: "default" | "widgets", cardCount: number) {
  const threeColumns = usesThreeDesktopColumns(cardCount);
  if (presentation === "widgets") {
    return threeColumns ? "grid-cols-2 md:grid-cols-6" : "grid-cols-2 md:grid-cols-8";
  }
  return threeColumns ? "grid-cols-2 md:grid-cols-3" : "grid-cols-2 md:grid-cols-4";
}
```

Use `const totalCards = renderedKpis.length + (extraCards ? 1 : 0);` and pass it into `gridClassFor` in the grid `className`.

Change the opening Card classes in both `KpiMetricWidgetCard.tsx` and `DailyCheckProgressCard.tsx` from `col-span-2` to `md:col-span-2`, leaving all other styling intact.

- [ ] **Step 4: Run the focused test to verify all grid patterns pass**

Run: `npx.cmd vitest run src/components/dashboard/KpiRow.test.tsx`

Expected: PASS with mobile two-column classes, the requested desktop class for every count from five through eleven, and responsive widget/Daily Check spans.

- [ ] **Step 5: Verify static types and the final diff without building**

Run: `npx.cmd tsc --noEmit` followed by `git diff --check`

Expected: both commands exit zero.

- [ ] **Step 6: Commit only the intended source and test files**

```bash
git add src/components/dashboard/KpiRow.tsx src/components/dashboard/KpiMetricWidgetCard.tsx src/components/dashboard/DailyCheckProgressCard.tsx src/components/dashboard/KpiRow.test.tsx
git commit -m "feat: arrange dashboard KPI cards by count"
```
