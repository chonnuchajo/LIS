# Per-Track Receive (Lab/QC) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** แยกสถานะการรับตัวอย่าง (สแกนรับ) ของ Lab กับ QC ออกจากกัน — Lab สแกน → Lab เห็น "รับแล้ว", QC ยังเห็น "ยังไม่รับ" จนกว่า QC สแกนเอง; viewer เห็น "รับแล้ว" ถ้าฝ่ายใดรับ

**Architecture:** เพิ่ม flat fields `labReceivedAt/By`, `qcReceivedAt/By` บน Petition; `PATCH /:id/receive` รับ `track` แล้วเซ็ต field ของ track นั้น + bump `status` กลางเป็น `pendingReview` เฉพาะการรับครั้งแรก (ให้ viewer เห็น "รับแล้ว"). Frontend เลิกเช็ค `status === 'sampleSent'` หันมาใช้ helper `isReceivedByTrack(p, track)` ในการ routing/bucket/badge ของหน้า Lab/QC. การทดสอบ/อนุมัติ/completion ยังใช้ `status` กลางเหมือนเดิม (แยกแค่การรับ)

**Tech Stack:** Express 4 + Mongoose 8 (backend), React 18 + TS + Vite (frontend), Vitest (tests)

**Reference spec:** `docs/superpowers/specs/2026-06-08-per-track-receive-lab-qc-design.md`

**Real type-check command** (root `tsc --noEmit` is a no-op): `npx tsc -p tsconfig.app.json --noEmit`

---

## File Structure

- Create `server/lib/petitionReceive.js` — pure receive-transition logic (testable)
- Create `server/lib/petitionReceive.test.js` — unit tests
- Modify `server/models/Petition.js` — add 4 fields
- Modify `server/routes/petitions.js` — `/receive` uses the new lib, accepts `track`
- Create `server/scripts/backfill-track-received.js` — migration (dry-run + `--commit`)
- Modify `src/types/petition.types.ts` — add 4 optional fields to `PetitionBase`
- Create `src/lib/petitionReceipt.ts` — `Track`, `isReceivedByTrack`, `splitPetitionsByTrack`
- Create `src/lib/petitionReceipt.test.ts` — unit tests
- Modify `src/components/lis/PetitionDashboardTable.tsx` — `track` prop, per-track routing
- Modify `src/pages/LabDashboard.tsx`, `src/pages/QCDashboard.tsx` — per-track buckets
- Modify `src/pages/LabTestingPage.tsx`, `src/pages/QCTestingPage.tsx` — per-track action/badge/row-click
- Modify `src/components/petition/LabScanAcceptModal.tsx`, `src/components/petition/QrReceiveModal.tsx` — send `track`

---

## Task 1: Backend receive-transition lib

**Files:**
- Create: `server/lib/petitionReceive.js`
- Test: `server/lib/petitionReceive.test.js`

- [ ] **Step 1: Write the failing test**

> Server-side tests use Node's built-in test runner (`node:test` + `node:assert`), NOT Vitest — Vitest's `include` glob is `src/**` only. Match the existing `server/lib/stockSource.test.js` style.

Create `server/lib/petitionReceive.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { computeReceiveUpdate } = require('./petitionReceive');

const NOW = new Date('2026-06-08T03:00:00.000Z');

test('rejects an invalid track', () => {
  const r = computeReceiveUpdate({ status: 'sampleSent' }, 'foo', 'alice', NOW);
  assert.strictEqual(r.error, 'invalid_track');
});

test('blocks receive when status is terminal', () => {
  for (const status of ['success', 'approved', 'rejected']) {
    const r = computeReceiveUpdate({ status }, 'lab', 'alice', NOW);
    assert.strictEqual(r.error, 'terminal_status');
  }
});

test('lab first receive on sampleSent sets lab fields and bumps status', () => {
  const r = computeReceiveUpdate({ status: 'sampleSent' }, 'lab', 'alice', NOW);
  assert.strictEqual(r.error, undefined);
  assert.ok(!r.alreadyReceived);
  assert.deepStrictEqual(r.update, {
    labReceivedAt: NOW,
    labReceivedBy: 'alice',
    status: 'pendingReview',
    receivedAt: NOW,
    receivedBy: 'alice',
  });
});

test('qc receiving after lab already bumped status does NOT touch status again', () => {
  const before = {
    status: 'pendingReview',
    labReceivedAt: new Date('2026-06-07T00:00:00.000Z'),
    labReceivedBy: 'bob',
  };
  const r = computeReceiveUpdate(before, 'qc', 'alice', NOW);
  assert.deepStrictEqual(r.update, { qcReceivedAt: NOW, qcReceivedBy: 'alice' });
  assert.strictEqual(r.update.status, undefined);
});

test('is idempotent when the same track already received', () => {
  const before = { status: 'pendingReview', qcReceivedAt: NOW, qcReceivedBy: 'alice' };
  const r = computeReceiveUpdate(before, 'qc', 'alice', NOW);
  assert.strictEqual(r.alreadyReceived, true);
  assert.strictEqual(r.update, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test server/lib/petitionReceive.test.js`
Expected: FAIL — `Cannot find module './petitionReceive'`

- [ ] **Step 3: Write the implementation**

Create `server/lib/petitionReceive.js`:

```js
'use strict';

// สถานะที่ห้ามรับเพิ่ม (จบ lifecycle แล้ว)
const TERMINAL_STATUSES = new Set(['success', 'approved', 'rejected']);

const FIELDS = {
  lab: { at: 'labReceivedAt', by: 'labReceivedBy' },
  qc: { at: 'qcReceivedAt', by: 'qcReceivedBy' },
};

/**
 * คำนวณ patch ที่ต้องใช้เมื่อ track หนึ่งสแกนรับตัวอย่าง — แยกตรรกะออกมาเพื่อ test ได้
 * @param {{status:string, labReceivedAt?:any, qcReceivedAt?:any}} before  petition ปัจจุบัน (lean)
 * @param {'lab'|'qc'} track
 * @param {string} actor
 * @param {Date} now
 * @returns {{update?:object|null, alreadyReceived?:boolean, error?:'invalid_track'|'terminal_status'}}
 */
function computeReceiveUpdate(before, track, actor, now) {
  const fields = FIELDS[track];
  if (!fields) return { error: 'invalid_track' };
  if (TERMINAL_STATUSES.has(before.status)) return { error: 'terminal_status' };
  if (before[fields.at]) return { alreadyReceived: true, update: null };

  const update = { [fields.at]: now, [fields.by]: actor };
  // bump status กลางเฉพาะการรับครั้งแรก (ยังเป็น sampleSent อยู่) → viewer เห็น "รับแล้ว"
  if (before.status === 'sampleSent') {
    update.status = 'pendingReview';
    update.receivedAt = now;
    update.receivedBy = actor;
  }
  return { update };
}

module.exports = { computeReceiveUpdate, TERMINAL_STATUSES };
```

> Note: CommonJS (`require`/`module.exports`) to match the rest of `server/`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test server/lib/petitionReceive.test.js`
Expected: `# pass 5`

- [ ] **Step 5: Commit**

```bash
git add server/lib/petitionReceive.js server/lib/petitionReceive.test.js
git commit -m "feat(receive): per-track receive transition lib + tests"
```

---

## Task 2: Petition model fields + wire route

**Files:**
- Modify: `server/models/Petition.js:212-214` (near `sampleSentAt`/`receivedAt`)
- Modify: `server/routes/petitions.js:386-414` (the `/receive` handler) + top-of-file require

- [ ] **Step 1: Add the model fields**

In `server/models/Petition.js`, find:

```js
    sampleSentAt: Date,
    receivedAt: Date,
    receivedBy: String,
```

Replace with:

```js
    sampleSentAt: Date,
    receivedAt: Date,
    receivedBy: String,
    // per-track receive (Lab/QC สแกนรับแยกกัน) — receivedAt/receivedBy ด้านบน = การรับครั้งแรก
    labReceivedAt: Date,
    labReceivedBy: String,
    qcReceivedAt: Date,
    qcReceivedBy: String,
```

- [ ] **Step 2: Require the lib at the top of the routes file**

In `server/routes/petitions.js`, find the existing requires near the top (the file already requires `mongoose` and the `Petition` model). Add after the model/util requires:

```js
const { computeReceiveUpdate } = require('../lib/petitionReceive');
```

(Place it next to the other `require('../...')` lines so it sits with related imports.)

- [ ] **Step 3: Replace the `/receive` handler**

In `server/routes/petitions.js`, replace the entire handler (currently lines ~386-414):

```js
// PATCH /api/petitions/:id/receive  → QC/Lab รับตัวอย่าง (scan รับ)
router.patch('/:id/receive', async (req, res) => {
  try {
    const id = req.params.id;
    const q = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { petitionNo: id };
    const before = await Petition.findOne(q).lean();
    if (!before) return res.status(404).json({ error: { message: 'ไม่พบคำร้อง' } });
    if (before.status !== 'sampleSent') {
      return badRequest(res, `ไม่สามารถรับได้: สถานะปัจจุบันคือ ${before.status}`);
    }
    const actor = req.body?.actor || 'system';
    const update = {
      status: 'pendingReview',
      receivedAt: new Date(),
      receivedBy: actor,
    };
    const doc = await Petition.findOneAndUpdate(q, update, { new: true });
    logAudit(doc, {
      event: 'statusChanged',
      fromStatus: before.status,
      toStatus: doc.status,
      actor,
      note: 'สแกนรับตัวอย่าง',
    });
    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});
```

with:

```js
// PATCH /api/petitions/:id/receive  → QC/Lab รับตัวอย่าง (scan รับ) แยก track
router.patch('/:id/receive', async (req, res) => {
  try {
    const id = req.params.id;
    const q = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { petitionNo: id };
    const before = await Petition.findOne(q).lean();
    if (!before) return res.status(404).json({ error: { message: 'ไม่พบคำร้อง' } });

    const actor = req.body?.actor || 'system';
    const track = req.body?.track;
    const { update, alreadyReceived, error } = computeReceiveUpdate(before, track, actor, new Date());

    if (error === 'invalid_track') return badRequest(res, 'track ไม่ถูกต้อง (ต้องเป็น lab หรือ qc)');
    if (error === 'terminal_status') {
      return badRequest(res, `ไม่สามารถรับได้: สถานะปัจจุบันคือ ${before.status}`);
    }
    // track นี้รับไปแล้ว → idempotent: ส่งของเดิมกลับให้ UI navigate ต่อได้
    if (alreadyReceived) return res.json(before);

    const doc = await Petition.findOneAndUpdate(q, update, { new: true });
    logAudit(doc, {
      event: 'statusChanged',
      fromStatus: before.status,
      toStatus: doc.status,
      actor,
      note: `สแกนรับตัวอย่าง (${track === 'lab' ? 'Lab' : 'QC'})`,
    });
    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});
```

- [ ] **Step 4: Verify the server still boots**

Run: `cd server && node -e "require('./routes/petitions'); require('./models/Petition'); console.log('ok')"`
Expected: prints `ok` (no require/syntax error)

- [ ] **Step 5: Commit**

```bash
git add server/models/Petition.js server/routes/petitions.js
git commit -m "feat(receive): Petition per-track fields + /receive accepts track"
```

---

## Task 3: Frontend type + receipt helper

**Files:**
- Modify: `src/types/petition.types.ts:186-188` (inside `PetitionBase`)
- Create: `src/lib/petitionReceipt.ts`
- Test: `src/lib/petitionReceipt.test.ts`

- [ ] **Step 1: Add the optional fields to the Petition type**

In `src/types/petition.types.ts`, find inside `interface PetitionBase`:

```ts
  receivedAt?: string | null;
  receivedBy?: string;
```

Replace with:

```ts
  receivedAt?: string | null;
  receivedBy?: string;
  labReceivedAt?: string | null;
  labReceivedBy?: string;
  qcReceivedAt?: string | null;
  qcReceivedBy?: string;
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/petitionReceipt.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isReceivedByTrack, splitPetitionsByTrack } from './petitionReceipt';
import type { Petition } from '@/types/petition.types';

// แค่ field ที่ helper ใช้ (status + *ReceivedAt) — cast เป็น Petition พอ
const p = (partial: Partial<Petition>): Petition => partial as Petition;

describe('isReceivedByTrack', () => {
  it('returns true for lab only when labReceivedAt is set', () => {
    expect(isReceivedByTrack(p({ labReceivedAt: '2026-06-08' }), 'lab')).toBe(true);
    expect(isReceivedByTrack(p({ labReceivedAt: null }), 'lab')).toBe(false);
    expect(isReceivedByTrack(p({ qcReceivedAt: '2026-06-08' }), 'lab')).toBe(false);
  });

  it('returns true for qc only when qcReceivedAt is set', () => {
    expect(isReceivedByTrack(p({ qcReceivedAt: '2026-06-08' }), 'qc')).toBe(true);
    expect(isReceivedByTrack(p({ labReceivedAt: '2026-06-08' }), 'qc')).toBe(false);
  });
});

describe('splitPetitionsByTrack', () => {
  const queue = [
    p({ _id: 'a', status: 'sampleSent' }),                       // neither received
    p({ _id: 'b', status: 'pendingReview', labReceivedAt: 'x' }), // lab received
    p({ _id: 'c', status: 'pendingReview', qcReceivedAt: 'x' }),  // qc received
  ];

  it('splits the lab view: waiting = not lab-received, inProgress = lab-received', () => {
    const { waiting, inProgress } = splitPetitionsByTrack(queue, 'lab');
    expect(waiting.map((x) => x._id)).toEqual(['a', 'c']);
    expect(inProgress.map((x) => x._id)).toEqual(['b']);
  });

  it('splits the qc view independently of lab', () => {
    const { waiting, inProgress } = splitPetitionsByTrack(queue, 'qc');
    expect(waiting.map((x) => x._id)).toEqual(['a', 'b']);
    expect(inProgress.map((x) => x._id)).toEqual(['c']);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/petitionReceipt.test.ts`
Expected: FAIL — cannot find module `./petitionReceipt`

- [ ] **Step 4: Write the helper**

Create `src/lib/petitionReceipt.ts`:

```ts
import type { Petition } from '@/types/petition.types';

export type Track = 'lab' | 'qc';

/** track นี้สแกนรับตัวอย่างคำร้องนี้แล้วหรือยัง (อิงเฉพาะ field ของ track ตัวเอง) */
export function isReceivedByTrack(p: Petition, track: Track): boolean {
  return track === 'lab' ? Boolean(p.labReceivedAt) : Boolean(p.qcReceivedAt);
}

/**
 * แบ่งคำร้องในคิวออกเป็นมุมมองของ track หนึ่ง:
 *  - waiting    = track นี้ยังไม่รับ (รอสแกนรับ)
 *  - inProgress = track นี้รับแล้ว
 * (completed = status 'success' จัดการแยกที่ผู้เรียก)
 */
export function splitPetitionsByTrack(queue: Petition[], track: Track) {
  const waiting: Petition[] = [];
  const inProgress: Petition[] = [];
  for (const p of queue) {
    (isReceivedByTrack(p, track) ? inProgress : waiting).push(p);
  }
  return { waiting, inProgress };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/petitionReceipt.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add src/types/petition.types.ts src/lib/petitionReceipt.ts src/lib/petitionReceipt.test.ts
git commit -m "feat(receive): Petition per-track type fields + isReceivedByTrack helper"
```

---

## Task 4: PetitionDashboardTable per-track routing

**Files:**
- Modify: `src/components/lis/PetitionDashboardTable.tsx`

Currently `goToPetition` treats a petition as unreceived when `petition.status === "sampleSent"`. Switch to per-track via `isReceivedByTrack`.

- [ ] **Step 1: Import the helper and Track type**

At the top of `src/components/lis/PetitionDashboardTable.tsx`, after the existing imports, add:

```ts
import { isReceivedByTrack, type Track } from "@/lib/petitionReceipt";
```

- [ ] **Step 2: Add the `track` prop to the interface**

Find in `interface PetitionDashboardTableProps`:

```ts
  /** ถ้าตั้งค่า: คำร้องที่ยังไม่สแกนรับ (status `sampleSent`) จะเด้งไปหน้า list นี้แทน detail */
  unreceivedListPath?: string;
```

Replace with:

```ts
  /** ถ้าตั้งค่า: คำร้องที่ track นี้ยังไม่สแกนรับ จะเด้งไปหน้า list นี้แทน detail */
  unreceivedListPath?: string;
  /** track ของหน้าที่ใช้ตาราง (lab/qc) — ใช้ตัดสินว่า "ยังไม่รับ" ของฝั่งไหน */
  track?: Track;
```

- [ ] **Step 3: Destructure the prop**

Find:

```ts
  unreceivedListPath,
  emptyAction,
```

Replace with:

```ts
  unreceivedListPath,
  track,
  emptyAction,
```

- [ ] **Step 4: Update `goToPetition`**

Find:

```ts
  // ยังไม่สแกนรับ → ไปหน้า list (สแกนรับ); รับแล้ว → เข้า detail พร้อม flash
  const goToPetition = (petition: Petition) => {
    if (unreceivedListPath && petition.status === "sampleSent") {
      navigate(unreceivedListPath, { state: { flashId: petition._id } });
    } else {
      navigate(`${actionPathPrefix}/${petition._id}`, { state: { flash: true } });
    }
  };
```

Replace with:

```ts
  // track นี้ยังไม่รับ → ไปหน้า list (สแกนรับ) + flash row; รับแล้ว → เข้า detail พร้อม flash
  const goToPetition = (petition: Petition) => {
    if (unreceivedListPath && track && !isReceivedByTrack(petition, track)) {
      navigate(unreceivedListPath, { state: { flashId: petition._id } });
    } else {
      navigate(`${actionPathPrefix}/${petition._id}`, { state: { flash: true } });
    }
  };
```

- [ ] **Step 5: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors mentioning `PetitionDashboardTable`

- [ ] **Step 6: Commit**

```bash
git add src/components/lis/PetitionDashboardTable.tsx
git commit -m "feat(receive): PetitionDashboardTable routes unreceived rows per track"
```

---

## Task 5: Lab/QC Dashboard per-track buckets

**Files:**
- Modify: `src/pages/LabDashboard.tsx:46-55` and the primary-table JSX
- Modify: `src/pages/QCDashboard.tsx:41-44` and the primary-table JSX

### LabDashboard

- [ ] **Step 1: Import the helper**

At the top of `src/pages/LabDashboard.tsx`, add after the existing imports:

```ts
import { splitPetitionsByTrack } from "@/lib/petitionReceipt";
```

- [ ] **Step 2: Replace the bucket computation**

Find:

```ts
  const labPetitions = onlyLabPetitions(allPetitions.filter((petition) => LAB_STATUSES.includes(petition.status)));
  const completedPetitions = onlyLabPetitions(
    allPetitions.filter((petition) => petition.status === "success"),
  );
  const waitingReceivePetitions = onlyLabPetitions(
    allPetitions.filter((petition) => petition.status === "sampleSent"),
  );
  const inProgressPetitions = onlyLabPetitions(
    allPetitions.filter((petition) => petition.status === "pendingReview" || petition.status === "inProgress"),
  );
  const labTotal = labPetitions.length + completedPetitions.length;
```

Replace with:

```ts
  // คิวงาน Lab (ยังไม่ success) — แล้วแบ่งเป็น รอรับ/กำลังดำเนินการ ตามการรับของ "ฝั่ง Lab"
  const labPetitions = onlyLabPetitions(allPetitions.filter((petition) => LAB_STATUSES.includes(petition.status)));
  const completedPetitions = onlyLabPetitions(
    allPetitions.filter((petition) => petition.status === "success"),
  );
  const { waiting: waitingReceivePetitions, inProgress: inProgressPetitions } =
    splitPetitionsByTrack(labPetitions, "lab");
  const labTotal = labPetitions.length + completedPetitions.length;
```

> `LAB_STATUSES` already = `["sampleSent", "pendingReview", "inProgress"]`, so `labPetitions` is the full Lab queue; the split just re-buckets it by `labReceivedAt`.

- [ ] **Step 3: Pass `track` to the primary table**

Find:

```tsx
          actionPathPrefix="/lab-testing"
          viewAllPath="/lab-testing"
          unreceivedListPath="/lab-testing"
          emptyText={
```

Replace with:

```tsx
          actionPathPrefix="/lab-testing"
          viewAllPath="/lab-testing"
          unreceivedListPath="/lab-testing"
          track="lab"
          emptyText={
```

### QCDashboard

- [ ] **Step 4: Import the helper**

At the top of `src/pages/QCDashboard.tsx`, add after the existing imports:

```ts
import { splitPetitionsByTrack } from "@/lib/petitionReceipt";
```

- [ ] **Step 5: Replace the bucket computation**

Find:

```ts
  const pendingReceivePetitions = allPetitions.filter((p) => PENDING_RECEIVE_STATUSES.includes(p.status));
  const inProgressPetitions = allPetitions.filter((p) => IN_PROGRESS_STATUSES.includes(p.status));
  const completedPetitions = allPetitions.filter((p) => COMPLETED_STATUSES.includes(p.status));
  const queuePetitions = allPetitions.filter((p) => QUEUE_STATUSES.includes(p.status));
  const trackedTotal = queuePetitions.length + completedPetitions.length;
```

Replace with:

```ts
  const completedPetitions = allPetitions.filter((p) => COMPLETED_STATUSES.includes(p.status));
  const queuePetitions = allPetitions.filter((p) => QUEUE_STATUSES.includes(p.status));
  // แบ่ง คิว QC เป็น รอรับ/กำลังดำเนินการ ตามการรับของ "ฝั่ง QC"
  const { waiting: pendingReceivePetitions, inProgress: inProgressPetitions } =
    splitPetitionsByTrack(queuePetitions, "qc");
  const trackedTotal = queuePetitions.length + completedPetitions.length;
```

> `PENDING_RECEIVE_STATUSES` and `IN_PROGRESS_STATUSES` consts become unused after this. Remove their declarations (near the top of the file) only if ESLint flags them; `QUEUE_STATUSES` and `COMPLETED_STATUSES` are still used.

- [ ] **Step 6: Pass `track` to the primary table**

Find:

```tsx
          viewAllPath="/qc-testing"
          actionPathPrefix="/qc-testing"
          unreceivedListPath="/qc-testing"
        />
```

Replace with:

```tsx
          viewAllPath="/qc-testing"
          actionPathPrefix="/qc-testing"
          unreceivedListPath="/qc-testing"
          track="qc"
        />
```

- [ ] **Step 7: Type-check + lint**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors in `LabDashboard`/`QCDashboard`

Run: `npm run lint`
Expected: no new errors. If `PENDING_RECEIVE_STATUSES`/`IN_PROGRESS_STATUSES` are flagged as unused in QCDashboard, delete those two `const` lines and re-run.

- [ ] **Step 8: Commit**

```bash
git add src/pages/LabDashboard.tsx src/pages/QCDashboard.tsx
git commit -m "feat(receive): Lab/QC dashboards bucket waiting vs in-progress per track"
```

---

## Task 6: Lab/QC TestingPage per-track action/badge/row-click

**Files:**
- Modify: `src/pages/LabTestingPage.tsx` (status column ~152-160, action column ~161-179, onRowClick ~232-234)
- Modify: `src/pages/QCTestingPage.tsx` (status column ~120+, action column, onRowClick ~193-195)

The list currently gates "เข้าตรวจ vs รอสแกนรับ" and the status badge on `ENTRY_STATUSES.has(p.status)` (= `pendingReview`/`inProgress`). Switch to per-track: a row is enterable when **this track received it** and it is not yet `success`.

### LabTestingPage

- [ ] **Step 1: Import the helper**

In `src/pages/LabTestingPage.tsx`, add after the `useArrivalFlashId` import:

```ts
import { isReceivedByTrack } from '@/lib/petitionReceipt';
```

- [ ] **Step 2: Replace the status column cell**

Find:

```tsx
    {
      key: 'status',
      header: 'สถานะ',
      className: 'align-top',
      cell: (p) => {
        const b = statusBadge(p.status);
        return <Badge variant={b.variant}>{b.label}</Badge>;
      },
    },
```

Replace with:

```tsx
    {
      key: 'status',
      header: 'สถานะ',
      className: 'align-top',
      cell: (p) => {
        // ฝั่ง Lab ยังไม่รับ → แสดง "รอรับเข้าระบบ" ไม่ว่า status กลางจะขยับไปเพราะ QC แล้วก็ตาม
        const b = isReceivedByTrack(p, 'lab') ? statusBadge(p.status) : statusBadge('sampleSent');
        return <Badge variant={b.variant}>{b.label}</Badge>;
      },
    },
```

- [ ] **Step 3: Replace the action column cell**

Find:

```tsx
      cell: (p) =>
        ENTRY_STATUSES.has(p.status) ? (
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/lab-testing/${p._id}`);
            }}
          >
            เข้าตรวจ
          </Button>
        ) : (
          <span className="text-xs text-grey-400">รอสแกนรับ</span>
        ),
```

Replace with:

```tsx
      cell: (p) =>
        isReceivedByTrack(p, 'lab') && p.status !== 'success' ? (
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/lab-testing/${p._id}`);
            }}
          >
            เข้าตรวจ
          </Button>
        ) : (
          <span className="text-xs text-grey-400">รอสแกนรับ</span>
        ),
```

- [ ] **Step 4: Replace the row-click gate**

Find:

```tsx
          onRowClick={(p) => {
            if (ENTRY_STATUSES.has(p.status)) navigate(`/lab-testing/${p._id}`);
          }}
```

Replace with:

```tsx
          onRowClick={(p) => {
            if (isReceivedByTrack(p, 'lab') && p.status !== 'success') navigate(`/lab-testing/${p._id}`);
          }}
```

> `ENTRY_STATUSES` is now unused in this file — remove the `const ENTRY_STATUSES = new Set(['pendingReview', 'inProgress']);` line near the top if lint flags it.

### QCTestingPage

- [ ] **Step 5: Import the helper**

In `src/pages/QCTestingPage.tsx`, add after the `useArrivalFlashId` import:

```ts
import { isReceivedByTrack } from '@/lib/petitionReceipt';
```

- [ ] **Step 6: Replace the status column cell**

In `src/pages/QCTestingPage.tsx` find (the status column, ~line 124):

```tsx
      cell: (p) => {
        const b = statusBadge(p.status);
        return <Badge variant={b.variant}>{b.label}</Badge>;
      },
```

Replace with:

```tsx
      cell: (p) => {
        // ฝั่ง QC ยังไม่รับ → แสดง "รอรับเข้าระบบ" แม้ status กลางขยับเพราะ Lab แล้ว
        const b = isReceivedByTrack(p, 'qc') ? statusBadge(p.status) : statusBadge('sampleSent');
        return <Badge variant={b.variant}>{b.label}</Badge>;
      },
```

- [ ] **Step 7: Replace the action column cell**

Find (~line 133):

```tsx
      cell: (p) =>
        ENTRY_STATUSES.has(p.status) ? (
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/qc-testing/${p._id}`);
            }}
          >
            เข้าตรวจ
          </Button>
        ) : (
          <span className="text-xs text-grey-400">รอสแกนรับ</span>
        ),
```

Replace with:

```tsx
      cell: (p) =>
        isReceivedByTrack(p, 'qc') && p.status !== 'success' ? (
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/qc-testing/${p._id}`);
            }}
          >
            เข้าตรวจ
          </Button>
        ) : (
          <span className="text-xs text-grey-400">รอสแกนรับ</span>
        ),
```

- [ ] **Step 8: Replace the row-click gate**

Find:

```tsx
        onRowClick={(p) => {
          if (ENTRY_STATUSES.has(p.status)) navigate(`/qc-testing/${p._id}`);
        }}
```

Replace with:

```tsx
        onRowClick={(p) => {
          if (isReceivedByTrack(p, 'qc') && p.status !== 'success') navigate(`/qc-testing/${p._id}`);
        }}
```

> Remove the now-unused `const ENTRY_STATUSES = ...` line in QCTestingPage if lint flags it.

- [ ] **Step 9: Type-check + lint**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors in `LabTestingPage`/`QCTestingPage`

Run: `npm run lint`
Expected: no new errors (delete any unused `ENTRY_STATUSES` consts flagged)

- [ ] **Step 10: Commit**

```bash
git add src/pages/LabTestingPage.tsx src/pages/QCTestingPage.tsx
git commit -m "feat(receive): Lab/QC testing lists gate entry by per-track receive"
```

---

## Task 7: Scan modals send `track`

**Files:**
- Modify: `src/components/petition/LabScanAcceptModal.tsx:160-189`
- Modify: `src/components/petition/QrReceiveModal.tsx:50-53, 150-178, 189-218`

### LabScanAcceptModal (track = lab)

- [ ] **Step 1: Use `labReceivedAt` for the "already received" shortcut**

Find:

```tsx
      // Already received — navigate directly
      if (found.status === 'pendingReview' || found.status === 'inProgress') {
        onAccepted();
        navigate(`/lab-testing/${found._id}`);
        return;
      }
```

Replace with:

```tsx
      // Lab รับไปแล้ว — เข้า detail ตรง (ไม่สนว่า status กลางขยับเพราะ QC หรือยัง)
      if (found.labReceivedAt) {
        onAccepted();
        navigate(`/lab-testing/${found._id}`);
        return;
      }
```

- [ ] **Step 2: Send `track: 'lab'` on receive**

Find:

```tsx
      const received = await api.patch<Petition>(`/petitions/${id}/receive`, {
        actor: user?.name || user?.email,
      });
```

Replace with:

```tsx
      const received = await api.patch<Petition>(`/petitions/${id}/receive`, {
        actor: user?.name || user?.email,
        track: 'lab',
      });
```

### QrReceiveModal (track = qc)

- [ ] **Step 3: Thread `track` through the `receivePetition` helper**

Find:

```tsx
async function receivePetition(id: string, actor?: string): Promise<Petition> {
  const res = await api.patch<Petition>(`/petitions/${id}/receive`, { actor });
  return res.data.data;
}
```

Replace with:

```tsx
async function receivePetition(id: string, actor?: string): Promise<Petition> {
  const res = await api.patch<Petition>(`/petitions/${id}/receive`, { actor, track: 'qc' });
  return res.data.data;
}
```

- [ ] **Step 4: Gate the confirm step on `qcReceivedAt` instead of `status === 'sampleSent'`**

Find:

```tsx
      setPetition(found);
      setPendingId(found._id);
      // Only allow receive if status is sampleSent
      if (found.status !== 'sampleSent') {
        setErrorMsg(`คำร้องนี้สถานะ "${PETITION_STATUS_CONFIG[found.status]?.label ?? found.status}" — ไม่สามารถรับตัวอย่างซ้ำได้`);
        setPhase('error');
        return;
      }
      setPhase('confirming');
```

Replace with:

```tsx
      setPetition(found);
      setPendingId(found._id);
      // QC รับไปแล้ว → ห้ามรับซ้ำ
      if (found.qcReceivedAt) {
        setErrorMsg(`คำร้อง ${found.petitionNo} ฝั่ง QC รับตัวอย่างไปแล้ว`);
        setPhase('error');
        return;
      }
      // คำร้องที่จบ lifecycle แล้ว รับไม่ได้
      if (found.status === 'success' || found.status === 'approved' || found.status === 'rejected') {
        setErrorMsg(`คำร้องนี้สถานะ "${PETITION_STATUS_CONFIG[found.status]?.label ?? found.status}" — รับตัวอย่างไม่ได้`);
        setPhase('error');
        return;
      }
      setPhase('confirming');
```

- [ ] **Step 5: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors in the two modal files

- [ ] **Step 6: Commit**

```bash
git add src/components/petition/LabScanAcceptModal.tsx src/components/petition/QrReceiveModal.tsx
git commit -m "feat(receive): scan modals send track and gate on per-track receive"
```

---

## Task 8: Migration script (backfill existing petitions)

**Files:**
- Create: `server/scripts/backfill-track-received.js`

Existing petitions past `sampleSent` were received under the old single-status model — treat them as received by BOTH tracks (per spec decision).

- [ ] **Step 1: Write the migration script**

Create `server/scripts/backfill-track-received.js`:

```js
// เติม labReceivedAt/qcReceivedAt ให้คำร้องที่ "รับไปแล้ว" ก่อนมีระบบแยก track
// คำร้องที่ status เลย sampleSent แล้ว (pendingReview|inProgress|success|approved|rejected)
// → ถือว่ารับทั้งสองฝั่ง: lab/qcReceivedAt = receivedAt เดิม (fallback updatedAt),
//   lab/qcReceivedBy = receivedBy เดิม (fallback 'migration').
// คำร้อง sampleSent|deliveringQC → ปล่อยว่าง (ยังไม่รับ)
//
// Idempotent: แตะเฉพาะคำร้องที่ยังไม่มี labReceivedAt และ qcReceivedAt ครบทั้งคู่.
//
// Usage:
//   node scripts/backfill-track-received.js           # dry-run
//   node scripts/backfill-track-received.js --commit   # เขียนจริง
'use strict';

const mongoose = require('mongoose');
const Petition = require('../models/Petition');

const COMMIT = process.argv.includes('--commit');
const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/LIS-DB';
const RECEIVED_STATUSES = ['pendingReview', 'inProgress', 'success', 'approved', 'rejected'];

async function main() {
  await mongoose.connect(URI);

  const docs = await Petition.find({ status: { $in: RECEIVED_STATUSES } }).lean();
  let touched = 0;
  let warned = 0;

  for (const d of docs) {
    if (d.labReceivedAt && d.qcReceivedAt) continue; // ครบแล้ว ข้าม

    const at = d.receivedAt || d.updatedAt;
    const by = d.receivedBy || 'migration';
    if (!d.receivedAt) {
      console.log(`  WARN ${d.petitionNo} (${d.status}) — ไม่มี receivedAt, ใช้ updatedAt แทน`);
      warned += 1;
    }
    touched += 1;
    console.log(`  ${d.petitionNo} (${d.status}) → lab/qcReceivedAt=${at && new Date(at).toISOString()} by ${by}`);

    if (COMMIT) {
      await Petition.updateOne(
        { _id: d._id },
        {
          $set: {
            labReceivedAt: d.labReceivedAt || at,
            labReceivedBy: d.labReceivedBy || by,
            qcReceivedAt: d.qcReceivedAt || at,
            qcReceivedBy: d.qcReceivedBy || by,
          },
        },
      );
    }
  }

  console.log(`\nคำร้องที่จะแตะ: ${touched} | WARN ไม่มี receivedAt: ${warned}`);
  if (!COMMIT) console.log('** dry-run — ยังไม่เขียน DB (ใส่ --commit เพื่อเขียนจริง) **');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run the dry-run**

Run: `cd server && node scripts/backfill-track-received.js`
Expected: lists petitions that would be touched + a summary line; ends with the dry-run notice. No DB writes. Review the WARN lines (petitions missing `receivedAt`).

- [ ] **Step 3: Commit the script (dry-run only; do NOT --commit yet)**

```bash
git add server/scripts/backfill-track-received.js
git commit -m "chore(receive): backfill script for per-track receive (dry-run verified)"
```

> The actual `--commit` run + `npm run seed:export` is a **manual operator step** (left to the user), mirroring the StockUnit.source backfill pattern. Flag it in the final summary — do not run `--commit` automatically.

---

## Task 9: Full verification

- [ ] **Step 1: Run the unit-test suites (frontend + server)**

Run: `npm run test`  (Vitest, `src/**`)
Expected: all tests pass, including the new `petitionReceipt` suite.

Run: `node --test server/lib/petitionReceive.test.js`  (server runner)
Expected: `# pass 5`

- [ ] **Step 2: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no NEW errors introduced by this work (repo has ~12 pre-existing latent errors per project notes — confirm the count/files are unchanged, not that output is empty).

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 4: Manual smoke (requires both processes running)**

Start backend (`cd server && npm run dev`) + frontend (`npm run dev`), then:
1. Take a petition in `sampleSent`. On the **Lab dashboard**, click it → routes to `/lab-testing` and the row flashes (still "รอรับเข้าระบบ" for Lab).
2. Scan-receive it in Lab → Lab list shows "เข้าตรวจ"; status badge reflects testing status.
3. Open the **QC dashboard** → the same petition still shows under "รอรับเข้าระบบ" for QC (NOT received), and clicking routes to `/qc-testing` to scan.
4. As a **viewer** (petition list / detail), the petition shows "รับตัวอย่างแล้ว" (global status `pendingReview`).

---

## Notes for the operator (post-merge)

- Run the backfill on the prod DB: `cd server && node scripts/backfill-track-received.js` (review), then `... --commit`.
- After committing data: `npm run seed:export` and commit `server/seed-data/` so the DB stays restorable (per repo convention).
