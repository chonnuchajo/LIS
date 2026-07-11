# Lab Data Config Dashboard Pies

**Date:** 2026-07-11
**Status:** Approved design, written spec pending review

## Goal

When a user has the Lab Data Config role (`lab-data-config` or `lab-config`),
the dashboard shows two pie charts for configuration coverage:

- Simple Method coverage.
- Standard Time coverage.

The charts appear as an additional section, not as a replacement for the user's
main working dashboard.

## Placement

The app currently resolves one primary dashboard role for the home page. Lab/QC
base working roles such as `lab-analyze` and `qc-staff` can intentionally win
the home profile when higher-level family roles are also assigned.

Therefore the Lab Data Config charts should be rendered whenever the user holds
`lab-data-config` or `lab-config`, independent of the resolved primary
dashboard profile.

Placement follows role rank:

- If the resolved dashboard profile is `lab-config`, show the pie section near
  the top of the dashboard before the main content.
- Otherwise, show the pie section after the main dashboard content so the
  user's primary working dashboard stays first.

Layout:

- Desktop: two cards side by side.
- Mobile/tablet: stacked cards.

## Simple Method Pie

Source data:

- `/master-items/slim`
- `/simple-methods`
- `/methods`

Counting unit:

- One active-substance slot from a master item's common name.
- A product with multiple active substances contributes one slot per parsed
  substance.

Category rules:

- `GC`: the slot has at least one configured machine-backed method whose
  `machinePrefix` resolves to `GC`, and no HPLC method.
- `HPLC`: the slot has at least one configured machine-backed method whose
  `machinePrefix` resolves to `HPLC`, and no GC method.
- `GC + HPLC`: the slot has at least one GC method and at least one HPLC method.
- `ยังไม่ได้กำหนด`: the slot has no GC or HPLC method configured.

Non-machine methods do not count as GC/HPLC. If a slot only has non-machine
methods, it still belongs to `ยังไม่ได้กำหนด` for this chart because the chart
tracks GC/HPLC assignment coverage.

Legacy Simple Method entries that only have `instruments` are read through the
existing `readSlotMethods()` compatibility helper.

## Standard Time Pie

Source data:

- `/standard-times/summary`

Counting unit:

- One Standard Time row, representing one analysis/substance row for an
  instrument.

Category rules:

- Each instrument with configured standard time becomes one slice. The slice
  label is the instrument name from the summary `_id`; the value is `withData`.
- `ยังไม่กำหนด`: sum of `total - withData` across all instruments.

Rows count as unconfigured when `hasData=false` or the standard time value is
blank/null, which is already reflected in the summary's `withData` count.

## Data Flow

`useDashboardData()` should fetch the additional config datasets only when the
current user holds the Lab Data Config role or when the current profile needs
the same data for existing KPIs.

Pure helpers in `src/lib/dashboardMetrics.ts` should compute:

- Simple Method pie rows from master items, simple methods, and method registry
  documents.
- Standard Time pie rows from standard time summary rows.

The dashboard UI consumes already-computed rows from `MetricsCtx` and renders
them through a small reusable pie section/component.

## Testing

Use TDD before production edits.

Unit tests should cover:

- Simple Method GC-only slots.
- Simple Method HPLC-only slots.
- Simple Method slots that contain both GC and HPLC.
- Simple Method unconfigured slots.
- Non-machine methods do not count as GC/HPLC.
- Standard Time per-instrument `withData` slices.
- Standard Time unconfigured total from `total - withData`.

Focused validation commands:

- `npm run test -- src/lib/dashboardMetrics.test.ts`
- `npm run test -- src/lib/dashboardProfiles.test.ts`
- `npx tsc --noEmit`

Do not run production or development build commands.

## Out Of Scope

- No new backend aggregate endpoint.
- No production build.
- No changes to generated `assets/`, root `app.html`, or seed exports.
- No redesign of Access Control role management.
