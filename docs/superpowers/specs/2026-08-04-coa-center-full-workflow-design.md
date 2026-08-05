# COA Center full workflow

Date: 2026-08-04

## 1. Goal

Create a dedicated page for issuing COA documents with a full approval, revision, cancellation, and audit workflow. The page must support user-selected samples, QC Head approval before printing, automatic COA numbering, and immutable issued document history.

This is not only a print button. It is a document-control workflow for Certificate of Analysis documents generated from approved Lab results.

## 2. Requirements

| # | Requirement | Source |
|---|---|---|
| R1 | Add a dedicated COA management page, separate from the current Lab Results detail page. | User selected full workflow |
| R2 | Users can choose which petition items/samples are included in a COA. One COA may include selected items from a petition; users may create separate COAs when needed. | User: "เลือกตาม ผู้ใช้งาน" |
| R3 | COA must have an approval step before printing. | User |
| R4 | QC Head is the approver. | User |
| R5 | COA number format is running sequence for the year followed by Gregorian year, with no slash or separator. Example: `00012026`. | User |
| R6 | Printing is disabled until QC Head approval succeeds. | Derived from R3 |
| R7 | Issued COAs are immutable. Changes after approval create a revision, not an overwrite. | Full workflow |
| R8 | Revision approval supersedes the previous approved COA. | Full workflow |
| R9 | Cancellation requires a reason and keeps the cancelled COA visible in history. | Full workflow |
| R10 | Every submit, approve, reject, revise, cancel, and print action is audit logged with actor and timestamp. | Full workflow |

## 3. Existing system to reuse

- `src/pages/LabResults.tsx` and `src/pages/LabResultDetailPage.tsx` already list lab-approved petitions and preview printable lab reports.
- `src/lib/labResultReport.ts` and `src/lib/labReport.ts` already build report pages from petition items, lab requests, parameters, QC results, and item group membership.
- `src/components/petition/LabResultReportTemplate.tsx` already renders an A4 printable result document and is currently previewed with `docType="coa"`.
- `src/components/lis/PrintPreviewDialog.tsx` already handles preview, zoom, copies, local/server print routing, and print config.
- `src/lib/printConfig.ts`, `server/routes/print.js`, and printer settings already understand a `coa` print document type.
- `DocumentNumberConfig` exists, but current `nextDocumentNumber()` builds prefix/year before sequence. COA needs `sequence + yyyy`, so it should use a dedicated COA numbering helper or a carefully extended helper.
- `src/components/lis/AppLayout.tsx`, `src/lib/navItems.ts`, role/access utilities, and shadcn-style UI components should be reused for shell, navigation, tables, badges, dialogs, and actions.

## 4. Document lifecycle

Primary statuses:

```text
draft -> pendingApproval -> approved -> printed
```

Revision/cancellation statuses:

```text
revisionDraft -> pendingRevisionApproval -> reissued
cancelled
superseded
rejected
```

Rules:

- `draft`: created by a user from one lab-approved petition and selected petition item sequences.
- `pendingApproval`: submitted for QC Head approval. Creator can no longer edit fields unless the draft is rejected.
- `approved`: QC Head approved. COA number is assigned at this moment if this is the first approved version.
- `printed`: at least one print action succeeded or local print dialog was opened. The document remains approved/issued, with print count and last print metadata.
- `revisionDraft`: created from an approved/printed COA to revise content. It references the source COA and version.
- `pendingRevisionApproval`: revision submitted for QC Head approval.
- `reissued`: revision approved. It receives the same base COA number with revision metadata, and the previous approved version becomes `superseded`.
- `cancelled`: QC Head or authorized document-control user cancels an approved/printed COA with a required reason.
- `superseded`: old approved version after a newer revision is approved.
- `rejected`: QC Head rejected a pending approval with a required reason; the creator may copy it back to draft or create a new draft.

## 5. Data model

Add `server/models/CoaDocument.js`.

```ts
type CoaStatus =
  | "draft"
  | "pendingApproval"
  | "approved"
  | "printed"
  | "revisionDraft"
  | "pendingRevisionApproval"
  | "reissued"
  | "cancelled"
  | "superseded"
  | "rejected";
```

Main fields:

- `coaNo: string | null` - assigned on first approval, e.g. `00012026`.
- `coaYear: number` - Gregorian year used for numbering.
- `sequence: number | null` - running number within `coaYear`.
- `revision: number` - starts at `0`; increments for each approved revision.
- `status: CoaStatus`.
- `petitionId: ObjectId` with index.
- `petitionNoSnapshot: string`.
- `selectedItemSeqs: number[]`.
- `sourceCoaId?: ObjectId` - set for revision drafts.
- `supersedesCoaId?: ObjectId` - set when a revision is approved.
- `supersededByCoaId?: ObjectId`.
- `customerSnapshot` - name, company, department, email, phone.
- `sampleSnapshots[]` - one entry per selected item: item seq, sample name, batch/lot, production date, sample id, condition, manufacturer/seller.
- `resultSnapshots[]` - printable rows frozen at approval time: item seq, test item, result, criteria, method, unit.
- `remark: string`.
- `approval` - submittedBy/At, approvedBy/At, rejectedBy/At, rejectReason.
- `cancel` - cancelledBy/At, reason.
- `print` - printCount, lastPrintedAt, lastPrintedBy, printEvents[].
- `createdBy`, `updatedBy`, timestamps.

Indexes:

- `{ coaNo: 1, revision: 1, deletedAt: 1 }` unique when `coaNo` exists.
- `{ petitionId: 1, status: 1 }`.
- `{ status: 1, updatedAt: -1 }`.
- `{ coaYear: 1, sequence: -1 }`.

Keep COA as a separate collection rather than embedding in `Petition`, because document revisions and audit history can grow independently.

## 6. Numbering

COA numbering must be concurrency-safe.

Format:

```text
<sequence padded to 4 digits><Gregorian year>
```

Example for the first COA approved in 2026:

```text
00012026
```

Implementation design:

- Add `server/models/CoaCounter.js` or a generic document counter collection.
- On approval, atomically `findOneAndUpdate({ year }, { $inc: { sequence: 1 } }, { upsert: true, new: true })`.
- Build `coaNo = String(sequence).padStart(4, "0") + String(year)`.
- Store both `sequence` and `coaYear` on the COA document.
- Do not derive the next number by sorting COA strings. The year suffix makes lexicographic lookup fragile.
- If sequence exceeds 9999 in a year, continue as `100002026`; do not truncate. UI can warn when nearing the 4-digit range, but uniqueness matters more than fixed width.

Revision numbering:

- Base `coaNo` remains the same across revisions.
- `revision` increments: original = `0`, first revision = `1`.
- Display can show `00012026 Rev.1`.
- The printable template should show the base COA number and revision when `revision > 0`.

## 7. Backend API

Add `server/routes/coaDocuments.js`, mounted under `/api/coa-documents`.

Endpoints:

- `GET /api/coa-documents`
  - Filters: `status`, `petitionNo`, `coaNo`, `dateFrom`, `dateTo`, `mine`, `needsApproval`.
  - Returns COA rows plus petition summary.

- `GET /api/coa-documents/eligible-petitions`
  - Lists petitions with `labApproved: true`.
  - Includes item-level availability: item seq, sample name, batch, lab-approved date, existing active COA references.

- `POST /api/coa-documents`
  - Creates a `draft` from `petitionId`, `selectedItemSeqs`, and optional remark.
  - Validates petition exists and is lab-approved.
  - Validates selected item sequences exist.
  - Does not assign a COA number.

- `GET /api/coa-documents/:id`
  - Returns document detail with snapshots, audit events, and current printable preview data.

- `PATCH /api/coa-documents/:id`
  - Allows editing only `draft`, `revisionDraft`, or rejected documents copied back to draft.
  - Editable fields: selected item seqs, remark, customer override fields if needed.

- `POST /api/coa-documents/:id/submit`
  - Moves `draft -> pendingApproval` or `revisionDraft -> pendingRevisionApproval`.
  - Rebuilds preview data from current Lab result source for review, but does not freeze final issued snapshot yet.

- `POST /api/coa-documents/:id/approve`
  - QC Head only.
  - For first approval: assign `coaNo`, `sequence`, `coaYear`, freeze snapshots, set status `approved`.
  - For revision approval: freeze new snapshots, set status `reissued`, set previous active version to `superseded`.

- `POST /api/coa-documents/:id/reject`
  - QC Head only.
  - Requires reason.
  - Sets status `rejected` and records approval rejection fields.

- `POST /api/coa-documents/:id/revise`
  - Creates `revisionDraft` from an approved/printed/reissued COA.
  - Copies selected items and editable text from the source.
  - Links `sourceCoaId`.

- `POST /api/coa-documents/:id/cancel`
  - QC Head or future document-control role.
  - Requires reason.
  - Sets status `cancelled`.

- `POST /api/coa-documents/:id/print-event`
  - Called after print action starts/succeeds.
  - Allowed only for `approved`, `printed`, or `reissued`.
  - Increments print count and sets status `printed` for first print of original issue.

Audit:

- Add `server/models/CoaAuditLog.js` or embed immutable event rows in `CoaDocument`.
- Prefer separate `CoaAuditLog` if filtering and reporting are expected.
- Events: `created`, `updated`, `submitted`, `approved`, `rejected`, `revisionCreated`, `revisionSubmitted`, `revisionApproved`, `superseded`, `cancelled`, `printed`.

## 8. Permissions

Minimum permissions:

- Any authenticated user who can view lab-approved results may create a COA draft from eligible petitions.
- Draft creator can edit and submit their own draft.
- QC Head can view pending approvals, approve, reject, cancel, and approve revisions.
- Printing requires `approved`, `printed`, or `reissued` status.

Implementation should reuse the existing auth/role helpers. The role check should accept the current system's QC Head role identifier/name. If the repository only has display role labels in some environments, create a small helper such as `isQcHead(user)` and centralize the mapping there.

## 9. Frontend UI

Add route:

- `/coa` -> `CoaCenterPage`
- `/coa/:id` -> `CoaDetailPage`

Navigation:

- Add a sidebar item labelled `ออกเอกสาร COA` with a document/check icon.
- Add `PAGE_ITEMS` entries for detail route.

### COA Center page

Primary layout:

- Header: `ออกเอกสาร COA`.
- KPI/status strip: Draft, รอ QC Head อนุมัติ, อนุมัติแล้ว, พิมพ์แล้ว, ยกเลิก/แก้ไข.
- Tabs or segmented status filters:
  - `ทั้งหมด`
  - `ร่าง`
  - `รออนุมัติ`
  - `อนุมัติแล้ว`
  - `พิมพ์แล้ว`
  - `แก้ไข/ยกเลิก`
- Search by petition number, COA number, customer/sample, batch/lot.
- Main table columns:
  - COA No.
  - Revision
  - Petition No.
  - Samples
  - Status
  - Created by
  - Submitted/Approved date
  - Print count
  - Next action

Primary action:

- `สร้าง COA` opens a create dialog/drawer.

### Create COA flow

Create dialog/drawer:

1. Select lab-approved petition.
2. Show item/sample checklist for that petition.
3. Show warning if selected items already belong to an active approved COA.
4. Require at least one selected item.
5. Create draft and navigate to detail page.

### COA Detail page

Sections:

- Header with COA number or `ร่าง COA`, status badge, petition link, revision label.
- Action bar:
  - Draft: Save, Submit for approval.
  - Pending approval: QC Head Approve, Reject.
  - Approved/Reissued: Print, Create revision, Cancel.
  - Printed: Print again, Create revision, Cancel.
  - Cancelled/Superseded: read-only.
- Source panel: petition, selected samples, lab approval date, requester/customer.
- Editable draft fields: selected samples, customer overrides if supported, remark.
- Result preview panel: table of test items/results/criteria/method grouped by selected sample.
- Print preview button disabled until approved.
- Audit timeline.

### Approval review

QC Head needs enough context to approve without opening unrelated pages:

- Compare document metadata, selected samples, and result rows.
- Show source petition and Lab result approval timestamp.
- Approve and reject actions require explicit confirmation.
- Reject requires a reason.

## 10. Printable COA template

Add a COA-specific template rather than reusing the existing Lab result report title unchanged.

Files:

- `src/lib/coaReport.ts` - builds printable pages from frozen COA snapshots.
- `src/components/coa/CoaReportTemplate.tsx` - A4 printable COA.

Template rules:

- Show company/logo header using existing branding.
- Title should be Certificate of Analysis / ใบรับรองผลการวิเคราะห์.
- Show `COA No.`, revision when applicable, issue date, page count.
- Show customer and sample data from frozen snapshots.
- Show selected sample result rows.
- Show analyst/lab source data if available.
- Show QC Head approval name and date.
- Show cancellation/superseded watermark only in read-only historical preview, not on active printable documents.
- Keep existing `PrintPreviewDialog` for preview/print mechanics.

Printing integration:

- Detail page renders `CoaReportTemplate`.
- `PrintPreviewDialog` uses `docType="coa"` and COA CSS.
- After print is initiated, call `/print-event`.
- If local print dialog is opened but the user cancels in the browser, the app cannot reliably know; record the event as `printDialogOpened` in `printEvents`.

## 11. Data flow

```text
Lab-approved petition
  -> user selects petition items
  -> CoaDocument draft
  -> submit
  -> QC Head approval review
  -> approve: assign coaNo + freeze snapshots
  -> print enabled
  -> print event recorded

Approved/printed COA
  -> create revision
  -> revision draft
  -> submit revision
  -> QC Head approval
  -> new revision becomes active/reissued
  -> previous version becomes superseded
```

Snapshot principle:

- Draft preview can use current source data.
- Approved COA must print from frozen snapshot data so later lab/result edits do not silently change an issued document.
- Revision deliberately creates a new frozen snapshot after approval.

## 12. Edge cases

- Petition is not lab-approved: cannot create COA.
- No selected item: cannot create or submit.
- Selected item has no Lab result rows: allow draft but show blocking warning before submit unless user confirms "issue with no result rows".
- Selected item already has an active approved/reissued COA: warn and require confirmation; do not hard-block because users may intentionally split/reissue by workflow.
- Pending approval source data changed: show warning on review that source data changed since submit; approval freezes the latest reviewed data.
- Duplicate approval click: approval endpoint must be idempotent enough to avoid assigning two COA numbers. Only approve from pending states.
- Two QC Heads approve at same time: atomic status transition and counter prevent duplicate numbers.
- Cancelled COA cannot be printed except as historical preview with cancelled watermark.
- Superseded COA cannot be printed as active COA; historical preview only.
- Rejected document can be copied back to draft instead of mutating rejected history.

## 13. Tests

Backend:

- COA number helper returns `00012026`, `00022026`, and starts at `00012027` in a new year.
- Concurrent approval simulation does not duplicate numbers.
- Create draft requires lab-approved petition and valid item seqs.
- Submit requires selected items.
- Approve requires QC Head role and pending status.
- Print-event rejects draft/pending/cancelled/superseded documents.
- Revision approval supersedes the previous active version.
- Cancel requires reason.
- Audit events are written for lifecycle actions.

Frontend/lib:

- COA status labels, badge variants, and allowed actions by status/role.
- Create drawer enforces item selection and shows existing COA warnings.
- Detail page disables print before approval.
- QC Head sees approve/reject actions; non-QC Head does not.
- Revision and cancelled/superseded states are read-only where required.
- `CoaReportTemplate` renders COA number, revision, selected samples, result rows, and QC Head approval fields.

Focused validation commands:

- `npm run test`
- `npx tsc -p tsconfig.app.json --noEmit`
- `node --test server/lib/*.test.js`

Do not run repository build commands unless explicitly requested, because the repo build rewrites root production files.

## 14. Out of scope for first implementation

- Digital signature image capture.
- PDF file archival to object storage.
- Emailing COA to customers.
- External QR verification portal.
- Line notification for COA approval.
- Configurable COA number format in Settings. The first implementation uses the user-approved fixed format `00012026`.

