# Petition Reject with Revision Request — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an explicit Approve / Send-back-for-revision pair of terminal actions to the QC approval flow. When sent back, the submitter must create a new petition that links to the original via `revisionOf`, and QC reviewing the revision sees the previous tested values inline.

**Architecture:** Add two terminal statuses (`approved`, `rejected`) and a `revisionOf` ObjectId reference to the Petition schema. Two new PATCH transitions on `/api/petitions/:id` handle approve/reject with terminal-state guards. `POST /api/petitions` accepts and validates `revisionOf`. Frontend adds a confirm dialog for reject (required note), a banner on rejected petitions for submittedBy, and inline previous-value display under each QC TestField when the petition is a revision.

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind + shadcn/ui (frontend), Express + Mongoose (backend), Vitest (unit tests), Playwright (E2E).

**Spec:** `docs/superpowers/specs/2026-05-28-petition-reject-with-revision-design.md`

---

## File Structure

**Backend (Modified):**
- `server/models/Petition.js` — enum + `revisionOf`, `approvedAt`, `rejectedAt` fields.
- `server/routes/petitions.js` — PATCH approve/reject transitions, terminal-state guard in generic PATCH, POST `revisionOf` validation, `returned-flags` source switch.

**Frontend types/lib (Modified + Created):**
- `src/types/petition.types.ts` — extend `PetitionStatus` and `PETITION_STATUS_CONFIG`.
- `src/lib/api.ts` — add `approvePetition`, `rejectPetition`.
- `src/lib/revisionHelpers.ts` *(new)* — build lookup map of previous QC values for a revision petition.
- `src/lib/revisionHelpers.test.ts` *(new)* — Vitest unit tests for the helper.

**Frontend components (Created + Modified):**
- `src/components/petition/RevisionRequestDialog.tsx` *(new)* — modal with required note + confirm.
- `src/pages/QCTestingDetailPage.tsx` — replace single "ส่งให้แก้ไข" button with two-button section (Approve + Reject opens dialog); fetch + display inline previous values in `TestField` when petition has `revisionOf`.
- `src/pages/PetitionDetailPage.tsx` — banner + "ยื่นแก้ไขใหม่" button when status=rejected and current user is submittedBy.
- `src/pages/petitions/ProductionPetitionNewPage.tsx` — accept `?revisionOf=<id>`, pre-fill, persist `revisionOf` on create.
- `src/pages/PetitionListPage.tsx` — client-side scan: push notification for newly rejected petitions owned by current user.

**Tests (Created):**
- `tests/e2e/qc-reject-flow.spec.ts` *(new)* — full happy-path E2E.

---

## Task 1: Petition schema — new statuses and fields

**Files:**
- Modify: `server/models/Petition.js:204-242`

- [ ] **Step 1.1: Extend status enum and add 3 fields**

Edit `server/models/Petition.js`, in the `PetitionSchema` definition:

Change:
```js
status: {
  type: String,
  enum: ['deliveringQC', 'sampleSent', 'pendingReview', 'inProgress', 'success'],
  default: 'deliveringQC',
  index: true,
},
```
To:
```js
status: {
  type: String,
  enum: ['deliveringQC', 'sampleSent', 'pendingReview', 'inProgress', 'success', 'approved', 'rejected'],
  default: 'deliveringQC',
  index: true,
},
```

After the `phase2TriggeredBy` block (around line 240), before the closing `},`, add:
```js
revisionOf: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Petition',
  default: null,
  index: true,
},
approvedAt: { type: Date, default: null },
rejectedAt: { type: Date, default: null },
```

- [ ] **Step 1.2: Restart dev server and verify schema loads**

Run: `npm run dev` (kill any running dev server first; check the server console for Mongoose model load errors).
Expected: server starts on port 8000, backend on 3001, no Mongoose errors.

- [ ] **Step 1.3: Commit**

```bash
git add server/models/Petition.js
git commit -m "feat(petition): add approved/rejected statuses and revisionOf field"
```

---

## Task 2: Frontend types — extend PetitionStatus and config

**Files:**
- Modify: `src/types/petition.types.ts:4-36, 164-189`

- [ ] **Step 2.1: Add new statuses to the union and array**

Edit `src/types/petition.types.ts`:

Change:
```ts
export type PetitionStatus =
  | 'deliveringQC'
  | 'sampleSent'
  | 'pendingReview'
  | 'inProgress'
  | 'success';

export const PETITION_STATUSES: PetitionStatus[] = [
  'deliveringQC',
  'sampleSent',
  'pendingReview',
  'inProgress',
  'success',
];
```
To:
```ts
export type PetitionStatus =
  | 'deliveringQC'
  | 'sampleSent'
  | 'pendingReview'
  | 'inProgress'
  | 'success'
  | 'approved'
  | 'rejected';

export const PETITION_STATUSES: PetitionStatus[] = [
  'deliveringQC',
  'sampleSent',
  'pendingReview',
  'inProgress',
  'success',
  'approved',
  'rejected',
];
```

- [ ] **Step 2.2: Add status config entries**

Add two entries inside `PETITION_STATUS_CONFIG`:
```ts
approved:      { label: 'อนุมัติแล้ว',        variant: 'green-soft' },
rejected:      { label: 'ส่งกลับให้แก้ไข',    variant: 'red-soft' },
```

- [ ] **Step 2.3: Add new petition fields to `PetitionBase`**

In `PetitionBase` interface (around line 164), add:
```ts
revisionOf?: string | null;
approvedAt?: string | null;
rejectedAt?: string | null;
```

- [ ] **Step 2.4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors (or only pre-existing errors unrelated to this change).

- [ ] **Step 2.5: Commit**

```bash
git add src/types/petition.types.ts
git commit -m "feat(petition): extend PetitionStatus with approved/rejected"
```

---

## Task 3: Backend — POST petitions accepts revisionOf

**Files:**
- Modify: `server/routes/petitions.js:261-307` (the `POST /api/petitions` handler)

- [ ] **Step 3.1: Add validation block for `revisionOf` before `Petition.create`**

In `server/routes/petitions.js`, inside the `POST /` handler, after the production-plan validation block (around line 290) and before `const petitionNo = await nextPetitionNo();`, insert:

```js
let revisionOf = null;
if (body.revisionOf) {
  if (!mongoose.Types.ObjectId.isValid(body.revisionOf)) {
    return badRequest(res, 'revisionOf ไม่ใช่รหัสคำร้องที่ถูกต้อง');
  }
  const predecessor = await Petition.findById(body.revisionOf).lean();
  if (!predecessor) {
    return badRequest(res, 'ไม่พบคำร้องต้นทาง');
  }
  if (predecessor.status !== 'rejected') {
    return badRequest(res, 'คำร้องต้นทางไม่ได้ถูกส่งกลับให้แก้ไข');
  }
  const submitterId = body.submittedBy?.employeeId?.trim();
  const predecessorId = predecessor.submittedBy?.employeeId?.trim();
  if (predecessorId && submitterId && predecessorId !== submitterId) {
    return res.status(403).json({ error: { message: 'เฉพาะผู้ยื่นคำร้องเดิมเท่านั้นที่สามารถยื่นแก้ไขได้' } });
  }
  revisionOf = predecessor._id;
}
```

Then change the `Petition.create({ ... })` block from:
```js
const doc = await Petition.create({
  ...body,
  petitionNo,
  status: 'deliveringQC',
});
```
To:
```js
const doc = await Petition.create({
  ...body,
  petitionNo,
  status: 'deliveringQC',
  revisionOf,
});
```

And update the audit log call to include the link in the note when applicable:
```js
logAudit(doc, {
  event: 'created',
  toStatus: doc.status,
  actor: body.actor || body.submittedBy?.name || 'system',
  note: revisionOf ? `สร้างคำร้องใหม่ (แก้ไขจาก ${body.revisionOf})` : 'สร้างคำร้องใหม่',
  metadata: revisionOf ? { revisionOf: String(revisionOf) } : undefined,
});
```

- [ ] **Step 3.2: Manual API check**

With dev server running, test in PowerShell:
```powershell
# Should reject invalid id
Invoke-RestMethod -Method Post -Uri http://localhost:3001/api/petitions -ContentType 'application/json' -Body '{"dept":"rm","submittedBy":{"name":"X"},"deliveredBy":{"name":"Y"},"items":[{"seq":1,"sampleName":"S","batchNo":"B"}],"revisionOf":"notanid"}'
```
Expected: 400 with message containing "revisionOf".

- [ ] **Step 3.3: Commit**

```bash
git add server/routes/petitions.js
git commit -m "feat(petition): accept and validate revisionOf in POST /petitions"
```

---

## Task 4: Backend — PATCH approve/reject transitions

**Files:**
- Modify: `server/routes/petitions.js:417-448` (the generic `PATCH /:id`)

- [ ] **Step 4.1: Add transition handlers before the generic update**

Replace the entire `router.patch('/:id', ...)` handler (lines ~417-448) with:

```js
// PATCH /api/petitions/:id  (general update + approve/reject transitions)
router.patch('/:id', async (req, res) => {
  try {
    const updates = { ...req.body };
    const actor = updates.actor;
    delete updates.actor;
    delete updates.petitionNo;
    delete updates._id;
    delete updates.revisionOf;     // revisionOf is set on create only
    delete updates.approvedAt;     // server-managed
    delete updates.rejectedAt;     // server-managed

    const before = await Petition.findById(req.params.id);
    if (!before) return res.status(404).json({ error: { message: 'ไม่พบคำร้อง' } });

    // Terminal-state guard
    if ((before.status === 'approved' || before.status === 'rejected') && updates.status && updates.status !== before.status) {
      return res.status(409).json({ error: { message: 'คำร้องนี้ปิดแล้ว ไม่สามารถเปลี่ยนสถานะได้' } });
    }

    // Approve transition: success → approved
    if (updates.status === 'approved') {
      if (before.status !== 'success') {
        return res.status(409).json({ error: { message: 'อนุมัติได้เฉพาะคำร้องสถานะ "ทดสอบเสร็จสิ้น"' } });
      }
      before.status = 'approved';
      before.approvedAt = new Date();
      before.reviewHistory.push({
        action: 'approve',
        reviewedBy: actor || 'system',
        reviewedAt: new Date(),
      });
      await before.save();
      logAudit(before, {
        event: 'statusChanged',
        fromStatus: 'success',
        toStatus: 'approved',
        actor: actor || 'system',
        note: 'อนุมัติคำร้อง',
      });
      return res.json(before);
    }

    // Reject transition: success → rejected
    if (updates.status === 'rejected') {
      if (before.status !== 'success') {
        return res.status(409).json({ error: { message: 'ส่งกลับให้แก้ไขได้เฉพาะคำร้องสถานะ "ทดสอบเสร็จสิ้น"' } });
      }
      const note = String(updates.revisionNote || '').trim();
      if (!note) {
        return badRequest(res, 'กรุณาระบุข้อความที่ต้องการให้แก้ไข');
      }
      before.status = 'rejected';
      before.rejectedAt = new Date();
      before.reviewHistory.push({
        action: 'reject',
        reviewedBy: actor || 'system',
        reviewedAt: new Date(),
        note,
      });
      await before.save();
      logAudit(before, {
        event: 'statusChanged',
        fromStatus: 'success',
        toStatus: 'rejected',
        actor: actor || 'system',
        note: `ส่งกลับให้แก้ไข: ${note}`,
      });
      return res.json(before);
    }

    // Generic update path (no terminal transition)
    delete updates.revisionNote;
    const doc = await Petition.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (before.status !== doc.status) {
      logAudit(doc, {
        event: 'statusChanged',
        fromStatus: before.status,
        toStatus: doc.status,
        actor: actor || 'system',
        note: 'อัปเดตคำร้อง',
      });
    } else {
      logAudit(doc, {
        event: 'updated',
        toStatus: doc.status,
        actor: actor || 'system',
        note: 'อัปเดตคำร้อง',
      });
    }
    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});
```

- [ ] **Step 4.2: Manual API check — approve happy path**

Create a petition via the UI and advance it to `success` (or use an existing `success` petition). Then:
```powershell
$id = '<petition _id here>'
Invoke-RestMethod -Method Patch -Uri "http://localhost:3001/api/petitions/$id" -ContentType 'application/json' -Body '{"status":"approved","actor":"tester"}'
```
Expected: response has `status: "approved"`, `approvedAt` populated, and `reviewHistory` ends with an `approve` entry.

- [ ] **Step 4.3: Manual API check — reject requires note**

```powershell
Invoke-RestMethod -Method Patch -Uri "http://localhost:3001/api/petitions/$id" -ContentType 'application/json' -Body '{"status":"rejected","actor":"tester"}'
```
Expected: 400 with message about needing a note.

```powershell
Invoke-RestMethod -Method Patch -Uri "http://localhost:3001/api/petitions/$id" -ContentType 'application/json' -Body '{"status":"rejected","actor":"tester","revisionNote":"ค่าตะกั่วเกิน — โปรดทดสอบใหม่"}'
```
Expected: 200, `status: "rejected"`, `rejectedAt` populated, `reviewHistory` ends with `reject` entry containing the note.

- [ ] **Step 4.4: Manual API check — terminal-state guard**

Using the petition that was just approved/rejected:
```powershell
Invoke-RestMethod -Method Patch -Uri "http://localhost:3001/api/petitions/$id" -ContentType 'application/json' -Body '{"status":"inProgress","actor":"tester"}'
```
Expected: 409 with message about closed petition.

- [ ] **Step 4.5: Commit**

```bash
git add server/routes/petitions.js
git commit -m "feat(petition): add approve/reject PATCH transitions with terminal guard"
```

---

## Task 5: Backend — returned-flags source switch

**Files:**
- Modify: `server/routes/petitions.js:152-180`

- [ ] **Step 5.1: Switch the data source to `revisionOf`**

Replace the entire `router.get('/returned-flags', ...)` handler with:

```js
// GET /api/petitions/returned-flags?petitionIds=id1,id2,...
// Returns map of petitionId → boolean (true if petition is a revision of another
// petition, i.e. its predecessor was sent back from QC for re-submission).
router.get('/returned-flags', async (req, res) => {
  try {
    const raw = String(req.query.petitionIds || '').trim();
    if (!raw) return res.json({});
    const ids = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) return res.json({});

    const objectIds = ids
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const withRevision = await Petition.find({
      _id: { $in: objectIds },
      revisionOf: { $ne: null },
    }).select('_id').lean();
    const set = new Set(withRevision.map((d) => String(d._id)));

    const map = {};
    for (const id of ids) map[id] = set.has(id);
    res.json(map);
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});
```

- [ ] **Step 5.2: Manual API check**

```powershell
Invoke-RestMethod -Uri "http://localhost:3001/api/petitions/returned-flags?petitionIds=$id"
```
Expected: `{ "<id>": false }` for a petition with `revisionOf: null`. For a petition created with a valid `revisionOf` (do this after Task 11), it should return `true`.

- [ ] **Step 5.3: Commit**

```bash
git add server/routes/petitions.js
git commit -m "refactor(petition): derive returned-flags from revisionOf instead of audit log"
```

---

## Task 6: Frontend API helpers — approve / reject

**Files:**
- Modify: `src/lib/api.ts`

- [ ] **Step 6.1: Add helpers**

Find a logical place near `advancePetitionPhase` or other petition mutations and add:

```ts
approvePetition: (petitionId: string, actor: string) =>
  request<unknown>(`/petitions/${petitionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'approved', actor }),
  }),

rejectPetition: (petitionId: string, actor: string, revisionNote: string) =>
  request<unknown>(`/petitions/${petitionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'rejected', actor, revisionNote }),
  }),
```

(Match the existing pattern in the same file. If `request()` already sets a default Content-Type, drop the headers line.)

- [ ] **Step 6.2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6.3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(api): add approvePetition and rejectPetition helpers"
```

---

## Task 7: revisionHelpers — lookup map of previous QC values

**Files:**
- Create: `src/lib/revisionHelpers.ts`
- Create: `src/lib/revisionHelpers.test.ts`

- [ ] **Step 7.1: Write the failing tests first (TDD)**

Create `src/lib/revisionHelpers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildPreviousValueLookup, getPreviousValue } from './revisionHelpers';
import type { QCTestResult, PetitionItem } from '@/types/petition.types';

const makeResult = (overrides: Partial<QCTestResult>): QCTestResult => ({
  petitionId: 'p1',
  itemSeq: 1,
  sampleName: 'SampleA',
  parameterId: 'param1',
  values: {},
  ...overrides,
});

const makeItem = (overrides: Partial<PetitionItem>): PetitionItem => ({
  seq: 1,
  sampleName: 'SampleA',
  batchNo: 'B1',
  ...overrides,
});

describe('buildPreviousValueLookup', () => {
  it('returns empty lookup for empty input', () => {
    const previousItems: PetitionItem[] = [];
    const previousResults: QCTestResult[] = [];
    const lookup = buildPreviousValueLookup(previousItems, previousResults);
    expect(lookup.size).toBe(0);
  });

  it('builds keys keyed by batchNo + sampleName + commonName + parameterId + fieldLabel', () => {
    const items = [makeItem({ seq: 1, sampleName: 'SampleA', commonName: 'Acetone', batchNo: 'B1' })];
    const results = [
      makeResult({ itemSeq: 1, parameterId: 'p1', values: { '%Purity': 99.5, Density: 0.79 } }),
    ];
    const lookup = buildPreviousValueLookup(items, results);
    expect(lookup.get('B1|SampleA|Acetone|p1|%Purity')).toBe(99.5);
    expect(lookup.get('B1|SampleA|Acetone|p1|Density')).toBe(0.79);
  });

  it('treats missing commonName as empty string in the key', () => {
    const items = [makeItem({ seq: 1, sampleName: 'SampleA', batchNo: 'B1' })];
    const results = [makeResult({ itemSeq: 1, parameterId: 'p1', values: { x: 1 } })];
    const lookup = buildPreviousValueLookup(items, results);
    expect(lookup.get('B1|SampleA||p1|x')).toBe(1);
  });

  it('skips results without a matching item', () => {
    const items = [makeItem({ seq: 1 })];
    const results = [makeResult({ itemSeq: 99, parameterId: 'p1', values: { x: 1 } })];
    const lookup = buildPreviousValueLookup(items, results);
    expect(lookup.size).toBe(0);
  });
});

describe('getPreviousValue', () => {
  it('returns the value when a match exists', () => {
    const items = [makeItem({ seq: 1, sampleName: 'SampleA', commonName: 'Acetone', batchNo: 'B1' })];
    const results = [makeResult({ itemSeq: 1, parameterId: 'p1', values: { Density: 0.79 } })];
    const lookup = buildPreviousValueLookup(items, results);
    const currentItem = makeItem({ seq: 5, sampleName: 'SampleA', commonName: 'Acetone', batchNo: 'B1' });
    expect(getPreviousValue(lookup, currentItem, 'p1', 'Density')).toBe(0.79);
  });

  it('returns undefined when no match exists', () => {
    const lookup = buildPreviousValueLookup([], []);
    const currentItem = makeItem({ seq: 1 });
    expect(getPreviousValue(lookup, currentItem, 'p1', 'x')).toBeUndefined();
  });
});
```

- [ ] **Step 7.2: Run the tests — verify they fail**

Run: `npx vitest run src/lib/revisionHelpers.test.ts`
Expected: FAIL — `Cannot find module './revisionHelpers'`.

- [ ] **Step 7.3: Implement the helper**

Create `src/lib/revisionHelpers.ts`:

```ts
import type { PetitionItem, QCTestResult } from '@/types/petition.types';

export type PreviousValueLookup = Map<string, unknown>;

function makeKey(batchNo: string, sampleName: string, commonName: string, parameterId: string, fieldLabel: string): string {
  return `${batchNo}|${sampleName}|${commonName}|${parameterId}|${fieldLabel}`;
}

export function buildPreviousValueLookup(
  previousItems: PetitionItem[],
  previousResults: QCTestResult[],
): PreviousValueLookup {
  const itemBySeq = new Map<number, PetitionItem>();
  for (const item of previousItems) itemBySeq.set(item.seq, item);

  const lookup: PreviousValueLookup = new Map();
  for (const result of previousResults) {
    const item = itemBySeq.get(result.itemSeq);
    if (!item) continue;
    const batchNo = item.batchNo ?? '';
    const sampleName = item.sampleName ?? '';
    const commonName = item.commonName ?? '';
    for (const [fieldLabel, value] of Object.entries(result.values ?? {})) {
      lookup.set(makeKey(batchNo, sampleName, commonName, result.parameterId, fieldLabel), value);
    }
  }
  return lookup;
}

export function getPreviousValue(
  lookup: PreviousValueLookup,
  currentItem: PetitionItem,
  parameterId: string,
  fieldLabel: string,
): unknown {
  return lookup.get(
    makeKey(
      currentItem.batchNo ?? '',
      currentItem.sampleName ?? '',
      currentItem.commonName ?? '',
      parameterId,
      fieldLabel,
    ),
  );
}
```

- [ ] **Step 7.4: Run the tests — verify they pass**

Run: `npx vitest run src/lib/revisionHelpers.test.ts`
Expected: all 6 tests PASS.

- [ ] **Step 7.5: Commit**

```bash
git add src/lib/revisionHelpers.ts src/lib/revisionHelpers.test.ts
git commit -m "feat(petition): revisionHelpers for matching previous QC values"
```

---

## Task 8: RevisionRequestDialog component

**Files:**
- Create: `src/components/petition/RevisionRequestDialog.tsx`

- [ ] **Step 8.1: Create the component**

Create `src/components/petition/RevisionRequestDialog.tsx`:

```tsx
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, RotateCcw } from 'lucide-react';

interface RevisionRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  petitionNo: string;
  submitterName: string;
  onConfirm: (note: string) => Promise<void> | void;
}

export function RevisionRequestDialog({
  open,
  onOpenChange,
  petitionNo,
  submitterName,
  onConfirm,
}: RevisionRequestDialogProps) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    const trimmed = note.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await onConfirm(trimmed);
      setNote('');
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const canConfirm = note.trim().length > 0 && !submitting;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!submitting) onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-orange-500" />
            ส่งคำร้อง {petitionNo} ให้แก้ไข
          </DialogTitle>
          <DialogDescription>
            ส่งกลับให้: <span className="font-semibold text-foreground">{submitterName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            ข้อความถึงผู้ยื่น <span className="text-red-500">*</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ระบุสิ่งที่ต้องการให้แก้ไข..."
            disabled={submitting}
            className="w-full text-sm rounded border px-3 py-2 min-h-[120px] focus:outline-none focus:ring-1 focus:ring-primary-300 disabled:bg-grey-50"
          />
        </div>

        <div className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800">
          ⚠ คำร้องนี้จะถูกปิด ผู้ยื่นจะต้องสร้างคำร้องใหม่จากคำร้องนี้เพื่อแก้ไข
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            ยกเลิก
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="gap-2"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            ส่งให้แก้ไข
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 8.2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors. If the `Dialog` import path differs, check `src/components/ui/` for the correct shadcn export.

- [ ] **Step 8.3: Commit**

```bash
git add src/components/petition/RevisionRequestDialog.tsx
git commit -m "feat(petition): RevisionRequestDialog with required note"
```

---

## Task 9: QCTestingDetailPage — two-button approval section

**Files:**
- Modify: `src/pages/QCTestingDetailPage.tsx:546-823`

- [ ] **Step 9.1: Import the new dialog and helpers, add state**

At the top of `src/pages/QCTestingDetailPage.tsx`, add:

```tsx
import { RevisionRequestDialog } from '@/components/petition/RevisionRequestDialog';
```

Inside `QCTestingDetailPage` component (near the other `useState` calls around line 260-263), add:

```tsx
const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
```

- [ ] **Step 9.2: Replace `handleSendBack` with approve and reject handlers**

Delete the existing `handleSendBack` function (around lines 546-565) and replace with:

```tsx
const handleApprove = async () => {
  if (!window.confirm('อนุมัติคำร้องนี้?')) return;
  setSubmitting(true);
  try {
    await api.approvePetition(petition._id, user?.name ?? 'system');
    toast.success('อนุมัติเรียบร้อย');
    navigate('/qc-approval');
  } catch {
    toast.error('อนุมัติไม่สำเร็จ');
  } finally {
    setSubmitting(false);
  }
};

const handleReject = async (note: string) => {
  try {
    await api.rejectPetition(petition._id, user?.name ?? 'system', note);
    toast.success('ส่งกลับให้แก้ไขเรียบร้อย', {
      description: `ส่งให้ ${petition.submittedBy?.name ?? 'ผู้ยื่น'}`,
    });
    navigate('/qc-approval');
  } catch {
    toast.error('ส่งกลับไม่สำเร็จ');
    throw new Error('reject failed'); // keep dialog open
  }
};
```

- [ ] **Step 9.3: Replace the success-state action panel with two buttons**

Find the `petition.status === 'success'` block (around lines 792-824) and replace its action area:

```tsx
{petition.status === 'success' && (
  <div className="rounded-lg border border-green-200 bg-green-50 p-4 flex flex-col items-center gap-3">
    <div className="flex flex-col items-center gap-1">
      <CheckCircle2 className="h-6 w-6 text-green-500" />
      <p className="text-sm font-semibold text-green-700">บันทึกผลแล้ว — รออนุมัติ</p>
      <p className="text-xs text-grey-500">
        {petition.receivedBy
          ? `ผู้รับงาน: ${petition.receivedBy}`
          : 'ไม่ระบุผู้รับงาน'}
      </p>
      {abnormalCount > 0 && (
        <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
          <AlertTriangle className="h-3.5 w-3.5" />
          คำร้องนี้มีค่าผิดปกติ {abnormalCount} รายการ
        </p>
      )}
    </div>
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setRevisionDialogOpen(true)}
        disabled={submitting}
        className="gap-2"
      >
        <RotateCcw className="h-4 w-4" />
        ส่งให้แก้ไข
      </Button>
      <Button
        variant="primary"
        size="sm"
        onClick={handleApprove}
        disabled={submitting}
        className="gap-2"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        อนุมัติคำร้อง
      </Button>
    </div>
  </div>
)}

<RevisionRequestDialog
  open={revisionDialogOpen}
  onOpenChange={setRevisionDialogOpen}
  petitionNo={petition.petitionNo}
  submitterName={petition.submittedBy?.name ?? 'ผู้ยื่น'}
  onConfirm={handleReject}
/>
```

- [ ] **Step 9.4: Add closed-state banner for approved/rejected**

Inside the same block list, after the `success` block, add:

```tsx
{(petition.status === 'approved' || petition.status === 'rejected') && (
  <div className={`rounded-lg border p-4 flex flex-col items-center gap-2 ${
    petition.status === 'approved' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
  }`}>
    {petition.status === 'approved' ? (
      <CheckCircle2 className="h-6 w-6 text-green-500" />
    ) : (
      <RotateCcw className="h-6 w-6 text-red-500" />
    )}
    <p className={`text-sm font-semibold ${
      petition.status === 'approved' ? 'text-green-700' : 'text-red-700'
    }`}>
      {petition.status === 'approved' ? 'อนุมัติแล้ว' : 'ส่งกลับให้แก้ไขแล้ว'}
    </p>
  </div>
)}
```

- [ ] **Step 9.5: Manual UI check**

Run dev server (if not running), open a petition in `success` status. Verify:
1. Both buttons appear.
2. Clicking "อนุมัติคำร้อง" → confirm prompt → on confirm, status becomes `approved`.
3. Clicking "ส่งให้แก้ไข" → dialog opens.
4. Submitting empty note: button is disabled.
5. Submitting with note: petition status becomes `rejected` and reviewHistory has the note.

- [ ] **Step 9.6: Commit**

```bash
git add src/pages/QCTestingDetailPage.tsx
git commit -m "feat(qc): two-button approve/reject with required note dialog"
```

---

## Task 10: PetitionDetailPage — rejected banner with re-submit button

**Files:**
- Modify: `src/pages/PetitionDetailPage.tsx`

- [ ] **Step 10.1: Add the banner above the existing layout**

Open `src/pages/PetitionDetailPage.tsx`. After the main petition view component begins rendering (find the section where the `<PetitionView petition={petition} />` is rendered), insert a banner block immediately above it:

```tsx
{petition.status === 'rejected' && (() => {
  const rejectEntry = [...(petition.reviewHistory ?? [])].reverse().find((e) => e.action === 'reject');
  const isSubmitter =
    user?.employeeId &&
    petition.submittedBy?.employeeId &&
    user.employeeId === petition.submittedBy.employeeId;
  return (
    <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 mb-4 space-y-2">
      <div className="flex items-center gap-2">
        <RotateCcw className="h-5 w-5 text-orange-500" />
        <p className="text-sm font-semibold text-orange-800">คำร้องนี้ถูกส่งกลับให้แก้ไข</p>
      </div>
      {rejectEntry && (
        <>
          <p className="text-xs text-orange-700">
            ผู้ตรวจสอบ: {rejectEntry.reviewedBy} · เมื่อ{' '}
            {new Date(rejectEntry.reviewedAt).toLocaleString('th-TH', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </p>
          {rejectEntry.note && (
            <p className="text-sm text-black-700 whitespace-pre-wrap rounded border border-orange-200 bg-white px-3 py-2">
              {rejectEntry.note}
            </p>
          )}
        </>
      )}
      {isSubmitter && (
        <Button
          variant="primary"
          size="sm"
          onClick={() => navigate(`/petitions/new?revisionOf=${petition._id}`)}
          className="gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          ยื่นแก้ไขใหม่
        </Button>
      )}
    </div>
  );
})()}
```

If `RotateCcw` is not yet imported in this file, add it to the lucide-react imports at the top.

- [ ] **Step 10.2: Manual UI check**

Open a petition that was rejected in Task 9 step 5. Verify:
1. Orange banner appears at the top.
2. Reviewer name + timestamp + note appear.
3. "ยื่นแก้ไขใหม่" button appears only when you're logged in as the submitter (in DEV_MODE that's `dev@icpladda.com`).

- [ ] **Step 10.3: Commit**

```bash
git add src/pages/PetitionDetailPage.tsx
git commit -m "feat(petition): rejected banner with submitter re-submit button"
```

---

## Task 11: PetitionNewPage — accept `?revisionOf` and persist link

**Files:**
- Modify: `src/pages/petitions/ProductionPetitionNewPage.tsx`

- [ ] **Step 11.1: Read the existing file structure first**

Run: `Read src/pages/petitions/ProductionPetitionNewPage.tsx` to locate:
- Where form state is initialized (useState/useReducer).
- Where the submit handler calls the API.
- Whether there is a sibling file for RM/FG petition creation (search via `Glob: src/pages/petitions/*PetitionNewPage.tsx`).

Note: per `src/pages/PetitionNewPage.tsx:1-5`, only the Production variant exists in routing. RM/FG re-submit will use this same page.

- [ ] **Step 11.2: Add revisionOf parsing and pre-fill effect**

Near the top of `ProductionPetitionNewPage`, add:

```tsx
import { useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import type { Petition } from '@/types/petition.types';
```

Inside the component, near the existing state declarations, add:

```tsx
const [searchParams] = useSearchParams();
const revisionOfId = searchParams.get('revisionOf');
const [revisionSource, setRevisionSource] = useState<Petition | null>(null);

useEffect(() => {
  if (!revisionOfId) return;
  let alive = true;
  api.request<Petition>(`/petitions/${revisionOfId}`)
    .then((source) => {
      if (!alive) return;
      if (source.status !== 'rejected') {
        toast.error('คำร้องต้นทางไม่ได้ถูกส่งกลับให้แก้ไข');
        navigate('/petitions');
        return;
      }
      const sameUser =
        !user?.employeeId ||
        !source.submittedBy?.employeeId ||
        user.employeeId === source.submittedBy.employeeId;
      if (!sameUser) {
        toast.error('คุณไม่ใช่ผู้ยื่นของคำร้องต้นทาง');
        navigate('/petitions');
        return;
      }
      setRevisionSource(source);
      // Pre-fill: dept, items, cause, productionPlans, prodOrderNos
      // (Replace the lines below with the project's actual form setters.)
      setDept(source.dept);
      setItems(source.items.map((it) => ({ ...it, sampleId: undefined })));
      setCause(source.cause ?? '');
      if (source.dept === 'production') {
        setProductionPlans((source as ProductionPetition).productionPlans ?? []);
      }
      setProdOrderNos(source.prodOrderNos ?? []);
    })
    .catch(() => {
      toast.error('โหลดคำร้องต้นทางไม่สำเร็จ');
      navigate('/petitions');
    });
  return () => { alive = false; };
}, [revisionOfId]);
```

(Adapt the setter names to the actual ones used by this page. If the page uses one `setForm(...)` reducer, set the whole object accordingly.)

- [ ] **Step 11.3: Show banner above the form**

Near the top of the page's JSX:

```tsx
{revisionSource && (
  <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 mb-4 flex items-center gap-2">
    <RotateCcw className="h-4 w-4 text-orange-500 shrink-0" />
    <p className="text-sm text-orange-800">
      ยื่นแก้ไขจากคำร้อง <span className="font-semibold">{revisionSource.petitionNo}</span>
    </p>
  </div>
)}
```

- [ ] **Step 11.4: Pass `revisionOf` in the submit payload**

Find the existing POST call (likely `api.request('/petitions', { method: 'POST', body: ... })` or similar). Add `revisionOf: revisionOfId || undefined` to the body object.

Example pattern:
```ts
const body = {
  dept,
  submittedBy: { ... },
  deliveredBy: { ... },
  items,
  cause,
  productionPlans,
  prodOrderNos,
  revisionOf: revisionOfId || undefined,
};
```

- [ ] **Step 11.5: Manual UI check**

1. Open the rejected petition from Task 10 step 2.
2. Click "ยื่นแก้ไขใหม่" → routed to `/petitions/new?revisionOf=<id>`.
3. Confirm form is pre-filled with dept/items/cause/etc.
4. Confirm orange banner appears.
5. Submit the form → new petition is created with `revisionOf` set (verify via `/api/petitions/<newId>`).
6. Open the new petition → returned-flag is true, header shows the `RotateCcw` icon.

- [ ] **Step 11.6: Commit**

```bash
git add src/pages/petitions/ProductionPetitionNewPage.tsx
git commit -m "feat(petition): pre-fill PetitionNewPage from rejected petition via revisionOf"
```

---

## Task 12: QC Testing — inline previous-value display

**Files:**
- Modify: `src/pages/QCTestingDetailPage.tsx`

- [ ] **Step 12.1: Fetch previous QC results when petition has revisionOf**

In `QCTestingDetailPage` (near where `savedResults` is loaded around lines 305-332), add a second effect:

```tsx
import { buildPreviousValueLookup, getPreviousValue, type PreviousValueLookup } from '@/lib/revisionHelpers';

// ...inside the component, alongside other useState:
const [previousLookup, setPreviousLookup] = useState<PreviousValueLookup>(new Map());

useEffect(() => {
  if (!petition?.revisionOf) {
    setPreviousLookup(new Map());
    return;
  }
  let alive = true;
  Promise.all([
    api.request<Petition>(`/petitions/${petition.revisionOf}`),
    api.getQCResults(String(petition.revisionOf)),
  ])
    .then(([prevPetition, prevResults]) => {
      if (!alive) return;
      setPreviousLookup(buildPreviousValueLookup(prevPetition.items, prevResults));
    })
    .catch(() => { if (alive) setPreviousLookup(new Map()); });
  return () => { alive = false; };
}, [petition?.revisionOf]);
```

- [ ] **Step 12.2: Pass previous value down to TestField**

Update the `TestField` interface (top of file):

```ts
interface TestFieldProps {
  field: ParameterValueField;
  item: PetitionItem;
  value: unknown;
  noteValue: unknown;
  saveInfo?: FieldSaveInfo;
  noteSaveInfo?: FieldSaveInfo;
  previousValue?: unknown;   // ← new
  onChange: (val: unknown) => void;
  onNoteChange: (val: unknown) => void;
  disabled?: boolean;
}
```

Inside the `TestField` function body, after the existing "who saved" `<p>` block (right before the closing `</div>` of the outer `space-y-1`), add:

```tsx
{previousValue !== undefined && previousValue !== '' && (
  <p className="text-xs text-grey-400 flex items-center gap-1 mt-0.5">
    <span>ค่าเดิม: <span className="font-mono">{String(previousValue)}</span></span>
    {isFieldAbnormal(field, previousValue) && (
      <AlertTriangle className="h-3 w-3 text-orange-400" />
    )}
  </p>
)}
```

Destructure `previousValue` in the `TestField` argument list (next to the other props).

- [ ] **Step 12.3: Wire up the prop at the call site**

In the JSX where `<TestField ... />` is rendered (around lines 731-746), add:

```tsx
previousValue={getPreviousValue(previousLookup, item, param._id!, field.label)}
```

- [ ] **Step 12.4: Manual UI check**

1. Open the new (revision) petition created in Task 11 step 5 via QC Testing.
2. Verify each field that had a value in the original petition shows "ค่าเดิม: XXX" underneath.
3. For values that are abnormal in the original, the orange warning icon shows next to it.

- [ ] **Step 12.5: Commit**

```bash
git add src/pages/QCTestingDetailPage.tsx
git commit -m "feat(qc): inline previous-value display for revision petitions"
```

---

## Task 13: PetitionListPage — push bell notification for newly rejected petitions

**Files:**
- Modify: `src/pages/PetitionListPage.tsx`

- [ ] **Step 13.1: Add a scan effect**

Open `src/pages/PetitionListPage.tsx`. Near the top imports:

```tsx
import { useNotifications } from '@/context/NotificationContext';
```

Inside the component, after the petition list data is loaded (find where `useQuery` or similar fetches petitions; access them as `petitions` or whatever the variable is called), add:

```tsx
const { push } = useNotifications();

useEffect(() => {
  if (!user || !petitions) return;
  const myEmpId = user.employeeId;
  if (!myEmpId) return;

  for (const p of petitions) {
    if (p.status !== 'rejected') continue;
    if (p.submittedBy?.employeeId !== myEmpId) continue;
    const rejectEntry = [...(p.reviewHistory ?? [])].reverse().find((e) => e.action === 'reject');
    if (!rejectEntry) continue;
    push({
      id: `petition-rejected-${p._id}`,
      title: `คำร้อง ${p.petitionNo} ถูกส่งกลับให้แก้ไข`,
      message: rejectEntry.note,
      level: 'warning',
      link: `/petitions/${p._id}`,
      persistent: true,
    });
  }
}, [user, petitions, push]);
```

The `push()` helper is a no-op for duplicate ids (see `NotificationContext.tsx:71-78`), so this is safe to run on every load.

- [ ] **Step 13.2: Manual UI check**

1. Reject a petition (Task 9 step 5) while logged in as the QC user.
2. With DEV_MODE on, the dev user is also the submitter — refresh `/petitions`.
3. Verify the bell icon shows an unread notification with the rejection title and the note as the body.
4. Click the notification → navigates to the petition detail with the banner.

- [ ] **Step 13.3: Commit**

```bash
git add src/pages/PetitionListPage.tsx
git commit -m "feat(notifications): push bell alert for rejected petitions owned by user"
```

---

## Task 14: E2E test — full reject + revision flow

**Files:**
- Create: `tests/e2e/qc-reject-flow.spec.ts`

- [ ] **Step 14.1: Inspect an existing E2E test as a template**

Run: `Read tests/e2e/qc-testing.spec.ts` (limit 80) to see the project's Playwright fixture conventions (selectors, navigation helpers, login bypass, etc.). The new spec must follow the same conventions.

- [ ] **Step 14.2: Write the spec**

Create `tests/e2e/qc-reject-flow.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

// Assumes DEV_MODE = true so login is bypassed and the dev user is admin.
// Requires a seeded petition at status=success; create one via the UI inside
// the test if no fixture exists.

test('QC reject → submitter resubmits → revision shows previous values', async ({ page }) => {
  // 1. As QC, open a petition at status=success and reject with a note.
  await page.goto('/LIS/qc-approval');
  const firstRow = page.locator('table tbody tr').first();
  await firstRow.click();
  await page.getByRole('button', { name: 'ส่งให้แก้ไข' }).first().click();
  await page.locator('textarea').fill('ตะกั่วเกิน — โปรดทดสอบใหม่');
  await page.getByRole('button', { name: 'ส่งให้แก้ไข' }).last().click();
  await expect(page).toHaveURL(/qc-approval/);

  // 2. As submitter (same dev user), find the rejected petition.
  await page.goto('/LIS/petitions');
  const rejectedBadge = page.getByText('ส่งกลับให้แก้ไข').first();
  await expect(rejectedBadge).toBeVisible();
  await rejectedBadge.click();
  await expect(page.getByText('คำร้องนี้ถูกส่งกลับให้แก้ไข')).toBeVisible();
  await expect(page.getByText('ตะกั่วเกิน — โปรดทดสอบใหม่')).toBeVisible();

  // 3. Click "ยื่นแก้ไขใหม่" → new petition page with banner.
  await page.getByRole('button', { name: 'ยื่นแก้ไขใหม่' }).click();
  await expect(page.getByText(/ยื่นแก้ไขจากคำร้อง/)).toBeVisible();

  // 4. Submit the pre-filled form → new petition is created with revisionOf.
  await page.getByRole('button', { name: /บันทึก|สร้าง/ }).first().click();
  await expect(page).toHaveURL(/\/petitions\/[^/]+$/);

  // 5. Open the new petition in QC Testing → previous values shown inline.
  // (Navigate the petition through the workflow until it reaches QC Testing —
  // this part is project-specific; consult tests/e2e/qc-testing.spec.ts for
  // the seed pattern, or stub the petition status via direct API call.)
});
```

The exact selectors and seeding pattern must be adapted to match `tests/e2e/qc-testing.spec.ts`. If the project doesn't have a way to seed a petition at status=success in tests, mark steps 4–5 as `test.fixme` and document the gap.

- [ ] **Step 14.3: Run the spec**

Run: `npx playwright test tests/e2e/qc-reject-flow.spec.ts`
Expected: PASS, or documented `.fixme` for steps that need seed infrastructure.

- [ ] **Step 14.4: Commit**

```bash
git add tests/e2e/qc-reject-flow.spec.ts
git commit -m "test(e2e): full reject + revision resubmit flow"
```

---

## Task 15: Final verification

- [ ] **Step 15.1: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 15.2: Run all unit tests**

Run: `npm run test`
Expected: all tests pass, including the new `revisionHelpers.test.ts`.

- [ ] **Step 15.3: Lint**

Run: `npm run lint`
Expected: no new warnings/errors in modified files.

- [ ] **Step 15.4: Smoke test the full UI flow**

With dev server running, walk through:
1. Create a petition (RM dept is fastest) → advance via QC scan/receive/assign/test until status=success.
2. As QC, approve one petition. Verify it lands at status=approved with the green banner.
3. Create another petition through the same path, but reject it. Verify the dialog requires a note.
4. As submitter, see the bell notification and the rejected banner on the petition detail.
5. Click "ยื่นแก้ไขใหม่" → form is pre-filled → submit.
6. The new petition shows the revision badge in QC Approval and the previous values inline in QC Testing.
7. Approve the new petition to close the loop.

- [ ] **Step 15.5: Final commit if anything was tweaked**

If steps 15.1-15.4 surfaced minor fixes, commit them:
```bash
git status
git add -p   # review changes
git commit -m "fix: address verification findings for petition reject/revision flow"
```
