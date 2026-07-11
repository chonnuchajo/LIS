# Lab Inventory Dashboard Donut Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Lab Inventory dashboard donut summary for near-empty stock, out-of-stock items, near-expiry Standards, and today's stock deductions.

**Architecture:** Keep inventory counting in pure dashboard metric helpers, feed those helpers from `useDashboardData()`, and render a dedicated dashboard card only for the `lab-inventory` profile. Reuse existing stock status rules and Recharts/shadcn dashboard card conventions so KPI values, donut values, and the withdrawal trend all come from the same stock transaction data.

**Tech Stack:** React 18, TypeScript, Vitest, React Testing Library, TanStack Query, Recharts, shadcn/ui, Tailwind CSS.

## Global Constraints

- Do not run `npm run build`, `npm run build:dev`, `npm run build:watch`, `vite build`, or any equivalent production/dev build command.
- Do not update generated `assets/`, root `app.html`, or seed-data exports.
- Use existing client API calls: `/stock/standards`, `/stock/units`, `/stock/solvents`, `/stock/glassware`, and `/stock/transactions?action=deduct`.
- No new backend aggregate endpoint.
- Count inventory item rows, not bottles or transaction rows, for `ใกล้หมด`, `หมดสต็อก`, and `ใกล้หมดอายุ`.
- Treat Standard near empty as usable bottle count `=== 1`.
- Treat Standard out of stock as usable bottle count `=== 0`.
- Treat Solvent near empty as `qty === 1`.
- Treat Solvent out of stock as `qty === 0`.
- Treat Glassware out of stock as `qty === 0`; glassware has no near-empty state.
- Treat Standard near expiry as `summarizeStandard(...).expiringSoon > 0`.
- Today's deduction count uses stock transaction rows where `action === "deduct"` and `createdAt` is on the local calendar day.

---

## File Structure

- Modify `src/lib/dashboardMetrics.ts`: add inventory summary types/helpers, add deduction trend helper, and extend `MetricsCtx`.
- Modify `src/lib/dashboardMetrics.test.ts`: add unit tests for the new inventory summary and deduction trend helpers, and update the `MetricsCtx` fixture.
- Modify `src/hooks/useDashboardData.ts`: fetch stock units and deduction transactions for Lab Inventory metrics, populate the new `MetricsCtx` fields, and switch the existing `withdrawalsToday` value to `deduct` transactions.
- Modify `src/components/dashboard/AnalyticsSection.tsx`: make `withdrawBar` render `ctx.deductionTrend` instead of petition `createdAt` proxy data.
- Create `src/components/dashboard/LabInventorySummary.tsx`: render the donut card, count legend, loading state, and empty state.
- Create `src/components/dashboard/LabInventorySummary.test.tsx`: component tests for labels/counts, loading state, and empty state.
- Modify `src/lib/dashboardProfiles.ts`: add a pure `shouldShowLabInventorySummary(profileId)` placement helper.
- Modify `src/lib/dashboardProfiles.test.ts`: test the placement helper.
- Modify `src/pages/RoleDashboard.tsx`: render `LabInventorySummary` below the KPI row only for the Lab Inventory profile.

---

### Task 1: Inventory Metric Helpers

**Files:**
- Modify: `src/lib/dashboardMetrics.ts`
- Modify: `src/lib/dashboardMetrics.test.ts`

**Interfaces:**
- Consumes: `summarizeStandard(units, now)` from `src/lib/stockStatus.ts`
- Consumes: `StockStandardItem`, `StockSolventItem`, `StockGlasswareItem`, `StockUnitItem`, and `StockTransactionItem` from `src/types/stock.ts`
- Produces: `type LabInventorySummaryKey = "nearEmpty" | "outOfStock" | "nearExpiry" | "todayDeductions"`
- Produces: `interface LabInventorySummaryDatum { key: LabInventorySummaryKey; label: string; value: number; color: string }`
- Produces: `interface LabInventorySummary { nearEmpty: number; outOfStock: number; nearExpiry: number; todayDeductions: number; rows: LabInventorySummaryDatum[] }`
- Produces: `interface DeductionTrendDatum { date: string; count: number }`
- Produces: `function labInventorySummaryData(input): LabInventorySummary`
- Produces: `function deductionTrendData(transactions: StockTransactionItem[], now: number, days: number): DeductionTrendDatum[]`

- [ ] **Step 1: Write the failing metric tests**

In `src/lib/dashboardMetrics.test.ts`, extend the import from `./dashboardMetrics`:

```ts
import {
  ageHours, isSameLocalDay, countByStatus, statusDonutData, deptWorkloadData,
  normalDonutData, requestTrendData, completedIn, computeKpi,
  buildLabWorklist, buildQcStaffWorklist, labWorklistCounts, qcStaffWorklistCounts,
  paginateLabWorklist, assignedWeekdayData,
  labInventorySummaryData, deductionTrendData,
  type MetricsCtx,
} from "./dashboardMetrics";
```

Add these type imports after the existing `Petition` import:

```ts
import type {
  StockGlasswareItem,
  StockSolventItem,
  StockStandardItem,
  StockTransactionItem,
  StockUnitItem,
} from "@/types/stock";
```

Add these helpers after `pet()`:

```ts
function stockStandard(over: Partial<StockStandardItem>): StockStandardItem {
  return {
    _id: over._id ?? "std-id",
    code: over.code ?? "STD",
    name: over.name ?? "Standard",
    primary: { qty: 0, ordered: 0, sizeMg: null, exp: "", usesPerBottle: null, pricePerUnit: 0, totalPrice: 0 },
    supplier: { qty: 0, sizeMg: null, exp: "" },
    working: { qty: 0, sizeMg: null, exp: "" },
    usagePerUseMg: null,
    frequency: "",
    storageTemp: "",
    status: "",
    expiryStatus: "",
    ...over,
  };
}

function stockUnit(over: Partial<StockUnitItem>): StockUnitItem {
  return {
    _id: over._id ?? "unit-id",
    qrId: over.qrId ?? "qr-id",
    itemCode: over.itemCode ?? "STD",
    itemName: over.itemName ?? "Standard",
    kind: over.kind ?? "sealed",
    source: over.source ?? "primary",
    type: over.type ?? "primary",
    parentId: over.parentId ?? null,
    lotNo: over.lotNo ?? "",
    exp: over.exp ?? null,
    volume: over.volume ?? { initial: 100, remaining: 100, unit: "mg" },
    status: over.status ?? "active",
    receivedDate: over.receivedDate ?? null,
    withdrawnDate: over.withdrawnDate ?? null,
    discardedAt: over.discardedAt ?? null,
    discardReason: over.discardReason ?? "",
    ...over,
  };
}

function solvent(over: Partial<StockSolventItem>): StockSolventItem {
  return {
    _id: over._id ?? "solvent-id",
    name: over.name ?? "Solvent",
    sizeLiter: over.sizeLiter ?? 1,
    qty: over.qty ?? 0,
    price: over.price ?? 0,
    note: over.note ?? "",
    ...over,
  };
}

function glassware(over: Partial<StockGlasswareItem>): StockGlasswareItem {
  return {
    _id: over._id ?? "glass-id",
    name: over.name ?? "Glassware",
    qty: over.qty ?? 0,
    pricePerPiece: over.pricePerPiece ?? 0,
    note: over.note ?? "",
    ...over,
  };
}

function stockTxn(over: Partial<StockTransactionItem>): StockTransactionItem {
  return {
    _id: over._id ?? "tx-id",
    itemType: over.itemType ?? "standard",
    itemId: over.itemId ?? "item-id",
    itemName: over.itemName ?? "Item",
    action: over.action ?? "deduct",
    createdAt: over.createdAt ?? new Date(NOW).toISOString(),
    ...over,
  };
}

function toRowCounts(rows: { key: string; value: number }[]): Record<string, number> {
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}
```

Add this `describe` block after the existing `aggregations` block:

```ts
describe("Lab Inventory dashboard metrics", () => {
  it("labInventorySummaryData counts near empty, out of stock, near expiry, and today's deductions", () => {
    const now = new Date(2026, 6, 6, 15, 0).getTime();
    const summary = labInventorySummaryData({
      standards: [
        stockStandard({ _id: "std-near", code: "STD-NEAR", name: "Near standard" }),
        stockStandard({ _id: "std-out", code: "STD-OUT", name: "Out standard" }),
        stockStandard({ _id: "std-exp", code: "STD-EXP", name: "Expiring standard" }),
      ],
      units: [
        stockUnit({ _id: "u-near", qrId: "qr-near", itemCode: "STD-NEAR", exp: "2026-09-01" }),
        stockUnit({ _id: "u-out", qrId: "qr-out", itemCode: "STD-OUT", exp: "2026-06-01" }),
        stockUnit({ _id: "u-exp-1", qrId: "qr-exp-1", itemCode: "STD-EXP", exp: "2026-07-20" }),
        stockUnit({ _id: "u-exp-2", qrId: "qr-exp-2", itemCode: "STD-EXP", exp: "2026-09-01" }),
      ],
      solvents: [
        solvent({ _id: "sol-near", name: "Near solvent", qty: 1 }),
        solvent({ _id: "sol-out", name: "Out solvent", qty: 0 }),
        solvent({ _id: "sol-ok", name: "Ok solvent", qty: 2 }),
      ],
      glassware: [
        glassware({ _id: "glass-out", name: "Out glass", qty: 0 }),
        glassware({ _id: "glass-ok", name: "Ok glass", qty: 1 }),
      ],
      deductions: [
        stockTxn({ _id: "tx-today-1", action: "deduct", createdAt: new Date(2026, 6, 6, 9).toISOString() }),
        stockTxn({ _id: "tx-today-2", action: "deduct", createdAt: new Date(2026, 6, 6, 14).toISOString() }),
        stockTxn({ _id: "tx-receive", action: "receive", createdAt: new Date(2026, 6, 6, 10).toISOString() }),
        stockTxn({ _id: "tx-yesterday", action: "deduct", createdAt: new Date(2026, 6, 5, 10).toISOString() }),
      ],
      now,
    });

    expect(summary.nearEmpty).toBe(2);
    expect(summary.outOfStock).toBe(3);
    expect(summary.nearExpiry).toBe(1);
    expect(summary.todayDeductions).toBe(2);
    expect(toRowCounts(summary.rows)).toEqual({
      nearEmpty: 2,
      outOfStock: 3,
      nearExpiry: 1,
      todayDeductions: 2,
    });
  });

  it("deductionTrendData buckets only deduction transactions by local day", () => {
    const now = new Date(2026, 6, 6, 15, 0).getTime();
    const rows = deductionTrendData([
      stockTxn({ _id: "today-1", action: "deduct", createdAt: new Date(2026, 6, 6, 8).toISOString() }),
      stockTxn({ _id: "today-2", action: "deduct", createdAt: new Date(2026, 6, 6, 11).toISOString() }),
      stockTxn({ _id: "yesterday", action: "deduct", createdAt: new Date(2026, 6, 5, 11).toISOString() }),
      stockTxn({ _id: "receive-today", action: "receive", createdAt: new Date(2026, 6, 6, 12).toISOString() }),
    ], now, 3);

    expect(rows.map((row) => row.count)).toEqual([0, 1, 2]);
  });
});
```

- [ ] **Step 2: Run the metric tests and verify RED**

Run:

```bash
npm run test -- src/lib/dashboardMetrics.test.ts
```

Expected result: FAIL because `labInventorySummaryData` and `deductionTrendData` are not exported.

- [ ] **Step 3: Add metric helper imports and types**

In `src/lib/dashboardMetrics.ts`, add these imports near the top:

```ts
import type {
  StockGlasswareItem,
  StockSolventItem,
  StockStandardItem,
  StockTransactionItem,
  StockUnitItem,
} from "@/types/stock";
import { summarizeStandard } from "@/lib/stockStatus";
```

Add these types before the KPI dispatch section:

```ts
export type LabInventorySummaryKey = "nearEmpty" | "outOfStock" | "nearExpiry" | "todayDeductions";

export interface LabInventorySummaryDatum {
  key: LabInventorySummaryKey;
  label: string;
  value: number;
  color: string;
}

export interface LabInventorySummary {
  nearEmpty: number;
  outOfStock: number;
  nearExpiry: number;
  todayDeductions: number;
  rows: LabInventorySummaryDatum[];
}

export interface LabInventorySummaryInput {
  standards: StockStandardItem[];
  units: StockUnitItem[];
  solvents: StockSolventItem[];
  glassware: StockGlasswareItem[];
  deductions: StockTransactionItem[];
  now: number;
}

export interface DeductionTrendDatum {
  date: string;
  count: number;
}

export const EMPTY_LAB_INVENTORY_SUMMARY: LabInventorySummary = {
  nearEmpty: 0,
  outOfStock: 0,
  nearExpiry: 0,
  todayDeductions: 0,
  rows: [
    { key: "nearEmpty", label: "ใกล้หมด", value: 0, color: "hsl(38,92%,50%)" },
    { key: "outOfStock", label: "หมดสต็อก", value: 0, color: "hsl(0,72%,51%)" },
    { key: "nearExpiry", label: "ใกล้หมดอายุ", value: 0, color: "hsl(262,83%,58%)" },
    { key: "todayDeductions", label: "เบิกวันนี้", value: 0, color: "hsl(217,91%,55%)" },
  ],
};
```

- [ ] **Step 4: Add the metric helper implementation**

In `src/lib/dashboardMetrics.ts`, add these helpers after `assignedWeekdayData()`:

```ts
function unitsByItemCode(units: StockUnitItem[]): Map<string, StockUnitItem[]> {
  const byCode = new Map<string, StockUnitItem[]>();
  for (const unit of units) {
    const code = String(unit.itemCode || "").trim();
    if (!code) continue;
    const current = byCode.get(code) ?? [];
    current.push(unit);
    byCode.set(code, current);
  }
  return byCode;
}

function localDayLabel(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

export function labInventorySummaryData(input: LabInventorySummaryInput): LabInventorySummary {
  const nowDate = new Date(input.now);
  const unitsByCode = unitsByItemCode(input.units);
  let nearEmpty = 0;
  let outOfStock = 0;
  let nearExpiry = 0;

  for (const standard of input.standards) {
    const summary = summarizeStandard(unitsByCode.get(standard.code) ?? [], nowDate);
    if (summary.usable === 1) nearEmpty += 1;
    if (summary.usable === 0) outOfStock += 1;
    if (summary.expiringSoon > 0) nearExpiry += 1;
  }

  for (const item of input.solvents) {
    const qty = Number(item.qty) || 0;
    if (qty === 1) nearEmpty += 1;
    if (qty === 0) outOfStock += 1;
  }

  for (const item of input.glassware) {
    const qty = Number(item.qty) || 0;
    if (qty === 0) outOfStock += 1;
  }

  const todayDeductions = input.deductions.filter(
    (transaction) => transaction.action === "deduct" && isSameLocalDay(transaction.createdAt, input.now),
  ).length;

  return {
    nearEmpty,
    outOfStock,
    nearExpiry,
    todayDeductions,
    rows: [
      { key: "nearEmpty", label: "ใกล้หมด", value: nearEmpty, color: "hsl(38,92%,50%)" },
      { key: "outOfStock", label: "หมดสต็อก", value: outOfStock, color: "hsl(0,72%,51%)" },
      { key: "nearExpiry", label: "ใกล้หมดอายุ", value: nearExpiry, color: "hsl(262,83%,58%)" },
      { key: "todayDeductions", label: "เบิกวันนี้", value: todayDeductions, color: "hsl(217,91%,55%)" },
    ],
  };
}

export function deductionTrendData(
  transactions: StockTransactionItem[],
  now: number,
  days: number,
): DeductionTrendDatum[] {
  const buckets: DeductionTrendDatum[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const start = startOfLocalDay(now, i);
    const end = startOfLocalDay(now, i - 1);
    const count = transactions.filter((transaction) => {
      if (transaction.action !== "deduct") return false;
      const t = new Date(transaction.createdAt).getTime();
      return t >= start && t < end;
    }).length;
    buckets.push({ date: localDayLabel(start), count });
  }
  return buckets;
}
```

- [ ] **Step 5: Run the metric tests and verify GREEN**

Run:

```bash
npm run test -- src/lib/dashboardMetrics.test.ts
```

Expected result: PASS for `src/lib/dashboardMetrics.test.ts`.

- [ ] **Step 6: Commit Task 1**

Run:

```bash
git add src/lib/dashboardMetrics.ts src/lib/dashboardMetrics.test.ts
git commit -m "feat(dashboard): compute lab inventory summary metrics"
```

---

### Task 2: Dashboard Data Wiring

**Files:**
- Modify: `src/lib/dashboardMetrics.ts`
- Modify: `src/lib/dashboardMetrics.test.ts`
- Modify: `src/hooks/useDashboardData.ts`
- Test: `src/lib/dashboardMetrics.test.ts`

**Interfaces:**
- Consumes: `labInventorySummaryData(input)` from `src/lib/dashboardMetrics.ts`
- Consumes: `deductionTrendData(transactions, now, days)` from `src/lib/dashboardMetrics.ts`
- Extends: `MetricsCtx` with `labInventorySummary`, `labInventoryLoading`, and `deductionTrend`
- Produces: `ctx.labInventorySummary`
- Produces: `ctx.labInventoryLoading`
- Produces: `ctx.deductionTrend`
- Updates: `ctx.stockLow`, `ctx.stockExpiring`, `ctx.withdrawalsToday`, and `ctx.withdrawalsYesterday`

- [ ] **Step 1: Extend MetricsCtx and the test fixture**

In `src/lib/dashboardMetrics.ts`, extend `MetricsCtx` with these fields after `masterItemsTotal`:

```ts
  labInventorySummary: LabInventorySummary;
  labInventoryLoading: boolean;
  deductionTrend: DeductionTrendDatum[];
```

In `src/lib/dashboardMetrics.test.ts`, update the `ctx: MetricsCtx` fixture in the `computeKpi` block by adding:

```ts
    labInventorySummary: {
      nearEmpty: 0,
      outOfStock: 0,
      nearExpiry: 0,
      todayDeductions: 0,
      rows: [],
    },
    labInventoryLoading: false,
    deductionTrend: [],
```

- [ ] **Step 2: Run the existing metric tests before hook wiring**

Run:

```bash
npm run test -- src/lib/dashboardMetrics.test.ts
```

Expected result: PASS from Task 1.

- [ ] **Step 3: Import the new metric helpers**

In `src/hooks/useDashboardData.ts`, replace:

```ts
import { isAssignedToUser, type MetricsCtx } from "@/lib/dashboardMetrics";
```

with:

```ts
import {
  EMPTY_LAB_INVENTORY_SUMMARY,
  deductionTrendData,
  isAssignedToUser,
  labInventorySummaryData,
  type MetricsCtx,
} from "@/lib/dashboardMetrics";
```

- [ ] **Step 4: Fetch stock units and deduction transactions for Lab Inventory**

Replace the existing stock and transaction query block:

```ts
  const wantStock = need("stockLow") || need("stockExpiring");
  const { data: solvents = [] } = useQuery({ queryKey: ["dash", "solvents"], enabled: wantStock, queryFn: api.getSolvents });
  const { data: standards = [] } = useQuery({ queryKey: ["dash", "standards"], enabled: wantStock, queryFn: api.getStandards });

  const wantWithdraw = need("withdrawalsToday") || profile.analytics.some((a) => a.kind === "withdrawBar");
  const { data: txns = [] } = useQuery({
    queryKey: ["dash", "txns"],
    enabled: wantWithdraw,
    queryFn: () => api.getStockTransactions({ action: "withdraw", limit: 500 }),
  });
```

with:

```ts
  const wantStock = need("stockLow") || need("stockExpiring") || profile.id === "lab-inventory";
  const { data: solvents = [], isLoading: solventsLoading } = useQuery({
    queryKey: ["dash", "solvents"],
    enabled: wantStock,
    queryFn: api.getSolvents,
  });
  const { data: standards = [], isLoading: standardsLoading } = useQuery({
    queryKey: ["dash", "standards"],
    enabled: wantStock,
    queryFn: api.getStandards,
  });
  const { data: glassware = [], isLoading: glasswareLoading } = useQuery({
    queryKey: ["dash", "glassware"],
    enabled: wantStock,
    queryFn: api.getGlassware,
  });
  const { data: stockUnits = [], isLoading: stockUnitsLoading } = useQuery({
    queryKey: ["dash", "stock-units"],
    enabled: wantStock,
    queryFn: () => api.getStockUnits(),
  });

  const wantWithdraw = need("withdrawalsToday") || profile.analytics.some((a) => a.kind === "withdrawBar");
  const { data: txns = [], isLoading: txnsLoading } = useQuery({
    queryKey: ["dash", "txns", "deduct"],
    enabled: wantWithdraw,
    queryFn: () => api.getStockTransactions({ action: "deduct", limit: 500 }),
  });
```

- [ ] **Step 5: Populate inventory summary and trend fields**

Inside the `useMemo()` in `src/hooks/useDashboardData.ts`, after `methodGaps`, add:

```ts
    const labInventorySummary = wantStock
      ? labInventorySummaryData({
        standards,
        units: stockUnits,
        solvents,
        glassware,
        deductions: txns,
        now,
      })
      : EMPTY_LAB_INVENTORY_SUMMARY;
    const labInventoryLoading = wantStock && (
      standardsLoading ||
      stockUnitsLoading ||
      solventsLoading ||
      glasswareLoading ||
      txnsLoading
    );
    const deductionTrend = wantWithdraw ? deductionTrendData(txns, now, 7) : [];
```

In the returned `ctx` object, replace:

```ts
      stockLow: solvents.filter((s) => (s.qty ?? 0) < SOLVENT_LOW_QTY).length,
      stockExpiring: standards.filter(
        (s) => Math.min(daysUntil(s.working?.exp), daysUntil(s.supplier?.exp)) <= EXPIRY_WARN_DAYS,
      ).length,
      withdrawalsToday: txns.filter((t) => isToday(t.createdAt)).length,
      withdrawalsYesterday: txns.filter((t) => isYesterday(t.createdAt)).length,
```

with:

```ts
      stockLow: labInventorySummary.nearEmpty + labInventorySummary.outOfStock,
      stockExpiring: labInventorySummary.nearExpiry,
      withdrawalsToday: txns.filter((t) => t.action === "deduct" && isToday(t.createdAt)).length,
      withdrawalsYesterday: txns.filter((t) => t.action === "deduct" && isYesterday(t.createdAt)).length,
```

Add these fields after `masterItemsTotal: slim.length,`:

```ts
      labInventorySummary,
      labInventoryLoading,
      deductionTrend,
```

Remove the now-unused constants and helper from the top of the file:

```ts
const EXPIRY_WARN_DAYS = 180;
const SOLVENT_LOW_QTY = 3;

function daysUntil(iso?: string | null): number {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return Infinity;
  return Math.ceil((t - Date.now()) / 86_400_000);
}
```

- [ ] **Step 6: Update the `useMemo` dependency array**

In `src/hooks/useDashboardData.ts`, add these dependencies to the `useMemo` dependency array:

```ts
    stockUnits,
    glassware,
    wantStock,
    wantWithdraw,
    standardsLoading,
    stockUnitsLoading,
    solventsLoading,
    glasswareLoading,
    txnsLoading,
```

- [ ] **Step 7: Run focused validation for data wiring**

Run:

```bash
npm run test -- src/lib/dashboardMetrics.test.ts
npx tsc --noEmit
```

Expected result: metric tests PASS and TypeScript completes with no errors.

- [ ] **Step 8: Commit Task 2**

Run:

```bash
git add src/lib/dashboardMetrics.ts src/lib/dashboardMetrics.test.ts src/hooks/useDashboardData.ts
git commit -m "feat(dashboard): load lab inventory stock metrics"
```

---

### Task 3: Lab Inventory Summary Component

**Files:**
- Create: `src/components/dashboard/LabInventorySummary.tsx`
- Create: `src/components/dashboard/LabInventorySummary.test.tsx`

**Interfaces:**
- Consumes: `LabInventorySummary` from `src/lib/dashboardMetrics.ts`
- Produces: default React component `LabInventorySummaryCard`
- Props: `{ summary: LabInventorySummary; loading?: boolean }`

- [ ] **Step 1: Write the failing component tests**

Create `src/components/dashboard/LabInventorySummary.test.tsx` with:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import LabInventorySummaryCard from "./LabInventorySummary";
import type { LabInventorySummary } from "@/lib/dashboardMetrics";

function summary(over: Partial<LabInventorySummary> = {}): LabInventorySummary {
  const base = {
    nearEmpty: 2,
    outOfStock: 3,
    nearExpiry: 1,
    todayDeductions: 4,
  };
  const counts = { ...base, ...over };
  return {
    ...counts,
    rows: [
      { key: "nearEmpty", label: "ใกล้หมด", value: counts.nearEmpty, color: "hsl(38,92%,50%)" },
      { key: "outOfStock", label: "หมดสต็อก", value: counts.outOfStock, color: "hsl(0,72%,51%)" },
      { key: "nearExpiry", label: "ใกล้หมดอายุ", value: counts.nearExpiry, color: "hsl(262,83%,58%)" },
      { key: "todayDeductions", label: "เบิกวันนี้", value: counts.todayDeductions, color: "hsl(217,91%,55%)" },
    ],
  };
}

describe("LabInventorySummaryCard", () => {
  it("renders the donut summary labels and visible counts", () => {
    render(<LabInventorySummaryCard summary={summary()} />);

    expect(screen.getByRole("heading", { name: "สรุป Lab Inventory" })).toBeInTheDocument();
    expect(screen.getByText("ใกล้หมด")).toBeInTheDocument();
    expect(screen.getByText("หมดสต็อก")).toBeInTheDocument();
    expect(screen.getByText("ใกล้หมดอายุ")).toBeInTheDocument();
    expect(screen.getByText("เบิกวันนี้")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("รายการทั้งหมด")).toBeInTheDocument();
    expect(screen.getByText("2 รายการ")).toBeInTheDocument();
    expect(screen.getByText("3 รายการ")).toBeInTheDocument();
    expect(screen.getByText("1 รายการ")).toBeInTheDocument();
    expect(screen.getByText("4 รายการ")).toBeInTheDocument();
  });

  it("renders loading and empty states", () => {
    const empty = summary({ nearEmpty: 0, outOfStock: 0, nearExpiry: 0, todayDeductions: 0 });
    const { rerender } = render(<LabInventorySummaryCard summary={empty} loading />);

    expect(screen.getByText("กำลังโหลด...")).toBeInTheDocument();

    rerender(<LabInventorySummaryCard summary={empty} />);
    expect(screen.getByText("ไม่มีรายการแจ้งเตือน")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the component tests and verify RED**

Run:

```bash
npm run test -- src/components/dashboard/LabInventorySummary.test.tsx
```

Expected result: FAIL because `LabInventorySummary.tsx` does not exist.

- [ ] **Step 3: Add the component implementation**

Create `src/components/dashboard/LabInventorySummary.tsx` with:

```tsx
import { Cell, Pie, PieChart } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { LabInventorySummary } from "@/lib/dashboardMetrics";

interface LabInventorySummaryCardProps {
  summary: LabInventorySummary;
  loading?: boolean;
}

export default function LabInventorySummaryCard({
  summary,
  loading = false,
}: LabInventorySummaryCardProps) {
  const total = summary.rows.reduce((sum, row) => sum + row.value, 0);
  const chartRows = summary.rows.filter((row) => row.value > 0);

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">สรุป Lab Inventory</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <StateText>กำลังโหลด...</StateText>
        ) : total === 0 ? (
          <StateText>ไม่มีรายการแจ้งเตือน</StateText>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
            <div className="relative min-h-[220px]">
              <ChartContainer config={{ value: { label: "จำนวน" } }} className="h-[220px] w-full">
                <PieChart>
                  <Pie
                    data={chartRows}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={58}
                    outerRadius={86}
                    paddingAngle={2}
                  >
                    {chartRows.map((row) => (
                      <Cell key={row.key} fill={row.color} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
                </PieChart>
              </ChartContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold tabular-nums">{total.toLocaleString("th-TH")}</span>
                <span className="text-xs text-muted-foreground">รายการทั้งหมด</span>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {summary.rows.map((row) => (
                <div key={row.key} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: row.color }} />
                    <span className="truncate text-sm text-muted-foreground">{row.label}</span>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {row.value.toLocaleString("th-TH")} รายการ
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StateText({ children }: { children: string }) {
  return <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">{children}</div>;
}
```

- [ ] **Step 4: Run the component tests and verify GREEN**

Run:

```bash
npm run test -- src/components/dashboard/LabInventorySummary.test.tsx
```

Expected result: PASS for `src/components/dashboard/LabInventorySummary.test.tsx`.

- [ ] **Step 5: Commit Task 3**

Run:

```bash
git add src/components/dashboard/LabInventorySummary.tsx src/components/dashboard/LabInventorySummary.test.tsx
git commit -m "feat(dashboard): add lab inventory summary card"
```

---

### Task 4: Lab Inventory Dashboard Placement

**Files:**
- Modify: `src/lib/dashboardProfiles.ts`
- Modify: `src/lib/dashboardProfiles.test.ts`
- Modify: `src/pages/RoleDashboard.tsx`

**Interfaces:**
- Produces: `function shouldShowLabInventorySummary(profileId: DashboardProfileId | null): boolean`
- Consumes: `LabInventorySummaryCard` from `src/components/dashboard/LabInventorySummary.tsx`
- Consumes: `ctx.labInventorySummary` and `ctx.labInventoryLoading`

- [ ] **Step 1: Write the failing placement helper tests**

In `src/lib/dashboardProfiles.test.ts`, extend the import from `./dashboardProfiles`:

```ts
import {
  DASHBOARD_PROFILES, KPI_META, resolveProfileForRole, resolveActiveRole, resolveDashboardRole,
  shouldShowLabInventorySummary,
} from "./dashboardProfiles";
```

Add this `describe` block before `describe("registry integrity", ...)`:

```ts
describe("Lab Inventory summary placement", () => {
  it("shows the inventory summary only on the Lab Inventory dashboard profile", () => {
    expect(shouldShowLabInventorySummary("lab-inventory")).toBe(true);
    expect(shouldShowLabInventorySummary("lab-analyze")).toBe(false);
    expect(shouldShowLabInventorySummary("lab-config")).toBe(false);
    expect(shouldShowLabInventorySummary("qc-staff")).toBe(false);
    expect(shouldShowLabInventorySummary(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run profile tests and verify RED**

Run:

```bash
npm run test -- src/lib/dashboardProfiles.test.ts
```

Expected result: FAIL because `shouldShowLabInventorySummary` is not exported.

- [ ] **Step 3: Add the placement helper**

In `src/lib/dashboardProfiles.ts`, add this function after `resolveDashboardRole()`:

```ts
export function shouldShowLabInventorySummary(profileId: DashboardProfileId | null): boolean {
  return profileId === "lab-inventory";
}
```

- [ ] **Step 4: Wire the summary card into RoleDashboard**

In `src/pages/RoleDashboard.tsx`, add this import after the existing dashboard component imports:

```ts
import LabInventorySummaryCard from "@/components/dashboard/LabInventorySummary";
```

Replace the dashboard profile import:

```ts
import { resolveProfileForRole, resolveDashboardRole, DASHBOARD_PROFILES, type KpiId } from "@/lib/dashboardProfiles";
```

with:

```ts
import {
  resolveProfileForRole,
  resolveDashboardRole,
  shouldShowLabInventorySummary,
  DASHBOARD_PROFILES,
  type KpiId,
} from "@/lib/dashboardProfiles";
```

Immediately after the existing `<KpiRow ... />` block in `RoleDashboard`, add:

```tsx
      {shouldShowLabInventorySummary(profileId) ? (
        <LabInventorySummaryCard
          summary={ctx.labInventorySummary}
          loading={ctx.labInventoryLoading}
        />
      ) : null}
```

- [ ] **Step 5: Run focused placement validation**

Run:

```bash
npm run test -- src/lib/dashboardProfiles.test.ts src/components/dashboard/LabInventorySummary.test.tsx
npx tsc --noEmit
```

Expected result: profile tests PASS, component tests PASS, and TypeScript completes with no errors.

- [ ] **Step 6: Commit Task 4**

Run:

```bash
git add src/lib/dashboardProfiles.ts src/lib/dashboardProfiles.test.ts src/pages/RoleDashboard.tsx
git commit -m "feat(dashboard): show inventory summary on lab inventory profile"
```

---

### Task 5: Deduction Trend Integration

**Files:**
- Modify: `src/components/dashboard/AnalyticsSection.tsx`
- Test: `src/lib/dashboardMetrics.test.ts`

**Interfaces:**
- Consumes: `ctx.deductionTrend`
- Updates: `withdrawBar` chart source from petition `createdAt` proxy data to stock deduction transaction buckets

- [ ] **Step 1: Confirm deduction trend helper coverage**

Run:

```bash
npm run test -- src/lib/dashboardMetrics.test.ts
```

Expected result: PASS, including `deductionTrendData buckets only deduction transactions by local day`.

- [ ] **Step 2: Update `withdrawBar` data source**

In `src/components/dashboard/AnalyticsSection.tsx`, replace:

```tsx
  if (spec.kind === "withdrawBar") return <TrendBar data={requestTrendData(ctx.petitions, ctx.now, 7)} note="(ใช้ createdAt คำขอเป็นตัวแทนช่วง — การเบิกจริงดูหน้าเบิก)" />;
```

with:

```tsx
  if (spec.kind === "withdrawBar") return <TrendBar data={ctx.deductionTrend} />;
```

- [ ] **Step 3: Remove the now-unused import**

In the `dashboardMetrics` import list in `src/components/dashboard/AnalyticsSection.tsx`, keep `requestTrendData` because the `requestTrend` chart still uses it. No import removal is needed for this task.

- [ ] **Step 4: Run focused validation**

Run:

```bash
npm run test -- src/lib/dashboardMetrics.test.ts
npx tsc --noEmit
```

Expected result: metric tests PASS and TypeScript completes with no errors.

- [ ] **Step 5: Commit Task 5**

Run:

```bash
git add src/components/dashboard/AnalyticsSection.tsx
git commit -m "feat(dashboard): chart real stock deductions"
```

---

### Task 6: Final Verification

**Files:**
- Test only unless verification exposes a concrete defect in files changed by Tasks 1-5.

**Interfaces:**
- Consumes all previous task outputs.
- Produces verified Lab Inventory dashboard donut implementation without build artifacts.

- [ ] **Step 1: Run focused unit and component tests**

Run:

```bash
npm run test -- src/lib/dashboardMetrics.test.ts src/lib/dashboardProfiles.test.ts src/components/dashboard/LabInventorySummary.test.tsx
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
git diff -- src/lib/dashboardMetrics.ts src/lib/dashboardMetrics.test.ts src/hooks/useDashboardData.ts src/components/dashboard/AnalyticsSection.tsx src/components/dashboard/LabInventorySummary.tsx src/components/dashboard/LabInventorySummary.test.tsx src/lib/dashboardProfiles.ts src/lib/dashboardProfiles.test.ts src/pages/RoleDashboard.tsx
```

Expected result:

- `labInventorySummaryData()` counts Standard, Solvent, and Glassware according to the design rules.
- `deductionTrendData()` uses stock transaction `createdAt` and ignores non-`deduct` actions.
- `useDashboardData()` fetches stock transactions with `action: "deduct"`.
- `stockLow`, `stockExpiring`, and `withdrawalsToday` are populated from the same summary/transaction sources as the donut.
- `AnalyticsSection` uses `ctx.deductionTrend` for `withdrawBar`.
- `RoleDashboard` renders `LabInventorySummaryCard` only when `profileId === "lab-inventory"`.
- No generated `assets/` files, root `app.html`, or seed exports are changed.

- [ ] **Step 4: Confirm prohibited commands were not run**

Confirm the current session did not run:

```text
npm run build
npm run build:dev
npm run build:watch
vite build
```

- [ ] **Step 5: Commit verification fixes if source fixes were needed**

If Step 1 or Step 2 required source fixes, commit only changed source/test files from this plan:

```bash
git add src/lib/dashboardMetrics.ts src/lib/dashboardMetrics.test.ts src/hooks/useDashboardData.ts src/components/dashboard/AnalyticsSection.tsx src/components/dashboard/LabInventorySummary.tsx src/components/dashboard/LabInventorySummary.test.tsx src/lib/dashboardProfiles.ts src/lib/dashboardProfiles.test.ts src/pages/RoleDashboard.tsx
git commit -m "fix(dashboard): verify lab inventory summary"
```

If Step 1 and Step 2 pass without source fixes, do not create an empty commit.

---

## Self-Review Notes

- Spec coverage: Task 1 implements the counting rules and transaction trend logic. Task 2 wires existing API data and keeps KPI values consistent with the donut. Task 3 adds the visible donut/count card. Task 4 renders it only for `lab-inventory`. Task 5 replaces the withdrawal proxy trend with real `deduct` transaction buckets. Task 6 verifies tests, typecheck, diff scope, and the no-build policy.
- Placeholder scan: the plan contains no deferred requirement markers and every code-changing step includes exact code or exact replacement snippets.
- Type consistency: `LabInventorySummary`, `LabInventorySummaryDatum`, and `DeductionTrendDatum` are defined in Task 1, populated in Task 2, consumed by the component in Task 3, inserted in Task 4, and used by analytics in Task 5.
