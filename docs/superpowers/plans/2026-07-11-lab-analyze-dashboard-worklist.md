# Lab Analyze Dashboard Worklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `lab-analyze` dashboard show a 4-row paginated in-page worklist driven by the selected KPI, remove returned/activity/status-donut sections, and replace the right-side pie chart with an assignment weekday horizontal bar.

**Architecture:** Keep the change lab-only by branching in `RoleDashboard` when `profileId === "lab-analyze"`. Put filtering, sorting, pagination, and weekday aggregation in `src/lib/dashboardMetrics.ts` so behavior is covered by unit tests and UI code stays thin.

**Tech Stack:** React 18, Vite, TypeScript, Vitest, shadcn/ui, Recharts, Tailwind CSS.

## Global Constraints

- Do not run `npm run build`, `npm run build:dev`, `npm run build:watch`, `vite build`, or equivalent build commands.
- Use `npm run test -- src/lib/dashboardMetrics.test.ts src/lib/dashboardProfiles.test.ts` and `npx tsc --noEmit` for validation.
- Scope is only `lab-analyze`; other dashboard profiles must keep their existing behavior.
- The dashboard worklist page size is exactly 4.

---

### Task 1: Lab Worklist Metrics

**Files:**
- Modify: `src/lib/dashboardMetrics.ts`
- Test: `src/lib/dashboardMetrics.test.ts`

**Interfaces:**
- Produces: `type LabWorklistFilter = "assignedToMe" | "inProgress" | "completedToday"`
- Produces: `isAssignedToUser(p: Petition, user: LabDashboardUser | null | undefined): boolean`
- Produces: `buildLabWorklist(petitions: Petition[], filter: LabWorklistFilter, user: LabDashboardUser | null | undefined, now: number): Petition[]`
- Produces: `paginateLabWorklist<T>(rows: T[], page: number, pageSize?: number): { pageRows: T[]; page: number; totalPages: number; total: number }`
- Produces: `assignedWeekdayData(petitions: Petition[]): { key: string; label: string; count: number }[]`

- [ ] **Step 1: Write the failing tests**

Add tests that assert:

```ts
expect(buildLabWorklist(list, "assignedToMe", { employeeId: "E1", name: "A" }, NOW).map((p) => p._id)).toEqual(["newer", "not-progress", "older"]);
expect(buildLabWorklist(list, "inProgress", { employeeId: "E1", name: "A" }, NOW).every((p) => p.status === "inProgress" && p.assignedTo)).toBe(true);
expect(buildLabWorklist(list, "completedToday", null, NOW).map((p) => p._id)).toEqual(["done-late", "done-early"]);
expect(paginateLabWorklist([1, 2, 3, 4, 5], 1).pageRows).toEqual([1, 2, 3, 4]);
expect(paginateLabWorklist([1, 2, 3, 4, 5], 2).pageRows).toEqual([5]);
expect(assignedWeekdayData(noSunday).map((d) => d.key)).toEqual(["mon", "tue", "wed", "thu", "fri", "sat"]);
expect(assignedWeekdayData(withSunday).map((d) => d.key)).toEqual(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
```

- [ ] **Step 2: Run red test**

Run: `npm run test -- src/lib/dashboardMetrics.test.ts`
Expected: FAIL because the new functions are not exported.

- [ ] **Step 3: Implement metrics helpers**

Implement helpers in `src/lib/dashboardMetrics.ts` using petition timestamps in this order:

```ts
assignedTo?.assignedAt ?? receivedAt ?? sampleSentAt ?? createdAt
completedAt ?? approvedAt ?? updatedAt
```

- [ ] **Step 4: Run green test**

Run: `npm run test -- src/lib/dashboardMetrics.test.ts`
Expected: PASS.

### Task 2: Lab Profile And Dashboard UI

**Files:**
- Modify: `src/lib/dashboardProfiles.ts`
- Modify: `src/lib/dashboardProfiles.test.ts`
- Modify: `src/components/dashboard/KpiRow.tsx`
- Modify: `src/components/dashboard/ActionTable.tsx`
- Modify: `src/components/dashboard/AnalyticsSection.tsx`
- Modify: `src/hooks/useDashboardData.ts`
- Modify: `src/pages/RoleDashboard.tsx`

**Interfaces:**
- Consumes: Task 1 helper exports.
- Produces: `KpiRow` optional `onKpiClick?: (id: KpiId) => void` and `activeKpi?: KpiId`.
- Produces: `ActionTable` optional props for title, empty message, sort control, and pagination footer.
- Produces: `AnalyticsSection` support for chart kind `assignedWeekdayBar`.
- Produces: `useDashboardData` `assignedToMeCount` based on `isAssignedToUser` so the KPI count matches the worklist.

- [ ] **Step 1: Write failing profile test**

Assert `DASHBOARD_PROFILES["lab-analyze"].kpis` equals `["assignedToMe", "inProgress", "completedToday"]`, has `workflow: null`, and has `analytics` containing only `{ kind: "assignedWeekdayBar", title: "งานที่ถูก assign ตามวัน" }`.

- [ ] **Step 2: Run red profile test**

Run: `npm run test -- src/lib/dashboardProfiles.test.ts`
Expected: FAIL because current profile still includes `returnedTotal`, `workflow`, and `statusDonut`.

- [ ] **Step 3: Implement UI changes**

Update the UI so `lab-analyze`:

```tsx
<KpiRow kpis={profile.kpis} ctx={ctx} activeKpi={labFilter} onKpiClick={setLabFilter} />
<ActionTable title="งานที่กำลังดำเนินการ" petitions={pageRows} ... />
<AnalyticsSection specs={profile.analytics} ctx={ctx} layout="single" />
```

Do not render the bottom analytics section or `ActivityTimeline` for `lab-analyze`. Keep existing rendering for all other profiles.

- [ ] **Step 4: Run green profile test**

Run: `npm run test -- src/lib/dashboardProfiles.test.ts`
Expected: PASS.

### Task 3: Validation

**Files:**
- No source edits unless validation exposes a concrete issue.

- [ ] **Step 1: Run focused unit tests**

Run: `npm run test -- src/lib/dashboardMetrics.test.ts src/lib/dashboardProfiles.test.ts`
Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Review diff**

Run: `git diff -- src/lib/dashboardMetrics.ts src/lib/dashboardMetrics.test.ts src/lib/dashboardProfiles.ts src/lib/dashboardProfiles.test.ts src/hooks/useDashboardData.ts src/components/dashboard/KpiRow.tsx src/components/dashboard/ActionTable.tsx src/components/dashboard/AnalyticsSection.tsx src/pages/RoleDashboard.tsx docs/superpowers/specs/2026-07-11-lab-analyze-dashboard-worklist-design.md docs/superpowers/plans/2026-07-11-lab-analyze-dashboard-worklist.md`
Expected: Diff only contains the lab analyze dashboard worklist changes and docs.
