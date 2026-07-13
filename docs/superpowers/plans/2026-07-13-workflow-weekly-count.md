# Workflow Weekly Count Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Lab and QC weekday workflow bars count work only inside the current local Monday-start week, using Lab assignment time and QC sample-sent time.

**Architecture:** Keep week-window filtering and weekday bucketing in `src/lib/dashboardMetrics.ts`, then pass the correct basis from dashboard UI components. Tests cover the metric behavior directly; UI changes stay thin and are validated with TypeScript.

**Tech Stack:** React, TypeScript, Recharts, Vitest, Vite project tooling.

## Global Constraints

- Do not run `npm run build`, `npm run build:dev`, `npm run build:watch`, `vite build`, or equivalent build commands.
- For validation, use focused Vitest and TypeScript commands such as `npx vitest run src/lib/dashboardMetrics.test.ts` and `npx tsc --noEmit`.
- Do not touch generated root production files such as `app.html` and `assets/`.
- Preserve unrelated dirty working-tree changes.

---

### Task 1: Add Weekly Weekday Metric Behavior

**Files:**
- Modify: `src/lib/dashboardMetrics.ts`
- Modify: `src/lib/dashboardMetrics.test.ts`

**Interfaces:**
- Consumes: existing `Petition`, `LabWeekdayBucket`, `assignmentIso`, `timeValue`, and `localWeekWindow`.
- Produces: `export type WeekdayWorkloadBasis = "labAssigned" | "qcSampleSent"` and `export function assignedWeekdayData(petitions: Petition[], now?: number, basis?: WeekdayWorkloadBasis): LabWeekdayBucket[]`.

- [ ] **Step 1: Write failing tests for Lab weekly counts**

In `src/lib/dashboardMetrics.test.ts`, replace the existing `assignedWeekdayData shows Monday-Saturday by default and Sunday only when assigned` test with:

```ts
  it("assignedWeekdayData counts Lab assigned work only inside the current local week", () => {
    const monday = pet({
      _id: "mon",
      assignedTo: { employeeId: "E1", name: "A", assignedAt: new Date(2026, 6, 6, 9).toISOString() },
    });
    const previousSunday = pet({
      _id: "previous-sun",
      assignedTo: { employeeId: "E1", name: "A", assignedAt: new Date(2026, 6, 5, 9).toISOString() },
    });
    const noAssignee = pet({
      _id: "no-assignee",
      assignedTo: null,
      createdAt: new Date(2026, 6, 6, 10).toISOString(),
    });

    const rows = assignedWeekdayData([monday, previousSunday, noAssignee], NOW, "labAssigned");

    expect(rows.map((d) => [d.key, d.count])).toEqual([
      ["mon", 1],
      ["tue", 0],
      ["wed", 0],
      ["thu", 0],
      ["fri", 0],
      ["sat", 0],
    ]);
  });
```

- [ ] **Step 2: Write failing tests for QC weekly counts and Sunday visibility**

In the same `describe("lab analyze worklist helpers", ...)` block, add these tests after the Lab weekly test:

```ts
  it("assignedWeekdayData counts QC work by sampleSentAt in the current local week", () => {
    const sentTuesday = pet({
      _id: "qc-tue",
      sampleSentAt: new Date(2026, 6, 7, 10).toISOString(),
      assignedTo: { employeeId: "E1", name: "A", assignedAt: new Date(2026, 5, 30, 9).toISOString() },
    });
    const fallbackCreated = pet({
      _id: "qc-fallback",
      assignedTo: null,
      createdAt: new Date(2026, 6, 8, 11).toISOString(),
    });
    const previousWeek = pet({
      _id: "qc-old",
      sampleSentAt: new Date(2026, 6, 5, 10).toISOString(),
      createdAt: new Date(2026, 6, 5, 10).toISOString(),
    });

    const rows = assignedWeekdayData([sentTuesday, fallbackCreated, previousWeek], NOW, "qcSampleSent");

    expect(rows.find((d) => d.key === "tue")?.count).toBe(1);
    expect(rows.find((d) => d.key === "wed")?.count).toBe(1);
    expect(rows.find((d) => d.key === "sun")).toBeUndefined();
  });

  it("assignedWeekdayData shows Sunday only when current-week Sunday has data", () => {
    const monday = pet({
      _id: "mon",
      assignedTo: { employeeId: "E1", name: "A", assignedAt: new Date(2026, 6, 6, 9).toISOString() },
    });
    const sunday = pet({
      _id: "sun",
      assignedTo: { employeeId: "E1", name: "A", assignedAt: new Date(2026, 6, 12, 9).toISOString() },
    });

    expect(assignedWeekdayData([monday], NOW, "labAssigned").map((d) => d.key))
      .toEqual(["mon", "tue", "wed", "thu", "fri", "sat"]);
    expect(assignedWeekdayData([monday, sunday], NOW, "labAssigned").map((d) => d.key))
      .toEqual(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
    expect(assignedWeekdayData([monday, sunday], NOW, "labAssigned").find((d) => d.key === "sun")?.count)
      .toBe(1);
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
npx vitest run src/lib/dashboardMetrics.test.ts
```

Expected: FAIL because `assignedWeekdayData` still accepts only one argument and still counts historical assignment dates without the basis/week filter.

- [ ] **Step 4: Implement the weekly basis-aware helper**

In `src/lib/dashboardMetrics.ts`, add this type near `LabWeekdayBucket`:

```ts
export type WeekdayWorkloadBasis = "labAssigned" | "qcSampleSent";
```

Add this helper near `assignmentIso`:

```ts
function weekdayWorkloadIso(p: Petition, basis: WeekdayWorkloadBasis): string | null | undefined {
  if (basis === "qcSampleSent") return p.sampleSentAt ?? p.createdAt;
  if (!p.assignedTo) return null;
  return p.assignedTo.assignedAt ?? assignmentIso(p);
}
```

Replace `assignedWeekdayData` with:

```ts
export function assignedWeekdayData(
  petitions: Petition[],
  now = Date.now(),
  basis: WeekdayWorkloadBasis = "labAssigned",
): LabWeekdayBucket[] {
  const { start, end } = localWeekWindow(now);
  const byKey = new Map<LabWeekdayBucket["key"], LabWeekdayBucket>(
    WEEKDAY_BUCKETS.map((d) => [d.key, { ...d }]),
  );

  for (const p of petitions) {
    const t = timeValue(weekdayWorkloadIso(p, basis));
    if (!t || t < start || t >= end) continue;
    const day = new Date(t).getDay();
    const key: LabWeekdayBucket["key"] =
      day === 0 ? "sun" :
      day === 1 ? "mon" :
      day === 2 ? "tue" :
      day === 3 ? "wed" :
      day === 4 ? "thu" :
      day === 5 ? "fri" :
      "sat";
    const bucket = byKey.get(key);
    if (bucket) bucket.count += 1;
  }

  const ordered = WEEKDAY_BUCKETS.map((d) => byKey.get(d.key) ?? d);
  return ordered.filter((d) => d.key !== "sun" || d.count > 0);
}
```

- [ ] **Step 5: Run metric tests**

Run:

```bash
npx vitest run src/lib/dashboardMetrics.test.ts
```

Expected: PASS for `src/lib/dashboardMetrics.test.ts`.

- [ ] **Step 6: Commit Task 1**

Run:

```bash
git add src/lib/dashboardMetrics.ts src/lib/dashboardMetrics.test.ts
git commit -m "feat(dashboard): count workflow weekdays by current week"
```

Expected: A commit containing only the metric helper and metric tests.

---

### Task 2: Wire Lab and QC Dashboard Charts to the Correct Basis

**Files:**
- Modify: `src/components/dashboard/WorkflowSummary.tsx`
- Modify: `src/components/dashboard/AnalyticsSection.tsx`
- Modify: `src/pages/RoleDashboard.tsx`

**Interfaces:**
- Consumes: `WeekdayWorkloadBasis` and `assignedWeekdayData(petitions, now, basis)` from Task 1.
- Produces: `WorkflowSummary` props `{ kind, petitions, now, weekdayBasis? }` and `AnalyticsSection` prop `weekdayBasis?`.

- [ ] **Step 1: Update `WorkflowSummary` props and chart call**

In `src/components/dashboard/WorkflowSummary.tsx`, update the imports:

```ts
import {
  assignedWeekdayData, statusDonutData, pipelineStages, type WeekdayWorkloadBasis,
} from "@/lib/dashboardMetrics";
```

Replace the component signature with:

```ts
export default function WorkflowSummary({
  kind,
  petitions,
  now,
  weekdayBasis = "labAssigned",
}: {
  kind: WorkflowKind;
  petitions: Petition[];
  now: number;
  weekdayBasis?: WeekdayWorkloadBasis;
}) {
```

Keep the existing JSX title and layout unchanged. Replace only this branch:

```tsx
        ) : kind === "assignedWeekdayBar" ? (
          <AssignedWeekdayBar petitions={petitions} now={now} basis={weekdayBasis} />
        ) : (
```

Replace the `AssignedWeekdayBar` opening block and data line with:

```ts
function AssignedWeekdayBar({
  petitions,
  now,
  basis,
}: {
  petitions: Petition[];
  now: number;
  basis: WeekdayWorkloadBasis;
}) {
  const data = assignedWeekdayData(petitions, now, basis);
```

Keep the existing empty-state check and chart JSX inside the function unchanged after the `data` line.

- [ ] **Step 2: Update `AnalyticsSection` props and chart call**

In `src/components/dashboard/AnalyticsSection.tsx`, add the type import:

```ts
import {
  deptWorkloadData, analystWorkloadData, normalDonutData, requestTrendData, statusDonutData,
  assignedWeekdayData, labHeadAnalystWorkloadData,
  type MetricsCtx,
  type LabHeadWorkloadPeriod,
  type WeekdayWorkloadBasis,
} from "@/lib/dashboardMetrics";
```

Add the prop:

```ts
  weekdayBasis?: WeekdayWorkloadBasis;
```

Thread it through `AnalyticsSection` and `ChartFor`:

```ts
export default function AnalyticsSection({
  specs,
  ctx,
  layout = "grid",
  labHeadPeriod = "today",
  onLabHeadPeriodChange,
  weekdayBasis = "labAssigned",
}: AnalyticsSectionProps) {
```

```tsx
<CardContent><ChartFor spec={s} ctx={ctx} labHeadPeriod={labHeadPeriod} weekdayBasis={weekdayBasis} /></CardContent>
```

```ts
function ChartFor({
  spec,
  ctx,
  labHeadPeriod,
  weekdayBasis,
}: {
  spec: ChartSpec;
  ctx: MetricsCtx;
  labHeadPeriod: LabHeadWorkloadPeriod;
  weekdayBasis: WeekdayWorkloadBasis;
}) {
```

Replace the assigned weekday branch with:

```ts
  if (spec.kind === "assignedWeekdayBar") return <WeekdayBar data={assignedWeekdayData(ctx.petitions, ctx.now, weekdayBasis)} />;
```

- [ ] **Step 3: Pass Lab/QC basis from `RoleDashboard`**

In `src/pages/RoleDashboard.tsx`, add this local constant after the `isQcStaff` declaration:

```ts
  const weekdayBasis = isQcStaff ? "qcSampleSent" : "labAssigned";
```

Update the Lab analytics call:

```tsx
            <AnalyticsSection
              specs={profile.analytics}
              ctx={labAnalyticsCtx}
              layout="single"
              weekdayBasis="labAssigned"
            />
```

Update the `WorkflowSummary` call:

```tsx
            <WorkflowSummary
              kind={profile.workflow}
              petitions={petitions}
              now={ctx.now}
              weekdayBasis={weekdayBasis}
            />
```

Update the bottom `AnalyticsSection` call:

```tsx
        <AnalyticsSection
          specs={profile.analytics}
          ctx={ctx}
          labHeadPeriod={labHeadPeriod}
          onLabHeadPeriodChange={isLabHead ? setLabHeadPeriod : undefined}
          weekdayBasis={weekdayBasis}
        />
```

- [ ] **Step 4: Run typecheck**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS with no TypeScript errors from the new props or helper signature.

- [ ] **Step 5: Run metric tests again**

Run:

```bash
npx vitest run src/lib/dashboardMetrics.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

Run:

```bash
git add src/components/dashboard/WorkflowSummary.tsx src/components/dashboard/AnalyticsSection.tsx src/pages/RoleDashboard.tsx
git commit -m "fix(dashboard): use lab and qc dates for weekly workflow bars"
```

Expected: A commit containing only the dashboard wiring changes.

---

### Task 3: Final Verification and Diff Review

**Files:**
- Review: `src/lib/dashboardMetrics.ts`
- Review: `src/lib/dashboardMetrics.test.ts`
- Review: `src/components/dashboard/WorkflowSummary.tsx`
- Review: `src/components/dashboard/AnalyticsSection.tsx`
- Review: `src/pages/RoleDashboard.tsx`

**Interfaces:**
- Consumes: Task 1 metric helper and Task 2 UI wiring.
- Produces: Verified working-tree state ready for user review.

- [ ] **Step 1: Run focused metric tests**

Run:

```bash
npx vitest run src/lib/dashboardMetrics.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run TypeScript validation**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: Confirm no build artifacts changed**

Run:

```bash
git status --short
```

Expected: No changes to `app.html` or files under root `assets/` caused by this task. Existing unrelated dirty files may still appear and must not be reverted.

- [ ] **Step 4: Review final source diff**

Run:

```bash
git diff -- src/lib/dashboardMetrics.ts src/lib/dashboardMetrics.test.ts src/components/dashboard/WorkflowSummary.tsx src/components/dashboard/AnalyticsSection.tsx src/pages/RoleDashboard.tsx
```

Expected: Diff only shows the weekly weekday metric helper, tests, and UI prop wiring.
