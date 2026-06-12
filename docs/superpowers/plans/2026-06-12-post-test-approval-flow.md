# Post-Test Approval Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ทำให้ปุ่มตัดสินใจของหัวหน้า QC เปลี่ยนตามผลปกติ/ไม่ปกติ และให้คำร้องที่จบไปรวมในหน้า "ผลวิเคราะห์" เป็นประวัติ

**Architecture:** ต่อยอด flow เดิม (status `approved`/`rejected`/`inProgress` ใช้ต่อ) เพิ่มฟิลด์ `conclusion` + `conclusionNote` บน Petition เพื่อบันทึกผลสรุป 3 แบบ (pass / accepted-oos / returned-to-requester). หน้าอนุมัติ QC (`QCTestingDetailPage` ตอน `status==='success'`) แตกปุ่ม 2 ชุดตาม `abnormalCount` ที่หน้าคำนวณอยู่แล้ว. retest target เพิ่มค่า `both`. หน้า "ผลวิเคราะห์" ใช้ route เดิม `/record-results` (แทนหน้า sample-based เก่าที่เลิกใช้) query คำร้อง terminal.

**Tech Stack:** React 18 + TS + Vite + TanStack Query + shadcn/ui (frontend); Express 4 + Mongoose 8 (backend). Type-check ด้วย `npx tsc -p tsconfig.app.json` (ตัวจริง — `--noEmit` แบบ root เป็น no-op). Lint `npm run lint`.

---

## File Structure

**Backend**
- `server/models/Petition.js` — เพิ่ม `conclusion` + `conclusionNote`
- `server/routes/petitions.js` — PATCH approve รับ `conclusion`; PATCH reject รองรับ target `both` + set conclusion ฝั่ง requester

**Frontend**
- `src/lib/api.ts` — `approvePetition` รับ conclusion/note; `rejectPetition` target รับ `both`
- `src/types/petition.types.ts` — เพิ่ม `conclusion`/`conclusionNote` ใน Petition; type retest target
- `src/pages/QCTestingDetailPage.tsx` — ปุ่ม context-aware + handlers + dialogs (success stage)
- `src/pages/AnalysisResults.tsx` — **สร้างใหม่** หน้าประวัติผลวิเคราะห์
- `src/App.tsx` — route `/record-results` ชี้ `AnalysisResults` แทน `RecordResults`
- `src/pages/RecordResults.tsx` — ลบ (เลิกใช้ ถูกแทนด้วย flow Lab Approval แล้ว)

> **หมายเหตุ deviation จาก spec:** spec ระบุ route ใหม่ `/analysis-results` แต่ nav "ผลวิเคราะห์" + `Home.tsx` + `HomeQC/HomeLab` + permissions อ้าง `/record-results` อยู่แล้ว จึง reuse `/record-results` เพื่อไม่ให้ nav/สิทธิ์ซ้ำ และเก็บกวาดหน้า sample-based เก่าที่เลิกใช้ไปในตัว

---

## Task 1: เพิ่มฟิลด์ conclusion + conclusionNote ใน Petition model

**Files:**
- Modify: `server/models/Petition.js:131` (หลัง `completedAt: Date,`)

- [ ] **Step 1: เพิ่มฟิลด์**

ที่ `server/models/Petition.js` หลังบรรทัด `completedAt: Date,` (บรรทัด 131) แทรก:

```js
    // ผลสรุปสุดท้ายจากหัวหน้า QC (ไว้แสดงในหน้าผลวิเคราะห์)
    //  pass                  = ผลปกติ-ถูกต้อง อนุมัติ
    //  accepted-oos          = ยอมรับผลไม่ปกติเป็นผลจริง (ต้องมีเหตุผล)
    //  returned-to-requester = ส่งคืนผู้ส่งให้แก้ product (ปิดงาน)
    conclusion: {
      type: String,
      enum: ['pass', 'accepted-oos', 'returned-to-requester'],
      default: null,
    },
    conclusionNote: String,
```

- [ ] **Step 2: ตรวจ syntax โหลดได้**

Run: `cd server && node -e "require('./models/Petition'); console.log('ok')"`
Expected: พิมพ์ `ok` ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add server/models/Petition.js
git commit -m "feat(petition): add conclusion + conclusionNote fields"
```

---

## Task 2: PATCH approve รับ conclusion (pass / accepted-oos)

**Files:**
- Modify: `server/routes/petitions.js:673-693` (approve transition)

- [ ] **Step 1: แก้ approve transition**

ที่ `server/routes/petitions.js` แทนที่บล็อก approve (บรรทัด 673-693 เริ่มที่ `if (updates.status === 'approved') {`) ด้วย:

```js
    // Approve transition: success → approved (conclusion = pass | accepted-oos)
    if (updates.status === 'approved') {
      if (before.status !== 'success') {
        return res.status(409).json({ error: { message: 'อนุมัติได้เฉพาะคำร้องสถานะ "ทดสอบเสร็จสิ้น"' } });
      }
      const conclusion = ['pass', 'accepted-oos'].includes(req.body.conclusion)
        ? req.body.conclusion
        : 'pass';
      if (conclusion === 'accepted-oos') {
        const reason = String(req.body.conclusionNote || '').trim();
        if (!reason) return badRequest(res, 'กรุณาระบุเหตุผลที่ยอมรับผลไม่ปกติ');
        before.conclusionNote = reason;
      }
      before.status = 'approved';
      before.conclusion = conclusion;
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
        note: conclusion === 'accepted-oos' ? 'ยอมรับผลไม่ปกติ' : 'อนุมัติคำร้อง (ผลถูกต้อง)',
        metadata: { conclusion },
      });
      return res.json(before);
    }
```

- [ ] **Step 2: ยืนยันว่า `conclusion` ไม่ถูกลบทิ้งก่อนถึง branch นี้**

ตรวจหัว PATCH (บรรทัด 647-655): มีการ `delete updates.xxx` หลายตัว แต่ **ต้องไม่มี** `delete updates.conclusion`. โค้ดอ่านจาก `req.body.conclusion` โดยตรง (ไม่ผ่าน `updates`) จึงปลอดภัยอยู่แล้ว — ไม่ต้องแก้

Run: `cd server && node -e "require('./routes/petitions'); console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add server/routes/petitions.js
git commit -m "feat(petition): approve sets conclusion pass|accepted-oos"
```

---

## Task 3: PATCH reject รองรับ target `both` + set conclusion ฝั่ง requester

**Files:**
- Modify: `server/routes/petitions.js:696-739` (reject transition)

- [ ] **Step 1: แก้ reject transition**

ที่ `server/routes/petitions.js` แทนที่บล็อก reject (บรรทัด 696-739 เริ่มที่ `if (updates.status === 'rejected') {`) ด้วย:

```js
    // Reject transition: success → (requester=ปิดงาน | lab|qc|both=ส่งกลับทดสอบใหม่)
    if (updates.status === 'rejected') {
      if (before.status !== 'success') {
        return res.status(409).json({ error: { message: 'ส่งกลับให้แก้ไขได้เฉพาะคำร้องสถานะ "ทดสอบเสร็จสิ้น"' } });
      }
      const note = String(updates.revisionNote || '').trim();
      if (!note) return badRequest(res, 'กรุณาระบุข้อความที่ต้องการให้แก้ไข');
      const target = ['requester', 'lab', 'qc', 'both'].includes(req.body.target) ? req.body.target : 'requester';

      if (target === 'requester') {
        before.status = 'rejected';
        before.rejectedAt = new Date();
        before.conclusion = 'returned-to-requester';
        before.conclusionNote = note;
        before.reviewHistory.push({ action: 'reject', reviewedBy: actor || 'system', reviewedAt: new Date(), note });
        await before.save();
        logAudit(before, {
          event: 'statusChanged', fromStatus: 'success', toStatus: 'rejected',
          actor: actor || 'system', note: `ส่งคืนผู้ส่งแก้ product: ${note}`, metadata: { returnTo: 'requester', conclusion: 'returned-to-requester' },
        });
        return res.json(before);
      }

      // target lab/qc/both — เด้ง track กลับเป็น inProgress (ไม่ปิดงาน ไม่ตั้ง conclusion)
      before.status = 'inProgress';
      before.completedAt = null;
      if (target === 'lab' || target === 'both') {
        before.labCompletedAt = null;
        before.labCompletedBy = undefined;
        before.labApprovedAt = null;
        before.labApprovedBy = undefined;
        before.labReturnNote = note;
      }
      if (target === 'qc' || target === 'both') {
        before.qcCompletedAt = null;
        before.qcCompletedBy = undefined;
        before.qcReturnNote = note;
      }
      before.reviewHistory.push({ action: 'reject', reviewedBy: actor || 'system', reviewedAt: new Date(), note });
      const targetLabel = target === 'lab' ? 'ฝั่ง Lab' : target === 'qc' ? 'ฝั่ง QC' : 'ทั้ง Lab และ QC';
      await before.save();
      logAudit(before, {
        event: 'statusChanged', fromStatus: 'success', toStatus: 'inProgress',
        actor: actor || 'system',
        note: `หัวหน้า QC ส่งกลับ${targetLabel}ทดสอบใหม่: ${note}`,
        metadata: { returnTo: target },
      });
      return res.json(before);
    }
```

- [ ] **Step 2: ตรวจ syntax**

Run: `cd server && node -e "require('./routes/petitions'); console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add server/routes/petitions.js
git commit -m "feat(petition): reject supports target=both + conclusion on requester return"
```

---

## Task 4: อัปเดต api.ts (approvePetition / rejectPetition)

**Files:**
- Modify: `src/lib/api.ts:458-472`

- [ ] **Step 1: แก้ signatures**

ที่ `src/lib/api.ts` แทนที่ `approvePetition` + `rejectPetition` (บรรทัด 458-472) ด้วย:

```ts
  approvePetition: (
    petitionId: string,
    actor: string,
    conclusion: "pass" | "accepted-oos" = "pass",
    conclusionNote?: string,
  ) =>
    request<import("@/types/petition.types").Petition>(`/petitions/${petitionId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "approved", actor, conclusion, conclusionNote }),
    }),
  rejectPetition: (
    petitionId: string,
    actor: string,
    revisionNote: string,
    target: "requester" | "lab" | "qc" | "both" = "requester",
  ) =>
    request<import("@/types/petition.types").Petition>(`/petitions/${petitionId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "rejected", actor, revisionNote, target }),
    }),
```

- [ ] **Step 2: Commit** (จะ type-check รวมตอน Task 6)

```bash
git add src/lib/api.ts
git commit -m "feat(api): approvePetition conclusion + rejectPetition target both"
```

---

## Task 5: เพิ่ม type conclusion ใน petition.types.ts

**Files:**
- Modify: `src/types/petition.types.ts:213` (หลัง `completedAt`)

- [ ] **Step 1: เพิ่มฟิลด์ใน Petition interface**

ที่ `src/types/petition.types.ts` หลังบรรทัด `completedAt?: string | null;` (บรรทัด 213) แทรก:

```ts
  conclusion?: "pass" | "accepted-oos" | "returned-to-requester" | null;
  conclusionNote?: string;
```

- [ ] **Step 2: Commit**

```bash
git add src/types/petition.types.ts
git commit -m "feat(types): add conclusion fields to Petition"
```

---

## Task 6: ปุ่ม context-aware + handlers + dialogs ใน QCTestingDetailPage

**Files:**
- Modify: `src/pages/QCTestingDetailPage.tsx` — state (325), handlers (794-823), success-stage UI (1166-1224), dialog block (1243-1259)

- [ ] **Step 1: เปลี่ยน state retest target + dialogs**

ที่บรรทัด 324-325 แทนที่ (ลบ `revisionDialogOpen` เดิมที่จะไม่ถูกใช้แล้ว + `rejectTarget`):

```tsx
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<'requester' | 'lab' | 'qc'>('requester');
```

ด้วย:

```tsx
  const [retestTarget, setRetestTarget] = useState<'lab' | 'qc' | 'both'>('lab');
  const [retestDialogOpen, setRetestDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [acceptReasonDialogOpen, setAcceptReasonDialogOpen] = useState(false);
```

> หลังแก้ ตรวจว่าไม่เหลือ reference ของ `revisionDialogOpen` / `setRevisionDialogOpen` / `rejectTarget` / `setRejectTarget` ในไฟล์ (ทั้งหมดอยู่ในบล็อกที่ Step 2-4 แทนที่) — Run: `grep -n "revisionDialogOpen\|rejectTarget" src/pages/QCTestingDetailPage.tsx` → Expected: ไม่มีผลลัพธ์

- [ ] **Step 2: แทนที่ handlers approve/reject**

แทนที่ `handleApprove` + `handleReject` (บรรทัด 794-823) ด้วย:

```tsx
  const doApprove = async (conclusion: 'pass' | 'accepted-oos', note?: string) => {
    setSubmitting(true);
    try {
      await api.approvePetition(petition._id, user?.name ?? 'system', conclusion, note);
      toast.success(conclusion === 'accepted-oos' ? 'ยอมรับผลเรียบร้อย' : 'อนุมัติเรียบร้อย');
      navigate('/qc-approval');
    } catch {
      toast.error('ดำเนินการไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprovePass = async () => {
    if (!(await confirm({ title: 'ผลถูกต้อง', description: 'ยืนยันว่าผลถูกต้องและอนุมัติคำร้องนี้?' }))) return;
    await doApprove('pass');
  };

  const handleAcceptOos = async (note: string) => {
    setAcceptReasonDialogOpen(false);
    await doApprove('accepted-oos', note);
  };

  const handleRetest = async (note: string) => {
    setSubmitting(true);
    try {
      await api.rejectPetition(petition._id, user?.name ?? 'system', note, retestTarget);
      const label = retestTarget === 'lab' ? 'Lab' : retestTarget === 'qc' ? 'QC' : 'Lab และ QC';
      toast.success(`ส่งกลับให้ ${label} ทดสอบใหม่เรียบร้อย`);
      setRetestDialogOpen(false);
      navigate('/qc-approval');
    } catch {
      toast.error('ส่งกลับไม่สำเร็จ');
      throw new Error('retest failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturnToRequester = async (note: string) => {
    setSubmitting(true);
    try {
      await api.rejectPetition(petition._id, user?.name ?? 'system', note, 'requester');
      toast.success('ส่งคืนผู้ส่งให้แก้ product เรียบร้อย', {
        description: `ส่งให้ ${petition.submittedBy?.name ?? 'ผู้ยื่น'}`,
      });
      setReturnDialogOpen(false);
      navigate('/qc-approval');
    } catch {
      toast.error('ส่งคืนไม่สำเร็จ');
      throw new Error('return failed');
    } finally {
      setSubmitting(false);
    }
  };
```

- [ ] **Step 3: แทนที่ success-stage UI block**

แทนที่บล็อก `{petition.status === 'success' && ( ... )}` (บรรทัด 1166-1224) ด้วย:

```tsx
      {petition.status === 'success' && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 flex flex-col items-center gap-3">
          <div className="flex flex-col items-center gap-1">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
            <p className="text-sm font-semibold text-green-700">บันทึกผลแล้ว — รอหัวหน้า QC ตัดสิน</p>
            <p className="text-xs text-grey-500">
              {qcReceivedBy(petition)
                ? `ผู้รับงาน: ${qcReceivedBy(petition)}`
                : 'ไม่ระบุผู้รับงาน'}
            </p>
            {abnormalCount > 0 ? (
              <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                คำร้องนี้มีค่าผิดปกติ {abnormalCount} รายการ
              </p>
            ) : (
              <p className="text-xs text-green-600 mt-1">ผลปกติทุกรายการ</p>
            )}
          </div>
          {(petition.labRedoExplanation || petition.qcRedoExplanation) && (
            <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm w-full">
              <p className="font-semibold text-violet-700 mb-1">คำอธิบายการทำใหม่</p>
              {petition.labRedoExplanation && <p className="text-violet-800">Lab: {petition.labRedoExplanation}</p>}
              {petition.qcRedoExplanation && <p className="text-violet-800">QC: {petition.qcRedoExplanation}</p>}
            </div>
          )}

          {/* เลือกปลายทางทดสอบใหม่ (ใช้ทั้งกรณีปกติ "ผลไม่ถูกต้อง" และไม่ปกติ "ทดสอบใหม่") */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500">ถ้าให้ทดสอบใหม่ ส่งกลับไปยัง:</span>
            {([['lab', 'Lab'], ['qc', 'QC'], ['both', 'ทั้งคู่']] as const).map(([val, label]) => (
              <label key={val} className="flex items-center gap-1 cursor-pointer">
                <input type="radio" name="retestTarget" checked={retestTarget === val} onChange={() => setRetestTarget(val)} />
                {label}
              </label>
            ))}
          </div>

          {abnormalCount === 0 ? (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button variant="primary" size="sm" onClick={handleApprovePass} disabled={submitting} className="gap-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                ผลถูกต้อง
              </Button>
              <Button variant="outline" size="sm" onClick={() => setRetestDialogOpen(true)} disabled={submitting} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                ผลไม่ถูกต้อง
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button variant="primary" size="sm" onClick={() => setAcceptReasonDialogOpen(true)} disabled={submitting} className="gap-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                ยอมรับผล
              </Button>
              <Button variant="outline" size="sm" onClick={() => setReturnDialogOpen(true)} disabled={submitting} className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50">
                <RotateCcw className="h-4 w-4" />
                ส่งคืนผู้ส่งแก้ product
              </Button>
              <Button variant="outline" size="sm" onClick={() => setRetestDialogOpen(true)} disabled={submitting} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                ทดสอบใหม่
              </Button>
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 4: แทนที่ dialog block**

แทนที่ `<RevisionRequestDialog ... />` (บรรทัด 1243-1259) ด้วย 3 dialogs:

```tsx
      {/* ทดสอบใหม่ (Lab/QC/ทั้งคู่) */}
      <RevisionRequestDialog
        open={retestDialogOpen}
        onOpenChange={setRetestDialogOpen}
        petitionNo={petition.petitionNo}
        submitterName={petition.submittedBy?.name ?? 'ผู้ยื่น'}
        recipientLabel={retestTarget === 'lab' ? 'ผู้ทดสอบ Lab' : retestTarget === 'qc' ? 'ผู้ทดสอบ QC' : 'ผู้ทดสอบ Lab และ QC'}
        warning={`คำร้องจะถูกส่งกลับให้${retestTarget === 'both' ? 'ทั้ง Lab และ QC' : retestTarget === 'lab' ? 'Lab' : 'QC'}ทดสอบใหม่ (ไม่ปิดคำร้อง ไม่เกี่ยวกับผู้ส่ง)`}
        onConfirm={handleRetest}
      />

      {/* ส่งคืนผู้ส่งแก้ product */}
      <RevisionRequestDialog
        open={returnDialogOpen}
        onOpenChange={setReturnDialogOpen}
        petitionNo={petition.petitionNo}
        submitterName={petition.submittedBy?.name ?? 'ผู้ยื่น'}
        recipientLabel={petition.submittedBy?.name ?? 'ผู้ยื่น'}
        warning="คำร้องจะถูกปิดและส่งคืนผู้ส่งให้แก้ไข product ตามคำแนะนำ"
        onConfirm={handleReturnToRequester}
      />

      {/* ยอมรับผลไม่ปกติ (ต้องมีเหตุผล) */}
      <RevisionRequestDialog
        open={acceptReasonDialogOpen}
        onOpenChange={setAcceptReasonDialogOpen}
        petitionNo={petition.petitionNo}
        submitterName={petition.submittedBy?.name ?? 'ผู้ยื่น'}
        recipientLabel="ยอมรับผลไม่ปกติ"
        warning="คำร้องจะถูกอนุมัติโดยบันทึกผลไม่ปกติเป็นผลจริง — โปรดระบุเหตุผล"
        onConfirm={handleAcceptOos}
      />
```

- [ ] **Step 5: ตรวจว่า `RevisionRequestDialog` รับ props เหล่านี้ได้**

อ่าน component เพื่อยืนยัน prop names (`open`, `onOpenChange`, `petitionNo`, `submitterName`, `recipientLabel`, `warning`, `onConfirm`) ตรงกับของเดิมที่เคยใช้ — ใช้ชุด props เดียวกับการเรียกเดิม (บรรทัด 1243-1259 ก่อนแก้) จึงตรงอยู่แล้ว. `onConfirm` ต้องเป็น `(note: string) => Promise<void> | void`

Run: `grep -n "onConfirm\|recipientLabel\|warning" src/components/**/RevisionRequestDialog*.tsx` (หา path จริงด้วย Glob ถ้าไม่เจอ)

- [ ] **Step 6: Type-check + lint**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่จากไฟล์ที่แก้ (QCTestingDetailPage.tsx, api.ts, petition.types.ts). repo มี ~12 latent error เดิม — ต้องไม่เพิ่มจากไฟล์เหล่านี้

Run: `npm run lint`
Expected: ไม่มี error ใหม่

- [ ] **Step 7: Commit**

```bash
git add src/pages/QCTestingDetailPage.tsx
git commit -m "feat(qc-approval): context-aware decision buttons by normal/abnormal"
```

---

## Task 7: สร้างหน้า AnalysisResults (ผลวิเคราะห์ — ประวัติ)

**Files:**
- Create: `src/pages/AnalysisResults.tsx`
- Modify: `src/App.tsx:17,88`
- Delete: `src/pages/RecordResults.tsx`

- [ ] **Step 1: ดู QCApproval.tsx เป็นแม่แบบ layout/table**

อ่าน `src/pages/QCApproval.tsx` ทั้งไฟล์ เพื่อ copy โครง AppLayout + table + `usePetitionList` hook + การ format. ใช้เป็นฐานของหน้าใหม่ (กรอง status + แสดง badge conclusion)

- [ ] **Step 2: สร้าง src/pages/AnalysisResults.tsx**

```tsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { usePetitionList } from "@/hooks/usePetitions";
import type { Petition } from "@/types/petition.types";

type ConclusionKey = "pass" | "accepted-oos" | "returned-to-requester";

// คำร้องเก่าก่อนมีฟิลด์ conclusion → เดาจาก status
function resolveConclusion(p: Petition): ConclusionKey {
  if (p.conclusion) return p.conclusion as ConclusionKey;
  return p.status === "rejected" ? "returned-to-requester" : "pass";
}

const CONCLUSION_META: Record<ConclusionKey, { label: string; cls: string }> = {
  "pass": { label: "ผ่าน", cls: "bg-green-100 text-green-700 border-green-200" },
  "accepted-oos": { label: "ยอมรับผลไม่ปกติ", cls: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  "returned-to-requester": { label: "ส่งคืนผู้ส่ง", cls: "bg-orange-100 text-orange-700 border-orange-200" },
};

export default function AnalysisResults() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | ConclusionKey>("all");

  // คำร้องที่ปิดงานแล้ว (approved = ผ่าน/ยอมรับ, rejected = ส่งคืนผู้ส่ง)
  const { data, loading } = usePetitionList({ status: "approved,rejected", limit: 100 });

  const rows = useMemo(() => {
    const items = (data?.items ?? []) as Petition[];
    return items
      .map((p) => ({ p, conclusion: resolveConclusion(p) }))
      .filter((r) => (filter === "all" ? true : r.conclusion === filter))
      .filter((r) =>
        search.trim()
          ? `${r.p.petitionNo} ${r.p.submittedBy?.name ?? ""}`.toLowerCase().includes(search.trim().toLowerCase())
          : true,
      );
  }, [data, filter, search]);

  return (
    <AppLayout>
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-lis-text">ผลวิเคราะห์</h1>
          <p className="text-sm text-gray-500">ประวัติคำร้องที่ผ่านการตัดสินจากหัวหน้า QC แล้ว</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาเลขคำร้อง / ผู้ส่ง"
            className="rounded-md border px-3 py-1.5 text-sm"
          />
          {(["all", "pass", "accepted-oos", "returned-to-requester"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`rounded-full border px-3 py-1 text-xs ${filter === k ? "bg-lis-sidebar text-white" : "bg-white text-gray-600"}`}
            >
              {k === "all" ? "ทั้งหมด" : CONCLUSION_META[k].label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2">เลขคำร้อง</th>
                <th className="px-3 py-2">แผนก</th>
                <th className="px-3 py-2">ผู้ส่ง</th>
                <th className="px-3 py-2">วันที่จบ</th>
                <th className="px-3 py-2">ผลสรุป</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">กำลังโหลด…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">ยังไม่มีประวัติ</td></tr>
              )}
              {rows.map(({ p, conclusion }) => {
                const meta = CONCLUSION_META[conclusion];
                const doneAt = p.approvedAt || p.rejectedAt || p.completedAt;
                return (
                  <tr
                    key={p._id}
                    onClick={() => navigate(`/petitions/${p._id}`)}
                    className="cursor-pointer border-t hover:bg-gray-50"
                  >
                    <td className="px-3 py-2 font-medium">{p.petitionNo}</td>
                    <td className="px-3 py-2">{p.dept}</td>
                    <td className="px-3 py-2">{p.submittedBy?.name ?? "-"}</td>
                    <td className="px-3 py-2">{doneAt ? new Date(doneAt).toLocaleDateString("th-TH") : "-"}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded-full border px-2 py-0.5 text-xs ${meta.cls}`}>{meta.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
```

- [ ] **Step 3: ยืนยัน import paths จริง**

ตรวจว่า import ตรงกับ repo:
- `usePetitionList` มาจาก hook จริง — Run: `grep -rn "export.*usePetitionList\|export function usePetitionList\|export const usePetitionList" src/hooks`
- `AppLayout` — Run: `grep -rn "export.*AppLayout" src/components/layout`
- ถ้า path/ชื่อ export ต่าง ให้แก้ import ใน AnalysisResults.tsx ให้ตรง (อย่าเดา — เทียบกับที่ `QCApproval.tsx` import จริง)

- [ ] **Step 4: สลับ route ใน App.tsx**

ที่ `src/App.tsx`:
- บรรทัด 17 เปลี่ยน `import RecordResults from "./pages/RecordResults";` → `import AnalysisResults from "./pages/AnalysisResults";`
- บรรทัด 88 เปลี่ยน `element={<PrivateRoute><RecordResults /></PrivateRoute>}` → `element={<PrivateRoute><AnalysisResults /></PrivateRoute>}`

- [ ] **Step 5: ลบหน้าเก่า**

Run: `git rm src/pages/RecordResults.tsx`

ยืนยันไม่มี import ค้าง: Run: `grep -rn "RecordResults" src` → Expected: ไม่มีผลลัพธ์

- [ ] **Step 6: Type-check + lint**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่

Run: `npm run lint`
Expected: ไม่มี error ใหม่

- [ ] **Step 7: Commit**

```bash
git add src/pages/AnalysisResults.tsx src/App.tsx
git commit -m "feat(analysis-results): petition history page, replace old RecordResults"
```

---

## Task 8: Manual E2E verification (dev)

> Backend route logic ใน Express ไม่มี unit test ในรีโปนี้ (ทีมใช้ manual E2E — ดู memory lab-approval). ตรวจด้วยมือบน dev (`npm run dev` + `cd server && npm run dev`), ใช้ DevRoleSwitcher สลับเป็นหัวหน้า QC

- [ ] **Step 1: เตรียมคำร้องผลปกติถึง success**

ผ่าน flow: assign → รับงาน → Lab บันทึกผล (ค่าปกติ) → หัวหน้า Lab อนุมัติ → QC บันทึกผล (ค่าปกติ) → เปิด `/qc-testing/:id`
Expected: เห็น 2 ปุ่ม **ผลถูกต้อง** / **ผลไม่ถูกต้อง** + ข้อความ "ผลปกติทุกรายการ"

- [ ] **Step 2: ทดสอบ "ผลถูกต้อง"**

กด ผลถูกต้อง → ยืนยัน
Expected: toast "อนุมัติเรียบร้อย", เด้งไป `/qc-approval`. ตรวจ DB/หน้า ผลวิเคราะห์: คำร้องขึ้น badge "ผ่าน" (conclusion=pass, status=approved)

- [ ] **Step 3: ทดสอบ "ผลไม่ถูกต้อง" → ทั้งคู่**

อีกคำร้องผลปกติ → เลือก retest target "ทั้งคู่" → กด ผลไม่ถูกต้อง → กรอกหมายเหตุ → ยืนยัน
Expected: status กลับเป็น `inProgress`, `labCompletedAt`/`labApprovedAt`/`qcCompletedAt` ถูกล้างทั้งหมด, ไม่อยู่ในหน้าผลวิเคราะห์

- [ ] **Step 4: เตรียมคำร้องผลไม่ปกติถึง success**

ทำ flow เดิมแต่กรอกค่าผิดปกติอย่างน้อย 1 ช่อง → เปิด `/qc-testing/:id` ตอน success
Expected: เห็น 3 ปุ่ม **ยอมรับผล** / **ส่งคืนผู้ส่งแก้ product** / **ทดสอบใหม่** + เตือน "มีค่าผิดปกติ N รายการ"

- [ ] **Step 5: ทดสอบ "ยอมรับผล"**

กด ยอมรับผล → กรอกเหตุผล → ยืนยัน
Expected: status=approved, conclusion=accepted-oos, conclusionNote บันทึก. หน้าผลวิเคราะห์ขึ้น badge "ยอมรับผลไม่ปกติ"
ลองกดยอมรับแบบไม่กรอกเหตุผล → backend ตอบ 400 "กรุณาระบุเหตุผลที่ยอมรับผลไม่ปกติ"

- [ ] **Step 6: ทดสอบ "ส่งคืนผู้ส่งแก้ product"**

อีกคำร้องไม่ปกติ → กด ส่งคืนผู้ส่ง → กรอกคำแนะนำ → ยืนยัน
Expected: status=rejected, conclusion=returned-to-requester, conclusionNote บันทึก. หน้าผลวิเคราะห์ขึ้น badge "ส่งคืนผู้ส่ง"

- [ ] **Step 7: ตรวจหน้าผลวิเคราะห์รวม**

เปิด `/record-results` (เมนู "ผลวิเคราะห์")
Expected: เห็นทั้ง 3 ประเภทผลสรุป, filter chip ทำงาน, ค้นหาทำงาน, คลิกแถวไป petition detail

- [ ] **Step 8: seed:export (backup ข้อมูล/สคีมาใหม่)**

> ฟิลด์ใหม่เป็น schema-only ไม่ต้อง migrate ข้อมูลเก่า (UI เดาผลสรุปจาก status). แต่ถ้ามีการกรอกข้อมูลทดสอบบน dev ที่อยากเก็บ ให้รัน:

Run: `cd server && npm run seed:export`
แล้ว commit `server/seed-data/` ถ้ามีการเปลี่ยนแปลงที่ตั้งใจเก็บ

---

## Permissions note

`/record-results` มีสิทธิ์อยู่แล้ว (Home/HomeQC/HomeLab อ้าง `canAccess("/record-results")`) — หน้าใหม่ใช้ path เดิมจึงได้สิทธิ์เดิมต่อ ไม่ต้องเพิ่ม path ใน access control. ตรวจว่า role หัวหน้า QC เห็นเมนู "ผลวิเคราะห์" (ถ้าไม่เห็น = เพิ่ม `/record-results` ในกลุ่มสิทธิ์ของ role นั้นผ่านหน้า Access Control)

---

## Self-Review Notes

- **Spec coverage:** ฟิลด์ conclusion/conclusionNote (Task 1,5) ✓; retest both (Task 3,6) ✓; approve/return/retest set conclusion (Task 2,3) ✓; ปุ่ม context-aware (Task 6) ✓; dialog เลือก Lab/QC/ทั้งคู่ (Task 6) ✓; หน้า ผลวิเคราะห์ + nav + สิทธิ์ (Task 7 + permissions note) ✓
- **Abnormal detection (spec task #4):** ใช้ `abnormalCount` ที่ `QCTestingDetailPage` คำนวณอยู่แล้ว (วนทุก param ที่ match ต่อ item ตอน success หัวหน้า QC เห็นทุก param). **ต้องยืนยันตอน Step ใน Task 6** ว่าตอน status=success หน้านี้ load param ครบทั้ง Lab+QC — ถ้าหน้าไม่รวม param ฝั่ง Lab จะต้องเสริม (ดู `matchParametersForItem`). บันทึกความเสี่ยงนี้ไว้
- **Type consistency:** `conclusion` enum ตรงกันทั้ง model/types/api ('pass'|'accepted-oos'|'returned-to-requester'); retest target ('lab'|'qc'|'both') ตรงทั้ง state/api/backend
