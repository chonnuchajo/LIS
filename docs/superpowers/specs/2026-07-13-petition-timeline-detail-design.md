# Petition Timeline Detail Design

## Goal

Replace the current cross-petition Gantt at `/petition-timeline` with a petition list that follows the established `/petitions` workflow. Selecting a petition opens a dedicated operational timeline dashboard at `/petition-timeline/:id`.

The dashboard is a read and print view for one petition. It must make the petition's current progress, work performed, required parameter tasks, and available print documents easy to scan without changing the existing petition detail workflow.

## Route and Navigation

- Keep `/petition-timeline` as the protected navigation entry.
- Make `/petition-timeline` a petition list with the same search, status filtering, paging, visibility rules, loading state, error state, and empty state behavior as `/petitions`.
- Selecting a list row opens `/petition-timeline/:id`.
- Add a protected `/petition-timeline/:id` route. It loads one petition independently and provides a back action to `/petition-timeline`.
- Do not change `/petitions/:id`, its action controls, or its result mode.

## Detail Header

The dashboard header contains the petition number as the title, current status, requester, assignee, and a stable sample-image area.

- Start time is the first actual receiving timestamp: `qcReceivedAt`, `labReceivedAt`, or `receivedAt`. If no sample has been received, show the submitted time and label it as submitted rather than received.
- End time is actual for closed petitions: the latest available final timestamp from `approvedAt`, `rejectedAt`, `completedAt`, `labApprovedAt`, `labCompletedAt`, or `qcCompletedAt`.
- For open petitions, show a provisional end time of 20:00 on the active operational day. If the work is already spanning days, the dashboard labels it as ongoing and uses the current time as the visible end of the timeline. This is explicitly an estimate, not a stored service-level commitment.
- The image area displays an existing sample image only when the current petition data exposes one. Until then it is a fixed-size, neutral placeholder and does not imply that an image was uploaded.

## Progress and Tasks

Create a focused frontend helper that derives an operational task model from the petition, parameter definitions, QC results, and Lab completion state.

- Each applicable parameter with one or more required, non-photo value fields is a task. A task is complete only when all of its required values are recorded and the relevant track has completed its approval workflow.
- Progress is `completed required value fields / all required value fields`, rounded to a whole percentage. It remains below 100% until the applicable final approval is recorded; an approved petition displays 100%.
- Tasks show parameter name, item/sample context when needed, current status, and a compact progress indicator.
- Parameters that are not applicable to any petition item are excluded. Photo-only fields are excluded from the numeric completion count, matching the existing QC completion heuristic.
- Data that is not available to the signed-in role remains hidden using the same role, lab parameter, and item-group visibility logic as the petition list and testing pages.

## Operational Timeline

The dashboard's `Project Timeline` is for a single petition, not a comparison of multiple petitions.

- For work visible within one operational day, the horizontal axis is 08:00 through 20:00.
- For work that crosses a day boundary, the axis starts at 08:00 on the start date and ends at the current time for open work, or the actual completion time for closed work. Date labels appear at every day boundary.
- Rows represent lifecycle stages: receive, assign/accept, parameter entry, QC completion, Lab completion and approval when applicable, and final approval or rejection.
- The timeline is derived only from actual lifecycle timestamps, audit events, and result-entry timestamps. It must not use `updatedAt` as a workflow event.
- Missing events render as pending. Invalid or out-of-order timestamps do not hide the petition or create negative timeline bars.

## Recent Activity

The right-side activity stream is scoped to the selected petition and starts with the most recent entries.

- Primary data source: the existing `/api/petitions/status-log/:id` response and petition audit events.
- Display events for submission, sample receipt, assignment, result entry and result edits, status changes, review, final approval, and rejection when present.
- Each entry includes actor, concise event text, and time. Parameter activity includes the parameter name when the audit metadata supplies it.
- A `View all` control expands or navigates to the complete activity history for that petition only.
- If activity data fails to load, show the petition lifecycle milestones that can be derived from the detail response, and retain a retry control.

## Documents

The Documents panel reuses existing print previews and eligibility rules from `PetitionDetailPage`.

- Sample label is available when `canPrintSampleLabel` permits it.
- Service request is available only when a Lab request exists.
- Pre Report is available when `canPrintPreReport` permits it.
- Final Report is available only after approval.
- The panel lists unavailable document types as disabled or omitted according to the existing page convention. It does not create files or add attachment storage.

## Component Boundaries

- `PetitionTimelinePage` becomes the list container and delegates row display to the existing petition-list pattern where practical.
- `PetitionTimelineDetailPage` owns data loading and dashboard composition.
- A pure `petitionTimelineDetail` helper derives header timing, timeline ranges, activity fallbacks, tasks, and progress. It has no React or API dependencies.
- A small activity adapter normalizes the existing status-log response for display.
- Existing print templates, printability predicates, and dialogs are reused rather than copied.

## Errors, Loading, and Empty States

- The list and detail both retain the existing retry pattern for data failures.
- The detail page shows independent loading/error states for petition, parameter/task, activity, and document data so an auxiliary failure does not blank the whole page.
- A petition with no applicable required parameters shows `-` for task progress rather than a misleading 100%.
- The activity and task panels provide an explicit empty state when no records are available.

## Testing and Verification

- Add unit tests for the detail helper: receive/start timing, same-day and cross-day timeline windows, closed versus open end handling, required-task progress, hidden/non-applicable parameters, and missing timestamps.
- Add route and component tests for list-to-detail navigation, activity fallback/error state, document availability, and no leakage of Lab-only information while parameter visibility is loading.
- Run `npx tsc --noEmit`, focused Vitest suites, targeted backend tests for the status-log adapter if changed, and desktop/mobile route smoke checks.
- Do not run production or Vite build commands under the repository's no-build policy.

## Out of Scope

- New image uploads or attachment storage.
- New backend aggregation endpoints, unless existing detail and status-log responses prove insufficient during implementation.
- Drag-and-drop scheduling or duration commitments.
- Changes to the existing petition detail page's editing, assignment, approval, or printing behavior.
