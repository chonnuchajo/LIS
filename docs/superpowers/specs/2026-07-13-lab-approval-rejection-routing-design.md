# Lab approval: approve/reject wording and rejection routing

Date: 2026-07-13  
Status: approved

## Goal

On `/lab-approval/:id`, replace the Lab Head decision wording with **อนุมัติ** and **ไม่อนุมัติ**.  A Lab Head who chooses **ไม่อนุมัติ** must provide a reason and select exactly one destination:

1. one Lab tester who recorded results for the petition;
2. the original requester; or
3. a QC Head, who makes a second decision from the same read-only result review.

The decision must be persisted with a recipient, reason, actor, timestamp, and audit-history entry.

## Chosen approach

Create an explicit Lab-result escalation state and a separate QC Head work queue.  This keeps the existing QC Final Result approval queue focused on completed QC work, while allowing QC Head confirmation to use the same Lab result review component.

The alternatives considered were:

- add these records to the existing QC Final Result queue (less code, but mixes a Lab escalation with a final QC decision);
- store only a note against the existing Lab rejection (does not route work or allow QC Head confirmation).

## User flow

### Lab Head

- The fixed decision panel shows **อนุมัติ** and **ไม่อนุมัติ**.
- **อนุมัติ** preserves the existing Lab approval workflow and only changes confirmation and toast wording to say “อนุมัติ”.
- **ไม่อนุมัติ** opens one dialog.  The dialog requires a reason and a destination before its submit action is enabled.
- Destination **ผู้ตรวจ Lab** shows a required single-select list of people who recorded Lab results for this petition.  Submitting clears the Lab completion/approval markers, records the selected recipient, and returns the Lab work to that person for correction.
- Destination **ผู้ยื่นคำร้อง** closes the petition as rejected, records the reason and requester destination, and uses the existing rejected-petition revision flow.
- Destination **QC Head** leaves the recorded Lab result unchanged, creates a pending QC Head confirmation task, and removes the item from the Lab Head approval queue.

### QC Head

- QC Head has a distinct “รอยืนยันผล Lab” queue below `/qc-approval`; it contains only pending Lab-result escalations.
- Opening an item renders the same read-only Lab result review (samples, values, criteria, abnormal flags, Lab agreement review, and the Lab Head’s reason).  It does not expose Lab result editing.
- The QC Head decision panel has **อนุมัติ** and **ไม่อนุมัติ**.  Approval completes the Lab approval step and records the QC Head as the confirming reviewer.
- A QC Head rejection uses the same dialog and may route to a tester, requester, or a new QC Head confirmation.  Re-escalating refreshes the pending task and records a new audit event.

## Data and API contract

Add a Lab-decision routing record to a petition.  It stores:

- `status`: `pending-qc-head-confirmation` or absent when no escalation is pending;
- `reason`, `requestedBy`, and `requestedAt`;
- destination kind: `tester`, `requester`, or `qc-head`;
- a selected tester identifier and display name for the tester destination; and
- confirmation actor and timestamp when QC Head approves.

Extend review/audit action enums with dedicated events for Lab rejection routing, QC Head escalation, and QC Head Lab confirmation.  Audit metadata includes the destination and named recipient, never just a free-text label.

Replace the narrow `lab-reject` request with a decision endpoint that accepts `{ actor, note, target, recipientId? }`.  The server validates all of the following before making changes:

- a non-blank reason and one of the three permitted target values;
- an eligible selected tester for `tester`;
- at least one active user with the QC Head role before creating a QC Head queue task;
- a pending escalation and QC Head authority for QC Head approval/rejection; and
- that the petition is neither closed nor already Lab-approved.

Add a petition-list filter for pending QC Head Lab confirmations, plus endpoints for QC Head confirmation and re-routing.  The frontend API wrapper exposes typed methods for each operation and no screen calls `fetch` directly for this workflow.

## Access and navigation

- Lab Head retains access to `/lab-approval` and its normal approval-detail route.
- QC Head receives access to the dedicated Lab-confirmation queue and its detail route under `/qc-approval`; it does not receive general Lab result editing access.
- The confirmation detail route shares the review display with `LabApprovalReviewPage`, but derives its controls and API calls from an explicit review mode.  It does not rely on the Lab Head path permission.
- Existing Lab approval and QC Final Result queue permissions and behavior remain unchanged for items that are not escalated.

## Failure handling

The server rejects stale, terminal, unauthorized, missing-recipient, or invalid-target requests with a clear error.  The dialog remains open on failure, keeps the selected target and reason, and shows an error toast.  Both queues refresh after a successful decision; a user who opens an item already actioned by someone else sees the existing not-found/stale-item handling.

## Testing

Add focused server tests for routing validation and each state transition:

- Lab Head approve succeeds and retains the existing completion semantics;
- tester routing requires one eligible tester, resets the Lab track, and retains the recipient and reason;
- requester routing closes the petition as rejected;
- QC Head routing preserves Lab results and creates one pending confirmation;
- only QC Head can approve/reject a pending confirmation;
- QC Head approval records the confirmation and completes the Lab approval stage; and
- invalid, stale, or unauthorized requests make no state change.

Add React tests for the Lab Head action labels, disabled rejection submit state, all three target choices, selected-tester requirement, and QC Head decision controls.  Cover that the Lab Head page does not expose controls to a QC Head and that the QC Head confirmation view does not expose result-editing controls.
