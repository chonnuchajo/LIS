# Lab Data Config Dashboard Pies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show two Lab Data Config dashboard pie charts for Simple Method coverage and Standard Time coverage whenever the user holds `lab-data-config` or `lab-config`.

**Architecture:** Keep counting logic in pure dashboard metric helpers so the category rules are unit-tested before UI work. Fetch the additional config datasets only for Lab Data Config users, store computed chart rows in `MetricsCtx`, then render a dedicated conditional dashboard section above or below the main dashboard based on the resolved profile.

**Tech Stack:** React 18, TypeScript, Vitest, React Testing Library, TanStack Query, Recharts, shadcn/ui, Tailwind CSS.

## Global Constraints

- Do not run `npm run build`, `npm run build:dev`, `npm run build:watch`, `vite build`, or any equivalent production/dev build command.
- Do not update generated `assets/`, root `app.html`, or seed-data exports.
- Use `/master-items/slim`, `/simple-methods`, `/methods`, and `/standard-times/summary`; do not add a new backend aggregate endpoint.
- Simple Method pie categories are `GC`, `HPLC`, `GC + HPLC`, and `ยังไม่ได้กำหนด`.
- Simple Method slots with both GC and HPLC count only in `GC + HPLC`, not in the GC/HPLC single-method slices.
- Standard Time `ยังไม่กำหนด` is `sum(total - withData)` from `/standard-times/summary`.

---

## File Structure

- Modify `src/lib/dashboardMetrics.ts`: add pure coverage data helpers and extend `MetricsCtx`.
- Modify `src/lib/dashboardMetrics.test.ts`: add unit tests for Simple Method and Standard Time coverage helpers, and update the existing `MetricsCtx` fixture.
- Modify `src/lib/dashboardProfiles.ts`: add pure role/placement helpers for the conditional Lab Data Config section.
- Modify `src/lib/dashboardProfiles.test.ts`: test the new placement helpers.
- Modify `src/hooks/useDashboardData.ts`: fetch methods and standard time summary for Lab Data Config users and populate `MetricsCtx`.
- Create `src/components/dashboard/ConfigCoveragePies.tsx`: render the two pie cards and their legends.
- Create `src/components/dashboard/ConfigCoveragePies.test.tsx`: verify titles, legend values, empty state, and loading state.
- Modify `src/pages/RoleDashboard.tsx`: insert the conditional pie section above or below the main dashboard content.

---

### Task 1: Coverage Metric Helpers

**Files:**
- Modify: `src/lib/dashboardMetrics.ts`
- Modify: `src/lib/dashboardMetrics.test.ts`

**Interfaces:**
- Consumes: `readSlotMethods(entry, substanceCount)` from `src/lib/methodRegistry.ts`
- Consumes: `parseSubstances(commonName)` from `src/lib/substances.ts`
- Produces: `type ConfigPieDatum = { key: string; label: string; value: number; color: string }`
- Produces: `type SimpleMethodCoverageItem = { itemNo?: string; commonName?: string }`
- Produces: `type SimpleMethodCoverageEntry = { itemNo: string; methods?: string[][]; instruments?: string[] }`
- Produces: `type StandardTimeCoverageSummary = { _id: string; total: number; withData: number }`
- Produces: `simpleMethodCoverageData(items, entries, methods): ConfigPieDatum[]`
- Produces: `standardTimeCoverageData(summary): ConfigPieDatum[]`

- [ ] **Step 1: Write the failing coverage tests**

In `src/lib/dashboardMetrics.test.ts`, extend the import from `./dashboardMetrics` so it includes the new exports:

```ts
import {
  ageHours, isSameLocalDay, countByStatus, statusDonutData, deptWorkloadData,
  normalDonutData, requestTrendData, completedIn, computeKpi,
  buildLabWorklist, buildQcStaffWorklist, labWorklistCounts, qcStaffWorklistCounts,
  paginateLabWorklist, assignedWeekdayData,
  simpleMethodCoverageData, standardTimeCoverageData,
  type MetricsCtx,
} from "./dashboardMetrics";
```

Add this helper after `pet()`:

```ts
function toCounts(rows: { label: string; value: number }[]): Record<string, number> {
  return Object.fromEntries(rows.map((row) => [row.label, row.value]));
}

const methods = [
  { _id: "m-gc", code: "GC", label: "GC", requiresMachine: true, machinePrefix: "GC", defaultTimes: 3, order: 1, active: true, builtIn: true },
  { _id: "m-hplc", code: "HPLC", label: "HPLC", requiresMachine: true, machinePrefix: "HPLC", defaultTimes: 1, order: 2, active: true, builtIn: true },
  { _id: "m-titration", code: "TITRATION", label: "Titration", requiresMachine: false, machinePrefix: "", defaultTimes: 1, order: 3, active: true, builtIn: false },
];
```

Add this `describe` block after the existing `aggregations` block:

```ts
describe("Lab Data Config coverage pies", () => {
  it("simpleMethodCoverageData separates GC, HPLC, GC + HPLC, and unassigned slots", () => {
    const masterItems = [
      { itemNo: "P1", commonName: "ALPHA 10% EC" },
      { itemNo: "P2", commonName: "BETA 20% SC" },
      { itemNo: "P3", commonName: "GAMMA 5% + DELTA 10% EC" },
      { itemNo: "P4", commonName: "EPSILON 1% SL" },
      { itemNo: "P5", commonName: "ZETA 1% SL" },
    ];
    const simpleMethods = [
      { itemNo: "P1", methods: [["GC"]] },
      { itemNo: "P2", methods: [["HPLC"]] },
      { itemNo: "P3", methods: [["GC", "HPLC"], []] },
      { itemNo: "P4", methods: [["TITRATION"]] },
    ];

    expect(toCounts(simpleMethodCoverageData(masterItems, simpleMethods, methods))).toEqual({
      GC: 1,
      HPLC: 1,
      "GC + HPLC": 1,
      "ยังไม่ได้กำหนด": 3,
    });
  });

  it("simpleMethodCoverageData reads legacy instruments through slot compatibility", () => {
    const masterItems = [{ itemNo: "LEGACY", commonName: "ALPHA 10% EC + BETA 20% SC" }];
    const simpleMethods = [{ itemNo: "LEGACY", instruments: ["GC", "HPLC"] }];

    expect(toCounts(simpleMethodCoverageData(masterItems, simpleMethods, methods))).toEqual({
      GC: 1,
      HPLC: 1,
    });
  });

  it("standardTimeCoverageData returns per-instrument configured rows and one unassigned slice", () => {
    const summary = [
      { _id: "GC7890A", total: 4, withData: 3 },
      { _id: "HPLC1260", total: 2, withData: 2 },
      { _id: "GC8890", total: 1, withData: 0 },
    ];

    expect(toCounts(standardTimeCoverageData(summary))).toEqual({
      GC7890A: 3,
      HPLC1260: 2,
      "ยังไม่กำหนด": 2,
    });
  });
});
```

Update the `ctx: MetricsCtx` fixture in the `computeKpi` block by adding the new fields:

```ts
    simpleMethodCoverage: [],
    standardTimeCoverage: [],
    configCoverageLoading: false,
```

- [ ] **Step 2: Run the metric tests and verify RED**

Run:

```bash
npm run test -- src/lib/dashboardMetrics.test.ts
```

Expected result: FAIL because `simpleMethodCoverageData` and `standardTimeCoverageData` are not exported.

- [ ] **Step 3: Add the coverage helper implementation**

In `src/lib/dashboardMetrics.ts`, add these imports near the top:

```ts
import { readSlotMethods, type MethodDoc } from "@/lib/methodRegistry";
import { parseSubstances } from "@/lib/substances";
```

Extend `MetricsCtx` with:

```ts
  simpleMethodCoverage: ConfigPieDatum[];
  standardTimeCoverage: ConfigPieDatum[];
  configCoverageLoading: boolean;
```

Add these types and helpers before the KPI dispatch section:

```ts
export interface ConfigPieDatum {
  key: string;
  label: string;
  value: number;
  color: string;
}

export interface SimpleMethodCoverageItem {
  itemNo?: string;
  commonName?: string;
}

export interface SimpleMethodCoverageEntry {
  itemNo: string;
  methods?: string[][];
  instruments?: string[];
}

export interface StandardTimeCoverageSummary {
  _id: string;
  total: number;
  withData: number;
}

const CONFIG_COLORS = {
  gc: "hsl(217,91%,55%)",
  hplc: "hsl(142,71%,42%)",
  both: "hsl(262,83%,58%)",
  unassigned: "hsl(38,92%,50%)",
};

const STANDARD_TIME_COLORS = [
  "hsl(217,91%,55%)",
  "hsl(142,71%,42%)",
  "hsl(262,83%,58%)",
  "hsl(189,94%,43%)",
  "hsl(330,81%,60%)",
  "hsl(24,95%,53%)",
];

function normalizeCode(value: string): string {
  return String(value || "").trim().toUpperCase();
}

function configuredMachinePrefixes(
  codes: string[],
  methodByCode: Map<string, MethodDoc>,
): Set<"GC" | "HPLC"> {
  const prefixes = new Set<"GC" | "HPLC">();
  for (const code of codes) {
    const method = methodByCode.get(normalizeCode(code));
    if (!method || !method.requiresMachine) continue;
    const prefix = normalizeCode(method.machinePrefix);
    if (prefix === "GC" || prefix === "HPLC") prefixes.add(prefix);
  }
  return prefixes;
}

function pieDatum(key: string, label: string, value: number, color: string): ConfigPieDatum | null {
  return value > 0 ? { key, label, value, color } : null;
}

export function simpleMethodCoverageData(
  items: SimpleMethodCoverageItem[],
  entries: SimpleMethodCoverageEntry[],
  methods: MethodDoc[],
): ConfigPieDatum[] {
  const methodByCode = new Map(methods.map((method) => [normalizeCode(method.code), method]));
  const entryByItemNo = new Map(entries.map((entry) => [String(entry.itemNo || "").trim(), entry]));
  const counts = { gc: 0, hplc: 0, both: 0, unassigned: 0 };

  for (const item of items) {
    const itemNo = String(item.itemNo || "").trim();
    const commonName = String(item.commonName || "").trim();
    if (!itemNo || !commonName) continue;

    const substances = parseSubstances(commonName);
    const entry = entryByItemNo.get(itemNo);
    const slots = entry ? readSlotMethods(entry, substances.length) : Array.from({ length: substances.length }, () => []);

    for (const slot of slots) {
      const prefixes = configuredMachinePrefixes(slot, methodByCode);
      const hasGc = prefixes.has("GC");
      const hasHplc = prefixes.has("HPLC");
      if (hasGc && hasHplc) counts.both += 1;
      else if (hasGc) counts.gc += 1;
      else if (hasHplc) counts.hplc += 1;
      else counts.unassigned += 1;
    }
  }

  return [
    pieDatum("gc", "GC", counts.gc, CONFIG_COLORS.gc),
    pieDatum("hplc", "HPLC", counts.hplc, CONFIG_COLORS.hplc),
    pieDatum("both", "GC + HPLC", counts.both, CONFIG_COLORS.both),
    pieDatum("unassigned", "ยังไม่ได้กำหนด", counts.unassigned, CONFIG_COLORS.unassigned),
  ].filter((row): row is ConfigPieDatum => Boolean(row));
}

export function standardTimeCoverageData(summary: StandardTimeCoverageSummary[]): ConfigPieDatum[] {
  const rows: ConfigPieDatum[] = [];
  let unassigned = 0;

  summary.forEach((row, index) => {
    const label = String(row._id || "").trim() || "ไม่ระบุเครื่อง";
    const total = Math.max(0, Number(row.total) || 0);
    const withData = Math.max(0, Number(row.withData) || 0);
    const configured = Math.min(total, withData);
    unassigned += Math.max(0, total - configured);
    if (configured > 0) {
      rows.push({
        key: `instrument-${label}`,
        label,
        value: configured,
        color: STANDARD_TIME_COLORS[index % STANDARD_TIME_COLORS.length],
      });
    }
  });

  const missing = pieDatum("unassigned", "ยังไม่กำหนด", unassigned, CONFIG_COLORS.unassigned);
  return missing ? [...rows, missing] : rows;
}
```

- [ ] **Step 4: Run the metric tests and verify GREEN**

Run:

```bash
npm run test -- src/lib/dashboardMetrics.test.ts
```

Expected result: PASS for `src/lib/dashboardMetrics.test.ts`.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add src/lib/dashboardMetrics.ts src/lib/dashboardMetrics.test.ts
git commit -m "feat(dashboard): compute lab config coverage pies"
```

---

### Task 2: Lab Data Config Role Placement Helpers

**Files:**
- Modify: `src/lib/dashboardProfiles.ts`
- Modify: `src/lib/dashboardProfiles.test.ts`

**Interfaces:**
- Consumes: `DashboardProfileId`
- Produces: `type LabDataConfigCoveragePlacement = "top" | "bottom" | "hidden"`
- Produces: `hasLabDataConfigRole(roleIds: string[]): boolean`
- Produces: `labDataConfigCoveragePlacement(roleIds: string[], profileId: DashboardProfileId | null): LabDataConfigCoveragePlacement`

- [ ] **Step 1: Write the failing placement tests**

In `src/lib/dashboardProfiles.test.ts`, extend the import from `./dashboardProfiles`:

```ts
import {
  DASHBOARD_PROFILES, KPI_META, resolveProfileForRole, resolveActiveRole, resolveDashboardRole,
  hasLabDataConfigRole, labDataConfigCoveragePlacement,
} from "./dashboardProfiles";
```

Add this `describe` block before `describe("registry integrity", ...)`:

```ts
describe("Lab Data Config dashboard pie placement", () => {
  it("detects both Lab Data Config role ids", () => {
    expect(hasLabDataConfigRole(["lab-data-config"])).toBe(true);
    expect(hasLabDataConfigRole(["lab-config"])).toBe(true);
    expect(hasLabDataConfigRole(["lab-analyze"])).toBe(false);
  });

  it("places config pies at the top only for the lab-config profile", () => {
    expect(labDataConfigCoveragePlacement(["lab-data-config"], "lab-config")).toBe("top");
    expect(labDataConfigCoveragePlacement(["lab-data-config", "lab-analyze"], "lab-analyze")).toBe("bottom");
    expect(labDataConfigCoveragePlacement(["lab-analyze"], "lab-analyze")).toBe("hidden");
    expect(labDataConfigCoveragePlacement(["lab-config"], null)).toBe("bottom");
  });
});
```

- [ ] **Step 2: Run the profile tests and verify RED**

Run:

```bash
npm run test -- src/lib/dashboardProfiles.test.ts
```

Expected result: FAIL because `hasLabDataConfigRole` and `labDataConfigCoveragePlacement` are not exported.

- [ ] **Step 3: Add the placement helpers**

In `src/lib/dashboardProfiles.ts`, add this type and functions after `resolveDashboardRole()`:

```ts
export type LabDataConfigCoveragePlacement = "top" | "bottom" | "hidden";

export function hasLabDataConfigRole(roleIds: string[]): boolean {
  return roleIds.includes("lab-data-config") || roleIds.includes("lab-config");
}

export function labDataConfigCoveragePlacement(
  roleIds: string[],
  profileId: DashboardProfileId | null,
): LabDataConfigCoveragePlacement {
  if (!hasLabDataConfigRole(roleIds)) return "hidden";
  return profileId === "lab-config" ? "top" : "bottom";
}
```

- [ ] **Step 4: Run the profile tests and verify GREEN**

Run:

```bash
npm run test -- src/lib/dashboardProfiles.test.ts
```

Expected result: PASS for `src/lib/dashboardProfiles.test.ts`.

- [ ] **Step 5: Commit Task 2**

Run:

```bash
git add src/lib/dashboardProfiles.ts src/lib/dashboardProfiles.test.ts
git commit -m "feat(dashboard): resolve lab config pie placement"
```

---

### Task 3: Dashboard Data Hook Wiring

**Files:**
- Modify: `src/hooks/useDashboardData.ts`
- Modify: `src/lib/dashboardMetrics.test.ts`

**Interfaces:**
- Consumes: `hasLabDataConfigRole(roleIds)` from `src/lib/dashboardProfiles.ts`
- Consumes: `simpleMethodCoverageData(items, entries, methods)` from `src/lib/dashboardMetrics.ts`
- Consumes: `standardTimeCoverageData(summary)` from `src/lib/dashboardMetrics.ts`
- Produces: `ctx.simpleMethodCoverage`
- Produces: `ctx.standardTimeCoverage`
- Produces: `ctx.configCoverageLoading`

- [ ] **Step 1: Write the failing hook-adjacent compile guard**

In `src/lib/dashboardMetrics.test.ts`, keep the `MetricsCtx` fixture fields added in Task 1. This test suite already type-checks the `MetricsCtx` literal during `npm run test` and `npx tsc --noEmit`, so it serves as the guard that all `MetricsCtx` callers provide the new fields.

Run this command before editing the hook:

```bash
npm run test -- src/lib/dashboardMetrics.test.ts
```

Expected result: PASS from Task 1. The next production edit in this task must preserve that result.

- [ ] **Step 2: Import the new dependencies in the hook**

In `src/hooks/useDashboardData.ts`, change the dashboard profile import:

```ts
import { hasLabDataConfigRole, type DashboardProfile } from "@/lib/dashboardProfiles";
```

Change the metric import:

```ts
import {
  isAssignedToUser,
  simpleMethodCoverageData,
  standardTimeCoverageData,
  type MetricsCtx,
} from "@/lib/dashboardMetrics";
```

Add these imports:

```ts
import { normalizeRoles } from "@/lib/roles";
import type { MethodDoc } from "@/lib/methodRegistry";
```

- [ ] **Step 3: Fetch methods and Standard Time summary only for Lab Data Config users**

In `useDashboardData(profile)`, after `const kpis = new Set(profile.kpis);`, add:

```ts
  const roleIds = normalizeRoles(user);
  const wantConfigCoverage = hasLabDataConfigRole(roleIds);
```

Replace the existing `wantConfig` assignment:

```ts
  const wantConfig = need("methodGaps") || need("masterItemsTotal");
```

with:

```ts
  const wantConfig = wantConfigCoverage || need("methodGaps") || need("masterItemsTotal");
```

Update the existing slim and simple method queries so they expose loading flags:

```ts
  const { data: slim = [], isLoading: slimLoading } = useQuery({
    queryKey: ["dash", "slim"],
    enabled: wantConfig,
    queryFn: () => api.get<unknown>("/master-items/slim").then((r) => unwrapSlim(r.data.data)),
  });
  const { data: simpleMethods = [], isLoading: simpleMethodsLoading } = useQuery({
    queryKey: ["dash", "simple-methods"],
    enabled: wantConfig,
    queryFn: () => api.get<SimpleMethodEntry[]>("/simple-methods").then((r) => r.data.data),
  });
```

Add these queries after the simple method query:

```ts
  const { data: methods = [], isLoading: methodsLoading } = useQuery({
    queryKey: ["dash", "methods"],
    enabled: wantConfigCoverage,
    queryFn: () => api.get<MethodDoc[]>("/methods").then((r) => r.data.data),
  });
  const { data: standardTimeSummary, isLoading: standardTimeSummaryLoading } = useQuery({
    queryKey: ["standard-times", "summary"],
    enabled: wantConfigCoverage,
    queryFn: api.getStandardTimeSummary,
  });
```

- [ ] **Step 4: Populate the new context fields**

Inside the `useMemo()` that returns `ctx`, after `methodGaps`, add:

```ts
    const simpleMethodCoverage = wantConfigCoverage
      ? simpleMethodCoverageData(slim, simpleMethods, methods)
      : [];
    const standardTimeCoverage = wantConfigCoverage
      ? standardTimeCoverageData(standardTimeSummary?.byInstrument ?? [])
      : [];
    const configCoverageLoading = wantConfigCoverage && (
      slimLoading ||
      simpleMethodsLoading ||
      methodsLoading ||
      standardTimeSummaryLoading
    );
```

Add these fields to the returned object:

```ts
      simpleMethodCoverage,
      standardTimeCoverage,
      configCoverageLoading,
```

Add the new dependencies to the `useMemo` dependency array:

```ts
    wantConfigCoverage,
    methods,
    standardTimeSummary,
    slimLoading,
    simpleMethodsLoading,
    methodsLoading,
    standardTimeSummaryLoading,
```

- [ ] **Step 5: Run focused tests and typecheck for this task**

Run:

```bash
npm run test -- src/lib/dashboardMetrics.test.ts src/lib/dashboardProfiles.test.ts
npx tsc --noEmit
```

Expected result: both Vitest suites PASS and TypeScript completes with no errors.

- [ ] **Step 6: Commit Task 3**

Run:

```bash
git add src/hooks/useDashboardData.ts src/lib/dashboardMetrics.test.ts
git commit -m "feat(dashboard): load lab config coverage data"
```

---

### Task 4: Pie Section Component

**Files:**
- Create: `src/components/dashboard/ConfigCoveragePies.tsx`
- Create: `src/components/dashboard/ConfigCoveragePies.test.tsx`

**Interfaces:**
- Consumes: `ConfigPieDatum[]` from `src/lib/dashboardMetrics.ts`
- Produces: default React component `ConfigCoveragePies(props)`
- Props: `{ simpleMethodData: ConfigPieDatum[]; standardTimeData: ConfigPieDatum[]; loading?: boolean }`

- [ ] **Step 1: Write the failing component tests**

Create `src/components/dashboard/ConfigCoveragePies.test.tsx` with:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ConfigCoveragePies from "./ConfigCoveragePies";

describe("ConfigCoveragePies", () => {
  it("renders both pie cards and legend counts", () => {
    render(
      <ConfigCoveragePies
        simpleMethodData={[
          { key: "gc", label: "GC", value: 2, color: "hsl(217,91%,55%)" },
          { key: "both", label: "GC + HPLC", value: 1, color: "hsl(262,83%,58%)" },
        ]}
        standardTimeData={[
          { key: "instrument-GC7890A", label: "GC7890A", value: 3, color: "hsl(217,91%,55%)" },
          { key: "unassigned", label: "ยังไม่กำหนด", value: 2, color: "hsl(38,92%,50%)" },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Simple Method" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Standard Time" })).toBeInTheDocument();
    expect(screen.getByText("GC + HPLC")).toBeInTheDocument();
    expect(screen.getByText("GC7890A")).toBeInTheDocument();
    expect(screen.getAllByText("2 รายการ")).toHaveLength(2);
  });

  it("renders loading and empty states", () => {
    const { rerender } = render(
      <ConfigCoveragePies simpleMethodData={[]} standardTimeData={[]} loading />,
    );
    expect(screen.getAllByText("กำลังโหลด...")).toHaveLength(2);

    rerender(<ConfigCoveragePies simpleMethodData={[]} standardTimeData={[]} />);
    expect(screen.getAllByText("ไม่มีข้อมูล")).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the component tests and verify RED**

Run:

```bash
npm run test -- src/components/dashboard/ConfigCoveragePies.test.tsx
```

Expected result: FAIL because `ConfigCoveragePies.tsx` does not exist.

- [ ] **Step 3: Add the component implementation**

Create `src/components/dashboard/ConfigCoveragePies.tsx` with:

```tsx
import { PieChart, Pie, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { ConfigPieDatum } from "@/lib/dashboardMetrics";

interface ConfigCoveragePiesProps {
  simpleMethodData: ConfigPieDatum[];
  standardTimeData: ConfigPieDatum[];
  loading?: boolean;
}

export default function ConfigCoveragePies({
  simpleMethodData,
  standardTimeData,
  loading = false,
}: ConfigCoveragePiesProps) {
  return (
    <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
      <CoveragePieCard title="Simple Method" data={simpleMethodData} loading={loading} />
      <CoveragePieCard title="Standard Time" data={standardTimeData} loading={loading} />
    </div>
  );
}

function CoveragePieCard({
  title,
  data,
  loading,
}: {
  title: string;
  data: ConfigPieDatum[];
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <StateText>กำลังโหลด...</StateText>
        ) : data.length === 0 ? (
          <StateText>ไม่มีข้อมูล</StateText>
        ) : (
          <>
            <ChartContainer config={{ value: { label: "จำนวน" } }} className="h-[220px] w-full">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={52}
                  outerRadius={82}
                  paddingAngle={2}
                >
                  {data.map((row) => (
                    <Cell key={row.key} fill={row.color} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
              </PieChart>
            </ChartContainer>
            <div className="mt-3 grid gap-2 text-sm">
              {data.map((row) => (
                <div key={row.key} className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: row.color }} />
                    <span className="truncate text-muted-foreground">{row.label}</span>
                  </div>
                  <span className="shrink-0 font-medium tabular-nums">{row.value.toLocaleString()} รายการ</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StateText({ children }: { children: string }) {
  return <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">{children}</div>;
}
```

- [ ] **Step 4: Run the component tests and verify GREEN**

Run:

```bash
npm run test -- src/components/dashboard/ConfigCoveragePies.test.tsx
```

Expected result: PASS for `src/components/dashboard/ConfigCoveragePies.test.tsx`.

- [ ] **Step 5: Commit Task 4**

Run:

```bash
git add src/components/dashboard/ConfigCoveragePies.tsx src/components/dashboard/ConfigCoveragePies.test.tsx
git commit -m "feat(dashboard): add lab config coverage pies"
```

---

### Task 5: RoleDashboard Integration

**Files:**
- Modify: `src/pages/RoleDashboard.tsx`
- Test: `src/lib/dashboardProfiles.test.ts`
- Test: `src/components/dashboard/ConfigCoveragePies.test.tsx`

**Interfaces:**
- Consumes: `labDataConfigCoveragePlacement(roleIds, profileId)` from `src/lib/dashboardProfiles.ts`
- Consumes: `ConfigCoveragePies` from `src/components/dashboard/ConfigCoveragePies.tsx`
- Consumes: `ctx.simpleMethodCoverage`, `ctx.standardTimeCoverage`, and `ctx.configCoverageLoading`

- [ ] **Step 1: Run the existing helper/component tests before integration**

Run:

```bash
npm run test -- src/lib/dashboardProfiles.test.ts src/components/dashboard/ConfigCoveragePies.test.tsx
```

Expected result: PASS from Tasks 2 and 4.

- [ ] **Step 2: Import the pie section and placement helper**

In `src/pages/RoleDashboard.tsx`, add:

```ts
import ConfigCoveragePies from "@/components/dashboard/ConfigCoveragePies";
```

Change the existing dashboard profile import:

```ts
import {
  resolveProfileForRole,
  resolveDashboardRole,
  DASHBOARD_PROFILES,
  labDataConfigCoveragePlacement,
  type KpiId,
} from "@/lib/dashboardProfiles";
```

- [ ] **Step 3: Compute the conditional section**

After `const isQcStaff = profileId === "qc-staff";`, add:

```ts
  const labConfigCoveragePlacement = labDataConfigCoveragePlacement(roles, profileId);
  const labConfigCoverageSection = labConfigCoveragePlacement === "hidden" ? null : (
    <ConfigCoveragePies
      simpleMethodData={ctx.simpleMethodCoverage}
      standardTimeData={ctx.standardTimeCoverage}
      loading={ctx.configCoverageLoading}
    />
  );
```

- [ ] **Step 4: Render the section above or below the main dashboard**

In the returned JSX, immediately after `<DashboardHeader ... />`, add:

```tsx
      {labConfigCoveragePlacement === "top" ? labConfigCoverageSection : null}
```

At the end of the dashboard content, immediately after the existing `ActivityTimeline` render, add:

```tsx
      {labConfigCoveragePlacement === "bottom" ? labConfigCoverageSection : null}
```

- [ ] **Step 5: Run focused tests and typecheck**

Run:

```bash
npm run test -- src/lib/dashboardMetrics.test.ts src/lib/dashboardProfiles.test.ts src/components/dashboard/ConfigCoveragePies.test.tsx
npx tsc --noEmit
```

Expected result: all listed tests PASS and TypeScript completes with no errors.

- [ ] **Step 6: Commit Task 5**

Run:

```bash
git add src/pages/RoleDashboard.tsx
git commit -m "feat(dashboard): show lab config pies by role"
```

---

### Task 6: Final Verification

**Files:**
- Test only unless verification exposes a concrete defect in files changed by Tasks 1-5.

**Interfaces:**
- Consumes all previous task outputs.
- Produces verified dashboard pie implementation without build artifacts.

- [ ] **Step 1: Run the focused unit and component tests**

Run:

```bash
npm run test -- src/lib/dashboardMetrics.test.ts src/lib/dashboardProfiles.test.ts src/components/dashboard/ConfigCoveragePies.test.tsx
```

Expected result: PASS for all three suites.

- [ ] **Step 2: Run TypeScript validation**

Run:

```bash
npx tsc --noEmit
```

Expected result: TypeScript completes with no errors.

- [ ] **Step 3: Inspect the relevant diff**

Run:

```bash
git diff -- src/lib/dashboardMetrics.ts src/lib/dashboardMetrics.test.ts src/lib/dashboardProfiles.ts src/lib/dashboardProfiles.test.ts src/hooks/useDashboardData.ts src/components/dashboard/ConfigCoveragePies.tsx src/components/dashboard/ConfigCoveragePies.test.tsx src/pages/RoleDashboard.tsx
```

Expected result:

- Simple Method helper has mutually exclusive `GC`, `HPLC`, `GC + HPLC`, and `ยังไม่ได้กำหนด` categories.
- Standard Time helper uses `withData` per instrument and `sum(total - withData)` for `ยังไม่กำหนด`.
- `useDashboardData()` fetches extra config datasets only when `hasLabDataConfigRole(roleIds)` is true or existing config KPIs require the simple method/master item data.
- `RoleDashboard` renders the section at the top only for `profileId === "lab-config"` and at the bottom for other dashboards held by Lab Data Config users.
- No generated `assets/` files, root `app.html`, or seed exports are changed.

- [ ] **Step 4: Confirm prohibited commands were not run**

Confirm the current session did not run:

```text
npm run build
npm run build:dev
npm run build:watch
vite build
```

- [ ] **Step 5: Commit verification fixes if there are source fixes**

If Step 1 or Step 2 required source fixes, commit only changed source/test files from this plan:

```bash
git add src/lib/dashboardMetrics.ts src/lib/dashboardMetrics.test.ts src/lib/dashboardProfiles.ts src/lib/dashboardProfiles.test.ts src/hooks/useDashboardData.ts src/components/dashboard/ConfigCoveragePies.tsx src/components/dashboard/ConfigCoveragePies.test.tsx src/pages/RoleDashboard.tsx
git commit -m "fix(dashboard): verify lab config coverage pies"
```

If Step 1 and Step 2 pass without source fixes, do not create an empty commit.

---

## Self-Review Notes

- Spec coverage: Task 1 implements the mutually exclusive Simple Method categories and Standard Time `withData`/unassigned counts. Task 2 implements role-held placement. Task 3 loads the required source data only for Lab Data Config users. Task 4 renders the two responsive pie cards. Task 5 inserts the section above or below the existing dashboard. Task 6 verifies tests, typecheck, diff scope, and no-build policy.
- Review scan: every code-changing step names concrete files and code, and the plan has no unresolved requirement markers.
- Type consistency: `ConfigPieDatum`, `simpleMethodCoverage`, `standardTimeCoverage`, and `configCoverageLoading` are introduced in Task 1, populated in Task 3, consumed in Task 4, and rendered from `RoleDashboard` in Task 5.
