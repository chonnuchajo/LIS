# Dashboard Urgent Priority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display and prioritize petitions submitted with `priority === 1` as urgent on every role dashboard.

**Architecture:** The dashboard profile registry exposes one shared `urgentTotal` KPI. `computeKpi` counts persisted petition priorities, while `RoleDashboard` maps the same field to the existing `ActionTable` urgency interface and moves urgent rows ahead of pagination. `ActionTable` sorts its supplied urgent IDs before its existing oldest-work-first ordering.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, Tailwind CSS, lucide-react.

## Global Constraints

- Urgent means exactly `petition.priority === 1`; `0` and a missing legacy value are normal.
- Do not infer urgency from abnormal results, returned work, or age; the 48-hour warning remains independent.
- Add `urgentTotal` as the first KPI to all nine `DASHBOARD_PROFILES` entries.
- Do not add API routes, form fields, standalone urgent tables, or list-page filters.
- Do not run `npm run build`, Vite build commands, or any command that triggers `postbuild`.
- The listed source files contain pre-existing user changes: do not stage or commit source or test files for this work.

---

## File Structure

- `src/types/petition.types.ts`: declares the persisted optional `priority` field on the frontend petition contract.
- `src/lib/dashboardProfiles.ts`: defines the urgent KPI metadata and inserts it in all role dashboard configurations.
- `src/lib/dashboardMetrics.ts`: calculates the urgent KPI and stably moves urgent petitions to the front of an existing worklist.
- `src/pages/RoleDashboard.tsx`: supplies priority-derived urgent IDs to every dashboard action table and prioritizes paginated worklists before slicing them into pages.
- `src/components/dashboard/ActionTable.tsx`: orders urgent rows before normal rows while preserving the age tie-breaker.
- `src/lib/dashboardMetrics.test.ts`: proves the KPI counts only priority-one petitions.
- `src/lib/dashboardProfiles.test.ts`: proves every dashboard profile puts the urgent KPI first.
- `src/pages/RoleDashboard.test.tsx`: proves the dashboard passes only priority-one petition IDs as urgent.
- `src/components/dashboard/ActionTable.test.tsx`: proves urgent rows appear before normal rows.

### Task 1: Expose and Count the Shared Urgent KPI

**Files:**
- Modify: `src/types/petition.types.ts:185-225`
- Modify: `src/lib/dashboardProfiles.ts:20-155`
- Modify: `src/lib/dashboardMetrics.ts:754-795`
- Modify: `src/lib/dashboardMetrics.test.ts:290-333`
- Modify: `src/lib/dashboardProfiles.test.ts:118-155`

**Interfaces:**
- Consumes: `PetitionBase` and `MetricsCtx.petitions`.
- Produces: `Petition.priority?: 0 | 1`, `computeKpi("urgentTotal", ctx): KpiValue`, and `prioritizeUrgentPetitions(petitions): Petition[]`.

- [ ] **Step 1: Write the failing metric and profile-registry tests**

Append the priority fixture values and the KPI expectation to `src/lib/dashboardMetrics.test.ts`:

```ts
petitions: [
  pet({ _id: "a", status: "inProgress", priority: 1 }),
  pet({ _id: "b", status: "success", completedAt: new Date(NOW).toISOString(), priority: 0 }),
  pet({ _id: "c", status: "sampleSent" }),
],

it("counts only priority-one petitions as urgent", () => {
  expect(computeKpi("urgentTotal", ctx).value).toBe(1);
});

it("moves priority-one petitions ahead without changing their existing order", () => {
  expect(prioritizeUrgentPetitions([
    pet({ _id: "normal-old", priority: 0 }),
    pet({ _id: "urgent-later", priority: 1 }),
    pet({ _id: "urgent-first", priority: 1 }),
  ]).map((petition) => petition._id)).toEqual(["urgent-later", "urgent-first", "normal-old"]);
});
```

Add this test to `src/lib/dashboardProfiles.test.ts`:

```ts
it("places the urgent KPI first in every dashboard profile", () => {
  for (const profile of Object.values(DASHBOARD_PROFILES)) {
    expect(profile.kpis[0]).toBe("urgentTotal");
  }
  expect(KPI_META.urgentTotal.label).toBe("งานด่วน");
});
```

- [ ] **Step 2: Run the tests to verify they fail for the missing KPI**

Run: `npx vitest run src/lib/dashboardMetrics.test.ts src/lib/dashboardProfiles.test.ts`

Expected: FAIL because `urgentTotal` is not accepted by `KpiId` and the profile configuration does not contain the KPI.

- [ ] **Step 3: Add the minimal priority contract and KPI implementation**

Add the persisted field to `PetitionBase`:

```ts
priority?: 0 | 1;
```

Add `"urgentTotal"` to `KpiId`, define the red alert metadata, and prepend the ID to every profile:

```ts
urgentTotal: { label: "งานด่วน", icon: AlertTriangle, variant: "red" },

admin: {
  // existing fields
  kpis: ["urgentTotal", "usersTotal", "usersActive", "rolesTotal", "activeTotal", "dailyCheckPending"],
},
```

Apply the same prepend-only change to `lab-analyze`, `lab-config`, `lab-head`, `lab-inventory`, `qc-staff`, `qc-reviewer`, `qc-head`, and `viewer`.

Add the KPI branch in `computeKpi`:

```ts
case "urgentTotal": return { value: P.filter((petition) => petition.priority === 1).length };
```

Add the stable ordering helper alongside other worklist helpers:

```ts
export function prioritizeUrgentPetitions(petitions: Petition[]): Petition[] {
  return [...petitions].sort((a, b) => Number(b.priority === 1) - Number(a.priority === 1));
}
```

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `npx vitest run src/lib/dashboardMetrics.test.ts src/lib/dashboardProfiles.test.ts`

Expected: PASS with `urgentTotal` counting only priority-one petitions and each profile beginning with that KPI.

- [ ] **Step 5: Leave the completed KPI slice unstaged**

Do not stage or commit these files because they contain pre-existing user changes. Record the modified files with `git status --short` and continue to Task 2.

### Task 2: Mark and Order Urgent Work in Dashboard Tables

**Files:**
- Modify: `src/pages/RoleDashboard.tsx:168-210`
- Modify: `src/pages/RoleDashboard.test.tsx:16-107`
- Modify: `src/components/dashboard/ActionTable.tsx:44-58`
- Create: `src/components/dashboard/ActionTable.test.tsx`

**Interfaces:**
- Consumes: `Petition.priority?: 0 | 1` and `prioritizeUrgentPetitions(petitions): Petition[]`.
- Produces: `urgentIds: Set<string>` containing exactly the priority-one petition IDs, an urgent-first page order for every paginated worklist, and the existing `ActionTable` UI ordered by urgency then age.

- [ ] **Step 1: Write the failing dashboard-source and action-table-order tests**

Extend the captured action table props in `src/pages/RoleDashboard.test.tsx`:

```ts
interface CapturedActionTableProps {
  title?: string;
  statusBadge?: (petition: Petition) => { label: string };
  urgentIds: Set<string>;
}
```

Add a mutable petition list to the existing hoisted test state, return it from the `useDashboardData` mock, then assert that a normal petition is excluded:

```ts
it("uses persisted priority to flag dashboard work as urgent", () => {
  state.roles = ["viewer"];
  state.petitions = [
    { _id: "urgent", petitionNo: "P-URGENT", dept: "production", status: "inProgress", priority: 1, submittedBy: { name: "A" }, items: [], createdAt: "2026-07-06T01:00:00.000Z", updatedAt: "2026-07-06T01:00:00.000Z" },
    { _id: "normal", petitionNo: "P-NORMAL", dept: "production", status: "inProgress", priority: 0, submittedBy: { name: "B" }, items: [], createdAt: "2026-07-06T01:00:00.000Z", updatedAt: "2026-07-06T01:00:00.000Z" },
  ] as Petition[];

  renderDashboard();

  expect(state.actionTableProps.at(-1).urgentIds).toEqual(new Set(["urgent"]));
});
```

Create `src/components/dashboard/ActionTable.test.tsx` with a newer urgent petition and an older normal petition. Pass `urgentIds={new Set(["urgent"])}` and assert the body order, which must fail before sorting changes:

```ts
expect(Array.from(container.querySelectorAll("tbody tr")).map((row) => row.textContent)).toEqual([
  expect.stringContaining("P-URGENT"),
  expect.stringContaining("P-NORMAL"),
]);
```

- [ ] **Step 2: Run the tests to verify they fail because rows sort only by age**

Run: `npx vitest run src/pages/RoleDashboard.test.tsx src/components/dashboard/ActionTable.test.tsx`

Expected: FAIL in the action-table test because the older normal petition appears before the newer urgent one.

- [ ] **Step 3: Derive urgency from priority and sort urgent rows first**

Replace the existing abnormal/returned-derived `urgentIds` calculation in `src/pages/RoleDashboard.tsx` with:

```ts
const urgentIds = useMemo(
  () => new Set(petitions.filter((petition) => petition.priority === 1).map((petition) => petition._id)),
  [petitions],
);
```

Import `prioritizeUrgentPetitions` from `dashboardMetrics` and apply it before every existing worklist pagination call so urgent rows are on the first page for Lab Analyze, Lab Head, and QC Staff:

```ts
const labPageData = useMemo(
  () => paginateLabWorklist(prioritizeUrgentPetitions(labRows), labPage),
  [labRows, labPage],
);
const labHeadPageData = useMemo(
  () => paginateLabWorklist(prioritizeUrgentPetitions(labHeadRows), labHeadPage),
  [labHeadRows, labHeadPage],
);
const qcStaffPageData = useMemo(
  () => paginateLabWorklist(prioritizeUrgentPetitions(qcStaffRows), qcStaffPage),
  [qcStaffRows, qcStaffPage],
);
```

Update `ActionTable` sorting so it keeps the existing sort-off behavior and applies urgency before age when sorting is enabled:

```ts
const rows = sortRows
  ? [...petitions].sort((a, b) => {
    const urgency = Number(urgentIds.has(b._id)) - Number(urgentIds.has(a._id));
    return urgency || (ageHours(firstTs(b), now) ?? 0) - (ageHours(firstTs(a), now) ?? 0);
  })
  : petitions;
```

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `npx vitest run src/pages/RoleDashboard.test.tsx src/components/dashboard/ActionTable.test.tsx`

Expected: PASS with every dashboard mapping only `priority === 1` to urgent and with urgent table rows preceding normal rows.

- [ ] **Step 5: Leave the completed table slice unstaged**

Do not stage or commit these files because they contain pre-existing user changes. Record the modified files with `git status --short` and continue to validation.

### Task 3: Validate the Integrated Dashboard Change

**Files:**
- Modify: no production files expected.

**Interfaces:**
- Consumes: the new `urgentTotal` KPI and priority-based `urgentIds` behavior.
- Produces: type-safe, focused test evidence for the dashboard change.

- [ ] **Step 1: Run the complete related unit-test set**

Run: `npx vitest run src/lib/dashboardMetrics.test.ts src/lib/dashboardProfiles.test.ts src/pages/RoleDashboard.test.tsx src/components/dashboard/ActionTable.test.tsx`

Expected: PASS with no test failures.

- [ ] **Step 2: Run the TypeScript check without building artifacts**

Run: `npx tsc --noEmit`

Expected: PASS with no TypeScript errors.

- [ ] **Step 3: Review the final diff and worktree scope**

Run: `git diff --check` followed by `git status --short`

Expected: no whitespace errors; only the intended urgent-priority files are newly modified by this work, alongside pre-existing user changes.

- [ ] **Step 4: Leave the validated change unstaged**

Do not stage or commit implementation files. Report the exact files touched by this feature and keep them alongside the existing user changes in the worktree.
