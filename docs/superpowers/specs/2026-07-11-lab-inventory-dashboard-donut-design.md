# Lab Inventory Dashboard Donut

**Date:** 2026-07-11
**Status:** Design approved

## Goal

Add a Lab Inventory dashboard summary that shows a donut chart for inventory attention items and a clear count of today's stock deductions.

The dashboard should answer four operational questions at a glance:

- How many inventory items are near empty.
- How many inventory items are out of stock.
- How many Standards are near expiry.
- How many stock deduction transactions happened today.

## Placement

Show the new summary whenever the current user holds the `lab-inventory` role,
independent of the resolved primary dashboard profile.

Placement depends on the resolved primary dashboard:

- If the primary dashboard profile is `lab-inventory`, place it below the
  existing KPI row and above the main dashboard grid.
- If the user holds `lab-inventory` alongside another primary working role
  such as `lab-analyze`, keep that primary dashboard first and place the
  Inventory summary below the primary dashboard content.

This means a user with both `lab-analyze` and `lab-inventory` should still see
the Lab Analyze dashboard first, with the Inventory data shown below it rather
than choosing only one dashboard.

Desktop layout:

- One card containing the donut chart and visible legend/count rows.
- The card can sit full width above the existing two-column dashboard grid.

Mobile layout:

- Chart and count rows stack vertically.
- Essential counts remain visible without hover.

## Counting Rules

### Stock Sources

The summary uses existing client-side API calls:

- `/stock/standards`
- `/stock/units`
- `/stock/solvents`
- `/stock/glassware`
- `/stock/transactions?action=deduct`

No new backend aggregate endpoint is required.

### Near Empty

Count inventory item rows, not bottles or transaction rows.

- Standard: `summarizeStandard(unitsByCode[standard.code]).usable === 1`
- Solvent: `qty === 1`
- Glassware: no near-empty state, because existing stock rules treat glassware as only out or ok.

### Out Of Stock

Count inventory item rows.

- Standard: usable bottle count is `0`.
- Solvent: `qty === 0`.
- Glassware: `qty === 0`.

### Near Expiry

Count Standard item rows with at least one active usable bottle expiring soon:

- `summarizeStandard(...).expiringSoon > 0`

This follows the existing `summarizeStandard` default window, currently 30 days.

Expired Standards are not part of the requested donut categories unless they also have a separate stock condition. They still reduce usable bottle count, so an item can become out of stock when all non-expired bottles are gone.

### Today's Deductions

Count `StockTransactionItem` rows where:

- `action === "deduct"`
- `createdAt` falls on the user's local calendar day.

This replaces the current `withdrawalsToday` dashboard data source, which asks for `action: "withdraw"` even though current stock deduction flows record `action: "deduct"`.

The existing KPI label `เบิกวันนี้` can continue to use the `withdrawalsToday` metric name internally, but its value should come from deduction transactions.

## Visualization

Use a donut chart with these slices:

- `ใกล้หมด`
- `หมดสต็อก`
- `ใกล้หมดอายุ`
- `เบิกวันนี้`

Show a legend/list next to or below the chart with the exact number for every slice. The numbers must not depend on hover.

If all values are zero, show an empty state instead of a blank donut.

Use Recharts through the existing shadcn chart wrapper where practical, matching dashboard card conventions already used in `AnalyticsSection` and `WorkflowSummary`.

## Data Flow

Add pure helpers in `src/lib/dashboardMetrics.ts`:

- `labInventorySummaryData(...)` returns donut rows and raw counts.
- `deductionTrendData(transactions, now, days)` returns daily deduction counts from stock transaction rows.

Update `MetricsCtx` to include:

- `labInventorySummary`
- `deductionTrend`
- existing `withdrawalsToday` and `withdrawalsYesterday` populated from `deduct` transactions

Update `useDashboardData()`:

- Detect held roles from the current user. Fetch Inventory summary data when
  `roleIds.includes("lab-inventory")`, even if the resolved profile is
  `lab-analyze`.
- Fetch stock units when the profile needs Lab Inventory stock metrics or the
  user holds `lab-inventory`.
- Fetch stock transactions with `action: "deduct"` when the profile needs
  `withdrawalsToday`, the `withdrawBar` analytic, or the user holds
  `lab-inventory`.
- Compute `stockLow`, `stockExpiring`, and donut data from the same stock sources so KPI and donut counts are consistent.
- Keep existing KPI names, with these values:
  - `stockLow = nearEmpty + outOfStock`
  - `stockExpiring = nearExpiry`
  - `withdrawalsToday = todayDeductions`

Update `AnalyticsSection`:

- Make `withdrawBar` use `ctx.deductionTrend`, not petition `createdAt` proxy data.
- Remove or update the existing note that says the chart uses request `createdAt` as a proxy.

Add a small dashboard component:

- `src/components/dashboard/LabInventorySummary.tsx`
- Props should consume computed summary rows from `MetricsCtx`, not fetch directly.

Render this component from `RoleDashboard` when the current role list includes
`lab-inventory`.

Placement in `RoleDashboard`:

- `profileId === "lab-inventory"`: render directly after the KPI row.
- any other `profileId` with `lab-inventory` held: render after the main
  dashboard content, so the primary dashboard stays first.

## Error And Loading States

If stock queries are loading, show a compact loading state in the summary card.

If transaction query fails, React Query's existing behavior leaves the default data empty. The card should still render stock alert counts, and the deduction count should be `0` until data is available.

## Testing

Use TDD before production edits.

Unit tests in `src/lib/dashboardMetrics.test.ts` should cover:

- Standard with one usable bottle counts as near empty.
- Standard with zero usable bottles counts as out of stock.
- Solvent qty `1` counts as near empty.
- Solvent qty `0` counts as out of stock.
- Glassware qty `0` counts as out of stock and glassware qty `1` does not count as near empty.
- Standard with `expiringSoon > 0` counts as near expiry.
- Today's deduction count uses local day and `action: "deduct"`.
- Deduction trend uses transaction dates, not petition dates.

Component tests should cover:

- Lab Inventory summary renders all labels and counts.
- Empty summary shows an empty state.
- The component is inserted for a user who holds `lab-inventory` even when the
  primary profile is `lab-analyze`.

Focused validation commands:

- `npm run test -- src/lib/dashboardMetrics.test.ts`
- `npm run test -- src/components/dashboard/LabInventorySummary.test.tsx`
- `npx tsc --noEmit`

Do not run production or development build commands.

## Out Of Scope

- No backend aggregate endpoint.
- No production build.
- No generated `assets/` or root `app.html` changes.
- No redesign of the Stock page tabs.
- No new threshold setting UI.
