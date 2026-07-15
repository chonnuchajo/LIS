# Petition Documents: hide sample label after receive + add "พิมพ์ผลวิเคราะห์ Lab"

**Date:** 2026-07-15
**Branch:** develop
**Scope:** Two focused UI changes on the petition timeline detail page and the petition detail page. Pure reuse of existing report/print infrastructure — no backend changes.

## Problem

1. On `/petition-timeline/:id`, the **Documents** card always shows the "ป้ายนำส่งตัวอย่าง" (sample-submission label) button, even after QC or Lab has already received the sample. Once received, the label is obsolete (the sample is already in the lab's hands). The `/petitions/:id` detail page already hides its equivalent button in this case; the timeline is inconsistent.

2. There is no way to print the Lab analysis result (ผลวิเคราะห์ Lab) directly from `/petition-timeline/:id` or `/petitions/:id`. The report already exists at the standalone `/lab-results/:id` page but requires navigating away.

## Goals

- Hide the sample-label button on the timeline once QC **or** Lab has received (match `/petitions/:id` behavior).
- Add a "พิมพ์ผลวิเคราะห์ Lab" button to both the timeline Documents card and the `/petitions/:id` detail page, opening an inline print preview, shown only when Lab has finished/issued results.

## Non-goals

- No change to the `/petitions/:id` sample-label gating (already correct).
- No backend, data-model, or route changes.
- No change to the report layout itself (`LabResultReportTemplate`).

## Design

### Part 1 — Gate the timeline sample-label button

Reuse the existing pure helper `canPrintSampleLabel(petition)` from `src/lib/petitionPrintability.ts`, which returns `false` once `qcReceivedBy` or `labReceivedBy` is set.

- `PetitionTimelineDetailPage.tsx`: import `canPrintSampleLabel`; wrap the "ป้ายนำส่งตัวอย่าง" button (currently `~:546`) in `{canPrintSampleLabel(petition) && …}`.

No new logic — the same helper the `/petitions/:id` page already uses, so both pages stay identical.

### Part 2 — "พิมพ์ผลวิเคราะห์ Lab" button

Reuse the existing report path that already powers `/lab-results/:id`:
`buildApprovalGroups` → `buildLabReportPages` → `<LabResultReportTemplate pages={…} />` inside `<PrintPreviewDialog docType="coa" css={LAB_REPORT_CSS}>`.

**New shared helper** — `src/lib/labResultReport.ts` (pure, unit-tested):

```ts
buildLabResultReportPages({ petition, labRequests, parameters, qcResults, groupMembership }): LabReportPage[]
```

Internally: filter `parameters` to `scope === 'lab'` (excludes QC params shared to Lab, e.g. ค่า ถพ.), run `buildApprovalGroups`, then `buildLabReportPages`. This collapses the three steps into one code path used by all consumers.

**New visibility helper** — in `src/lib/petitionPrintability.ts`:

```ts
canPrintLabResult(petition) = !!(petition.labCompletedAt || petition.labApprovedAt)
```

Matches the product decision "show when Lab has finished/issued results". These fields exist only when the petition has lab work, so the check also implies "has lab" — no separate `labRequests` check needed. The button is additionally hidden when the built `pages` array is empty, to avoid an empty preview.

**Consumers** (both already load `parameters`, `qcResults`, `groupMembership`, `labRequests` — no new fetching):

- `PetitionTimelineDetailPage.tsx`: add `labResultOpen` state; compute `labReportPages` via `useMemo(buildLabResultReportPages(...))`; add a full-width Documents-card button with a new `documentButtonColors.labResult` (sky, matching the Lab theme), routed through the existing `openDocument(setLabResultOpen)` loader; add a `<PrintPreviewDialog docType="coa" css={LAB_REPORT_CSS}>` rendering `<LabResultReportTemplate pages={labReportPages} />`. Button shown when `canPrintLabResult(petition) && labReportPages.length > 0`.
- `PetitionDetailPage.tsx`: same computation; add a `size="sm"` PageHeader action button next to the existing print buttons, plus the matching dialog. Same visibility condition.

**Optional DRY refactor:** update `LabResultDetailPage.tsx` to call `buildLabResultReportPages` instead of inlining the three steps (same output; single code path). Low risk; included.

## Testing

- `src/lib/labResultReport.test.ts` — helper filters to lab-scope params and builds pages from raw data; empty when no lab results.
- `src/lib/petitionPrintability.test.ts` — extend: `canPrintLabResult` true when `labCompletedAt` or `labApprovedAt` set, false otherwise.
- Type-check with `npx tsc -p tsconfig.app.json --noEmit` (real type-check per project note).

## Files touched

- `src/lib/petitionPrintability.ts` (+ `.test.ts`) — add `canPrintLabResult`.
- `src/lib/labResultReport.ts` (+ `.test.ts`) — new shared helper.
- `src/pages/PetitionTimelineDetailPage.tsx` — gate sample label + add lab-result button/dialog.
- `src/pages/PetitionDetailPage.tsx` — add lab-result button/dialog.
- `src/pages/LabResultDetailPage.tsx` — optional refactor to shared helper.
