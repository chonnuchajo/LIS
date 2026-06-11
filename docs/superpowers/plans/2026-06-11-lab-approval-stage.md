# Lab Approval Stage + Multi-target Reject — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มด่าน "หัวหน้า Lab อนุมัติ" คู่กับ QC อนุมัติ — บังคับลำดับ QC รอ Lab, หัวหน้า QC เห็นทุก param และส่งกลับได้ 3 ปลายทาง (ผู้ส่งคำขอ/Lab/QC) พร้อมให้ผู้ทดสอบที่ถูกส่งกลับอธิบาย "ทำใหม่ยังไง"

**Architecture:** ใช้ field-based gating (ไม่เพิ่มค่า status enum) — เพิ่ม `labApprovedAt` ใน Petition แล้วแก้ `isPetitionComplete` ให้ success เกิดหลัง Lab อนุมัติ. Backend เพิ่ม endpoint `lab-approve`/`lab-reject` + ขยาย `complete`/reject. Frontend เพิ่มหน้าคิว `/lab-approval` + แก้ Lab/QC detail page. Access เป็น path-based เดิม (สิทธิ์ path `/lab-approval` = หัวหน้า Lab)

**Tech Stack:** Express 4 + Mongoose 8 (backend), React 18 + TS + Vite + TanStack-style hooks (frontend). Backend unit tests = `node:test` (`node --test`). Frontend = `npx tsc -p tsconfig.app.json --noEmit` + `npm run lint` + manual.

**Spec:** `docs/superpowers/specs/2026-06-11-lab-approval-stage-design.md`

---

## File Structure

**Backend**
- `server/models/Petition.js` — field ใหม่ + reviewHistory action enum
- `server/lib/petitionStatusLog.js` + `.test.js` — `isPetitionComplete` เช็ค `labApprovedAt`
- `server/routes/petitions.js` — `lab-approve`/`lab-reject`, redoExplanation ใน `complete`, reject target, `awaitingLabApproval` filter

**Frontend**
- `src/types/petition.types.ts` — field ใหม่
- `src/lib/api.ts` — api helpers
- `src/hooks/usePetition.ts` — param `awaitingLabApproval`
- `src/pages/LabApproval.tsx` — หน้าใหม่ (clone QCApproval)
- `src/App.tsx`, `src/lib/navItems.ts` — route + nav
- `src/pages/LabTestingDetailPage.tsx` — โซน 3 สถานะ + อนุมัติ/ส่งกลับ + redo
- `src/pages/QCTestingDetailPage.tsx` — กล่องผล Lab อ่านอย่างเดียว + reject 3 ปลายทาง + redo banner

---

## Task 1: Petition schema — field ใหม่ + reviewHistory enum

**Files:**
- Modify: `server/models/Petition.js:38` (ReviewEntrySchema enum), `server/models/Petition.js:120` (หลัง qcCompletedBy)
- Modify: `src/types/petition.types.ts:205` (หลัง qcCompletedBy)

- [ ] **Step 1: เพิ่ม action enum ใน ReviewEntrySchema**

แก้ `server/models/Petition.js` บรรทัด 38:
```js
      enum: ['note', 'approve', 'reject', 'startTesting', 'lab-approve', 'lab-reject'],
```

- [ ] **Step 2: เพิ่ม field ใหม่ใน petition schema**

ใน `server/models/Petition.js` หลังบรรทัด 120 (`qcCompletedBy: String,`) แทรก:
```js
    // Lab supervisor approval (ด่านหลังผู้ทดสอบ Lab บันทึกผล — success เกิดหลังขั้นนี้)
    labApprovedAt: Date,
    labApprovedBy: String,
    // เหตุผลล่าสุดที่ track ถูกส่งกลับ (เคลียร์เมื่อผู้ทดสอบ re-confirm)
    labReturnNote: String,
    qcReturnNote: String,
    // ผู้ทดสอบอธิบาย "ทำใหม่ยังไง" ตอน re-confirm หลังโดนส่งกลับ
    labRedoExplanation: String,
    qcRedoExplanation: String,
```

- [ ] **Step 3: เพิ่ม field ใน type frontend**

ใน `src/types/petition.types.ts` หลังบรรทัด 205 (`qcCompletedBy?: string;`) แทรก:
```ts
  labApprovedAt?: string | null;
  labApprovedBy?: string;
  labReturnNote?: string;
  qcReturnNote?: string;
  labRedoExplanation?: string;
  qcRedoExplanation?: string;
```

- [ ] **Step 4: ตรวจ type-check ผ่าน**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่ (repo มี latent error ~12 ตัวเดิม — เทียบกับ baseline ว่าไม่เพิ่ม)

- [ ] **Step 5: Commit**

```bash
git add server/models/Petition.js src/types/petition.types.ts
git commit -m "feat(petition): add lab-approval + return-note + redo-explanation fields"
```

---

## Task 2: success gate รอ Lab อนุมัติ (TDD)

**Files:**
- Test: `server/lib/petitionStatusLog.test.js:408-445` (กลุ่ม isPetitionComplete)
- Modify: `server/lib/petitionStatusLog.js:238-244`

- [ ] **Step 1: เขียน/แก้ test ให้ fail ก่อน**

ใน `server/lib/petitionStatusLog.test.js`:

(ก) แก้ test เดิม "lab item — both done → complete" (บรรทัด ~436) ให้ใช้ `labApprovedAt` แทน `labCompletedAt`:
```js
test('isPetitionComplete: lab item — qc done + lab APPROVED → complete', () => {
  assert.strictEqual(
    isPetitionComplete({ items: [{ batchNo: 'B-1' }], qcCompletedAt: 'T', labApprovedAt: 'T' }),
    true,
  );
});
```

(ข) เพิ่ม test ใหม่ (วางต่อท้ายกลุ่ม isPetitionComplete ก่อน null-safe test):
```js
test('isPetitionComplete: lab item — qc done + lab COMPLETED but NOT approved → incomplete', () => {
  assert.strictEqual(
    isPetitionComplete({ items: [{ batchNo: 'B-1' }], qcCompletedAt: 'T', labCompletedAt: 'T' }),
    false,
  );
});
```

- [ ] **Step 2: รัน test ให้เห็น fail**

Run: `node --test server/lib/petitionStatusLog.test.js`
Expected: FAIL — test (ก) และ (ข) ล้ม (ปัจจุบัน labDone ดู labCompletedAt → (ข) ได้ true แทน false)

- [ ] **Step 3: แก้ isPetitionComplete**

ใน `server/lib/petitionStatusLog.js` บรรทัด 242 เปลี่ยน:
```js
  const labDone = !hasLabItem || !!(petition ?? {}).labApprovedAt;
```
(เดิม: `!!(petition ?? {}).labCompletedAt`)

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `node --test server/lib/petitionStatusLog.test.js`
Expected: PASS ทั้งหมด

- [ ] **Step 5: Commit**

```bash
git add server/lib/petitionStatusLog.js server/lib/petitionStatusLog.test.js
git commit -m "feat(petition): success gate now requires Lab approval (labApprovedAt)"
```

---

## Task 3: endpoint lab-approve + lab-reject

**Files:**
- Modify: `server/routes/petitions.js` — แทรกหลังบรรทัด 338 (ปลาย handler `POST /:id/complete`)

- [ ] **Step 1: แทรก 2 endpoint หลัง `POST /:id/complete`**

ใน `server/routes/petitions.js` หลังบรรทัด 338 (`});` ปิด complete) แทรก:
```js
// POST /api/petitions/:id/lab-approve  → หัวหน้า Lab อนุมัติผล Lab. success เกิดเมื่อครบทุก track.
router.post('/:id/lab-approve', async (req, res) => {
  try {
    const actor = req.body?.actor || 'system';
    const doc = await Petition.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: { message: 'ไม่พบคำร้อง' } });
    if (['success', 'approved', 'rejected'].includes(doc.status)) {
      return res.status(409).json({ error: { message: 'คำร้องนี้ผ่านขั้น Lab อนุมัติแล้ว' } });
    }
    if (!doc.labCompletedAt) return badRequest(res, 'ผู้ทดสอบ Lab ยังไม่ได้บันทึกผล');
    if (doc.labApprovedAt) return badRequest(res, 'Lab อนุมัติไปแล้ว');

    const now = new Date();
    doc.labApprovedAt = now;
    doc.labApprovedBy = actor;
    doc.reviewHistory.push({ action: 'lab-approve', reviewedBy: actor, reviewedAt: now });

    const prevStatus = doc.status;
    if (isPetitionComplete(doc)) {
      if (doc.status !== 'success') doc.status = 'success';
      if (!doc.completedAt) doc.completedAt = now;
      await doc.save();
      logAudit(doc, {
        event: 'statusChanged', fromStatus: prevStatus, toStatus: 'success', actor,
        note: 'หัวหน้า Lab อนุมัติ — ครบทุกส่วน รอหัวหน้า QC อนุมัติ', metadata: { side: 'lab' },
      });
    } else {
      await doc.save();
      logAudit(doc, {
        event: 'updated', toStatus: doc.status, actor,
        note: 'หัวหน้า Lab อนุมัติ — รอ QC ตรวจให้ครบ', metadata: { side: 'lab' },
      });
    }
    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

// POST /api/petitions/:id/lab-reject  → หัวหน้า Lab ส่งผล Lab กลับให้ผู้ทดสอบแก้ (ไม่ใช่ reject ทั้งใบ).
router.post('/:id/lab-reject', async (req, res) => {
  try {
    const actor = req.body?.actor || 'system';
    const note = String(req.body?.note || '').trim();
    if (!note) return badRequest(res, 'กรุณาระบุเหตุผลที่ส่งกลับ');
    const doc = await Petition.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: { message: 'ไม่พบคำร้อง' } });
    if (['approved', 'rejected'].includes(doc.status)) {
      return res.status(409).json({ error: { message: 'คำร้องนี้ปิดแล้ว' } });
    }
    if (!doc.labCompletedAt) return badRequest(res, 'ยังไม่มีผล Lab ให้ส่งกลับ');

    doc.labCompletedAt = null;
    doc.labCompletedBy = undefined;
    doc.labApprovedAt = null;
    doc.labApprovedBy = undefined;
    doc.labReturnNote = note;
    doc.reviewHistory.push({ action: 'lab-reject', reviewedBy: actor, reviewedAt: new Date(), note });
    await doc.save();
    logAudit(doc, {
      event: 'updated', toStatus: doc.status, actor,
      note: `หัวหน้า Lab ส่งกลับให้แก้: ${note}`, metadata: { side: 'lab', returnTo: 'lab' },
    });
    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});
```

- [ ] **Step 2: ทดสอบด้วย API จริง (backend ต้องรันอยู่: `cd server && npm run dev`)**

สร้างคำร้องทดสอบหรือใช้ที่มีอยู่ที่ status=inProgress + labCompletedAt set แล้ว lab-approve:
```bash
curl -s -X POST http://localhost:3001/api/petitions/<ID>/lab-approve -H "Content-Type: application/json" -d "{\"actor\":\"test\"}"
```
Expected: JSON petition มี `labApprovedAt` ถูกตั้ง; ถ้า qcCompletedAt มีแล้ว status=`success`, ถ้าไม่มี status คงเป็น `inProgress`

ทดสอบ guard (เรียกซ้ำ):
Expected: `400 {"error":{"message":"Lab อนุมัติไปแล้ว"}}`

ทดสอบ lab-reject:
```bash
curl -s -X POST http://localhost:3001/api/petitions/<ID>/lab-reject -H "Content-Type: application/json" -d "{\"actor\":\"test\",\"note\":\"ค่าผิด\"}"
```
Expected: `labCompletedAt`/`labApprovedAt` = null, `labReturnNote`="ค่าผิด"

- [ ] **Step 3: Commit**

```bash
git add server/routes/petitions.js
git commit -m "feat(petition): add lab-approve / lab-reject endpoints"
```

---

## Task 4: redoExplanation ใน POST /:id/complete

**Files:**
- Modify: `server/routes/petitions.js:301-308` (ภายใน handler complete)

- [ ] **Step 1: แก้บล็อกตั้ง completedAt ให้รองรับ redoExplanation**

ใน `server/routes/petitions.js` แทนที่บล็อกบรรทัด 301-308:
```js
    const now = new Date();
    if (side === 'qc') {
      doc.qcCompletedAt = now;
      doc.qcCompletedBy = actor;
    } else {
      doc.labCompletedAt = now;
      doc.labCompletedBy = actor;
    }
```
ด้วย:
```js
    const now = new Date();
    const redoExplanation = String(req.body?.redoExplanation || '').trim();
    if (side === 'qc') {
      if (doc.qcReturnNote && !redoExplanation) {
        return badRequest(res, 'กรุณาอธิบายว่าทำใหม่อย่างไร (ถูกส่งกลับให้แก้)');
      }
      doc.qcCompletedAt = now;
      doc.qcCompletedBy = actor;
      if (doc.qcReturnNote) { doc.qcRedoExplanation = redoExplanation; doc.qcReturnNote = undefined; }
    } else {
      if (doc.labReturnNote && !redoExplanation) {
        return badRequest(res, 'กรุณาอธิบายว่าทำใหม่อย่างไร (ถูกส่งกลับให้แก้)');
      }
      doc.labCompletedAt = now;
      doc.labCompletedBy = actor;
      if (doc.labReturnNote) { doc.labRedoExplanation = redoExplanation; doc.labReturnNote = undefined; }
    }
```

- [ ] **Step 2: ทดสอบ API**

ใช้คำร้องที่เพิ่ง lab-reject (มี labReturnNote) แล้ว complete side=lab โดยไม่ส่ง redoExplanation:
```bash
curl -s -X POST http://localhost:3001/api/petitions/<ID>/complete -H "Content-Type: application/json" -d "{\"side\":\"lab\",\"actor\":\"t\"}"
```
Expected: `400` ขอ "อธิบายว่าทำใหม่อย่างไร"

ส่งพร้อม redoExplanation:
```bash
curl -s -X POST http://localhost:3001/api/petitions/<ID>/complete -H "Content-Type: application/json" -d "{\"side\":\"lab\",\"actor\":\"t\",\"redoExplanation\":\"คาลิเบรตเครื่องใหม่\"}"
```
Expected: 200, `labRedoExplanation` ตั้งค่า, `labReturnNote` หาย (null/undefined)

- [ ] **Step 3: Commit**

```bash
git add server/routes/petitions.js
git commit -m "feat(petition): require redo explanation on re-complete after return"
```

---

## Task 5: QC reject เลือกปลายทาง 3 แบบ

**Files:**
- Modify: `server/routes/petitions.js:611-637` (บล็อก reject ใน PATCH /:id) + เพิ่ม `delete updates.target;` ใกล้บรรทัด 569

- [ ] **Step 1: กัน target หลุดเข้า generic update**

ใน `server/routes/petitions.js` หลังบรรทัด 569 (`delete updates.revisionOf;`) แทรก:
```js
    delete updates.target;          // routing hint for reject only
```

- [ ] **Step 2: แทนบล็อก reject ทั้งก้อน (บรรทัด 611-637)**

แทนที่บล็อก `if (updates.status === 'rejected') { ... }` ด้วย:
```js
    // Reject transition: success → (requester | lab | qc)
    if (updates.status === 'rejected') {
      if (before.status !== 'success') {
        return res.status(409).json({ error: { message: 'ส่งกลับให้แก้ไขได้เฉพาะคำร้องสถานะ "ทดสอบเสร็จสิ้น"' } });
      }
      const note = String(updates.revisionNote || '').trim();
      if (!note) return badRequest(res, 'กรุณาระบุข้อความที่ต้องการให้แก้ไข');
      const target = ['requester', 'lab', 'qc'].includes(req.body.target) ? req.body.target : 'requester';

      if (target === 'requester') {
        before.status = 'rejected';
        before.rejectedAt = new Date();
        before.reviewHistory.push({ action: 'reject', reviewedBy: actor || 'system', reviewedAt: new Date(), note });
        await before.save();
        logAudit(before, {
          event: 'statusChanged', fromStatus: 'success', toStatus: 'rejected',
          actor: actor || 'system', note: `ส่งกลับให้แก้ไข: ${note}`, metadata: { returnTo: 'requester' },
        });
        return res.json(before);
      }

      // target lab/qc — เด้ง track กลับเป็น inProgress (ไม่ปิดงานทั้งใบ)
      before.status = 'inProgress';
      before.completedAt = null;
      if (target === 'lab') {
        before.labCompletedAt = null;
        before.labCompletedBy = undefined;
        before.labApprovedAt = null;
        before.labApprovedBy = undefined;
        before.labReturnNote = note;
      } else {
        before.qcCompletedAt = null;
        before.qcCompletedBy = undefined;
        before.qcReturnNote = note;
      }
      before.reviewHistory.push({ action: 'reject', reviewedBy: actor || 'system', reviewedAt: new Date(), note });
      await before.save();
      logAudit(before, {
        event: 'statusChanged', fromStatus: 'success', toStatus: 'inProgress',
        actor: actor || 'system',
        note: `หัวหน้า QC ส่งกลับ${target === 'lab' ? 'ฝั่ง Lab' : 'ฝั่ง QC'}: ${note}`,
        metadata: { returnTo: target },
      });
      return res.json(before);
    }
```

- [ ] **Step 3: ทดสอบ API ทั้ง 3 ปลายทาง**

ใช้คำร้อง status=success:
```bash
# requester (เดิม)
curl -s -X PATCH http://localhost:3001/api/petitions/<ID> -H "Content-Type: application/json" -d "{\"status\":\"rejected\",\"actor\":\"t\",\"revisionNote\":\"n\",\"target\":\"requester\"}"
# → status=rejected
# lab
curl -s -X PATCH http://localhost:3001/api/petitions/<ID2> -H "Content-Type: application/json" -d "{\"status\":\"rejected\",\"actor\":\"t\",\"revisionNote\":\"n\",\"target\":\"lab\"}"
# → status=inProgress, labCompletedAt/labApprovedAt=null, labReturnNote="n"
# qc
curl -s -X PATCH http://localhost:3001/api/petitions/<ID3> -H "Content-Type: application/json" -d "{\"status\":\"rejected\",\"actor\":\"t\",\"revisionNote\":\"n\",\"target\":\"qc\"}"
# → status=inProgress, qcCompletedAt=null, qcReturnNote="n"
```
Expected: ตรงตามคอมเมนต์แต่ละบรรทัด

- [ ] **Step 4: Commit**

```bash
git add server/routes/petitions.js
git commit -m "feat(petition): QC reject can route to requester / lab / qc"
```

---

## Task 6: filter awaitingLabApproval ใน GET /petitions

**Files:**
- Modify: `server/routes/petitions.js:52-66` (สร้าง query `q` ใน GET /)

- [ ] **Step 1: เพิ่มเงื่อนไข filter**

ใน `server/routes/petitions.js` หลังบล็อก `if (search) { ... }` (ปิดที่บรรทัด ~66 ก่อน `const [docs, total]`) แทรก:
```js
    if (req.query.awaitingLabApproval === 'true') {
      q.labCompletedAt = { $ne: null };
      q.labApprovedAt = null;
      q.status = 'inProgress';
    }
```

- [ ] **Step 2: ทดสอบ API**

```bash
curl -s "http://localhost:3001/api/petitions?awaitingLabApproval=true&limit=100"
```
Expected: คืนเฉพาะคำร้อง status=inProgress ที่ labCompletedAt มีค่าและ labApprovedAt ว่าง

- [ ] **Step 3: Commit**

```bash
git add server/routes/petitions.js
git commit -m "feat(petition): GET /petitions?awaitingLabApproval=true filter"
```

---

## Task 7: api.ts helpers

**Files:**
- Modify: `src/lib/api.ts:438-452`

- [ ] **Step 1: แก้ completePetitionTrack + rejectPetition + เพิ่ม lab helpers**

ใน `src/lib/api.ts` แทนที่บล็อกบรรทัด 438-452 ด้วย:
```ts
  completePetitionTrack: (
    petitionId: string,
    side: "lab" | "qc",
    actor: string,
    redoExplanation?: string,
  ) =>
    request<import("@/types/petition.types").Petition>(`/petitions/${petitionId}/complete`, {
      method: "POST",
      body: JSON.stringify({ side, actor, redoExplanation }),
    }),
  labApprovePetition: (petitionId: string, actor: string) =>
    request<import("@/types/petition.types").Petition>(`/petitions/${petitionId}/lab-approve`, {
      method: "POST",
      body: JSON.stringify({ actor }),
    }),
  labRejectPetition: (petitionId: string, actor: string, note: string) =>
    request<import("@/types/petition.types").Petition>(`/petitions/${petitionId}/lab-reject`, {
      method: "POST",
      body: JSON.stringify({ actor, note }),
    }),
  approvePetition: (petitionId: string, actor: string) =>
    request<import("@/types/petition.types").Petition>(`/petitions/${petitionId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "approved", actor }),
    }),
  rejectPetition: (
    petitionId: string,
    actor: string,
    revisionNote: string,
    target: "requester" | "lab" | "qc" = "requester",
  ) =>
    request<import("@/types/petition.types").Petition>(`/petitions/${petitionId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "rejected", actor, revisionNote, target }),
    }),
```

- [ ] **Step 2: type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่ (call site เดิมของ completePetitionTrack/rejectPetition ยังถูกต้องเพราะ param ใหม่ optional/มี default)

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(api): lab-approve/lab-reject + redoExplanation + reject target"
```

---

## Task 8: หน้า /lab-approval + route + nav + hook param

**Files:**
- Modify: `src/hooks/usePetition.ts:73-78` (PetitionListParams) + `:104-112` (queryString)
- Create: `src/pages/LabApproval.tsx`
- Modify: `src/App.tsx` (import + route), `src/lib/navItems.ts:38` (nav item)

- [ ] **Step 1: เพิ่ม param awaitingLabApproval ใน hook**

ใน `src/hooks/usePetition.ts` ใน `interface PetitionListParams` (บรรทัด 73-79) เพิ่ม:
```ts
  awaitingLabApproval?: boolean;
```
และใน queryString builder (หลังบรรทัด 110 `if (params.dept) ...`) เพิ่ม:
```ts
    if (params.awaitingLabApproval) sp.set('awaitingLabApproval', 'true');
```

- [ ] **Step 2: สร้าง `src/pages/LabApproval.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/lis/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";
import { usePetitionList } from "@/hooks/usePetition";
import { PETITION_DEPT_LABELS, type Petition } from "@/types/petition.types";
import PageHeader from "@/components/lis/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/lis/DataTable";
import { statusBadge } from "@/lib/statusBadge";

const API_BASE = import.meta.env.BASE_URL + "api";

const LabApproval = () => {
  const navigate = useNavigate();
  const { data, loading } = usePetitionList({ awaitingLabApproval: true, limit: 100 });
  const petitions = data?.items ?? [];
  const [testersMap, setTestersMap] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (petitions.length === 0) {
      setTestersMap({});
      return;
    }
    const ids = petitions.map((p) => p._id);
    let alive = true;
    fetch(`${API_BASE}/qc-results/testers?petitionIds=${encodeURIComponent(ids.join(","))}`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : {}))
      .then((map: Record<string, string[]>) => { if (alive) setTestersMap(map || {}); })
      .catch(() => { if (alive) setTestersMap({}); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petitions.map((p) => p._id).join(",")]);

  const columns: DataTableColumn<Petition>[] = [
    { key: "no", header: "เลขที่คำร้อง", className: "font-semibold text-primary", cell: (p) => p.petitionNo },
    { key: "dept", header: "แผนก", cell: (p) => <Badge variant="blue-soft">{PETITION_DEPT_LABELS[p.dept]}</Badge> },
    { key: "submitter", header: "ผู้นำส่ง", cell: (p) => p.submittedBy?.name ?? "-" },
    {
      key: "testers", header: "ผู้ทดสอบ", className: "max-w-[200px] text-sm text-muted-foreground align-top",
      cell: (p) => {
        const t = testersMap[p._id] ?? [];
        return t.length > 0 ? <div className="flex flex-col gap-0.5">{t.map((n) => <span key={n}>{n}</span>)}</div> : "-";
      },
    },
    { key: "count", header: "จำนวนรายการ", cell: (p) => `${p.items?.length ?? 0} รายการ` },
    { key: "status", header: "สถานะ", cell: (p) => { const b = statusBadge(p.status); return <Badge variant={b.variant}>{b.label}</Badge>; } },
    {
      key: "action", header: "การดำเนินการ", className: "text-right",
      cell: (p) => (
        <Button size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/lab-testing/${p._id}`); }}>
          ตรวจสอบ
        </Button>
      ),
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title={<span className="inline-flex items-center gap-2"><ShieldCheck className="w-6 h-6" />อนุมัติผล Lab</span>}
          description={`ตรวจสอบและอนุมัติผลการทดสอบจาก Lab · ${petitions.length} รายการรออนุมัติ`}
        />
        <DataTable
          columns={columns}
          data={petitions}
          rowKey={(p) => p._id}
          isLoading={loading}
          onRowClick={(p) => navigate(`/lab-testing/${p._id}`)}
          emptyTitle="ไม่มีคำร้องที่รออนุมัติ Lab"
          tableClassName="min-w-[700px]"
        />
      </div>
    </AppLayout>
  );
};

export default LabApproval;
```

- [ ] **Step 3: เพิ่ม route ใน App.tsx**

ใน `src/App.tsx` เพิ่ม import (ใกล้บรรทัด 22 ที่ import QCApproval):
```tsx
import LabApproval from "./pages/LabApproval";
```
และเพิ่ม route (หลังบรรทัด 85 ที่ route `/qc-approval`):
```tsx
              <Route path="/lab-approval" element={<PrivateRoute><LabApproval /></PrivateRoute>} />
```

- [ ] **Step 4: เพิ่ม nav item**

ใน `src/lib/navItems.ts` หลังบรรทัด 38 (`{ icon: ShieldCheck, label: "อนุมัติผล QC", path: "/qc-approval" },`) แทรก:
```ts
  { icon: ShieldCheck, label: "อนุมัติผล Lab", path: "/lab-approval" },
```
(ShieldCheck import อยู่แล้วในไฟล์ — ตรวจว่า import ครบ ถ้ายังไม่มีให้เพิ่ม)

- [ ] **Step 5: type-check + lint**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run lint`
Expected: ไม่มี error ใหม่

- [ ] **Step 6: Commit**

```bash
git add src/hooks/usePetition.ts src/pages/LabApproval.tsx src/App.tsx src/lib/navItems.ts
git commit -m "feat(lab-approval): add /lab-approval queue page + route + nav"
```

---

## Task 9: LabTestingDetailPage — โซน 3 สถานะ + อนุมัติ/ส่งกลับ + redo

**Files:**
- Modify: `src/pages/LabTestingDetailPage.tsx` — imports, state, handlers (ใกล้ 584-622), render zone (977-1009)

- [ ] **Step 1: เพิ่ม imports + state**

ใน `src/pages/LabTestingDetailPage.tsx`:
- เพิ่ม import (ใกล้กลุ่ม import เดิม):
```tsx
import { useCanAccessPath } from '@/hooks/useCanAccessPath';
import { RevisionRequestDialog } from '@/components/petition/RevisionRequestDialog';
```
- เพิ่ม state ใกล้ state เดิม (ที่มี `submitting`):
```tsx
  const [labRejectOpen, setLabRejectOpen] = useState(false);
  const [redoExplanation, setRedoExplanation] = useState('');
  const canApproveLab = useCanAccessPath('/lab-approval');
```

> ตรวจสอบลายเซ็น `useCanAccessPath` ก่อน (อ่าน `src/hooks/useCanAccessPath.ts`) — ถ้ารับ object หรือ signature ต่าง ให้ปรับการเรียกให้ตรง

- [ ] **Step 2: แก้ handleSubmitResult ให้ส่ง redoExplanation + บังคับกรอกเมื่อถูกส่งกลับ**

ใน `handleSubmitResult` (บรรทัด ~591) ก่อน `const ok = await confirm(...)` เพิ่ม:
```tsx
    if (petition.labReturnNote && !redoExplanation.trim()) {
      toast.error('กรุณาอธิบายว่าทำใหม่อย่างไร', { description: 'คำร้องนี้เคยถูกส่งกลับให้แก้ไข' });
      return;
    }
```
และแก้บรรทัดเรียก completePetitionTrack (บรรทัด ~610):
```tsx
      const updated = await api.completePetitionTrack(
        petition._id, 'lab', user?.name ?? 'system', redoExplanation.trim() || undefined,
      );
```

- [ ] **Step 3: เพิ่ม handler อนุมัติ/ส่งกลับ Lab**

หลัง `handleSubmitResult` เพิ่ม:
```tsx
  const handleLabApprove = async () => {
    if (!(await confirm({ title: 'อนุมัติผล Lab', description: 'อนุมัติผลการทดสอบ Lab นี้?' }))) return;
    setSubmitting(true);
    try {
      await api.labApprovePetition(petition._id, user?.name ?? 'system');
      toast.success('อนุมัติผล Lab เรียบร้อย');
      navigate('/lab-approval');
    } catch {
      toast.error('อนุมัติไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLabReject = async (note: string) => {
    setSubmitting(true);
    try {
      await api.labRejectPetition(petition._id, user?.name ?? 'system', note);
      toast.success('ส่งกลับให้แก้ไขแล้ว');
      setLabRejectOpen(false);
      navigate('/lab-approval');
    } catch {
      toast.error('ส่งกลับไม่สำเร็จ');
      throw new Error('reject failed');
    } finally {
      setSubmitting(false);
    }
  };
```

- [ ] **Step 4: แก้ render zone (บรรทัด 977-1009)**

แทนที่บล็อกตั้งแต่ `{/* Action buttons */}` (บรรทัด 977) ถึงปิด `{petition.status === 'success' && (...)}` (บรรทัด 1009) ด้วย:
```tsx
        {/* banner เหตุผลส่งกลับ + ช่องอธิบายทำใหม่ (เฉพาะตอนยังกรอก/แก้อยู่) */}
        {!petition.labCompletedAt && petition.labReturnNote && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 space-y-2">
            <p className="text-sm font-semibold text-orange-700 flex items-center gap-1">
              <RotateCcw className="h-4 w-4" /> ถูกส่งกลับให้แก้ไข
            </p>
            <p className="text-sm text-orange-800">{petition.labReturnNote}</p>
            <label className="block text-xs font-medium text-gray-600 mt-2">อธิบายว่าทำใหม่อย่างไร (จำเป็น)</label>
            <textarea
              value={redoExplanation}
              onChange={(e) => setRedoExplanation(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-1 focus:ring-orange-400"
              placeholder="เช่น คาลิเบรตเครื่องใหม่แล้วทดสอบซ้ำ"
            />
          </div>
        )}

        {/* Action buttons — เฉพาะตอนผู้ทดสอบยังไม่ยืนยัน */}
        {labItems.length > 0 && !petition.labCompletedAt && (
          <div className="fixed bottom-0 left-0 right-0 z-50 md:left-72 px-4 sm:px-6 py-3 bg-white border-t shadow-[0_-4px_20px_rgba(0,0,0,0.08)] flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <Button
              variant={isComplete ? 'primary' : 'outline'}
              onClick={isComplete ? handleSubmitResult : handleSaveDraft}
              disabled={submitting}
              className="gap-2"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : isComplete ? <Send className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {isComplete ? 'บันทึก' : 'บันทึกแบบร่าง'}
            </Button>
          </div>
        )}

        {/* รอหัวหน้า Lab อนุมัติ */}
        {labItems.length > 0 && petition.labCompletedAt && !petition.labApprovedAt && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex flex-col items-center gap-3">
            <div className="flex flex-col items-center gap-1">
              <CheckCircle2 className="h-6 w-6 text-amber-500" />
              <p className="text-sm font-semibold text-amber-700">บันทึกผลแล้ว — รอหัวหน้า Lab อนุมัติ</p>
              {abnormalCount > 0 && (
                <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                  <AlertTriangle className="h-3.5 w-3.5" />คำร้องนี้มีค่าผิดปกติ {abnormalCount} รายการ
                </p>
              )}
            </div>
            {canApproveLab && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setLabRejectOpen(true)} disabled={submitting} className="gap-2">
                  <RotateCcw className="h-4 w-4" /> ส่งกลับให้แก้
                </Button>
                <Button variant="primary" size="sm" onClick={handleLabApprove} disabled={submitting} className="gap-2">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  อนุมัติผล Lab
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Lab อนุมัติแล้ว */}
        {petition.labApprovedAt && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 flex flex-col items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
            <p className="text-sm font-semibold text-green-700">Lab อนุมัติแล้ว</p>
            {petition.labApprovedBy && <p className="text-xs text-gray-500">โดย {petition.labApprovedBy}</p>}
          </div>
        )}

        <RevisionRequestDialog
          open={labRejectOpen}
          onOpenChange={setLabRejectOpen}
          petitionNo={petition.petitionNo}
          submitterName={petition.submittedBy?.name ?? 'ผู้ทดสอบ Lab'}
          onConfirm={handleLabReject}
        />
```

> ตรวจว่า icon `RotateCcw`, `Send`, `Save`, `Loader2`, `AlertTriangle`, `CheckCircle2` ถูก import แล้ว (ดูหัวไฟล์ — ถ้าขาดตัวไหนให้เพิ่มใน import จาก 'lucide-react'). ตรวจ props ของ `RevisionRequestDialog` จากไฟล์จริง (`src/components/petition/RevisionRequestDialog.tsx`) ว่า `onConfirm` รับ `(note: string)` — ถ้าต่างให้ปรับ

- [ ] **Step 5: type-check + lint**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run lint`
Expected: ไม่มี error ใหม่

- [ ] **Step 6: Commit**

```bash
git add src/pages/LabTestingDetailPage.tsx
git commit -m "feat(lab-testing): Lab supervisor approve/reject zone + redo explanation"
```

---

## Task 10: QCTestingDetailPage — ผล Lab อ่านอย่างเดียว + reject 3 ปลายทาง + redo banner

**Files:**
- Modify: `src/pages/QCTestingDetailPage.tsx` — handleReject (807), success zone (1156-1196), RevisionRequestDialog (1215+)

- [ ] **Step 1: ตรวจการแสดง param Lab ปัจจุบันก่อน**

อ่านส่วน render ของ `QCTestingDetailPage.tsx` (รอบการ map `items`/`matchParametersForItem`) เพื่อยืนยันว่า lab-batch items + param ฝั่ง Lab ถูกแสดงอยู่แล้วหรือไม่ (หน้านี้ใช้ `petition.items` ทั้งหมด ไม่ได้กรอง batch). 
- ถ้าหน้าแสดงทุก item/param อยู่แล้ว → "QC เห็นทุก param" เป็นจริงโดยปริยาย; เพิ่มเพียง **ป้ายกำกับ "ผล Lab"** บนการ์ดของ item ที่ `isLabBatchNo(batchNo)` เพื่อให้หัวหน้า QC เห็นชัดว่าอันไหนผล Lab (ใช้ helper `isLabBatchNo` แบบเดียวกับ LabTestingDetailPage: `/[16]$/.test(batchNo)`)
- ถ้าหน้ากรอง lab-batch ออก → เพิ่มการ์ดสรุปผล Lab อ่านอย่างเดียวจาก `savedResults` ที่โหลดแล้ว (ดู Step 2)

บันทึกผลการตรวจไว้ใน commit message ของ task นี้

- [ ] **Step 2: (กรณีต้องเพิ่มการ์ดสรุป) เพิ่ม read-only Lab summary**

ถ้า Step 1 พบว่าผล Lab ไม่แสดง — เพิ่มเหนือโซน success (บรรทัด ~1156) การ์ดสรุปจาก `savedResults` (ตัวแปรที่ตั้งจาก `api.getQCResults`) กรองด้วย lab batch:
```tsx
{(() => {
  const isLabBatchNo = (b?: string | null) => /[16]$/.test(String(b ?? '').trim());
  const labItemSeqs = new Set((petition.items ?? []).filter((it) => isLabBatchNo(it.batchNo)).map((it) => it.seq));
  const labResults = savedResults.filter((r) => labItemSeqs.has(r.itemSeq));
  if (labResults.length === 0) return null;
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-2">
      <p className="text-sm font-semibold text-blue-700">ผลทดสอบ Lab (อ่านอย่างเดียว)</p>
      {labResults.map((r) => (
        <div key={`${r.itemSeq}-${r.parameterId}`} className="text-sm text-gray-700">
          <span className="font-medium">#{r.itemSeq}</span>{' '}
          {Object.entries((r.values ?? {}) as Record<string, unknown>).map(([k, v]) => `${k}: ${String(v)}`).join(' · ')}
        </div>
      ))}
    </div>
  );
})()}
```

- [ ] **Step 3: แสดง redo explanation ที่ผู้ทดสอบกรอก**

เหนือปุ่มอนุมัติในโซน success (บรรทัด ~1156) เพิ่ม:
```tsx
{(petition.labRedoExplanation || petition.qcRedoExplanation) && (
  <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm w-full">
    <p className="font-semibold text-violet-700 mb-1">คำอธิบายการทำใหม่</p>
    {petition.labRedoExplanation && <p className="text-violet-800">Lab: {petition.labRedoExplanation}</p>}
    {petition.qcRedoExplanation && <p className="text-violet-800">QC: {petition.qcRedoExplanation}</p>}
  </div>
)}
```

- [ ] **Step 4: dialog ส่งกลับ — เลือกปลายทาง 3 แบบ**

เพิ่ม state ใกล้ `revisionDialogOpen`:
```tsx
  const [rejectTarget, setRejectTarget] = useState<'requester' | 'lab' | 'qc'>('requester');
```
แก้ `handleReject` (บรรทัด 807) ให้ส่ง target:
```tsx
  const handleReject = async (note: string) => {
    setSubmitting(true);
    try {
      await api.rejectPetition(petition._id, user?.name ?? 'system', note, rejectTarget);
      toast.success('ส่งกลับให้แก้ไขแล้ว');
      setRevisionDialogOpen(false);
      navigate('/qc-approval');
    } catch {
      toast.error('ส่งกลับไม่สำเร็จ');
      throw new Error('reject failed');
    } finally {
      setSubmitting(false);
    }
  };
```
> ตรวจ navigate ปลายทางเดิมของ handleReject ในไฟล์ ถ้าต่างจาก `/qc-approval` ให้คงของเดิมไว้

เพิ่มตัวเลือกปลายทางก่อนเปิด dialog — แทนปุ่ม "ส่งให้แก้ไข" เดิม (บรรทัด ~1174) ด้วยกลุ่มเลือก + ปุ่ม:
```tsx
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500">ส่งกลับไปยัง:</span>
                {([['requester', 'ผู้ส่งคำขอ'], ['lab', 'Lab'], ['qc', 'QC']] as const).map(([val, label]) => (
                  <label key={val} className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" name="rejectTarget" checked={rejectTarget === val} onChange={() => setRejectTarget(val)} />
                    {label}
                  </label>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={() => setRevisionDialogOpen(true)} disabled={submitting} className="gap-2">
                <RotateCcw className="h-4 w-4" /> ส่งให้แก้ไข
              </Button>
            </div>
```
(วางคู่กับปุ่ม "อนุมัติคำร้อง" เดิมในแถวเดียวกัน — ปรับ layout flex ให้พอดี)

- [ ] **Step 5: type-check + lint**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run lint`
Expected: ไม่มี error ใหม่

- [ ] **Step 6: Commit**

```bash
git add src/pages/QCTestingDetailPage.tsx
git commit -m "feat(qc-approval): show Lab results read-only + reject to requester/lab/qc + redo notes"
```

---

## Task 11: Verification เต็มระบบ + seed export

**Files:** ไม่มีไฟล์โค้ดใหม่

- [ ] **Step 1: รัน test backend ทั้งหมด**

Run: `node --test server/lib/petitionStatusLog.test.js`
Expected: PASS ทั้งหมด

- [ ] **Step 2: type-check + lint + unit test frontend**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run lint && npm run test`
Expected: ไม่มี error ใหม่; vitest ผ่าน

- [ ] **Step 3: Manual end-to-end (frontend + backend รันอยู่)**

ไล่ตาม flow:
1. ผู้ทดสอบ Lab กรอกครบ → กด "บันทึก" → คำร้องหายจากหน้าตัวเอง, **เข้าคิว `/lab-approval`** (ยังไม่เข้า `/qc-approval`)
2. เปิด `/lab-approval` ด้วย user ที่มีสิทธิ์ path นี้ → กดเข้า → เห็นปุ่ม "อนุมัติผล Lab"/"ส่งกลับให้แก้"
3. กด "ส่งกลับให้แก้" ใส่เหตุผล → คำร้องกลับไปให้ผู้ทดสอบ Lab, หน้า Lab โชว์ banner เหตุผล + บังคับกรอก "ทำใหม่ยังไง" ก่อนบันทึกซ้ำ
4. อนุมัติ Lab + ผู้ทดสอบ QC กรอกครบ → คำร้องเป็น `success` → **เข้าคิว `/qc-approval`**
5. หน้า QC อนุมัติ → หัวหน้า QC เห็นผล Lab (ป้าย/การ์ด) + param QC ครบ + เห็นคำอธิบายการทำใหม่ (ถ้ามี)
6. ทดสอบ "ส่งให้แก้ไข" ทั้ง 3 ปลายทาง: requester → rejected; lab → กลับ inProgress รอ Lab; qc → กลับ inProgress รอ QC
7. อนุมัติคำร้อง → `approved`

ใช้ DevRoleSwitcher สลับ role/สิทธิ์เพื่อทดสอบการเห็นปุ่มอนุมัติ Lab

- [ ] **Step 4: seed export (schema เปลี่ยน)**

Run: `cd server && npm run seed:export`
แล้ว commit:
```bash
git add server/seed-data
git commit -m "chore(seed): export after lab-approval schema change"
```

---

## Notes สำหรับผู้ทำ
- **อย่าใช้ `--no-verify`** ตอน commit (ให้ hook ทำงานตามปกติ)
- commit ระบุ pathspec เฉพาะไฟล์ที่แก้ (รีโปนี้บางทีมี process อื่น commit แทรกบน develop)
- **อย่ารัน `npm run build`** ระหว่าง dev (ใช้ `npx tsc -p tsconfig.app.json --noEmit` type-check) — ดู CLAUDE.md
- ถ้าจะ deploy: prod ต้อง pull โค้ดใหม่ (auto-sync.ps1 push root files แต่โค้ด feature ต้อง merge develop→main + deploy ตามปกติ)
