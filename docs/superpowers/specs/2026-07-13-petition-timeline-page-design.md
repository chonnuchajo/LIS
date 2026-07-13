# Petition Timeline Page Design

## Goal

Add a main navigation page that shows a timeline view for each visible petition. The page should resemble the provided project timeline reference: a summary header, timeline/Gantt rows, recent activity-style context, and supporting petition details. The first version must use existing petition data and avoid backend changes unless a missing data point blocks the UI.

## Route and Navigation

- Add a protected route at `/petition-timeline`.
- Add a nav item labeled `Timeline คำร้อง` with a timeline-oriented Lucide icon.
- Add the page to access-control defaults so users who can see petition work can also see the new timeline page by default.
- Keep petition detail pages unchanged; clicking a petition row opens `/petitions/:id`.

## Data Source

Use `usePetitionList` with the existing list endpoint.

- Admin users load paginated server data like the petition list.
- Non-admin users load a larger list and apply the same visibility rules used by `PetitionListPage`.
- The timeline is derived from petition fields that already exist:
  - `createdAt` or `submittedBy.submittedAt`
  - `sampleSentAt`
  - `receivedAt`, `qcReceivedAt`, `labReceivedAt`
  - `assignedTo.assignedAt`
  - `firstResultAt`
  - `qcCompletedAt`, `labCompletedAt`, `labApprovedAt`
  - `completedAt`, `approvedAt`, `rejectedAt`
  - `updatedAt` as a fallback only for sorting and "last updated" context

No fabricated dates should be created. Missing milestones are rendered as pending or omitted depending on the row context.

## Timeline Model

Create a focused frontend helper that converts a petition into timeline segments and milestones.

Segments:
- Intake: submitted to sample sent or received.
- Receive and assign: received to assigned or current.
- Testing: assigned or received to completion/current.
- Lab approval: lab completed to lab approved, only when the petition has a Lab track.
- Final result: completed to approved/rejected/current.

Milestones:
- Submitted
- Sample sent
- QC received
- Lab received
- Assigned
- First result
- QC completed
- Lab completed
- Lab approved
- Final result or rejected

The page range is computed from visible rows. It should clamp to a useful visible window if only one date is available, so the chart remains readable.

## UI

Use the existing `AppLayout`, `PageHeader`, cards, badges, buttons, inputs, and Tailwind patterns.

Top summary:
- Total visible petitions
- In progress count
- Completed/final result count
- Overdue or waiting count based on petitions that are not closed and have been idle for more than 24 hours from the best available timestamp

Controls:
- Search by petition number, submitter, sample name, or batch number
- Status filter
- Date range selector using native date inputs
- Compact list size suitable for operational scanning

Main view:
- Left columns: petition number, status badge, sample summary, requester/assignee.
- Right timeline grid: month/day ticks, colored horizontal bars, milestone dots, and a vertical "today" marker when today is inside the range.
- Rows should keep stable height and support horizontal overflow on small screens.

Side/supporting panels:
- Recent activity summary can use latest milestone per petition from derived data.
- Documents are not added in this version because the current petition model does not expose document attachments for this page.

## Error and Empty States

- Loading state: show a simple skeleton or muted loading block.
- Error state: show the existing retry pattern with `refresh`.
- Empty state: explain whether no petitions match filters or there are no visible petitions.
- Invalid or missing dates: keep the petition in the list and show pending milestones rather than hiding the row.

## Testing

Add focused tests for the pure timeline helper:
- Builds segments from normal petition timestamps.
- Handles Lab-track and QC-only petitions.
- Handles missing dates without producing invalid ranges.
- Marks closed petitions correctly.

Add or update nav/access tests:
- `NAV_ITEMS` includes `/petition-timeline`.
- Access-control implication does not accidentally grant unrelated petition nav pages.

Run validation with `npx tsc --noEmit` and focused tests. Do not run build commands.

## Out of Scope

- No new backend aggregation endpoint.
- No PDF/document attachment panel.
- No drag-and-drop scheduling.
- No production build.
