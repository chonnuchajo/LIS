# Workflow Weekly Count Design

## Goal

Change the dashboard Workflow/weekday bar from accumulated historical counts to the number of work items in the current local week. The weekly window starts on Monday at 00:00 local time and resets automatically when a new Monday starts.

## Scope

- Lab weekday workload uses `petition.assignedTo.assignedAt`.
- QC weekday workflow uses `petition.sampleSentAt`.
- Only petitions whose selected timestamp falls inside the current local week are counted.
- The chart keeps the existing Monday-Saturday buckets, with Sunday shown only when there is Sunday data.
- Existing status donut, pipeline workflow, request trend, KPI cards, and worklist tables are unchanged.

## Data Rules

The shared weekday aggregation should accept:

- `petitions`: source petition rows.
- `now`: current timestamp, used to compute the current local week.
- `basis`: which date source to use.

For Lab:

- Primary timestamp: `assignedTo.assignedAt`.
- Fallback: existing assignment fallback only if the primary value is missing, so legacy data can still appear.
- A petition without an assignee is not counted.

For QC:

- Primary timestamp: `sampleSentAt`.
- Fallback: `createdAt`, to avoid dropping older records that predate `sampleSentAt`.
- Assignee is not required.

## UI Behavior

- Lab Analyze dashboard analytics chart uses the Lab basis.
- QC Staff dashboard Workflow summary uses the QC basis.
- Other usages of `assignedWeekdayBar`, if any, must explicitly choose the relevant basis or keep the default Lab basis only where the chart means assigned work.
- Empty current-week data keeps the existing empty state.

## Architecture

Update `src/lib/dashboardMetrics.ts` so the week-window and weekday bucketing live in the metrics layer, not in UI components. `WorkflowSummary` and `AnalyticsSection` pass `ctx.now`/`now` and the correct basis to the helper.

This keeps:

- Date boundary logic testable.
- UI components focused on rendering.
- Lab and QC behavior consistent while using different timestamp sources.

## Testing

Add focused tests in `src/lib/dashboardMetrics.test.ts` for:

- Current-week filtering excludes previous-week work.
- Monday reset behavior using a Monday `now`.
- Lab basis counts by `assignedTo.assignedAt`.
- QC basis counts by `sampleSentAt`.
- Sunday remains hidden unless there is Sunday data.

Validate with a focused test command, not a build command.
