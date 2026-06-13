# Show Review Sections by Test Method — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In `LabAgreementReviewDialog`, show only the review section that matches the petition's test method (2.1 standard vs 2.2 custom/previous).

**Architecture:** The dialog gains an optional `testMethod` prop, passed down from `LabApprovalReviewPage` (read from the petition's first LabRequest — all share one method). The dialog computes `isCustom` and wraps its two method-specific `<section>`s in conditionals. The shared summary section stays always visible.

**Tech Stack:** React 18 + TypeScript, shadcn/ui Dialog. Types from `@/types/labRequest.types` (`TestMethod`, `ServiceAgreement.testMethod`, `LabRequest.serviceAgreement`).

**Note on testing:** This is conditional JSX rendering driven by a prop — no extractable pure function. Verification is `tsc` + `lint` + manual E2E per the spec.

---

### Task 1: Gate the dialog sections by `testMethod`

**Files:**
- Modify: `src/components/review/LabAgreementReviewDialog.tsx`
- Modify: `src/pages/LabApprovalReviewPage.tsx`

Do the edits in order. The file compiles cleanly after every step except between Step 5 and Step 7 (the JSX conditionals are added in a matched set Steps 5–7).

- [ ] **Step 1: Import the `TestMethod` type in the dialog**

In `src/components/review/LabAgreementReviewDialog.tsx`, find:
```tsx
import type { LabAgreementReview } from '@/types/labRequest.types';
```
Replace with:
```tsx
import type { LabAgreementReview, TestMethod } from '@/types/labRequest.types';
```

- [ ] **Step 2: Add the `testMethod` prop to the `Props` interface**

Find:
```tsx
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: LabAgreementReview | null;
  onSave: (draft: Draft) => Promise<void>;
}
```
Replace with:
```tsx
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: LabAgreementReview | null;
  onSave: (draft: Draft) => Promise<void>;
  testMethod?: TestMethod | null;
}
```

- [ ] **Step 3: Destructure `testMethod` in the component signature**

Find:
```tsx
export default function LabAgreementReviewDialog({ open, onOpenChange, initial, onSave }: Props) {
```
Replace with:
```tsx
export default function LabAgreementReviewDialog({ open, onOpenChange, initial, onSave, testMethod }: Props) {
```

- [ ] **Step 4: Compute `isCustom`**

Find:
```tsx
  const [d, setD] = useState<Draft>({});
  const [saving, setSaving] = useState(false);
```
Replace with:
```tsx
  const [d, setD] = useState<Draft>({});
  const [saving, setSaving] = useState(false);
  // วิธีเฉพาะตามเอกสารลูกค้า (2.2) ครอบ 'custom' และ 'previous'; อย่างอื่น (รวม undefined) = วิธีปกติ (2.1)
  const isCustom = testMethod === 'custom' || testMethod === 'previous';
```

- [ ] **Step 5: Wrap the standard-method section in `{!isCustom && ( ... )}`**

Find:
```tsx
          {/* กรณีวิธีปกติ */}
          <section className="space-y-2">
            <h3 className="font-semibold underline text-sm">กรณีลูกค้าระบุวิธีทดสอบตามปกติ</h3>
```
Replace with:
```tsx
          {/* กรณีวิธีปกติ — โชว์เมื่อวิธี standard (ไม่ใช่ custom/previous) */}
          {!isCustom && (
          <section className="space-y-2">
            <h3 className="font-semibold underline text-sm">กรณีลูกค้าระบุวิธีทดสอบตามปกติ</h3>
```

- [ ] **Step 6: Close the standard section and open the custom section (the boundary between them)**

Find:
```tsx
          {/* กรณีวิธีเฉพาะ */}
          <section className="space-y-2">
            <h3 className="font-semibold underline text-sm">กรณีลูกค้าระบุวิธีการทดสอบตามเอกสารของลูกค้า</h3>
```
Replace with:
```tsx
          )}

          {/* กรณีวิธีเฉพาะ — โชว์เมื่อวิธี custom/previous */}
          {isCustom && (
          <section className="space-y-2">
            <h3 className="font-semibold underline text-sm">กรณีลูกค้าระบุวิธีการทดสอบตามเอกสารของลูกค้า</h3>
```

Note: the `)}` here closes the `{!isCustom && (` opened in Step 5. The standard section's own `</section>` tag (just above this `{/* กรณีวิธีเฉพาะ */}` comment) is untouched and now sits inside the conditional.

- [ ] **Step 7: Close the custom section before the summary section**

The custom section ends right before the `{/* สรุป */}` comment. Find:
```tsx
          {/* สรุป */}
          <section className="space-y-2 border-t pt-3">
            <p className="font-semibold text-sm">สรุปความพร้อมของงานบริการ</p>
```
Replace with:
```tsx
          )}

          {/* สรุป — โชว์เสมอ ใช้ร่วมทั้งสองวิธี */}
          <section className="space-y-2 border-t pt-3">
            <p className="font-semibold text-sm">สรุปความพร้อมของงานบริการ</p>
```

Note: the `)}` here closes the `{isCustom && (` opened in Step 6. After this step the JSX is balanced again.

- [ ] **Step 8: Pass `testMethod` from the page into the dialog**

In `src/pages/LabApprovalReviewPage.tsx`, find:
```tsx
        <LabAgreementReviewDialog
          open={reviewDialogOpen}
          onOpenChange={handleReviewDialogChange}
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
          testMethod={labRequests?.[0]?.serviceAgreement?.testMethod}
        />
```

(`labRequests` is already in scope — `const { data: labRequests, ... } = useLabRequestsByPetition(id);`. `LabRequest.serviceAgreement: ServiceAgreement` and `ServiceAgreement.testMethod: TestMethod` are confirmed types.)

- [ ] **Step 9: Type-check and lint**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no NEW errors referencing `LabAgreementReviewDialog.tsx` or `LabApprovalReviewPage.tsx`. (Repo has ~3 pre-existing errors in HomeQC.tsx / PetitionPrintTemplate.tsx / api.ts — ignore. Plain `npx tsc --noEmit` is a no-op; must use `-p tsconfig.app.json`.)

Run: `npm run lint`
Expected: no NEW problems for the two changed files. In particular, confirm the JSX is balanced (no "unexpected token" / unterminated-JSX errors) — that proves Steps 5–7 closed correctly.

- [ ] **Step 10: Commit**

```bash
git add src/components/review/LabAgreementReviewDialog.tsx src/pages/LabApprovalReviewPage.tsx
git commit -m "feat(lab-approval): show review section matching the test method

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Manual E2E verification

**Files:** none.

Against a running dev server with petitions in the `/lab-approval` queue (use DevRoleSwitcher for a `/lab-approval` role):

- [ ] **Step 1: Standard method shows only the standard section**

Open `/lab-approval/:id` for a petition whose test method is **2.1 วิธีปกติ** (`standard`). Click อนุมัติผล Lab (or กรอกการทบทวน).
Expected: dialog shows the **"กรณีลูกค้าระบุวิธีทดสอบตามปกติ"** section + the **"สรุปความพร้อมของงานบริการ"** section. The **"กรณีลูกค้าระบุวิธีการทดสอบตามเอกสารของลูกค้า"** section is NOT shown.

- [ ] **Step 2: Custom method shows only the custom section**

Open a petition whose method is **2.2 วิธีเฉพาะ** (`custom`, or `previous`). Open the review dialog.
Expected: dialog shows the **"กรณีลูกค้าระบุวิธีการทดสอบตามเอกสารของลูกค้า"** section + **สรุป**. The standard section is NOT shown.

- [ ] **Step 3: Save + approve still works for both**

In each case fill the visible section, บันทึกการทบทวน, then confirm อนุมัติ — the approve flow (from the prior feature) still completes and routes back to `/lab-approval`.

---

## Self-Review

**Spec coverage:**
- standard → standard section only: Steps 5–6, Task 2 Step 1 ✓
- custom/previous → custom section only: Steps 6–7, Task 2 Step 2 ✓
- undefined → standard: `isCustom` is false for undefined (Step 4), so `!isCustom` standard section renders ✓
- summary always shown: Step 7 leaves summary outside both conditionals ✓
- prop threaded from page: Step 8 ✓
- print/view untouched: not in any task ✓

**Placeholder scan:** none — every step has concrete find/replace code.

**Type consistency:** `TestMethod` imported (Step 1), used in `Props` (Step 2) and destructure (Step 3); `isCustom` defined (Step 4) before use (Steps 5–7). Prop name `testMethod` consistent across dialog Props and page call site (Step 8). `{!isCustom && (` (Step 5) closed by `)}` (Step 6); `{isCustom && (` (Step 6) closed by `)}` (Step 7) — balanced. ✓
