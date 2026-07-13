# Lab Approval Rejection Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename Lab approval actions to “อนุมัติ” and “ไม่อนุมัติ”, then route a rejection to one Lab tester, the requester, or a QC Head confirmation queue.

**Architecture:** A persisted `labDecision` record records target, recipient, reason, actor, and timestamps. Pure server helpers own state transitions; the existing read-only Lab review is reused in a separate QC Head confirmation mode.

**Tech Stack:** React 18, TypeScript, React Router, TanStack Query, Radix UI, Vitest, Express, Mongoose, Jest.

## Global Constraints

- Do not run `npm run build`, `npm run build:dev`, `npm run build:watch`, `vite build`, or scripts that invoke a build/postbuild workflow.
- Preserve unrelated working-tree changes and stage only files from this feature.
- A tester target is exactly one current owner from `QCTestResult.updatedBy ?? QCTestResult.enteredBy`, identified by email.
- Requester routing sets `status: 'rejected'`; tester routing clears only Lab completion/approval; QC Head routing retains the result and remains `inProgress`.
- QC Head confirmation is distinct from the existing QC Final Result queue.
- Every mutation appends review history and creates an audit entry with target, recipient (where applicable), reason, actor, and time.

---

## File structure

| File | Responsibility |
| --- | --- |
| `server/lib/labApprovalDecision.js` | Pure recipient extraction and Lab decision transitions. |
| `server/lib/labApprovalDecision.test.js` | Jest tests for each permitted transition and invalid input. |
| `server/models/Petition.js` | Persists `labDecision` and review actions. |
| `server/routes/petitions.js` | Role-checked endpoints and list filters. |
| `src/types/petition.types.ts`, `src/lib/api.ts` | Typed decision payloads and client calls. |
| `src/components/petition/LabApprovalRejectDialog.tsx` | Reusable target/reason dialog. |
| `src/pages/LabApprovalReviewPage.tsx` | Shared Lab Head/QC Head read-only decision page. |
| `src/pages/QCApproval.tsx`, `src/pages/LabQcHeadConfirmationReviewPage.tsx`, `src/App.tsx` | QC Head queue, wrapper, and explicit route. |

### Task 1: Model and test pure Lab-decision transitions

**Files:**

- Create: `server/lib/labApprovalDecision.js`
- Create: `server/lib/labApprovalDecision.test.js`
- Modify: `server/models/Petition.js`

**Interfaces:**

- Produces `testerRecipients(results)`, `routeLabRejection(input)`, and `confirmLabByQcHead(input)`.
- Produces `petition.labDecision` with `state`, `target`, `note`, `routedBy`, `routedAt`, optional `recipient`, and optional confirmation fields.

- [ ] **Step 1: Write the failing Jest tests**

```js
const {
  testerRecipients,
  routeLabRejection,
  confirmLabByQcHead,
} = require('./labApprovalDecision');

const at = new Date('2026-07-13T10:00:00.000Z');
const results = [
  { enteredBy: { name: 'Analyst A', email: 'a@example.com' } },
  { updatedBy: { name: 'Analyst B', email: 'b@example.com' } },
  { updatedBy: { name: 'Analyst A', email: 'a@example.com' } },
];
const petition = () => ({
  status: 'inProgress',
  labCompletedAt: new Date('2026-07-13T09:00:00.000Z'),
  labCompletedBy: 'Analyst A',
  labApprovedAt: null,
  labApprovedBy: undefined,
  reviewHistory: [],
});

describe('Lab approval decisions', () => {
  it('deduplicates result owners by email', () => {
    expect(testerRecipients(results)).toEqual([
      { name: 'Analyst A', email: 'a@example.com' },
      { name: 'Analyst B', email: 'b@example.com' },
    ]);
  });

  it('returns only the Lab track to one selected tester', () => {
    const doc = petition();
    const outcome = routeLabRejection({
      petition: doc, results, target: 'tester', recipientEmail: 'b@example.com',
      actor: 'Lab Head', at, note: 'ตรวจค่าอีกครั้ง',
    });
    expect(doc.labCompletedAt).toBeNull();
    expect(doc.labApprovedAt).toBeNull();
    expect(doc.labDecision).toMatchObject({
      state: 'returned-to-tester', target: 'tester',
      recipient: { name: 'Analyst B', email: 'b@example.com' },
    });
    expect(outcome.event).toBe('lab-routed-to-tester');
  });

  it('closes the petition when returning it to the requester', () => {
    const doc = petition();
    routeLabRejection({ petition: doc, results, target: 'requester', actor: 'Lab Head', at, note: 'ข้อมูลไม่ครบ' });
    expect(doc).toMatchObject({
      status: 'rejected',
      conclusion: 'returned-to-requester',
      labDecision: { state: 'returned-to-requester', target: 'requester' },
    });
  });

  it('keeps recorded results while awaiting QC Head confirmation', () => {
    const doc = petition();
    routeLabRejection({ petition: doc, results, target: 'qc-head', actor: 'Lab Head', at, note: 'ขอให้ยืนยันผล' });
    expect(doc.labCompletedAt).toEqual(new Date('2026-07-13T09:00:00.000Z'));
    expect(doc.labDecision).toMatchObject({
      state: 'pending-qc-head-confirmation', target: 'qc-head',
    });
  });

  it('requires note and tester selection, and rejects terminal petitions', () => {
    expect(() => routeLabRejection({ petition: petition(), results, target: 'tester', actor: 'Lab Head', at, note: 'x' }))
      .toThrow('กรุณาเลือกผู้ตรวจ Lab');
    expect(() => routeLabRejection({ petition: petition(), results, target: 'qc-head', actor: 'Lab Head', at, note: ' ' }))
      .toThrow('กรุณาระบุเหตุผลที่ไม่อนุมัติ');
    expect(() => routeLabRejection({ petition: { ...petition(), status: 'approved' }, results, target: 'qc-head', actor: 'Lab Head', at, note: 'x' }))
      .toThrow('คำร้องนี้ปิดแล้ว');
  });

  it('records QC Head confirmation as Lab approval', () => {
    const doc = petition();
    routeLabRejection({ petition: doc, results, target: 'qc-head', actor: 'Lab Head', at, note: 'ขอให้ยืนยันผล' });
    confirmLabByQcHead({ petition: doc, actor: 'QC Head', at });
    expect(doc.labApprovedBy).toBe('QC Head');
    expect(doc.labDecision).toMatchObject({ state: 'qc-head-confirmed', confirmedBy: 'QC Head' });
    expect(doc.reviewHistory.at(-1)).toMatchObject({ action: 'lab-qc-confirm', reviewedBy: 'QC Head' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --runInBand lib/labApprovalDecision.test.js` from `server`

Expected: FAIL with `Cannot find module './labApprovalDecision'`.

- [ ] **Step 3: Implement the helper and persisted schema**

```js
// server/lib/labApprovalDecision.js
const TARGETS = new Set(['tester', 'requester', 'qc-head']);

function testerRecipients(results) {
  const recipients = new Map();
  for (const result of results || []) {
    const person = result.updatedBy?.email ? result.updatedBy : result.enteredBy;
    const email = String(person?.email || '').trim().toLowerCase();
    const name = String(person?.name || '').trim();
    if (email && name && !recipients.has(email)) recipients.set(email, { name, email });
  }
  return [...recipients.values()];
}

function routeLabRejection({ petition, results, target, recipientEmail, actor, at = new Date(), note }) {
  const reason = String(note || '').trim();
  if (['approved', 'rejected'].includes(petition.status)) throw new Error('คำร้องนี้ปิดแล้ว');
  if (!reason) throw new Error('กรุณาระบุเหตุผลที่ไม่อนุมัติ');
  if (!TARGETS.has(target)) throw new Error('ปลายทางการส่งกลับไม่ถูกต้อง');
  const base = { target, note: reason, routedBy: actor, routedAt: at };

  if (target === 'tester') {
    const recipient = testerRecipients(results).find((item) => item.email === String(recipientEmail || '').trim().toLowerCase());
    if (!recipient) throw new Error('กรุณาเลือกผู้ตรวจ Lab');
    petition.labCompletedAt = null;
    petition.labCompletedBy = undefined;
    petition.labApprovedAt = null;
    petition.labApprovedBy = undefined;
    petition.labReturnNote = reason;
    petition.labDecision = { ...base, state: 'returned-to-tester', recipient };
    petition.reviewHistory.push({ action: 'lab-route-reject', reviewedBy: actor, reviewedAt: at, note: reason });
    return { event: 'lab-routed-to-tester', metadata: { target, recipient } };
  }

  if (target === 'requester') {
    petition.status = 'rejected';
    petition.rejectedAt = at;
    petition.conclusion = 'returned-to-requester';
    petition.conclusionNote = reason;
    petition.labDecision = { ...base, state: 'returned-to-requester' };
    petition.reviewHistory.push({ action: 'lab-route-reject', reviewedBy: actor, reviewedAt: at, note: reason });
    return { event: 'lab-routed-to-requester', metadata: { target } };
  }

  petition.labDecision = { ...base, state: 'pending-qc-head-confirmation' };
  petition.reviewHistory.push({ action: 'lab-route-reject', reviewedBy: actor, reviewedAt: at, note: reason });
  return { event: 'lab-escalated-to-qc-head', metadata: { target } };
}

function confirmLabByQcHead({ petition, actor, at = new Date() }) {
  if (petition.labDecision?.state !== 'pending-qc-head-confirmation') throw new Error('ไม่มีรายการรอ QC Head ยืนยัน');
  petition.labApprovedAt = at;
  petition.labApprovedBy = actor;
  petition.labDecision.state = 'qc-head-confirmed';
  petition.labDecision.confirmedBy = actor;
  petition.labDecision.confirmedAt = at;
  petition.reviewHistory.push({ action: 'lab-qc-confirm', reviewedBy: actor, reviewedAt: at });
  return { event: 'lab-qc-head-confirmed', metadata: { target: 'qc-head' } };
}

module.exports = { TARGETS, testerRecipients, routeLabRejection, confirmLabByQcHead };
```

In `server/models/Petition.js`, add a `LabDecisionSchema` with:
`state: ['returned-to-tester', 'returned-to-requester', 'pending-qc-head-confirmation', 'qc-head-confirmed']`, `target: ['tester', 'requester', 'qc-head']`, `note`, `routedBy`, `routedAt`, `recipient.name`, `recipient.email`, `confirmedBy`, and `confirmedAt`. Add `labDecision` beside `labReturnNote`. Extend review-action enum with `lab-route-reject` and `lab-qc-confirm`; retain `lab-reject` for historical data.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- --runInBand lib/labApprovalDecision.test.js` from `server`

Expected: PASS with five tests.

- [ ] **Step 5: Commit the transition layer**

```bash
git add server/lib/labApprovalDecision.js server/lib/labApprovalDecision.test.js server/models/Petition.js
git commit -m "feat: model lab approval decision routing"
```

### Task 2: Decision endpoints, actor validation, and queue filtering

**Files:**

- Modify: `server/routes/petitions.js`
- Modify: `server/lib/labApprovalDecision.js`
- Test: `server/lib/labApprovalDecision.test.js`

**Interfaces:**

- Produces `POST /api/petitions/:id/lab-decision`, `POST /api/petitions/:id/lab-qc-confirm`, and `GET /api/petitions?awaitingLabQcConfirmation=true`.

- [ ] **Step 1: Write a failing role-authorization helper test**

```js
it('allows only the required role or admin to take a decision', () => {
  expect(canActAs(['lab-head'], 'lab-head')).toBe(true);
  expect(canActAs(['qc-head'], 'lab-head')).toBe(false);
  expect(canActAs(['admin'], 'qc-head')).toBe(true);
});
```

- [ ] **Step 2: Run the test to verify it fails because the role helper does not exist**

Run: `npm test -- --runInBand lib/labApprovalDecision.test.js` from `server`

Expected: FAIL with `canActAs is not a function`.

- [ ] **Step 3: Wire the routes to the pure helper**

Import `User`, `normalizeRoles`, `QCTestResult`, `routeLabRejection`, `confirmLabByQcHead`, and `canActAs` in `server/routes/petitions.js`. Add this resolver beside `badRequest`:

```js
async function requireDecisionActor(actorUserId, allowedRoles) {
  const actor = await User.findById(actorUserId).lean();
  const roles = normalizeRoles(actor);
  if (!actor || actor.status !== 'active' || !allowedRoles.some((role) => canActAs(roles, role))) {
    const error = new Error('คุณไม่มีสิทธิ์ดำเนินการนี้');
    error.statusCode = 403;
    throw error;
  }
  return actor.name || actor.email;
}
```

Add and export this helper in `server/lib/labApprovalDecision.js`:

```js
function canActAs(roles, requiredRole) {
  return Array.isArray(roles) && (roles.includes('admin') || roles.includes(requiredRole));
}

module.exports = {
  TARGETS,
  testerRecipients,
  routeLabRejection,
  confirmLabByQcHead,
  canActAs,
};
```

Implement `POST /:id/lab-decision`: resolve a `lab-head` or `qc-head` actor, load the petition plus its `QCTestResult` records, call `routeLabRejection`, save, and call `logAudit(doc, { event: outcome.event, actor, note: doc.labDecision.note, metadata: outcome.metadata })`. Implement `POST /:id/lab-qc-confirm`: require `qc-head`, call `confirmLabByQcHead`, set `status = 'success'` and `completedAt` when `isPetitionComplete(doc)`, save, and audit. Map helper validation errors to 400, missing documents to 404, role errors to 403, and already-resolved queue items to 409.

Add these list clauses after the existing `awaitingLabApproval` clause:

```js
if (req.query.awaitingLabApproval === 'true') {
  q.labCompletedAt = { $ne: null };
  q.labApprovedAt = null;
  q.status = 'inProgress';
  q['labDecision.state'] = { $ne: 'pending-qc-head-confirmation' };
}
if (req.query.awaitingLabQcConfirmation === 'true') {
  q['labDecision.state'] = 'pending-qc-head-confirmation';
  q.labCompletedAt = { $ne: null };
  q.labApprovedAt = null;
  q.status = 'inProgress';
}
```

- [ ] **Step 4: Verify the server transition tests and scoped lint**

Run: `npm test -- --runInBand lib/labApprovalDecision.test.js` from `server`

Expected: PASS.

Run: `npx eslint lib/labApprovalDecision.js routes/petitions.js models/Petition.js` from `server`

Expected: exit code 0.

- [ ] **Step 5: Commit the route layer**

```bash
git add server/routes/petitions.js server/lib/labApprovalDecision.js server/lib/labApprovalDecision.test.js
git commit -m "feat: route lab approval decisions"
```

### Task 3: Typed API and reusable rejection dialog

**Files:**

- Modify: `src/types/petition.types.ts`
- Modify: `src/lib/api.ts`
- Create: `src/components/petition/LabApprovalRejectDialog.tsx`
- Create: `src/components/petition/LabApprovalRejectDialog.test.tsx`

**Interfaces:**

- Produces `LabDecisionTarget`, `LabTesterRecipient`, `LabDecision`, and `LabApprovalRejectDialog`.
- `LabApprovalRejectDialog.onConfirm` receives `{ target, note, recipientEmail? }`.

- [ ] **Step 1: Write failing dialog tests**

```tsx
it('requires a reason and selected tester before submitting a tester decision', async () => {
  const onConfirm = vi.fn().mockResolvedValue(undefined);
  render(<LabApprovalRejectDialog open onOpenChange={vi.fn()} petitionNo="P-1" testers={[
    { name: 'Analyst A', email: 'a@example.com' },
  ]} onConfirm={onConfirm} />);

  const submit = screen.getByRole('button', { name: 'ยืนยันไม่อนุมัติ' });
  fireEvent.click(screen.getByLabelText('ผู้ตรวจ Lab'));
  fireEvent.change(screen.getByLabelText('เหตุผลที่ไม่อนุมัติ'), { target: { value: 'ตรวจใหม่' } });
  expect(submit).toBeDisabled();
  fireEvent.change(screen.getByLabelText('เลือกผู้ตรวจ Lab'), { target: { value: 'a@example.com' } });
  fireEvent.click(submit);
  await waitFor(() => expect(onConfirm).toHaveBeenCalledWith({
    target: 'tester', note: 'ตรวจใหม่', recipientEmail: 'a@example.com',
  }));
});

it.each([['ผู้ยื่นคำร้อง', 'requester'], ['QC Head', 'qc-head']] as const)(
  'submits %s without a tester recipient',
  async (label, target) => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<LabApprovalRejectDialog open onOpenChange={vi.fn()} petitionNo="P-1" testers={[]} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByLabelText(label));
    fireEvent.change(screen.getByLabelText('เหตุผลที่ไม่อนุมัติ'), { target: { value: 'โปรดตรวจสอบ' } });
    fireEvent.click(screen.getByRole('button', { name: 'ยืนยันไม่อนุมัติ' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith({ target, note: 'โปรดตรวจสอบ' }));
  },
);
```

- [ ] **Step 2: Run the dialog test to verify it fails**

Run: `npm test -- src/components/petition/LabApprovalRejectDialog.test.tsx`

Expected: FAIL with unresolved `LabApprovalRejectDialog` import.

- [ ] **Step 3: Implement types, calls, and dialog**

Add to `src/types/petition.types.ts`:

```ts
export type LabDecisionTarget = 'tester' | 'requester' | 'qc-head';
export interface LabTesterRecipient { name: string; email: string; }
export interface LabDecision {
  state: 'returned-to-tester' | 'returned-to-requester' | 'pending-qc-head-confirmation' | 'qc-head-confirmed';
  target: LabDecisionTarget;
  note: string;
  routedBy: string;
  routedAt: string;
  recipient?: LabTesterRecipient;
  confirmedBy?: string;
  confirmedAt?: string;
}
```

Add `labDecision?: LabDecision` to `PetitionBase`; add optional `enteredBy` and `updatedBy` of type `LabTesterRecipient` to `QCTestResult`. Add these methods beside `labApprovePetition` in `src/lib/api.ts`:

```ts
submitLabDecision: (petitionId: string, payload: { actorUserId: string; target: import("@/types/petition.types").LabDecisionTarget; note: string; recipientEmail?: string }) =>
  request<import("@/types/petition.types").Petition>(`/petitions/${petitionId}/lab-decision`, { method: 'POST', body: JSON.stringify(payload) }),
confirmLabByQcHead: (petitionId: string, actorUserId: string) =>
  request<import("@/types/petition.types").Petition>(`/petitions/${petitionId}/lab-qc-confirm`, { method: 'POST', body: JSON.stringify({ actorUserId }) }),
```

The dialog has exactly three radio labels: `ผู้ตรวจ Lab`, `ผู้ยื่นคำร้อง`, and `QC Head`. Show a `<select aria-label="เลือกผู้ตรวจ Lab">` only for target `tester`; show a required `<textarea aria-label="เหตุผลที่ไม่อนุมัติ">`; enable `ยืนยันไม่อนุมัติ` only when the reason is nonblank and a tester has been selected where required. Keep values and dialog state on a rejected promise.

- [ ] **Step 4: Verify the dialog and type check**

Run: `npm test -- src/components/petition/LabApprovalRejectDialog.test.tsx`

Expected: PASS with three tests.

Run: `npx tsc --noEmit`

Expected: exit code 0.

- [ ] **Step 5: Commit the dialog contract**

```bash
git add src/types/petition.types.ts src/lib/api.ts src/components/petition/LabApprovalRejectDialog.tsx src/components/petition/LabApprovalRejectDialog.test.tsx
git commit -m "feat: add lab rejection destination picker"
```

### Task 4: Lab Head page wording and routed rejection

**Files:**

- Modify: `src/pages/LabApprovalReviewPage.tsx`
- Create: `src/pages/LabApprovalReviewPage.test.tsx`

**Interfaces:**

- Consumes Task 3 dialog and `api.submitLabDecision`.
- Produces renamed Lab Head action labels and a typed rejection payload.

- [ ] **Step 1: Write the failing page test**

```tsx
it('uses approve/reject labels and submits a selected tester routing decision', async () => {
  renderPage();
  await screen.findByRole('button', { name: 'อนุมัติ' });
  expect(screen.getByRole('button', { name: 'ไม่อนุมัติ' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'ออกผล Lab' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'ไม่อนุมัติ' }));
  fireEvent.click(screen.getByLabelText('ผู้ตรวจ Lab'));
  fireEvent.change(screen.getByLabelText('เลือกผู้ตรวจ Lab'), { target: { value: 'analyst@example.com' } });
  fireEvent.change(screen.getByLabelText('เหตุผลที่ไม่อนุมัติ'), { target: { value: 'ตรวจค่าใหม่' } });
  fireEvent.click(screen.getByRole('button', { name: 'ยืนยันไม่อนุมัติ' }));

  await waitFor(() => expect(submitLabDecisionMock).toHaveBeenCalledWith('p1', {
    actorUserId: 'lab-head-id', target: 'tester', note: 'ตรวจค่าใหม่', recipientEmail: 'analyst@example.com',
  }));
  expect(navigateMock).toHaveBeenCalledWith('/lab-approval');
});
```

Mock `useAuth` with a `lab-head-id` user, `api.getQCResults` with `updatedBy: { name: 'Analyst', email: 'analyst@example.com' }`, and `api.submitLabDecision`.

- [ ] **Step 2: Run the page test to verify it fails on old labels**

Run: `npm test -- src/pages/LabApprovalReviewPage.test.tsx`

Expected: FAIL because the page still has `ออกผล Lab` and `ส่งกลับให้แก้`.

- [ ] **Step 3: Implement Lab Head decisions**

Replace `RevisionRequestDialog` and the old `handleReject(note)` with `LabApprovalRejectDialog`. Deduplicate `updatedBy ?? enteredBy` result owners by lowercase email and pass them as dialog testers. Call `api.submitLabDecision(petition._id, { actorUserId: user?.id ?? '', target, note, recipientEmail })`; show destination-specific success copy; close then navigate to `/lab-approval`.

Rename the button copy to `อนุมัติ` and `ไม่อนุมัติ`. Rename confirmation to title `อนุมัติ` and description `ยืนยันการอนุมัติผล Lab นี้?`; rename approve success/error to `อนุมัติผล Lab เรียบร้อย` and `อนุมัติไม่สำเร็จ`. Keep the Lab agreement review gate and existing `api.labApprovePetition` approve semantics unchanged.

- [ ] **Step 4: Verify page test and scoped lint**

Run: `npm test -- src/pages/LabApprovalReviewPage.test.tsx`

Expected: PASS.

Run: `npx eslint src/pages/LabApprovalReviewPage.tsx src/pages/LabApprovalReviewPage.test.tsx`

Expected: exit code 0.

- [ ] **Step 5: Commit the Lab Head screen**

```bash
git add src/pages/LabApprovalReviewPage.tsx src/pages/LabApprovalReviewPage.test.tsx
git commit -m "feat: route lab rejection decisions"
```

### Task 5: QC Head confirmation queue and shared review mode

**Files:**

- Modify: `src/pages/QCApproval.tsx`
- Create: `src/pages/QCApproval.test.tsx`
- Create: `src/pages/LabQcHeadConfirmationReviewPage.tsx`
- Modify: `src/pages/LabApprovalReviewPage.tsx`
- Modify: `src/App.tsx`

**Interfaces:**

- Produces `/qc-approval/lab-confirmation/:id`, which reuses Lab result display but exposes only QC Head decision actions.

- [ ] **Step 1: Write failing queue and confirmation-mode tests**

```tsx
it('shows the Lab confirmation queue only to a QC Head', async () => {
  mockUseAuth.mockReturnValue({ user: { roles: ['qc-head'] } });
  mockUsePetitionList.mockImplementation((params) => (
    params.awaitingLabQcConfirmation
      ? { data: { items: [{ _id: 'lab-pending', petitionNo: 'P-LAB-1', items: [] }] }, loading: false }
      : { data: { items: [] }, loading: false }
  ));
  render(<MemoryRouter><QCApproval /></MemoryRouter>);
  expect(await screen.findByText('รอยืนยันผล Lab')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'ตรวจสอบ P-LAB-1' }));
  expect(navigateMock).toHaveBeenCalledWith('/qc-approval/lab-confirmation/lab-pending');
});

it('hides the Lab confirmation queue from non-QC-Head users', () => {
  mockUseAuth.mockReturnValue({ user: { roles: ['qc-staff'] } });
  render(<MemoryRouter><QCApproval /></MemoryRouter>);
  expect(screen.queryByText('รอยืนยันผล Lab')).not.toBeInTheDocument();
});
```

Add a `LabApprovalReviewPage` test that renders `reviewMode="qc-head-confirmation"` with `labDecision.state: 'pending-qc-head-confirmation'`; assert it calls `api.confirmLabByQcHead('p1', 'qc-head-id')` from **อนุมัติ**, exposes **ไม่อนุมัติ**, and has no Lab agreement edit button.

- [ ] **Step 2: Run focused tests to verify they fail**

Run: `npm test -- src/pages/QCApproval.test.tsx src/pages/LabApprovalReviewPage.test.tsx`

Expected: FAIL because the queue and explicit confirmation route do not exist.

- [ ] **Step 3: Implement queue, wrapper, and QC Head mode**

In `QCApproval.tsx`, use `normalizeRoles(user)` and set `canConfirmLab` for `qc-head` or `admin`. For eligible users, call `usePetitionList({ awaitingLabQcConfirmation: true, limit: 100 })` and render a second section titled `รอยืนยันผล Lab`. Its row button name is `ตรวจสอบ ${petition.petitionNo}` and navigates to `/qc-approval/lab-confirmation/${petition._id}`.

Create:

```tsx
import LabApprovalReviewPage from './LabApprovalReviewPage';

export default function LabQcHeadConfirmationReviewPage() {
  return <LabApprovalReviewPage reviewMode="qc-head-confirmation" />;
}
```

Add `reviewMode?: 'lab-head' | 'qc-head-confirmation'` to `LabApprovalReviewPage`. In QC Head mode: require role `qc-head` or `admin`; show `petition.labDecision?.note`; skip Lab agreement review edit/gating; send **อนุมัติ** to `api.confirmLabByQcHead(petition._id, user?.id ?? '')`; send **ไม่อนุมัติ** through the Task 3 dialog and `api.submitLabDecision`; navigate successful actions to `/qc-approval`. Keep groups read-only.

Place the explicit route before the generic QC detail route:

```tsx
<Route path="/qc-approval/lab-confirmation/:id" element={<PrivateRoute><LabQcHeadConfirmationReviewPage /></PrivateRoute>} />
<Route path="/qc-approval/:id" element={<PrivateRoute><QCApprovalReviewPage /></PrivateRoute>} />
```

- [ ] **Step 4: Verify UI tests and TypeScript**

Run: `npm test -- src/pages/QCApproval.test.tsx src/pages/LabApprovalReviewPage.test.tsx`

Expected: PASS.

Run: `npx tsc --noEmit`

Expected: exit code 0.

- [ ] **Step 5: Commit the QC Head review path**

```bash
git add src/pages/QCApproval.tsx src/pages/QCApproval.test.tsx src/pages/LabQcHeadConfirmationReviewPage.tsx src/pages/LabApprovalReviewPage.tsx src/App.tsx
git commit -m "feat: add QC Head lab confirmation queue"
```

### Task 6: Regression validation

**Files:**

- Modify only a scoped feature file when a command below reveals a defect.

- [ ] **Step 1: Run all focused frontend tests**

Run: `npm test -- src/components/petition/LabApprovalRejectDialog.test.tsx src/pages/LabApprovalReviewPage.test.tsx src/pages/QCApproval.test.tsx src/pages/QCApprovalReviewPage.reject-dialog.test.tsx`

Expected: PASS with no unhandled promise warnings.

- [ ] **Step 2: Run all focused server tests**

Run: `npm test -- --runInBand lib/labApprovalDecision.test.js` from `server`

Expected: PASS.

- [ ] **Step 3: Run safe project checks**

Run: `npx tsc --noEmit`

Expected: exit code 0.

Run: `npm run lint -- --quiet`

Expected: exit code 0. Do not run a build command.

- [ ] **Step 4: Review the scoped diff**

```bash
git diff --check -- server/lib/labApprovalDecision.js server/lib/labApprovalDecision.test.js server/models/Petition.js server/routes/petitions.js src/types/petition.types.ts src/lib/api.ts src/components/petition/LabApprovalRejectDialog.tsx src/components/petition/LabApprovalRejectDialog.test.tsx src/pages/LabApprovalReviewPage.tsx src/pages/LabApprovalReviewPage.test.tsx src/pages/QCApproval.tsx src/pages/QCApproval.test.tsx src/pages/LabQcHeadConfirmationReviewPage.tsx src/App.tsx
git status --short
```

Expected: no whitespace errors; unrelated changes remain unstaged.

- [ ] **Step 5: Commit a scoped regression correction only if one was required**

```bash
git add server/lib/labApprovalDecision.js server/lib/labApprovalDecision.test.js server/models/Petition.js server/routes/petitions.js src/types/petition.types.ts src/lib/api.ts src/components/petition/LabApprovalRejectDialog.tsx src/components/petition/LabApprovalRejectDialog.test.tsx src/pages/LabApprovalReviewPage.tsx src/pages/LabApprovalReviewPage.test.tsx src/pages/QCApproval.tsx src/pages/QCApproval.test.tsx src/pages/LabQcHeadConfirmationReviewPage.tsx src/App.tsx
git commit -m "fix: verify lab approval rejection routing"
```
