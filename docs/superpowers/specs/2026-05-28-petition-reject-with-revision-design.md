# Petition Reject with Revision Request — Design

**Date:** 2026-05-28
**Status:** Approved
**Owner:** prompiriya-ICP

## Summary

When QC finds abnormal values in a petition (status `success`), the approver gets two actions: **Approve** or **Send back for revision**. Approve closes the petition normally. Reject closes the petition with a required text message to the submitter, and the submitter must create a new petition that links back to the original via `revisionOf`. QC reviewing the revision sees the previous tested values inline beside each input.

## Background

Current flow (as of `develop` @ be9b758):
- `Petition.status` enum: `'deliveringQC' | 'sampleSent' | 'pendingReview' | 'inProgress' | 'success'`. `success` is the only terminal state — no explicit approve/reject.
- `QCTestingDetailPage.tsx` already has a single "ส่งให้แก้ไข" button at `status === 'success'` that transitions back to `inProgress` (returns to QC, not to the submitter). No required note.
- `Petition.reviewHistory` already supports `action: 'reject'` with a `note` field, but is unused for end-of-flow reject.
- `api.getReturnedFlags()` exists (backed by `/petitions/returned-flags`) and is consumed by `QCApproval.tsx` and `QCTestingDetailPage.tsx` via `wasReturned`. Currently derived from `reviewHistory.action === 'reject'`.

Gaps to close:
- No explicit "approve" action — `success` ambiguously means "tests done" and "blessed by approver".
- No way to send the petition back to the submitter with a corrective message.
- No link between an old (rejected) petition and the new petition the submitter creates as a redo.
- QC reviewing a revision has no visibility into the values that triggered the original rejection.

## Goals

1. Make approval an explicit terminal action distinct from "tests done".
2. Allow the approver to reject a petition with a required text message to the submitter.
3. Let the submitter create a new petition that is explicitly linked to the rejected one (`revisionOf`).
4. Show QC the previous tested values inline when working on a revision petition.

## Non-Goals (YAGNI)

- Partial reject (per-item). Reject is whole-petition only.
- In-place edit of the rejected petition. Submitter creates a new petition.
- Multi-step revision history chain UI. A revision links to its immediate predecessor only; chain walking is not needed in v1.
- Threaded messaging between QC and submitter. Single note per rejection is enough.

## Flow

```
QC opens petition at status=success
├── [อนุมัติ]   → status: approved (terminal)
│                approvedAt set
│                reviewHistory.push({action:'approve', reviewedBy, reviewedAt})
│
└── [ส่งให้แก้ไข] → RevisionRequestDialog opens
                    ├── required note (trim non-empty)
                    └── confirm → status: rejected (terminal)
                                  rejectedAt set
                                  reviewHistory.push({action:'reject', reviewedBy, reviewedAt, note})
                                  notify submittedBy via NotificationContext

Submitter (submittedBy)
├── sees bell notification "คำร้อง XXX ถูกส่งกลับให้แก้ไข"
├── PetitionListPage shows badge "รอแก้ไข" on rejected petitions
└── PetitionDetailPage (rejected) shows banner with reviewer/date/note
    └── [ยื่นแก้ไขใหม่] → navigate('/petitions/new?revisionOf=<id>')
                          (button visible only to submittedBy)

PetitionNewPage with ?revisionOf=<id>
├── fetch old petition, pre-fill items/cause/productionPlans
├── show banner "🔄 ยื่นแก้ไขจากคำร้อง <oldNo>"
├── hidden state revisionOf
└── submit → new petition with revisionOf set

QC opens the new (revision) petition
├── header badge "คำร้องแก้ไข" + RotateCcw icon (existing wasReturned, new source)
├── for each item × parameter × field: show inline "ค่าเดิม: 12.5 ⚠ ผิดปกติ"
│   match by (sampleName + batchNo) → (parameterId + fieldLabel)
└── normal entry flow
```

## Data Model

### `server/models/Petition.js`

```js
status: {
  type: String,
  enum: ['deliveringQC', 'sampleSent', 'pendingReview', 'inProgress',
         'success', 'approved', 'rejected'],   // + approved, + rejected
  default: 'deliveringQC',
  index: true,
},
// ...existing fields...
revisionOf: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Petition',
  default: null,
  index: true,
},
approvedAt: Date,
rejectedAt: Date,
```

- `ReviewEntrySchema` is unchanged (`action: 'reject'` + `note` already supported).
- No migration required — existing documents keep status values; new fields default to null/undefined.
- `success` semantics unchanged: tests complete, awaiting approver. `approved` and `rejected` are the new terminal states.

### `src/types/petition.types.ts`

- `PETITION_STATUS_CONFIG` gains entries:
  - `approved` → variant `green-soft`, label "อนุมัติแล้ว"
  - `rejected` → variant `red-soft`, label "ส่งกลับให้แก้ไข"

## API

### `PATCH /api/petitions/:id`

Existing endpoint, two new transitions accepted from `status === 'success'`:

- `{status: 'approved', actor}` → set status, `approvedAt = now`, push `reviewHistory{action:'approve', reviewedBy:actor, reviewedAt:now}`.
- `{status: 'rejected', actor, revisionNote}` → require non-empty `revisionNote`; set status, `rejectedAt = now`, push `reviewHistory{action:'reject', reviewedBy:actor, reviewedAt:now, note:revisionNote}`; emit notification to `submittedBy.employeeId`.

Terminal states are immutable: any PATCH that would leave `approved` or `rejected` returns 409.

### `POST /api/petitions`

Existing endpoint, accept optional `revisionOf` in body:
- Must be a valid ObjectId referencing a petition with `status === 'rejected'`.
- Caller must be the `submittedBy` of the referenced petition (compare `employeeId`).
- On success the new document persists `revisionOf`.
- Invalid → 400; wrong submitter → 403; old petition not rejected → 400.

### `GET /api/petitions/returned-flags` (existing)

Change the source: a petition is "returned" iff `revisionOf != null`. The previous derivation (`reviewHistory.action === 'reject'`) becomes obsolete because reject is now a terminal action on the *old* petition, while the flag is meant for the *new* (revision) petition.

### `GET /api/qc-results?petitionId=<oldId>` (existing)

Frontend reuses this verbatim to fetch previous values for inline display. No backend change.

### `src/lib/api.ts`

```ts
approvePetition: (id: string, actor: string) =>
  request(`/petitions/${id}`, {method:'PATCH', body: JSON.stringify({status:'approved', actor})}),
rejectPetition: (id: string, actor: string, revisionNote: string) =>
  request(`/petitions/${id}`, {method:'PATCH', body: JSON.stringify({status:'rejected', actor, revisionNote})}),
```

## UI

### `QCTestingDetailPage.tsx`

Replace the single-button section at `petition.status === 'success'` with two buttons. The existing `handleSendBack` is removed (it transitions to `inProgress`, which is no longer part of the flow).

Layout:
```
✅ บันทึกผลแล้ว — รออนุมัติ
ผู้รับงาน: <name>
⚠ คำร้องนี้มีค่าผิดปกติ N รายการ          ← if abnormalCount > 0

        [ ส่งให้แก้ไข ]   [ ✓ อนุมัติคำร้อง ]
```

- Approve: confirm dialog → `api.approvePetition(...)` → toast → `navigate('/qc-approval')`.
- Send back: opens `RevisionRequestDialog`.

Status `approved` and `rejected` render a closed-state banner (no action buttons).

### `src/components/petition/RevisionRequestDialog.tsx` (new)

Modal using shadcn `Dialog`:
```
ส่งคำร้อง <petitionNo> ให้แก้ไข

ส่งกลับให้: <submittedBy.name>

ข้อความถึงผู้ยื่น *
[ textarea, min-h-[100px], required ]

⚠ คำร้องนี้จะถูกปิด ผู้ยื่นจะต้องสร้างคำร้องใหม่
   จากคำร้องนี้เพื่อแก้ไข

         [ ยกเลิก ]   [ ส่งให้แก้ไข ]
```

- Submit button disabled while `note.trim().length === 0` or while submitting.
- Confirm → `api.rejectPetition(id, actor, note)` → toast → `navigate('/qc-approval')`.

### `PetitionDetailPage.tsx`

When `petition.status === 'rejected'`:
- Render a sticky banner near the top (orange theme):
  ```
  🔄 คำร้องนี้ถูกส่งกลับให้แก้ไข
  ผู้ตรวจสอบ: <reviewer> · เมื่อ <date>
  ข้อความ: "<note from last reviewHistory.reject>"

  [ ยื่นแก้ไขใหม่ ]   ← only if currentUser is submittedBy
  ```
- Button navigates to `/petitions/new?revisionOf=<id>`.

### `PetitionNewPage.tsx`

When `?revisionOf=<id>` is present:
1. Fetch the referenced petition.
2. Verify it is `rejected` and `submittedBy.employeeId === currentUser.employeeId` (otherwise toast and `navigate('/petitions')`).
3. Pre-fill the form: `items`, `cause`, `productionPlans`, `dept`, `prodOrderNos`. Leave `submittedBy/deliveredBy` to current user defaults. `petitionNo` is freshly generated by the existing logic — it is not copied.
4. Render banner `🔄 ยื่นแก้ไขจากคำร้อง <oldNo>` above the form.
5. On submit, include `revisionOf: <id>` in the POST body.

### `QCApproval.tsx` and `QCTestingDetailPage.tsx` header

- `getReturnedFlags` consumer code stays the same; only the backend source changes (`revisionOf != null`).
- The existing `RotateCcw` icon + tooltip stays; tooltip text becomes "คำร้องแก้ไขจาก <oldNo>" (oldNo fetched alongside the petition).

### `QCTestingDetailPage.tsx` — inline previous values in `TestField`

When `petition.revisionOf` is set:
1. On mount, fetch QC results of the predecessor: `api.getQCResults(revisionOf)`.
2. Build a lookup: `Map<batchNo|sampleName|commonName|parameterId|fieldLabel, value>`. `commonName` is included to disambiguate when two items share the same `sampleName + batchNo` (e.g., parallel substance lines).
3. In `TestField`, after the input row, render:
   ```
   ค่าเดิม: <value> ⚠ ผิดปกติ        ← warning icon only if isFieldAbnormal(field, value)
   ```
   styled as `text-xs text-grey-400`. Hide if no previous value matches.

## Notifications

Reuse the existing `NotificationContext` (added in commit e09af9e and refined later). The reject handler in `petitions.js` calls the same notification creator used elsewhere with:
- recipient: `submittedBy.employeeId`
- kind: `'petitionRejected'`
- payload: `{petitionId, petitionNo, reviewer, note}`

The bell renders the existing notification list — no UI work needed beyond the link target (`/petitions/<id>`).

## Edge Cases

| Case | Behavior |
|------|----------|
| `?revisionOf=<id>` where status ≠ rejected | block + toast "คำร้องนี้ไม่ได้ถูกส่งกลับ" |
| Caller is not submittedBy of the referenced petition | backend 403 |
| QC approves while status ≠ success | backend 409 |
| QC rejects without note | frontend disables button; backend 400 if bypassed |
| PATCH that would leave `approved` or `rejected` | backend 409 |
| Revision petition rejected again (B → C → D chain) | each new petition links to its immediate predecessor; inline previous values come from the immediate predecessor only |
| Revision adds new items not present in original | match by `batchNo + sampleName + commonName`; unmatched items simply show no previous value |
| Original petition in phase 2 testing | not reachable — reject is only valid at status=success which is post-completion |

## Testing

### Unit
- `src/lib/revisionHelpers.ts` (new): builds the `Map` and resolves previous values. Test matching on `batchNo + sampleName + commonName + parameterId + fieldLabel`, including missing-row and abnormality flags.

### Integration (server)
- `tests/petitions/reject.test.ts` — POST reject requires `revisionNote`, sets `rejectedAt`, pushes `reviewHistory`, calls notification creator.
- `tests/petitions/approve.test.ts` — POST approve sets `approvedAt`, pushes `reviewHistory`.
- `tests/petitions/revision-create.test.ts` — `revisionOf` validation: valid/invalid id, predecessor not rejected, wrong submitter.
- `tests/petitions/terminal-immutable.test.ts` — once `approved` or `rejected`, further PATCH attempts return 409.

### E2E (playwright)
- `tests/e2e/qc-reject-flow.spec.ts`:
  1. QC rejects a petition at status=success with a note.
  2. Submitter logs in, sees the bell notification and the rejected banner.
  3. Submitter clicks "ยื่นแก้ไขใหม่" → lands on `/petitions/new?revisionOf=<id>` pre-filled.
  4. Submitter saves the new petition → `revisionOf` persisted.
  5. QC opens the new petition → header shows revision badge; one of the abnormal fields shows "ค่าเดิม: <value> ⚠ ผิดปกติ" inline.

## Implementation Order

1. Backend: Petition schema (enum + `revisionOf`, `approvedAt`, `rejectedAt`).
2. Backend: PATCH transitions (approve/reject) + terminal-state guard.
3. Backend: POST petitions — accept and validate `revisionOf`.
4. Backend: `returned-flags` source switched to `revisionOf != null`.
5. Frontend: `src/types/petition.types.ts` status config + types.
6. Frontend: `src/lib/api.ts` — `approvePetition`, `rejectPetition`.
7. Frontend: `RevisionRequestDialog` component.
8. Frontend: `QCTestingDetailPage.tsx` — two-button section, remove old `handleSendBack`.
9. Frontend: `PetitionDetailPage.tsx` — rejected banner + button.
10. Frontend: `PetitionNewPage.tsx` — `?revisionOf` handling.
11. Frontend: `src/lib/revisionHelpers.ts` + inline previous-value display in `TestField`.
12. Tests (unit, integration, e2e).
