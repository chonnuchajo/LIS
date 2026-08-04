# COA Center Full Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dedicated COA Center with user-selected samples, QC Head approval before printing, fixed COA numbering, revisions, cancellation, print tracking, and audit history.

**Architecture:** Store COA documents in their own MongoDB collection with immutable approved snapshots and a separate atomic yearly counter. Backend lifecycle helpers enforce allowed state transitions and permissions; React pages consume typed API methods and render list/detail workflows plus an A4 printable COA template through the existing print dialog.

**Tech Stack:** React 18, Vite, TypeScript, React Router, TanStack Query, shadcn/Radix UI, lucide-react, Express, Mongoose, Vitest, Node test runner.

## Global Constraints

- Do not run `npm run build`, `npm run build:dev`, `npm run build:watch`, `vite build`, or equivalent build commands.
- COA number format is fixed as `<sequence padded to 4 digits><Gregorian year>`, for example `00012026`.
- QC Head approval is required before any active COA print action is enabled.
- Approved/reissued COA output must use frozen snapshot data; later source edits must not silently change issued documents.
- Revision approval supersedes the previous active COA version.
- Cancellation requires a reason and keeps the document visible in history.
- Every lifecycle action records actor and timestamp.

---

## File Structure

Create:

- `server/models/CoaCounter.js` - yearly atomic counter for COA numbers.
- `server/models/CoaDocument.js` - COA document, snapshots, approval, print metadata.
- `server/models/CoaAuditLog.js` - immutable lifecycle event log.
- `server/lib/coaNumber.js` - pure formatting plus atomic next-number helper.
- `server/lib/coaLifecycle.js` - status labels, allowed transitions, QC Head role helper, snapshot builder, action guards.
- `server/lib/coaLifecycle.test.js` - Node tests for numbering, status guards, action rules.
- `server/routes/coaDocuments.js` - REST endpoints for list/create/submit/approve/reject/revise/cancel/print-event.
- `server/routes/coaDocuments.test.js` - route-level tests with mocked models/helpers for lifecycle behavior.
- `src/types/coa.types.ts` - shared frontend COA types.
- `src/lib/coaStatus.ts` - frontend status labels, badge variants, allowed action helpers.
- `src/lib/coaStatus.test.ts` - Vitest tests for UI state logic.
- `src/lib/coaReport.ts` - printable-page builder from frozen snapshots.
- `src/lib/coaReport.test.ts` - printable builder tests.
- `src/components/coa/CoaReportTemplate.tsx` - A4 COA print template.
- `src/components/coa/CoaCreateDialog.tsx` - create draft dialog with petition/item selection.
- `src/components/coa/CoaStatusBadge.tsx` - consistent status badge.
- `src/components/coa/CoaAuditTimeline.tsx` - lifecycle timeline.
- `src/pages/CoaCenterPage.tsx` - COA list/filters/create entry point.
- `src/pages/CoaDetailPage.tsx` - detail, approval, revision, cancel, print workflow.
- `src/pages/__tests__/CoaCenterPage.test.tsx` - list/create behavior.
- `src/pages/__tests__/CoaDetailPage.test.tsx` - action availability and print lock behavior.

Modify:

- `server/index.js` - mount `/api/coa-documents`.
- `src/lib/api.ts` - add typed COA API methods.
- `src/App.tsx` - lazy routes `/coa` and `/coa/:id`.
- `src/lib/navItems.ts` - add sidebar and page route items.
- `src/components/lis/PrintPreviewDialog.tsx` - expose `onPrinted` callback so COA detail can record print events after print starts.

---

### Task 1: Backend COA Core Models, Numbering, And Lifecycle

**Files:**
- Create: `server/models/CoaCounter.js`
- Create: `server/models/CoaDocument.js`
- Create: `server/models/CoaAuditLog.js`
- Create: `server/lib/coaNumber.js`
- Create: `server/lib/coaLifecycle.js`
- Test: `server/lib/coaLifecycle.test.js`

**Interfaces:**
- Produces: `formatCoaNo(sequence: number, year: number): string`
- Produces: `nextCoaNumber(now?: Date): Promise<{ coaNo: string; sequence: number; year: number }>`
- Produces: `COA_STATUSES: string[]`
- Produces: `isQcHead(user: { role?: string; activeRole?: string; permissions?: string[]; position?: string }): boolean`
- Produces: `assertCanTransition(fromStatus: string, action: string): void`
- Produces: `activePrintableStatuses: Set<string>`

- [ ] **Step 1: Write failing lifecycle and number tests**

Add `server/lib/coaLifecycle.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { formatCoaNo } = require('./coaNumber');
const { assertCanTransition, isQcHead, activePrintableStatuses } = require('./coaLifecycle');

test('formatCoaNo pads sequence to four digits and appends Gregorian year', () => {
  assert.equal(formatCoaNo(1, 2026), '00012026');
  assert.equal(formatCoaNo(22, 2026), '00222026');
  assert.equal(formatCoaNo(10000, 2026), '100002026');
});

test('QC Head role detection accepts role, activeRole, permission, and position signals', () => {
  assert.equal(isQcHead({ role: 'qc-head' }), true);
  assert.equal(isQcHead({ activeRole: 'qc_head' }), true);
  assert.equal(isQcHead({ permissions: ['coa.approve'] }), true);
  assert.equal(isQcHead({ position: 'QC Head' }), true);
  assert.equal(isQcHead({ role: 'lab-staff' }), false);
});

test('lifecycle allows submit, approve, revise, cancel, and print only from valid statuses', () => {
  assert.doesNotThrow(() => assertCanTransition('draft', 'submit'));
  assert.doesNotThrow(() => assertCanTransition('pendingApproval', 'approve'));
  assert.doesNotThrow(() => assertCanTransition('approved', 'revise'));
  assert.doesNotThrow(() => assertCanTransition('printed', 'cancel'));
  assert.doesNotThrow(() => assertCanTransition('reissued', 'print'));

  assert.throws(() => assertCanTransition('draft', 'approve'), /Cannot approve COA from draft/);
  assert.throws(() => assertCanTransition('pendingApproval', 'print'), /Cannot print COA from pendingApproval/);
  assert.throws(() => assertCanTransition('cancelled', 'print'), /Cannot print COA from cancelled/);
});

test('printable statuses exclude pending, cancelled, and superseded documents', () => {
  assert.equal(activePrintableStatuses.has('approved'), true);
  assert.equal(activePrintableStatuses.has('printed'), true);
  assert.equal(activePrintableStatuses.has('reissued'), true);
  assert.equal(activePrintableStatuses.has('pendingApproval'), false);
  assert.equal(activePrintableStatuses.has('cancelled'), false);
  assert.equal(activePrintableStatuses.has('superseded'), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test server/lib/coaLifecycle.test.js`

Expected: FAIL with module-not-found errors for `./coaNumber` and `./coaLifecycle`.

- [ ] **Step 3: Create COA counter model**

Add `server/models/CoaCounter.js`:

```js
const mongoose = require('mongoose');

const CoaCounterSchema = new mongoose.Schema(
  {
    year: { type: Number, required: true, unique: true, index: true },
    sequence: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model('CoaCounter', CoaCounterSchema);
```

- [ ] **Step 4: Create COA document model**

Add `server/models/CoaDocument.js` with status enum, snapshots, approval, cancellation, and print metadata:

```js
const mongoose = require('mongoose');

const PersonSchema = new mongoose.Schema(
  { name: String, email: String, role: String },
  { _id: false },
);

const CustomerSnapshotSchema = new mongoose.Schema(
  { name: String, company: String, department: String, email: String, phone: String },
  { _id: false },
);

const SampleSnapshotSchema = new mongoose.Schema(
  {
    itemSeq: { type: Number, required: true },
    sampleName: String,
    commonName: String,
    batchNo: String,
    lotNo: String,
    productionDate: String,
    sampleId: String,
    condition: String,
    manufacturer: String,
  },
  { _id: false },
);

const ResultSnapshotSchema = new mongoose.Schema(
  {
    itemSeq: { type: Number, required: true },
    testItem: String,
    result: String,
    criteria: String,
    method: String,
    unit: String,
  },
  { _id: false },
);

const PrintEventSchema = new mongoose.Schema(
  { event: String, printedAt: Date, printedBy: PersonSchema, copies: Number, outputMode: String },
  { _id: false },
);

const STATUS = [
  'draft',
  'pendingApproval',
  'approved',
  'printed',
  'revisionDraft',
  'pendingRevisionApproval',
  'reissued',
  'cancelled',
  'superseded',
  'rejected',
];

const CoaDocumentSchema = new mongoose.Schema(
  {
    coaNo: { type: String, default: null, index: true },
    coaYear: Number,
    sequence: Number,
    revision: { type: Number, default: 0 },
    status: { type: String, enum: STATUS, required: true, default: 'draft', index: true },
    petitionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Petition', required: true, index: true },
    petitionNoSnapshot: String,
    selectedItemSeqs: { type: [Number], default: [] },
    sourceCoaId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoaDocument' },
    supersedesCoaId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoaDocument' },
    supersededByCoaId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoaDocument' },
    customerSnapshot: CustomerSnapshotSchema,
    sampleSnapshots: { type: [SampleSnapshotSchema], default: [] },
    resultSnapshots: { type: [ResultSnapshotSchema], default: [] },
    remark: { type: String, default: '' },
    approval: {
      submittedBy: PersonSchema,
      submittedAt: Date,
      approvedBy: PersonSchema,
      approvedAt: Date,
      rejectedBy: PersonSchema,
      rejectedAt: Date,
      rejectReason: String,
    },
    cancel: { cancelledBy: PersonSchema, cancelledAt: Date, reason: String },
    print: {
      printCount: { type: Number, default: 0 },
      lastPrintedAt: Date,
      lastPrintedBy: PersonSchema,
      printEvents: { type: [PrintEventSchema], default: [] },
    },
    createdBy: PersonSchema,
    updatedBy: PersonSchema,
  },
  { timestamps: true },
);

CoaDocumentSchema.index(
  { coaNo: 1, revision: 1 },
  { unique: true, partialFilterExpression: { coaNo: { $type: 'string' } } },
);
CoaDocumentSchema.index({ petitionId: 1, status: 1 });
CoaDocumentSchema.index({ status: 1, updatedAt: -1 });
CoaDocumentSchema.index({ coaYear: 1, sequence: -1 });

module.exports = mongoose.model('CoaDocument', CoaDocumentSchema);
module.exports.COA_STATUSES = STATUS;
```

- [ ] **Step 5: Create COA audit model**

Add `server/models/CoaAuditLog.js`:

```js
const mongoose = require('mongoose');

const CoaAuditLogSchema = new mongoose.Schema(
  {
    coaId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoaDocument', required: true, index: true },
    coaNo: String,
    petitionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Petition', index: true },
    petitionNo: String,
    event: {
      type: String,
      required: true,
      enum: [
        'created',
        'updated',
        'submitted',
        'approved',
        'rejected',
        'revisionCreated',
        'revisionSubmitted',
        'revisionApproved',
        'superseded',
        'cancelled',
        'printed',
      ],
      index: true,
    },
    actor: { name: String, email: String, role: String },
    note: String,
    metadata: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true },
);

CoaAuditLogSchema.index({ coaId: 1, createdAt: -1 });
CoaAuditLogSchema.index({ event: 1, createdAt: -1 });

module.exports = mongoose.model('CoaAuditLog', CoaAuditLogSchema);
```

- [ ] **Step 6: Implement number helper**

Add `server/lib/coaNumber.js`:

```js
function formatCoaNo(sequence, year) {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error('COA sequence must be a positive integer');
  }
  if (!Number.isInteger(year) || year < 2000) {
    throw new Error('COA year must be a Gregorian year');
  }
  return `${String(sequence).padStart(4, '0')}${String(year)}`;
}

async function nextCoaNumber(now = new Date()) {
  const CoaCounter = require('../models/CoaCounter');
  const year = now.getFullYear();
  const counter = await CoaCounter.findOneAndUpdate(
    { year },
    { $inc: { sequence: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  const sequence = counter.sequence;
  return { coaNo: formatCoaNo(sequence, year), sequence, year };
}

module.exports = { formatCoaNo, nextCoaNumber };
```

- [ ] **Step 7: Implement lifecycle helper**

Add `server/lib/coaLifecycle.js`:

```js
const COA_STATUSES = [
  'draft',
  'pendingApproval',
  'approved',
  'printed',
  'revisionDraft',
  'pendingRevisionApproval',
  'reissued',
  'cancelled',
  'superseded',
  'rejected',
];

const transitions = {
  submit: new Set(['draft', 'revisionDraft']),
  approve: new Set(['pendingApproval', 'pendingRevisionApproval']),
  reject: new Set(['pendingApproval', 'pendingRevisionApproval']),
  revise: new Set(['approved', 'printed', 'reissued']),
  cancel: new Set(['approved', 'printed', 'reissued']),
  print: new Set(['approved', 'printed', 'reissued']),
  update: new Set(['draft', 'revisionDraft']),
};

const activePrintableStatuses = transitions.print;

function normalizeRole(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function isQcHead(user = {}) {
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  return (
    normalizeRole(user.role) === 'qc_head' ||
    normalizeRole(user.activeRole) === 'qc_head' ||
    normalizeRole(user.position) === 'qc_head' ||
    permissions.includes('coa.approve')
  );
}

function assertCanTransition(fromStatus, action) {
  const allowed = transitions[action];
  if (!allowed) throw new Error(`Unknown COA action ${action}`);
  if (!allowed.has(fromStatus)) {
    throw new Error(`Cannot ${action} COA from ${fromStatus}`);
  }
}

function actorFromBody(body = {}) {
  const u = body._user || body.actor || {};
  return {
    name: String(u.name || body.actorName || '').trim(),
    email: String(u.email || body.actorEmail || '').trim(),
    role: String(u.role || body.actorRole || '').trim(),
  };
}

module.exports = {
  COA_STATUSES,
  activePrintableStatuses,
  isQcHead,
  assertCanTransition,
  actorFromBody,
};
```

- [ ] **Step 8: Run tests and commit**

Run: `node --test server/lib/coaLifecycle.test.js`

Expected: PASS.

Commit:

```bash
git add server/models/CoaCounter.js server/models/CoaDocument.js server/models/CoaAuditLog.js server/lib/coaNumber.js server/lib/coaLifecycle.js server/lib/coaLifecycle.test.js
git commit -m "feat: add coa lifecycle core"
```

---

### Task 2: Backend COA Routes And Snapshot Builder

**Files:**
- Modify: `server/index.js`
- Create: `server/routes/coaDocuments.js`
- Modify: `server/lib/coaLifecycle.js`
- Test: `server/routes/coaDocuments.test.js`

**Interfaces:**
- Consumes: `nextCoaNumber()`, `assertCanTransition()`, `isQcHead()`, `actorFromBody()`
- Produces: REST API under `/api/coa-documents`
- Produces: `buildCoaSnapshots({ petition, labRequests, parameters, qcResults, selectedItemSeqs, groupMembership }): { customerSnapshot, sampleSnapshots, resultSnapshots }`

- [ ] **Step 1: Add snapshot-builder tests**

In `server/routes/coaDocuments.test.js`, start with pure helper coverage by importing from `../lib/coaLifecycle`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { selectedItemsFromPetition } = require('../lib/coaLifecycle');

test('selectedItemsFromPetition returns only requested item seqs in petition order', () => {
  const petition = {
    items: [
      { seq: 1, sampleName: 'A' },
      { seq: 2, sampleName: 'B' },
      { seq: 3, sampleName: 'C' },
    ],
  };
  assert.deepEqual(selectedItemsFromPetition(petition, [3, 1]).map((i) => i.seq), [1, 3]);
});

test('selectedItemsFromPetition rejects missing item seqs', () => {
  const petition = { items: [{ seq: 1, sampleName: 'A' }] };
  assert.throws(() => selectedItemsFromPetition(petition, [1, 9]), /Invalid COA item seqs: 9/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test server/routes/coaDocuments.test.js`

Expected: FAIL with `selectedItemsFromPetition is not a function`.

- [ ] **Step 3: Add selection helper**

Append to `server/lib/coaLifecycle.js` and export it:

```js
function selectedItemsFromPetition(petition, selectedItemSeqs) {
  const wanted = new Set((selectedItemSeqs || []).map(Number));
  if (wanted.size === 0) throw new Error('COA must include at least one sample');
  const items = Array.isArray(petition?.items) ? petition.items : [];
  const selected = items.filter((item) => wanted.has(Number(item.seq)));
  const found = new Set(selected.map((item) => Number(item.seq)));
  const missing = [...wanted].filter((seq) => !found.has(seq));
  if (missing.length) throw new Error(`Invalid COA item seqs: ${missing.join(', ')}`);
  return selected;
}
```

Export:

```js
module.exports = {
  COA_STATUSES,
  activePrintableStatuses,
  isQcHead,
  assertCanTransition,
  actorFromBody,
  selectedItemsFromPetition,
};
```

- [ ] **Step 4: Implement route file**

Create `server/routes/coaDocuments.js`:

```js
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const CoaDocument = require('../models/CoaDocument');
const CoaAuditLog = require('../models/CoaAuditLog');
const Petition = require('../models/Petition');
const LabRequest = require('../models/LabRequest');
const QCTestResult = require('../models/QCTestResult');
const Parameter = require('../models/Parameter');
const { nextCoaNumber } = require('../lib/coaNumber');
const {
  actorFromBody,
  assertCanTransition,
  isQcHead,
  selectedItemsFromPetition,
} = require('../lib/coaLifecycle');

function objectId(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new Error('Invalid id');
  return new mongoose.Types.ObjectId(id);
}

async function writeAudit(doc, event, actor, note, metadata) {
  await CoaAuditLog.create({
    coaId: doc._id,
    coaNo: doc.coaNo,
    petitionId: doc.petitionId,
    petitionNo: doc.petitionNoSnapshot,
    event,
    actor,
    note,
    metadata,
  });
}

function itemSnapshot(item) {
  return {
    itemSeq: item.seq,
    sampleName: item.sampleName || item.commonName || '-',
    commonName: item.commonName || '',
    batchNo: item.batchNo || '',
    lotNo: item.lotNo || '',
    productionDate: item.productionDate || '',
    sampleId: item.sampleId || '',
    condition: item.condition || '',
    manufacturer: item.labelManufacturer || item.labelSeller || '',
  };
}

async function freezeSnapshots(petitionId, selectedItemSeqs) {
  const petition = await Petition.findById(petitionId).lean();
  if (!petition) throw new Error('ไม่พบคำร้อง');
  const selectedItems = selectedItemsFromPetition(petition, selectedItemSeqs);
  const labRequests = await LabRequest.find({ petitionId: String(petition._id) }).lean();
  const qcResults = await QCTestResult.find({ petitionId: String(petition._id), itemSeq: { $in: selectedItemSeqs } }).lean();
  const parameterIds = [...new Set(qcResults.map((r) => String(r.parameterId)))];
  const parameters = parameterIds.length ? await Parameter.find({ _id: { $in: parameterIds } }).lean() : [];
  const paramById = new Map(parameters.map((p) => [String(p._id), p]));
  const firstLabRequest = labRequests[0] || {};
  const requester = firstLabRequest.requester || {};
  const resultSnapshots = [];
  for (const result of qcResults) {
    const param = paramById.get(String(result.parameterId));
    if ((param?.scope || 'qc') !== 'lab') continue;
    for (const [label, value] of Object.entries(result.values || {})) {
      resultSnapshots.push({
        itemSeq: result.itemSeq,
        testItem: label,
        result: value == null || String(value).trim() === '' ? '-' : String(value),
        criteria: '-',
        method: '-',
        unit: '',
      });
    }
  }
  return {
    petitionNoSnapshot: petition.petitionNo,
    customerSnapshot: {
      name: firstLabRequest.reportCustomerName || requester.fullName || petition.submittedBy?.name || '-',
      company: 'บริษัท ไอ ซี พี ลัดดา จำกัด',
      department: requester.department || '',
      email: requester.email || '',
      phone: requester.phone || '',
    },
    sampleSnapshots: selectedItems.map(itemSnapshot),
    resultSnapshots,
  };
}

router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = String(req.query.status);
    if (req.query.coaNo) filter.coaNo = new RegExp(String(req.query.coaNo).trim(), 'i');
    if (req.query.petitionNo) filter.petitionNoSnapshot = new RegExp(String(req.query.petitionNo).trim(), 'i');
    if (req.query.needsApproval === '1') filter.status = { $in: ['pendingApproval', 'pendingRevisionApproval'] };
    const items = await CoaDocument.find(filter).sort({ updatedAt: -1 }).limit(200).lean();
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/eligible-petitions', async (_req, res) => {
  try {
    const petitions = await Petition.find({ labApprovedAt: { $exists: true, $ne: null } })
      .sort({ labApprovedAt: -1 })
      .limit(100)
      .lean();
    const petitionIds = petitions.map((p) => p._id);
    const coas = await CoaDocument.find({
      petitionId: { $in: petitionIds },
      status: { $in: ['approved', 'printed', 'reissued'] },
    }).lean();
    const activeByPetitionSeq = new Map();
    for (const coa of coas) {
      for (const seq of coa.selectedItemSeqs || []) {
        activeByPetitionSeq.set(`${coa.petitionId}:${seq}`, { coaId: coa._id, coaNo: coa.coaNo, revision: coa.revision });
      }
    }
    res.json({
      items: petitions.map((p) => ({
        _id: p._id,
        petitionNo: p.petitionNo,
        labApprovedAt: p.labApprovedAt,
        submittedBy: p.submittedBy,
        items: (p.items || []).map((item) => ({
          seq: item.seq,
          sampleName: item.sampleName,
          commonName: item.commonName,
          batchNo: item.batchNo,
          lotNo: item.lotNo,
          activeCoa: activeByPetitionSeq.get(`${p._id}:${item.seq}`) || null,
        })),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const actor = actorFromBody(req.body);
    const petition = await Petition.findById(req.body.petitionId).lean();
    if (!petition) return res.status(404).json({ error: 'ไม่พบคำร้อง' });
    if (!petition.labApprovedAt) return res.status(400).json({ error: 'คำร้องนี้ยังไม่ได้อนุมัติผล Lab' });
    selectedItemsFromPetition(petition, req.body.selectedItemSeqs);
    const doc = await CoaDocument.create({
      petitionId: petition._id,
      petitionNoSnapshot: petition.petitionNo,
      selectedItemSeqs: req.body.selectedItemSeqs,
      remark: String(req.body.remark || ''),
      status: 'draft',
      createdBy: actor,
      updatedBy: actor,
    });
    await writeAudit(doc, 'created', actor, 'สร้างร่าง COA', { selectedItemSeqs: req.body.selectedItemSeqs });
    res.status(201).json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const doc = await CoaDocument.findById(objectId(req.params.id)).lean();
    if (!doc) return res.status(404).json({ error: 'ไม่พบ COA' });
    const audit = await CoaAuditLog.find({ coaId: doc._id }).sort({ createdAt: -1 }).lean();
    res.json({ ...doc, audit });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const actor = actorFromBody(req.body);
    const doc = await CoaDocument.findById(objectId(req.params.id));
    if (!doc) return res.status(404).json({ error: 'ไม่พบ COA' });
    assertCanTransition(doc.status, 'update');
    if (req.body.selectedItemSeqs) doc.selectedItemSeqs = req.body.selectedItemSeqs;
    if (typeof req.body.remark === 'string') doc.remark = req.body.remark;
    doc.updatedBy = actor;
    await doc.save();
    await writeAudit(doc, 'updated', actor, 'แก้ไขร่าง COA', {});
    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/submit', async (req, res) => {
  try {
    const actor = actorFromBody(req.body);
    const doc = await CoaDocument.findById(objectId(req.params.id));
    if (!doc) return res.status(404).json({ error: 'ไม่พบ COA' });
    assertCanTransition(doc.status, 'submit');
    doc.status = doc.status === 'revisionDraft' ? 'pendingRevisionApproval' : 'pendingApproval';
    doc.approval.submittedBy = actor;
    doc.approval.submittedAt = new Date();
    doc.updatedBy = actor;
    await doc.save();
    await writeAudit(doc, doc.status === 'pendingRevisionApproval' ? 'revisionSubmitted' : 'submitted', actor, 'ส่งอนุมัติ COA', {});
    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/approve', async (req, res) => {
  try {
    const actor = actorFromBody(req.body);
    if (!isQcHead({ ...actor, permissions: req.body._user?.permissions, activeRole: req.body._user?.activeRole })) {
      return res.status(403).json({ error: 'อนุมัติ COA ได้เฉพาะ QC Head' });
    }
    const doc = await CoaDocument.findOne({ _id: objectId(req.params.id), status: { $in: ['pendingApproval', 'pendingRevisionApproval'] } });
    if (!doc) return res.status(409).json({ error: 'COA ไม่อยู่ในสถานะรออนุมัติ' });
    const snapshots = await freezeSnapshots(doc.petitionId, doc.selectedItemSeqs);
    Object.assign(doc, snapshots);
    if (!doc.coaNo) {
      const next = await nextCoaNumber();
      doc.coaNo = next.coaNo;
      doc.sequence = next.sequence;
      doc.coaYear = next.year;
    }
    doc.status = doc.status === 'pendingRevisionApproval' ? 'reissued' : 'approved';
    doc.approval.approvedBy = actor;
    doc.approval.approvedAt = new Date();
    doc.updatedBy = actor;
    await doc.save();
    if (doc.sourceCoaId) {
      await CoaDocument.findByIdAndUpdate(doc.sourceCoaId, { status: 'superseded', supersededByCoaId: doc._id });
    }
    await writeAudit(doc, doc.revision > 0 ? 'revisionApproved' : 'approved', actor, 'อนุมัติ COA', {});
    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/reject', async (req, res) => {
  try {
    const actor = actorFromBody(req.body);
    if (!isQcHead({ ...actor, permissions: req.body._user?.permissions, activeRole: req.body._user?.activeRole })) {
      return res.status(403).json({ error: 'ปฏิเสธ COA ได้เฉพาะ QC Head' });
    }
    const reason = String(req.body.reason || '').trim();
    if (!reason) return res.status(400).json({ error: 'ต้องระบุเหตุผลการปฏิเสธ' });
    const doc = await CoaDocument.findById(objectId(req.params.id));
    if (!doc) return res.status(404).json({ error: 'ไม่พบ COA' });
    assertCanTransition(doc.status, 'reject');
    doc.status = 'rejected';
    doc.approval.rejectedBy = actor;
    doc.approval.rejectedAt = new Date();
    doc.approval.rejectReason = reason;
    await doc.save();
    await writeAudit(doc, 'rejected', actor, reason, {});
    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/revise', async (req, res) => {
  try {
    const actor = actorFromBody(req.body);
    const source = await CoaDocument.findById(objectId(req.params.id)).lean();
    if (!source) return res.status(404).json({ error: 'ไม่พบ COA' });
    assertCanTransition(source.status, 'revise');
    const doc = await CoaDocument.create({
      coaNo: source.coaNo,
      coaYear: source.coaYear,
      sequence: source.sequence,
      revision: Number(source.revision || 0) + 1,
      status: 'revisionDraft',
      petitionId: source.petitionId,
      petitionNoSnapshot: source.petitionNoSnapshot,
      selectedItemSeqs: source.selectedItemSeqs,
      sourceCoaId: source._id,
      remark: source.remark,
      createdBy: actor,
      updatedBy: actor,
    });
    await writeAudit(doc, 'revisionCreated', actor, 'สร้างร่างแก้ไข COA', { sourceCoaId: source._id });
    res.status(201).json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/cancel', async (req, res) => {
  try {
    const actor = actorFromBody(req.body);
    const reason = String(req.body.reason || '').trim();
    if (!reason) return res.status(400).json({ error: 'ต้องระบุเหตุผลการยกเลิก' });
    const doc = await CoaDocument.findById(objectId(req.params.id));
    if (!doc) return res.status(404).json({ error: 'ไม่พบ COA' });
    assertCanTransition(doc.status, 'cancel');
    doc.status = 'cancelled';
    doc.cancel = { cancelledBy: actor, cancelledAt: new Date(), reason };
    await doc.save();
    await writeAudit(doc, 'cancelled', actor, reason, {});
    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/print-event', async (req, res) => {
  try {
    const actor = actorFromBody(req.body);
    const doc = await CoaDocument.findById(objectId(req.params.id));
    if (!doc) return res.status(404).json({ error: 'ไม่พบ COA' });
    assertCanTransition(doc.status, 'print');
    doc.print.printCount = Number(doc.print.printCount || 0) + 1;
    doc.print.lastPrintedAt = new Date();
    doc.print.lastPrintedBy = actor;
    doc.print.printEvents.push({
      event: req.body.event || 'printDialogOpened',
      printedAt: new Date(),
      printedBy: actor,
      copies: Number(req.body.copies || 1),
      outputMode: req.body.outputMode || 'local',
    });
    if (doc.status === 'approved') doc.status = 'printed';
    await doc.save();
    await writeAudit(doc, 'printed', actor, 'บันทึกการพิมพ์ COA', { copies: req.body.copies, outputMode: req.body.outputMode });
    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
module.exports.freezeSnapshots = freezeSnapshots;
```

- [ ] **Step 5: Mount route**

Modify `server/index.js` near existing route mounts:

```js
mountApi('/coa-documents', require('./routes/coaDocuments'));
```

- [ ] **Step 6: Run backend checks**

Run: `node --test server/lib/coaLifecycle.test.js server/routes/coaDocuments.test.js`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/index.js server/routes/coaDocuments.js server/routes/coaDocuments.test.js server/lib/coaLifecycle.js
git commit -m "feat: add coa document api"
```

---

### Task 3: Frontend COA Types, API Methods, Status Logic, And Printable Data

**Files:**
- Create: `src/types/coa.types.ts`
- Create: `src/lib/coaStatus.ts`
- Test: `src/lib/coaStatus.test.ts`
- Create: `src/lib/coaReport.ts`
- Test: `src/lib/coaReport.test.ts`
- Modify: `src/lib/api.ts`

**Interfaces:**
- Produces: `CoaDocument`, `CoaStatus`, `CoaAuditLogEntry`, `EligibleCoaPetition`
- Produces: `coaStatusLabel(status: CoaStatus): string`
- Produces: `canPrintCoa(status: CoaStatus): boolean`
- Produces: `allowedCoaActions(status: CoaStatus, isQcHead: boolean): string[]`
- Produces: `buildCoaReportPages(doc: CoaDocument): CoaReportPage[]`
- Produces API methods: `api.getCoaDocuments`, `api.getEligibleCoaPetitions`, `api.createCoaDocument`, `api.getCoaDocument`, `api.updateCoaDocument`, `api.submitCoaDocument`, `api.approveCoaDocument`, `api.rejectCoaDocument`, `api.reviseCoaDocument`, `api.cancelCoaDocument`, `api.recordCoaPrintEvent`

- [ ] **Step 1: Write failing status tests**

Add `src/lib/coaStatus.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { allowedCoaActions, canPrintCoa, coaStatusLabel } from "./coaStatus";

describe("coaStatus", () => {
  it("labels statuses for COA Center", () => {
    expect(coaStatusLabel("pendingApproval")).toBe("รอ QC Head อนุมัติ");
    expect(coaStatusLabel("superseded")).toBe("ถูกแทนที่");
  });

  it("allows printing only for active approved document states", () => {
    expect(canPrintCoa("approved")).toBe(true);
    expect(canPrintCoa("printed")).toBe(true);
    expect(canPrintCoa("reissued")).toBe(true);
    expect(canPrintCoa("draft")).toBe(false);
    expect(canPrintCoa("pendingApproval")).toBe(false);
    expect(canPrintCoa("cancelled")).toBe(false);
  });

  it("shows QC Head approval actions only to QC Head", () => {
    expect(allowedCoaActions("pendingApproval", true)).toEqual(["approve", "reject"]);
    expect(allowedCoaActions("pendingApproval", false)).toEqual([]);
    expect(allowedCoaActions("draft", false)).toEqual(["save", "submit"]);
    expect(allowedCoaActions("printed", true)).toEqual(["print", "revise", "cancel"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/coaStatus.test.ts`

Expected: FAIL with module-not-found for `./coaStatus`.

- [ ] **Step 3: Create shared types**

Add `src/types/coa.types.ts`:

```ts
export type CoaStatus =
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

export type CoaPerson = { name?: string; email?: string; role?: string };

export type CoaSampleSnapshot = {
  itemSeq: number;
  sampleName?: string;
  commonName?: string;
  batchNo?: string;
  lotNo?: string;
  productionDate?: string;
  sampleId?: string;
  condition?: string;
  manufacturer?: string;
};

export type CoaResultSnapshot = {
  itemSeq: number;
  testItem?: string;
  result?: string;
  criteria?: string;
  method?: string;
  unit?: string;
};

export type CoaAuditLogEntry = {
  _id: string;
  event: string;
  actor?: CoaPerson;
  note?: string;
  createdAt: string;
};

export type CoaDocument = {
  _id: string;
  coaNo?: string | null;
  coaYear?: number;
  sequence?: number;
  revision: number;
  status: CoaStatus;
  petitionId: string;
  petitionNoSnapshot?: string;
  selectedItemSeqs: number[];
  sourceCoaId?: string;
  supersededByCoaId?: string;
  customerSnapshot?: { name?: string; company?: string; department?: string; email?: string; phone?: string };
  sampleSnapshots: CoaSampleSnapshot[];
  resultSnapshots: CoaResultSnapshot[];
  remark?: string;
  approval?: {
    submittedBy?: CoaPerson;
    submittedAt?: string;
    approvedBy?: CoaPerson;
    approvedAt?: string;
    rejectedBy?: CoaPerson;
    rejectedAt?: string;
    rejectReason?: string;
  };
  cancel?: { cancelledBy?: CoaPerson; cancelledAt?: string; reason?: string };
  print?: {
    printCount?: number;
    lastPrintedAt?: string;
    lastPrintedBy?: CoaPerson;
  };
  audit?: CoaAuditLogEntry[];
  createdBy?: CoaPerson;
  updatedBy?: CoaPerson;
  createdAt?: string;
  updatedAt?: string;
};

export type EligibleCoaPetition = {
  _id: string;
  petitionNo: string;
  labApprovedAt?: string;
  submittedBy?: { name?: string; email?: string };
  items: Array<{
    seq: number;
    sampleName?: string;
    commonName?: string;
    batchNo?: string;
    lotNo?: string;
    activeCoa?: { coaId: string; coaNo: string; revision: number } | null;
  }>;
};
```

- [ ] **Step 4: Implement status logic**

Add `src/lib/coaStatus.ts`:

```ts
import type { CoaStatus } from "@/types/coa.types";

export const COA_STATUS_LABELS: Record<CoaStatus, string> = {
  draft: "ร่าง",
  pendingApproval: "รอ QC Head อนุมัติ",
  approved: "อนุมัติแล้ว",
  printed: "พิมพ์แล้ว",
  revisionDraft: "ร่างแก้ไข",
  pendingRevisionApproval: "รออนุมัติฉบับแก้ไข",
  reissued: "ออกใหม่แล้ว",
  cancelled: "ยกเลิก",
  superseded: "ถูกแทนที่",
  rejected: "ไม่อนุมัติ",
};

export function coaStatusLabel(status: CoaStatus): string {
  return COA_STATUS_LABELS[status];
}

export function canPrintCoa(status: CoaStatus): boolean {
  return status === "approved" || status === "printed" || status === "reissued";
}

export function allowedCoaActions(status: CoaStatus, isQcHead: boolean): string[] {
  if (status === "draft" || status === "revisionDraft") return ["save", "submit"];
  if ((status === "pendingApproval" || status === "pendingRevisionApproval") && isQcHead) return ["approve", "reject"];
  if (status === "approved" || status === "printed" || status === "reissued") return ["print", "revise", "cancel"];
  return [];
}
```

- [ ] **Step 5: Add report builder test**

Add `src/lib/coaReport.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildCoaReportPages } from "./coaReport";
import type { CoaDocument } from "@/types/coa.types";

describe("buildCoaReportPages", () => {
  it("groups frozen result rows by selected sample", () => {
    const doc = {
      _id: "c1",
      coaNo: "00012026",
      revision: 1,
      status: "reissued",
      petitionId: "p1",
      petitionNoSnapshot: "P-2608-0001",
      selectedItemSeqs: [1],
      customerSnapshot: { name: "Customer A", company: "ICP Ladda" },
      sampleSnapshots: [{ itemSeq: 1, sampleName: "Sample A", batchNo: "B1" }],
      resultSnapshots: [{ itemSeq: 1, testItem: "pH", result: "7.0", criteria: "6.5-7.5", method: "M1" }],
      approval: { approvedBy: { name: "QC Head" }, approvedAt: "2026-08-04T00:00:00.000Z" },
    } as CoaDocument;

    const pages = buildCoaReportPages(doc);
    expect(pages).toHaveLength(1);
    expect(pages[0].coaNo).toBe("00012026");
    expect(pages[0].revision).toBe(1);
    expect(pages[0].samples[0].rows[0].testItem).toBe("pH");
  });
});
```

- [ ] **Step 6: Implement report builder**

Add `src/lib/coaReport.ts`:

```ts
import type { CoaDocument, CoaResultSnapshot, CoaSampleSnapshot } from "@/types/coa.types";

export type CoaReportSample = CoaSampleSnapshot & { rows: CoaResultSnapshot[] };

export type CoaReportPage = {
  coaNo: string;
  revision: number;
  issueDate: string;
  petitionNo: string;
  customer: NonNullable<CoaDocument["customerSnapshot"]>;
  samples: CoaReportSample[];
  remark: string;
  approvedBy: string;
  approvedAt: string;
};

function formatDate(iso?: string): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("th-TH");
}

export function buildCoaReportPages(doc: CoaDocument): CoaReportPage[] {
  const rowsBySeq = new Map<number, CoaResultSnapshot[]>();
  for (const row of doc.resultSnapshots || []) {
    const bucket = rowsBySeq.get(row.itemSeq) || [];
    bucket.push(row);
    rowsBySeq.set(row.itemSeq, bucket);
  }
  return [
    {
      coaNo: doc.coaNo || "-",
      revision: doc.revision || 0,
      issueDate: formatDate(doc.approval?.approvedAt),
      petitionNo: doc.petitionNoSnapshot || "-",
      customer: doc.customerSnapshot || {},
      samples: (doc.sampleSnapshots || []).map((sample) => ({ ...sample, rows: rowsBySeq.get(sample.itemSeq) || [] })),
      remark: doc.remark || "",
      approvedBy: doc.approval?.approvedBy?.name || "-",
      approvedAt: formatDate(doc.approval?.approvedAt),
    },
  ];
}
```

- [ ] **Step 7: Add API methods**

Modify `src/lib/api.ts` imports:

```ts
import type { CoaDocument, EligibleCoaPetition } from "@/types/coa.types";
```

Add methods inside `api`:

```ts
  getCoaDocuments: (params?: { status?: string; petitionNo?: string; coaNo?: string; needsApproval?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.petitionNo) q.set("petitionNo", params.petitionNo);
    if (params?.coaNo) q.set("coaNo", params.coaNo);
    if (params?.needsApproval) q.set("needsApproval", "1");
    return request<{ items: CoaDocument[] }>(`/coa-documents${q.toString() ? `?${q}` : ""}`);
  },
  getEligibleCoaPetitions: () => request<{ items: EligibleCoaPetition[] }>("/coa-documents/eligible-petitions"),
  createCoaDocument: (body: { petitionId: string; selectedItemSeqs: number[]; remark?: string; _user?: unknown }) =>
    request<CoaDocument>("/coa-documents", { method: "POST", body: JSON.stringify(body) }),
  getCoaDocument: (id: string) => request<CoaDocument>(`/coa-documents/${id}`),
  updateCoaDocument: (id: string, body: { selectedItemSeqs?: number[]; remark?: string; _user?: unknown }) =>
    request<CoaDocument>(`/coa-documents/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  submitCoaDocument: (id: string, body: { _user?: unknown }) =>
    request<CoaDocument>(`/coa-documents/${id}/submit`, { method: "POST", body: JSON.stringify(body) }),
  approveCoaDocument: (id: string, body: { _user?: unknown }) =>
    request<CoaDocument>(`/coa-documents/${id}/approve`, { method: "POST", body: JSON.stringify(body) }),
  rejectCoaDocument: (id: string, body: { reason: string; _user?: unknown }) =>
    request<CoaDocument>(`/coa-documents/${id}/reject`, { method: "POST", body: JSON.stringify(body) }),
  reviseCoaDocument: (id: string, body: { _user?: unknown }) =>
    request<CoaDocument>(`/coa-documents/${id}/revise`, { method: "POST", body: JSON.stringify(body) }),
  cancelCoaDocument: (id: string, body: { reason: string; _user?: unknown }) =>
    request<CoaDocument>(`/coa-documents/${id}/cancel`, { method: "POST", body: JSON.stringify(body) }),
  recordCoaPrintEvent: (id: string, body: { event: string; copies: number; outputMode: string; _user?: unknown }) =>
    request<CoaDocument>(`/coa-documents/${id}/print-event`, { method: "POST", body: JSON.stringify(body) }),
```

- [ ] **Step 8: Run tests and typecheck focused files**

Run:

```bash
npx vitest run src/lib/coaStatus.test.ts src/lib/coaReport.test.ts
npx tsc -p tsconfig.app.json --noEmit
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/types/coa.types.ts src/lib/coaStatus.ts src/lib/coaStatus.test.ts src/lib/coaReport.ts src/lib/coaReport.test.ts src/lib/api.ts
git commit -m "feat: add coa frontend types and helpers"
```

---

### Task 4: COA List Page And Create Dialog

**Files:**
- Create: `src/components/coa/CoaStatusBadge.tsx`
- Create: `src/components/coa/CoaCreateDialog.tsx`
- Create: `src/pages/CoaCenterPage.tsx`
- Test: `src/pages/__tests__/CoaCenterPage.test.tsx`

**Interfaces:**
- Consumes: `api.getCoaDocuments`, `api.getEligibleCoaPetitions`, `api.createCoaDocument`
- Consumes: `coaStatusLabel(status)`
- Produces: `/coa` page UI and draft creation flow.

- [ ] **Step 1: Write failing page test**

Add `src/pages/__tests__/CoaCenterPage.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import CoaCenterPage from "../CoaCenterPage";

vi.mock("@/components/lis/AppLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/lib/api", () => ({
  api: {
    getCoaDocuments: vi.fn().mockResolvedValue({
      items: [
        {
          _id: "c1",
          coaNo: "00012026",
          revision: 0,
          status: "approved",
          petitionId: "p1",
          petitionNoSnapshot: "P-2608-0001",
          selectedItemSeqs: [1],
          sampleSnapshots: [{ itemSeq: 1, sampleName: "Sample A" }],
          resultSnapshots: [],
          print: { printCount: 0 },
        },
      ],
    }),
    getEligibleCoaPetitions: vi.fn().mockResolvedValue({ items: [] }),
  },
}));

describe("CoaCenterPage", () => {
  it("renders COA list and create action", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <CoaCenterPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("ออกเอกสาร COA")).toBeInTheDocument();
    expect(await screen.findByText("00012026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /สร้าง COA/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/__tests__/CoaCenterPage.test.tsx`

Expected: FAIL because `../CoaCenterPage` does not exist.

- [ ] **Step 3: Implement status badge**

Add `src/components/coa/CoaStatusBadge.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";
import { coaStatusLabel } from "@/lib/coaStatus";
import type { CoaStatus } from "@/types/coa.types";

const variantByStatus: Record<CoaStatus, React.ComponentProps<typeof Badge>["variant"]> = {
  draft: "gray-soft",
  pendingApproval: "yellow-soft",
  approved: "green-soft",
  printed: "blue-soft",
  revisionDraft: "yellow-soft",
  pendingRevisionApproval: "yellow-soft",
  reissued: "green-soft",
  cancelled: "red-soft",
  superseded: "gray-soft",
  rejected: "red-soft",
};

export default function CoaStatusBadge({ status }: { status: CoaStatus }) {
  return <Badge variant={variantByStatus[status]}>{coaStatusLabel(status)}</Badge>;
}
```

- [ ] **Step 4: Implement create dialog**

Add `src/components/coa/CoaCreateDialog.tsx`:

```tsx
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FilePlus2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { EligibleCoaPetition } from "@/types/coa.types";

export default function CoaCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const [petitionId, setPetitionId] = useState("");
  const [selectedSeqs, setSelectedSeqs] = useState<number[]>([]);
  const { data } = useQuery({ queryKey: ["coa", "eligible-petitions"], queryFn: api.getEligibleCoaPetitions, enabled: open });
  const petitions = data?.items ?? [];
  const selectedPetition = useMemo(
    () => petitions.find((p: EligibleCoaPetition) => p._id === petitionId),
    [petitions, petitionId],
  );
  const create = useMutation({
    mutationFn: () => api.createCoaDocument({ petitionId, selectedItemSeqs: selectedSeqs }),
    onSuccess: (doc) => {
      onOpenChange(false);
      onCreated(doc._id);
    },
  });

  function toggleSeq(seq: number) {
    setSelectedSeqs((value) => (value.includes(seq) ? value.filter((x) => x !== seq) : [...value, seq]));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>สร้าง COA</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-[260px_1fr]">
          <div className="max-h-80 overflow-auto rounded-md border">
            {petitions.map((petition) => (
              <button
                key={petition._id}
                type="button"
                className={`block w-full border-b px-3 py-2 text-left text-sm hover:bg-slate-50 ${petition._id === petitionId ? "bg-sky-50" : ""}`}
                onClick={() => {
                  setPetitionId(petition._id);
                  setSelectedSeqs([]);
                }}
              >
                <div className="font-medium">{petition.petitionNo}</div>
                <div className="text-xs text-muted-foreground">{petition.items.length} รายการ</div>
              </button>
            ))}
          </div>
          <div className="max-h-80 overflow-auto rounded-md border">
            {!selectedPetition && <div className="p-6 text-center text-sm text-muted-foreground">เลือกคำร้องที่อนุมัติผล Lab แล้ว</div>}
            {selectedPetition?.items.map((item) => (
              <label key={item.seq} className="flex items-start gap-3 border-b p-3 text-sm">
                <Checkbox checked={selectedSeqs.includes(item.seq)} onCheckedChange={() => toggleSeq(item.seq)} />
                <span>
                  <span className="block font-medium">{item.sampleName || item.commonName || `Sample ${item.seq}`}</span>
                  <span className="block text-xs text-muted-foreground">{item.batchNo || item.lotNo || "-"}</span>
                  {item.activeCoa && <span className="mt-1 block text-xs text-amber-600">มี COA แล้ว: {item.activeCoa.coaNo}</span>}
                </span>
              </label>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ปิด</Button>
          <Button className="gap-2" disabled={!petitionId || selectedSeqs.length === 0 || create.isPending} onClick={() => create.mutate()}>
            <FilePlus2 className="h-4 w-4" />
            สร้างร่าง COA
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: Implement center page**

Add `src/pages/CoaCenterPage.tsx`:

```tsx
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { FileCheck2, FilePlus2 } from "lucide-react";
import AppLayout from "@/components/lis/AppLayout";
import PageHeader from "@/components/lis/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CoaCreateDialog from "@/components/coa/CoaCreateDialog";
import CoaStatusBadge from "@/components/coa/CoaStatusBadge";
import { api } from "@/lib/api";

export default function CoaCenterPage() {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["coa", "documents"], queryFn: () => api.getCoaDocuments() });
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const items = data?.items ?? [];
    if (!q) return items;
    return items.filter((doc) => `${doc.coaNo || ""} ${doc.petitionNoSnapshot || ""}`.toLowerCase().includes(q));
  }, [data, search]);

  return (
    <AppLayout>
      <div className="space-y-4 p-6">
        <PageHeader
          title={<span className="inline-flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-sky-500" />ออกเอกสาร COA</span>}
          actions={<Button className="gap-2" onClick={() => setCreateOpen(true)}><FilePlus2 className="h-4 w-4" />สร้าง COA</Button>}
        />
        <Input className="max-w-sm" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหา COA / คำร้อง" />
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2">COA No.</th>
                <th className="px-3 py-2">Revision</th>
                <th className="px-3 py-2">เลขคำร้อง</th>
                <th className="px-3 py-2">ตัวอย่าง</th>
                <th className="px-3 py-2">สถานะ</th>
                <th className="px-3 py-2">พิมพ์</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">กำลังโหลด...</td></tr>}
              {!isLoading && rows.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">ยังไม่มีเอกสาร COA</td></tr>}
              {rows.map((doc) => (
                <tr key={doc._id} className="cursor-pointer border-t hover:bg-gray-50" onClick={() => navigate(`/coa/${doc._id}`)}>
                  <td className="px-3 py-2 font-medium">{doc.coaNo || "ร่าง"}</td>
                  <td className="px-3 py-2">{doc.revision ? `Rev.${doc.revision}` : "-"}</td>
                  <td className="px-3 py-2">{doc.petitionNoSnapshot || "-"}</td>
                  <td className="px-3 py-2">{doc.sampleSnapshots?.map((s) => s.sampleName || s.commonName).filter(Boolean).join(", ") || `${doc.selectedItemSeqs.length} รายการ`}</td>
                  <td className="px-3 py-2"><CoaStatusBadge status={doc.status} /></td>
                  <td className="px-3 py-2">{doc.print?.printCount || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <CoaCreateDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={(id) => navigate(`/coa/${id}`)} />
    </AppLayout>
  );
}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/pages/__tests__/CoaCenterPage.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/coa/CoaStatusBadge.tsx src/components/coa/CoaCreateDialog.tsx src/pages/CoaCenterPage.tsx src/pages/__tests__/CoaCenterPage.test.tsx
git commit -m "feat: add coa center page"
```

---

### Task 5: COA Detail Page, Approval Actions, Audit Timeline, And Print Event Hook

**Files:**
- Create: `src/components/coa/CoaAuditTimeline.tsx`
- Create: `src/components/coa/CoaReportTemplate.tsx`
- Create: `src/pages/CoaDetailPage.tsx`
- Test: `src/pages/__tests__/CoaDetailPage.test.tsx`
- Modify: `src/components/lis/PrintPreviewDialog.tsx`

**Interfaces:**
- Consumes: `buildCoaReportPages(doc)`
- Consumes: `canPrintCoa(status)`, `allowedCoaActions(status, isQcHead)`
- Consumes: COA API methods.
- Produces: Detail route UI and calls print-event after print starts.

- [ ] **Step 1: Add optional print callback to dialog**

Modify `src/components/lis/PrintPreviewDialog.tsx` Props:

```ts
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docType: PrintDocType;
  css?: string;
  children: React.ReactNode;
  onPrinted?: (meta: { copies: number; outputMode: PrintOutputMode }) => void;
}
```

Destructure `onPrinted` and call it after `printDocument()` succeeds:

```ts
const res = await printDocument(docType, printRef.current, { css, copies, outputMode: mode });
onPrinted?.({ copies, outputMode: mode });
```

- [ ] **Step 2: Write failing detail page test**

Add `src/pages/__tests__/CoaDetailPage.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import CoaDetailPage from "../CoaDetailPage";

vi.mock("@/components/lis/AppLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/lis/PrintPreviewDialog", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/lib/api", () => ({
  api: {
    getCoaDocument: vi.fn().mockResolvedValue({
      _id: "c1",
      coaNo: null,
      revision: 0,
      status: "pendingApproval",
      petitionId: "p1",
      petitionNoSnapshot: "P-2608-0001",
      selectedItemSeqs: [1],
      customerSnapshot: { name: "Customer A" },
      sampleSnapshots: [{ itemSeq: 1, sampleName: "Sample A" }],
      resultSnapshots: [{ itemSeq: 1, testItem: "pH", result: "7.0" }],
      audit: [],
    }),
  },
}));

describe("CoaDetailPage", () => {
  it("disables print before approval", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/coa/c1"]}>
          <Routes><Route path="/coa/:id" element={<CoaDetailPage />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("P-2608-0001")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /พิมพ์ COA/ })).toBeDisabled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/pages/__tests__/CoaDetailPage.test.tsx`

Expected: FAIL because `../CoaDetailPage` does not exist.

- [ ] **Step 4: Implement audit timeline**

Add `src/components/coa/CoaAuditTimeline.tsx`:

```tsx
import type { CoaAuditLogEntry } from "@/types/coa.types";

export default function CoaAuditTimeline({ audit = [] }: { audit?: CoaAuditLogEntry[] }) {
  if (!audit.length) return <div className="rounded-md border p-4 text-sm text-muted-foreground">ยังไม่มีประวัติเอกสาร</div>;
  return (
    <div className="rounded-md border bg-white">
      {audit.map((entry) => (
        <div key={entry._id} className="border-b p-3 text-sm last:border-b-0">
          <div className="font-medium">{entry.event}</div>
          <div className="text-xs text-muted-foreground">
            {entry.actor?.name || entry.actor?.email || "system"} · {entry.createdAt ? new Date(entry.createdAt).toLocaleString("th-TH") : "-"}
          </div>
          {entry.note && <div className="mt-1 text-muted-foreground">{entry.note}</div>}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Implement COA report template**

Add `src/components/coa/CoaReportTemplate.tsx`:

```tsx
import { ICP_LADDA_LOGO_URL } from "@/lib/branding";
import type { CoaReportPage } from "@/lib/coaReport";
import { A4_PRINT_FONT_FAMILY, A4_PRINT_FONT_SIZE, A4_PRINT_HEADING_FONT_WEIGHT } from "@/lib/printConfig";

export const COA_REPORT_CSS = `
.coa-root, .coa-root * { box-sizing: border-box; color: #000; font-family: ${A4_PRINT_FONT_FAMILY}; font-size: ${A4_PRINT_FONT_SIZE}; }
.coa-page { width: 210mm; min-height: 297mm; padding: 12mm; background: #fff; }
.coa-page + .coa-page { margin-top: 6mm; page-break-before: always; break-before: page; }
.coa-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.coa-table td, .coa-table th { border: 0.8pt solid #000; padding: 2.4mm; vertical-align: top; word-break: break-word; }
.coa-title { text-align: center; font-size: 15pt; font-weight: 700; }
.coa-logo { height: 16mm; }
.coa-center { text-align: center; }
.coa-right { text-align: right; }
.coa-muted { color: #555; }
.coa-sign { margin-top: 14mm; text-align: center; }
.coa-line { display: inline-block; min-width: 62mm; border-bottom: 0.8pt dotted #000; }
@media screen { .coa-page { margin: 0 auto; box-shadow: 0 0 0 1px #ddd; } }
.coa-root h1, .coa-root th, .coa-title, .print-heading { font-weight: ${A4_PRINT_HEADING_FONT_WEIGHT} !important; }
`;

export default function CoaReportTemplate({ pages }: { pages: CoaReportPage[] }) {
  return (
    <div className="coa-root">
      <style>{COA_REPORT_CSS}</style>
      {pages.map((page, index) => (
        <section className="coa-page" key={`${page.coaNo}-${index}`}>
          <table className="coa-table">
            <tbody>
              <tr>
                <td style={{ width: "34%" }}><img className="coa-logo" src={ICP_LADDA_LOGO_URL} alt="ICP Ladda" /></td>
                <td className="coa-title">Certificate of Analysis<br />ใบรับรองผลการวิเคราะห์</td>
                <td style={{ width: "28%" }}>
                  <div>COA No. {page.coaNo}</div>
                  {page.revision > 0 && <div>Revision {page.revision}</div>}
                  <div>Issue date {page.issueDate}</div>
                </td>
              </tr>
            </tbody>
          </table>
          <table className="coa-table">
            <tbody>
              <tr>
                <td>Customer: {page.customer.name || "-"}</td>
                <td>Company: {page.customer.company || "-"}</td>
              </tr>
              <tr>
                <td>Petition No.: {page.petitionNo}</td>
                <td>Approved by: {page.approvedBy}</td>
              </tr>
            </tbody>
          </table>
          {page.samples.map((sample) => (
            <table className="coa-table" key={sample.itemSeq}>
              <thead>
                <tr><th colSpan={4}>Sample: {sample.sampleName || sample.commonName || `Sample ${sample.itemSeq}`} / Batch: {sample.batchNo || sample.lotNo || "-"}</th></tr>
                <tr><th>Test item</th><th>Result</th><th>Criteria</th><th>Method</th></tr>
              </thead>
              <tbody>
                {sample.rows.length ? sample.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    <td>{row.testItem || "-"}</td>
                    <td className="coa-center">{row.result || "-"}</td>
                    <td className="coa-center">{row.criteria || "-"}</td>
                    <td className="coa-center">{row.method || "-"}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="coa-center coa-muted">ไม่พบผลทดสอบ</td></tr>
                )}
              </tbody>
            </table>
          ))}
          <div style={{ marginTop: "6mm" }}>Remark: {page.remark || "-"}</div>
          <div className="coa-sign">
            <span className="coa-line" />
            <div>QC Head</div>
            <div>{page.approvedBy} · {page.approvedAt}</div>
          </div>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Implement detail page**

Add `src/pages/CoaDetailPage.tsx`:

```tsx
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { FileCheck2, Printer } from "lucide-react";
import AppLayout from "@/components/lis/AppLayout";
import PageHeader from "@/components/lis/PageHeader";
import PrintPreviewDialog from "@/components/lis/PrintPreviewDialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import CoaAuditTimeline from "@/components/coa/CoaAuditTimeline";
import CoaReportTemplate, { COA_REPORT_CSS } from "@/components/coa/CoaReportTemplate";
import CoaStatusBadge from "@/components/coa/CoaStatusBadge";
import { api } from "@/lib/api";
import { buildCoaReportPages } from "@/lib/coaReport";
import { canPrintCoa } from "@/lib/coaStatus";

export default function CoaDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [printOpen, setPrintOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { data: doc, isLoading } = useQuery({ queryKey: ["coa", id], queryFn: () => api.getCoaDocument(id), enabled: Boolean(id) });
  const pages = useMemo(() => (doc ? buildCoaReportPages(doc) : []), [doc]);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["coa", id] });
  const submit = useMutation({ mutationFn: () => api.submitCoaDocument(id, {}), onSuccess: invalidate });
  const approve = useMutation({ mutationFn: () => api.approveCoaDocument(id, { _user: { role: "qc-head" } }), onSuccess: invalidate });
  const reject = useMutation({ mutationFn: () => api.rejectCoaDocument(id, { reason, _user: { role: "qc-head" } }), onSuccess: invalidate });
  const revise = useMutation({ mutationFn: () => api.reviseCoaDocument(id, {}), onSuccess: (next) => navigate(`/coa/${next._id}`) });
  const cancel = useMutation({ mutationFn: () => api.cancelCoaDocument(id, { reason }), onSuccess: invalidate });
  const recordPrint = useMutation({ mutationFn: (meta: { copies: number; outputMode: string }) => api.recordCoaPrintEvent(id, { event: "printDialogOpened", ...meta }), onSuccess: invalidate });

  if (isLoading || !doc) {
    return <AppLayout><div className="p-6 text-muted-foreground">กำลังโหลด...</div></AppLayout>;
  }

  const printable = canPrintCoa(doc.status);

  return (
    <AppLayout title={doc.coaNo || "COA"}>
      <div className="space-y-6 p-6">
        <PageHeader
          onBack={() => navigate("/coa")}
          title={<span className="inline-flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-sky-500" />{doc.coaNo || "ร่าง COA"}</span>}
          actions={<Button className="gap-2" disabled={!printable} onClick={() => setPrintOpen(true)}><Printer className="h-4 w-4" />พิมพ์ COA</Button>}
        />
        <div className="flex flex-wrap items-center gap-2">
          <CoaStatusBadge status={doc.status} />
          <span className="text-sm text-muted-foreground">{doc.petitionNoSnapshot}</span>
          {doc.revision > 0 && <span className="text-sm text-muted-foreground">Rev.{doc.revision}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {(doc.status === "draft" || doc.status === "revisionDraft") && <Button onClick={() => submit.mutate()}>ส่งอนุมัติ</Button>}
          {(doc.status === "pendingApproval" || doc.status === "pendingRevisionApproval") && (
            <>
              <Button onClick={() => approve.mutate()}>QC Head อนุมัติ</Button>
              <Button variant="destructive" disabled={!reason.trim()} onClick={() => reject.mutate()}>ไม่อนุมัติ</Button>
            </>
          )}
          {printable && (
            <>
              <Button variant="outline" onClick={() => revise.mutate()}>สร้างฉบับแก้ไข</Button>
              <Button variant="destructive" disabled={!reason.trim()} onClick={() => cancel.mutate()}>ยกเลิก COA</Button>
            </>
          )}
        </div>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เหตุผลสำหรับไม่อนุมัติหรือยกเลิก" />
        <section className="rounded-lg border bg-white p-4">
          <h2 className="mb-3 font-semibold">ตัวอย่างและผลทดสอบ</h2>
          {doc.sampleSnapshots.map((sample) => (
            <div key={sample.itemSeq} className="mb-4 rounded-md border p-3">
              <div className="font-medium">{sample.sampleName || sample.commonName || `Sample ${sample.itemSeq}`}</div>
              <div className="text-sm text-muted-foreground">{sample.batchNo || sample.lotNo || "-"}</div>
              <ul className="mt-2 list-disc pl-5 text-sm">
                {doc.resultSnapshots.filter((row) => row.itemSeq === sample.itemSeq).map((row, index) => (
                  <li key={index}>{row.testItem}: {row.result}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
        <section>
          <h2 className="mb-3 font-semibold">ประวัติเอกสาร</h2>
          <CoaAuditTimeline audit={doc.audit} />
        </section>
      </div>
      <PrintPreviewDialog
        open={printOpen}
        onOpenChange={setPrintOpen}
        docType="coa"
        css={COA_REPORT_CSS}
        onPrinted={(meta) => recordPrint.mutate(meta)}
      >
        <CoaReportTemplate pages={pages} />
      </PrintPreviewDialog>
    </AppLayout>
  );
}
```

- [ ] **Step 7: Run tests and typecheck**

Run:

```bash
npx vitest run src/pages/__tests__/CoaDetailPage.test.tsx src/lib/coaReport.test.ts
npx tsc -p tsconfig.app.json --noEmit
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/lis/PrintPreviewDialog.tsx src/components/coa/CoaAuditTimeline.tsx src/components/coa/CoaReportTemplate.tsx src/pages/CoaDetailPage.tsx src/pages/__tests__/CoaDetailPage.test.tsx
git commit -m "feat: add coa detail workflow"
```

---

### Task 6: Routing, Navigation, And End-To-End Integration Polish

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/lib/navItems.ts`
- Test: `src/lib/navItems.test.ts`

**Interfaces:**
- Consumes: `CoaCenterPage`, `CoaDetailPage`
- Produces: reachable `/coa` and `/coa/:id` routes.

- [ ] **Step 1: Write failing nav test**

Modify `src/lib/navItems.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { NAV_ITEMS, PAGE_ITEMS } from "./navItems";

describe("COA navigation", () => {
  it("includes COA Center in sidebar and detail in page registry", () => {
    expect(NAV_ITEMS.some((item) => item.path === "/coa" && item.label === "ออกเอกสาร COA")).toBe(true);
    expect(PAGE_ITEMS.some((item) => item.path === "/coa/:id")).toBe(true);
  });
});
```

If `navItems.test.ts` already has imports/describes, merge only the `it(...)` block and reuse existing imports.

- [ ] **Step 2: Run nav test to verify it fails**

Run: `npx vitest run src/lib/navItems.test.ts`

Expected: FAIL because `/coa` is not in `NAV_ITEMS`.

- [ ] **Step 3: Add routes**

Modify `src/App.tsx` lazy imports:

```ts
const CoaCenterPage = lazy(() => import("./pages/CoaCenterPage"));
const CoaDetailPage = lazy(() => import("./pages/CoaDetailPage"));
```

Add routes near lab/report routes:

```tsx
<Route path="/coa" element={<PrivateRoute><CoaCenterPage /></PrivateRoute>} />
<Route path="/coa/:id" element={<PrivateRoute><CoaDetailPage /></PrivateRoute>} />
```

- [ ] **Step 4: Add navigation item**

Modify `src/lib/navItems.ts` imports to include `FileCheck2` from `lucide-react`.

Add to `NAV_ITEMS` after Lab Results:

```ts
{ icon: FileCheck2, label: "ออกเอกสาร COA", path: "/coa" },
```

Add to `PAGE_ITEMS`:

```ts
{ icon: FileCheck2, label: "รายละเอียด COA", path: "/coa/:id" },
```

- [ ] **Step 5: Run focused tests and typecheck**

Run:

```bash
npx vitest run src/lib/navItems.test.ts src/pages/__tests__/CoaCenterPage.test.tsx src/pages/__tests__/CoaDetailPage.test.tsx
npx tsc -p tsconfig.app.json --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/lib/navItems.ts src/lib/navItems.test.ts
git commit -m "feat: route coa center"
```

---

### Task 7: Final Verification Pass

**Files:**
- Modify only files required to fix issues found by tests.

**Interfaces:**
- Consumes all previous tasks.
- Produces verified COA workflow implementation.

- [ ] **Step 1: Run backend tests**

Run:

```bash
node --test server/lib/coaLifecycle.test.js server/routes/coaDocuments.test.js
```

Expected: PASS.

- [ ] **Step 2: Run frontend focused tests**

Run:

```bash
npx vitest run src/lib/coaStatus.test.ts src/lib/coaReport.test.ts src/pages/__tests__/CoaCenterPage.test.tsx src/pages/__tests__/CoaDetailPage.test.tsx src/lib/navItems.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run app typecheck**

Run:

```bash
npx tsc -p tsconfig.app.json --noEmit
```

Expected: PASS.

- [ ] **Step 4: Run full test suite if focused tests pass**

Run:

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 5: Inspect git status**

Run:

```bash
git status --short
```

Expected: only intentional COA files are changed, plus pre-existing unrelated `auth.html` and `index.html` if they remain dirty from before this work.

- [ ] **Step 6: Final commit for verification fixes**

If Step 1-5 required fixes, commit them:

```bash
git add server src
git commit -m "test: verify coa workflow"
```

If no fixes were required, do not create an empty commit.
