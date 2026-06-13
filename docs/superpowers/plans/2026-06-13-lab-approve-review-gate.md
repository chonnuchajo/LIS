# Bind Agreement Review Form into Lab Approve Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the "อนุมัติผล Lab" button open the agreement-review form first; only after the review is saved does a confirm dialog appear and approval commit.

**Architecture:** Single-file change in `src/pages/LabApprovalReviewPage.tsx`. Add a `pendingApprove` flag + a `approveAfterSaveRef` ref to distinguish "review dialog opened via Approve" from "via the standalone edit button". The existing `handleApprove` (confirm + approve + navigate) is renamed `runApprove` and is now triggered from the review dialog's close handler after a successful save.

**Tech Stack:** React 18 + TypeScript, shadcn/ui dialogs, `useConfirm`/`releaseBodyPointerLock` from `@/context/ConfirmDialog`.

**Note on testing:** This change is pure dialog-sequencing wiring (Radix dialog → confirm provider → navigate) with no extractable pure function, so there is no meaningful unit test to write first. Per the spec, verification is `tsc` + `lint` + a scripted manual E2E checklist. This is a deliberate deviation from TDD justified by the spec.

---

### Task 1: Rewire the approve flow through the review dialog

**Files:**
- Modify: `src/pages/LabApprovalReviewPage.tsx`

All edits are in this one file. After all steps the file must type-check and lint clean. Make the edits in order; the file only compiles cleanly again after Step 9.

- [ ] **Step 1: Add `useRef` to the React import**

Find (line 1):
```tsx
import { useEffect, useState, useCallback } from "react";
```
Replace with:
```tsx
import { useEffect, useState, useCallback, useRef } from "react";
```

- [ ] **Step 2: Import `releaseBodyPointerLock`**

Find (line 18):
```tsx
import { useConfirm } from "@/context/ConfirmDialog";
```
Replace with:
```tsx
import { useConfirm, releaseBodyPointerLock } from "@/context/ConfirmDialog";
```

- [ ] **Step 3: Add the `pendingApprove` state and `approveAfterSaveRef` ref**

Find (lines 33-34):
```tsx
  const [submitting, setSubmitting] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
```
Replace with:
```tsx
  const [submitting, setSubmitting] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [pendingApprove, setPendingApprove] = useState(false);
  const approveAfterSaveRef = useRef(false);
```

`pendingApprove` = the review dialog was opened by the Approve button (vs. the standalone edit button). `approveAfterSaveRef` = set synchronously on a successful save so the dialog's close handler knows to fire approval.

- [ ] **Step 4: Rename `handleApprove` → `runApprove` and release the pointer lock before confirm**

Find (lines 73-86):
```tsx
  const handleApprove = useCallback(async () => {
    if (!petition) return;
    if (!(await confirm({ title: "อนุมัติผล Lab", description: "อนุมัติผลการทดสอบ Lab นี้?" }))) return;
    setSubmitting(true);
    try {
      await api.labApprovePetition(petition._id, user?.name ?? "system");
      toast.success("อนุมัติผล Lab เรียบร้อย");
      navigate("/lab-approval");
    } catch {
      toast.error("อนุมัติไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }, [petition, user, confirm, navigate]);
```
Replace with:
```tsx
  const runApprove = useCallback(async () => {
    if (!petition) return;
    // review dialog just closed; clear any lingering Radix body lock before stacking confirm
    releaseBodyPointerLock();
    if (!(await confirm({ title: "อนุมัติผล Lab", description: "อนุมัติผลการทดสอบ Lab นี้?" }))) return;
    setSubmitting(true);
    try {
      await api.labApprovePetition(petition._id, user?.name ?? "system");
      toast.success("อนุมัติผล Lab เรียบร้อย");
      navigate("/lab-approval");
    } catch {
      toast.error("อนุมัติไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }, [petition, user, confirm, navigate]);
```

- [ ] **Step 5: Record `approveAfterSaveRef` on a successful review save**

Find (lines 104-114):
```tsx
  const handleSaveReview = useCallback(async (draft) => {
    if (!petition) return;
    try {
      await saveLabAgreementReview(petition._id, draft, user?.name ?? "system");
      toast.success("บันทึกการทบทวนข้อตกลงเรียบร้อย");
      refreshLabRequests();
    } catch {
      toast.error("บันทึกไม่สำเร็จ");
      throw new Error("save review failed");
    }
  }, [petition, user, refreshLabRequests]);
```
Replace with:
```tsx
  const handleSaveReview = useCallback(async (draft) => {
    if (!petition) return;
    try {
      await saveLabAgreementReview(petition._id, draft, user?.name ?? "system");
      toast.success("บันทึกการทบทวนข้อตกลงเรียบร้อย");
      refreshLabRequests();
      // if this dialog was opened by the Approve button, remember to approve after it closes
      approveAfterSaveRef.current = pendingApprove;
    } catch {
      toast.error("บันทึกไม่สำเร็จ");
      throw new Error("save review failed");
    }
  }, [petition, user, refreshLabRequests, pendingApprove]);
```

The dialog calls `onSave` then closes itself, so we record the intent here and run the actual approval from the close handler (Step 6) — this avoids stacking the confirm dialog on top of the still-open review dialog.

- [ ] **Step 6: Add the review-dialog close handler**

Insert immediately after the `handleSaveReview` block (after the line `}, [petition, user, refreshLabRequests, pendingApprove]);`):
```tsx

  const handleReviewDialogChange = useCallback((open: boolean) => {
    setReviewDialogOpen(open);
    if (open) return;
    // dialog is closing — clear the "opened via Approve" flag either way
    setPendingApprove(false);
    if (approveAfterSaveRef.current) {
      approveAfterSaveRef.current = false;
      runApprove();
    }
  }, [runApprove]);
```

Cancel (close without save): `approveAfterSaveRef` stays `false` → no approval. Save success in the approve flow: Step 5 set the ref `true` → `runApprove()` fires after the dialog closes.

- [ ] **Step 7: Point the Approve button at the review dialog**

Find (lines 270-273):
```tsx
              <Button variant="primary" size="sm" onClick={handleApprove} disabled={submitting} className="gap-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                อนุมัติผล Lab
              </Button>
```
Replace with:
```tsx
              <Button
                variant="primary"
                size="sm"
                onClick={() => { setPendingApprove(true); setReviewDialogOpen(true); }}
                disabled={submitting}
                className="gap-2"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                อนุมัติผล Lab
              </Button>
```

- [ ] **Step 8: Make the standalone edit button explicit about NOT being the approve flow**

Find (lines 184-188):
```tsx
                {canApproveLab && (
                  <Button variant="outline" size="sm" onClick={() => setReviewDialogOpen(true)}>
                    {isReviewFilled(currentReview) ? "แก้ไขการทบทวน" : "กรอกการทบทวน"}
                  </Button>
                )}
```
Replace with:
```tsx
                {canApproveLab && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setPendingApprove(false); setReviewDialogOpen(true); }}
                  >
                    {isReviewFilled(currentReview) ? "แก้ไขการทบทวน" : "กรอกการทบทวน"}
                  </Button>
                )}
```

- [ ] **Step 9: Route the dialog's `onOpenChange` through the new handler**

Find (lines 290-295):
```tsx
        <LabAgreementReviewDialog
          open={reviewDialogOpen}
          onOpenChange={setReviewDialogOpen}
          initial={currentReview}
          onSave={handleSaveReview}
        />
```
Replace with:
```tsx
        <LabAgreementReviewDialog
          open={reviewDialogOpen}
          onOpenChange={handleReviewDialogChange}
          initial={currentReview}
          onSave={handleSaveReview}
        />
```

- [ ] **Step 10: Type-check and lint**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no NEW errors referencing `LabApprovalReviewPage.tsx`. (The repo has ~12 pre-existing latent errors per memory `real_typecheck_command`; ignore those. The plain `npx tsc --noEmit` from CLAUDE.md is a no-op — must use `-p tsconfig.app.json`.)

Run: `npm run lint`
Expected: no NEW errors/warnings for `LabApprovalReviewPage.tsx`. In particular, confirm `handleApprove` is no longer referenced anywhere (it was renamed to `runApprove`) — a dangling reference would surface as a TS error in Step 10.

- [ ] **Step 11: Commit**

```bash
git add src/pages/LabApprovalReviewPage.tsx
git commit -m "feat(lab-approval): require agreement review before approving Lab result

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Manual E2E verification

**Files:** none (manual verification only)

No automated test — verify against a running dev server (`npm run dev` + backend on 3001) with a petition sitting in the Lab-approval queue, logged in as a role that has `/lab-approval` access (use DevRoleSwitcher).

- [ ] **Step 1: Approve happy path**

Open `/lab-approval/:id`. Click **อนุมัติผล Lab**.
Expected: the `การทบทวนข้อตกลงการบริการทดสอบ` form dialog opens (pre-filled if a review already existed). Fill it, click **บันทึกการทบทวน**.
Expected: form closes → `อนุมัติผล Lab นี้?` confirm dialog appears → click ยืนยัน → toast `อนุมัติผล Lab เรียบร้อย` → routed back to `/lab-approval`.

- [ ] **Step 2: Cancel the review = no approval**

Click **อนุมัติผล Lab** → when the review form opens, click **ยกเลิก** (or press Esc).
Expected: no confirm dialog, petition NOT approved, still on the page. Verify the page is still interactive — click a nav item / the back button to confirm `body` is not stuck with `pointer-events: none` (the known Radix lock bug).

- [ ] **Step 3: Standalone edit button still saves without approving**

Click the card button **กรอกการทบทวน / แก้ไขการทบทวน**. Fill and **บันทึกการทบทวน**.
Expected: toast `บันทึกการทบทวนข้อตกลงเรียบร้อย`, the review summary card updates, and **NO** confirm dialog appears, petition NOT approved.

- [ ] **Step 4: "ไม่พร้อมรับงาน" does not block approval**

Click **อนุมัติผล Lab** → in the form select **ไม่พร้อมรับงาน** (`acceptable = false`) and fill the reason → **บันทึกการทบทวน** → confirm.
Expected: approval still succeeds (no block).

- [ ] **Step 5: Reject unchanged**

Click **ส่งกลับให้แก้**.
Expected: `RevisionRequestDialog` opens with the reason field, behaves exactly as before.

---

## Self-Review

**Spec coverage:**
- Flow B (review → save → confirm → approve): Task 1 Steps 4-9, Task 2 Step 1 ✓
- Cancel form = no approval: Step 6 (ref stays false), Task 2 Step 2 ✓
- Standalone edit button kept, no approve: Step 8, Task 2 Step 3 ✓
- Reject unchanged: untouched, Task 2 Step 5 ✓
- No block on `acceptable=false`: nothing added to block it, Task 2 Step 4 ✓
- Pointer-lock mitigation: Step 4 `releaseBodyPointerLock()` before confirm, Task 2 Step 2 manual check ✓
- Single file scope: all edits in `LabApprovalReviewPage.tsx` ✓

**Placeholder scan:** none — every step has concrete find/replace code.

**Type/name consistency:** `handleApprove` fully removed and replaced by `runApprove` (Step 4); referenced only in `handleReviewDialogChange` (Step 6). `pendingApprove`/`setPendingApprove`, `approveAfterSaveRef`, `handleReviewDialogChange` defined before use. `useRef` imported (Step 1), `releaseBodyPointerLock` imported (Step 2). Approve button no longer references `handleApprove` (Step 7). ✓
