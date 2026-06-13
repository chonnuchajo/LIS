# Lab Agreement Review (สำหรับหัวหน้าห้องปฏิบัติการ) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the lab supervisor fill the "สำหรับหัวหน้าห้องปฏิบัติการ" half of the FM-QP-07-01-001 service-agreement-review form at the `/lab-approval` step; persist it once per petition (fanned out to every LabRequest) and render it in the print template.

**Architecture:** Expand `LabRequest.labAgreementReview` to the full paper form. A new non-blocking card on `LabApprovalReviewPage` opens a dialog editor; saving POSTs to a new `/petitions/:id/lab-agreement-review` endpoint that writes the same review to all LabRequests of the petition. Print and the read-only view are wired to the expanded fields.

**Tech Stack:** React 18 + TypeScript + Vite + shadcn/ui + Vitest (frontend); Express 4 + Mongoose 8 (backend).

Spec: `docs/superpowers/specs/2026-06-13-lab-agreement-review-design.md`

---

### Task 1: Expand the `LabAgreementReview` type

**Files:**
- Modify: `src/types/labRequest.types.ts:16-24`

- [ ] **Step 1: Replace the `LabAgreementReview` interface**

Replace the existing block (lines 16-24, the old 4-boolean interface) with the enums + full interface:

```ts
export type PersonnelCapability = 'able' | 'unable';
export type PersonnelAbleReason = 'trained' | 'assigned';
export type PersonnelUnableReason = 'neverDone' | 'notTrained' | 'notAssigned';
export type Workload = 'normal' | 'slower' | 'cannot';
export type SubcontractorChoice = 'none' | 'used';
export type EquipmentReadiness = 'ready' | 'notReady';
export type EquipmentReadyReason = 'hasInstrument' | 'calibrated';
export type EquipmentNotReadyReason = 'noInstrument' | 'notCalibrated' | 'outOfRange' | 'broken';

export interface LabAgreementReview {
  reviewedAt: string;
  reviewedBy: string;
  // กรณีวิธีปกติ (standard)
  personnel?: PersonnelCapability;
  personnelAbleReasons?: PersonnelAbleReason[];
  personnelUnableReasons?: PersonnelUnableReason[];
  workload?: Workload;
  subcontractor?: SubcontractorChoice;
  subcontractorName?: string;
  // กรณีวิธีเฉพาะตามเอกสารลูกค้า (custom)
  methodSuitable?: boolean;
  methodSuitableReason?: string;
  equipmentName?: string;
  equipment?: EquipmentReadiness;
  equipmentReadyReasons?: EquipmentReadyReason[];
  equipmentNotReadyReasons?: EquipmentNotReadyReason[];
  // สรุป (ทั้งสองกรณี)
  acceptable?: boolean;
  notAcceptableReason?: string;
  remark?: string;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no NEW errors referencing `labRequest.types.ts`/`LabAgreementReview`. (`LabAgreementReviewView.tsx` will still error because it imports the type from the wrong module — fixed in Task 8. Repo has ~12 pre-existing latent errors; ignore those.)

- [ ] **Step 3: Commit**

```bash
git add src/types/labRequest.types.ts
git commit -m "feat(lab-agreement): expand LabAgreementReview type to full form"
```

---

### Task 2: Shared labels + `isReviewFilled` helper (TDD)

**Files:**
- Create: `src/lib/labAgreementReview.ts`
- Test: `src/lib/labAgreementReview.test.ts`

DRY anchor: Thai labels for every enum, reused by the dialog, the read-only view, and (where helpful) the print template, plus a helper to tell whether a review has been filled.

- [ ] **Step 1: Write the failing test**

Create `src/lib/labAgreementReview.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  isReviewFilled,
  WORKLOAD_LABELS,
  PERSONNEL_ABLE_REASON_LABELS,
  EQUIP_NOT_READY_REASON_LABELS,
} from './labAgreementReview';
import type { LabAgreementReview } from '@/types/labRequest.types';

describe('isReviewFilled', () => {
  it('is false for null/undefined', () => {
    expect(isReviewFilled(undefined)).toBe(false);
    expect(isReviewFilled(null)).toBe(false);
  });

  it('is false when reviewedBy or reviewedAt missing', () => {
    expect(isReviewFilled({ reviewedBy: '', reviewedAt: '' } as LabAgreementReview)).toBe(false);
    expect(isReviewFilled({ reviewedBy: 'somchai', reviewedAt: '' } as LabAgreementReview)).toBe(false);
  });

  it('is true when both reviewedBy and reviewedAt present', () => {
    expect(
      isReviewFilled({ reviewedBy: 'somchai', reviewedAt: '2026-06-13T00:00:00Z' } as LabAgreementReview),
    ).toBe(true);
  });
});

describe('label maps', () => {
  it('cover every enum value', () => {
    expect(Object.keys(WORKLOAD_LABELS)).toEqual(['normal', 'slower', 'cannot']);
    expect(Object.keys(PERSONNEL_ABLE_REASON_LABELS)).toEqual(['trained', 'assigned']);
    expect(Object.keys(EQUIP_NOT_READY_REASON_LABELS)).toEqual([
      'noInstrument', 'notCalibrated', 'outOfRange', 'broken',
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/labAgreementReview.test.ts`
Expected: FAIL — cannot resolve `./labAgreementReview`.

- [ ] **Step 3: Create the module**

Create `src/lib/labAgreementReview.ts`:

```ts
import type { LabAgreementReview } from '@/types/labRequest.types';

export const PERSONNEL_ABLE_REASON_LABELS = {
  trained: 'ได้รับการฝึกอบรมแล้ว',
  assigned: 'ได้รับการมอบหมายให้ทดลอง',
} as const;

export const PERSONNEL_UNABLE_REASON_LABELS = {
  neverDone: 'ยังไม่เคยทำการทดลอง',
  notTrained: 'ยังไม่ได้รับการฝึกอบรม',
  notAssigned: 'ยังไม่ได้รับการมอบหมายให้ทำงานทดลอง',
} as const;

export const WORKLOAD_LABELS = {
  normal: 'ยังมีความสามารถรับงานได้ตามปกติ',
  slower: 'สามารถรับงานได้แต่อาจช้ากว่าปกติ ซึ่งลูกค้ายินยอม',
  cannot: 'ไม่สามารถรับงานได้ เพราะมีงานสะสมมาก',
} as const;

export const EQUIP_READY_REASON_LABELS = {
  hasInstrument: 'มีเครื่องมือ',
  calibrated: 'สอบเทียบแล้ว',
} as const;

export const EQUIP_NOT_READY_REASON_LABELS = {
  noInstrument: 'ไม่มีเครื่องมือ',
  notCalibrated: 'ยังไม่มีการสอบเทียบ',
  outOfRange: 'เครื่องมือไม่ครอบคลุมช่วงทดสอบที่ต้องการ',
  broken: 'เครื่องมือเสีย',
} as const;

export function isReviewFilled(r?: LabAgreementReview | null): boolean {
  return !!r && !!r.reviewedBy && !!r.reviewedAt;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/labAgreementReview.test.ts`
Expected: PASS (2 suites, 4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/labAgreementReview.ts src/lib/labAgreementReview.test.ts
git commit -m "feat(lab-agreement): shared labels + isReviewFilled helper"
```

---

### Task 3: Expand the server schema

**Files:**
- Modify: `server/models/LabRequest.js:17-28`

- [ ] **Step 1: Replace `LabAgreementReviewSchema`**

Replace the existing schema (lines 17-28) with:

```js
const LabAgreementReviewSchema = new mongoose.Schema(
  {
    reviewedAt: { type: Date, default: Date.now },
    reviewedBy: String,
    // กรณีวิธีปกติ (standard)
    personnel: { type: String, enum: ['able', 'unable'] },
    personnelAbleReasons: [{ type: String, enum: ['trained', 'assigned'] }],
    personnelUnableReasons: [{ type: String, enum: ['neverDone', 'notTrained', 'notAssigned'] }],
    workload: { type: String, enum: ['normal', 'slower', 'cannot'] },
    subcontractor: { type: String, enum: ['none', 'used'] },
    subcontractorName: String,
    // กรณีวิธีเฉพาะตามเอกสารลูกค้า (custom)
    methodSuitable: Boolean,
    methodSuitableReason: String,
    equipmentName: String,
    equipment: { type: String, enum: ['ready', 'notReady'] },
    equipmentReadyReasons: [{ type: String, enum: ['hasInstrument', 'calibrated'] }],
    equipmentNotReadyReasons: [
      { type: String, enum: ['noInstrument', 'notCalibrated', 'outOfRange', 'broken'] },
    ],
    // สรุป
    acceptable: Boolean,
    notAcceptableReason: String,
    remark: String,
  },
  { _id: false },
);
```

- [ ] **Step 2: Commit**

```bash
git add server/models/LabRequest.js
git commit -m "feat(lab-agreement): expand server LabAgreementReview schema"
```

---

### Task 4: Backend fan-out endpoint

**Files:**
- Modify: `server/routes/petitions.js` (add `LabRequest` require near line 11; add route after the `lab-reject` handler, ~line 417)

- [ ] **Step 1: Add the LabRequest model require**

After line 11 (`const QCTestResult = require('../models/QCTestResult');` region — specifically after the `PetitionAuditLog` require on line 9, any of the requires block), add:

```js
const LabRequest = require('../models/LabRequest');
```

- [ ] **Step 2: Add the endpoint**

Immediately after the `router.post('/:id/lab-reject', ...)` handler closes (the line with its closing `});`, ~line 417), insert:

```js
// POST /api/petitions/:id/lab-agreement-review
// บันทึก "สำหรับหัวหน้าห้องปฏิบัติการ" ครั้งเดียว → เขียนลงทุก LabRequest ของคำร้อง (fan-out)
router.post('/:id/lab-agreement-review', async (req, res) => {
  try {
    const actor = req.body?.actor || 'system';
    const review = { ...(req.body?.review || {}) };
    delete review.reviewedAt;
    delete review.reviewedBy;
    review.reviewedBy = actor;
    review.reviewedAt = new Date();

    const petition = await Petition.findById(req.params.id).lean();
    if (!petition) return res.status(404).json({ error: { message: 'ไม่พบคำร้อง' } });

    const result = await LabRequest.updateMany(
      { petitionId: petition._id },
      { $set: { labAgreementReview: review } },
    );
    const updated = result.modifiedCount ?? result.nModified ?? 0;
    res.json({ updated, review });
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});
```

- [ ] **Step 3: Smoke-test the route wiring**

Run: `node -e "require('./server/routes/petitions.js'); console.log('ok')"`
Expected: prints `ok` (no syntax/require error).

- [ ] **Step 4: Commit**

```bash
git add server/routes/petitions.js
git commit -m "feat(lab-agreement): POST /petitions/:id/lab-agreement-review fan-out"
```

---

### Task 5: Client mutation `saveLabAgreementReview`

**Files:**
- Modify: `src/hooks/usePetition.ts` (after `deleteLabRequest`, ~line 299)

- [ ] **Step 1: Add the mutation + import**

Ensure `LabAgreementReview` is importable. At the top of `usePetition.ts` the file already does `import type { LabRequest } from '@/types/labRequest.types';` (line 13) — extend it:

```ts
import type { LabRequest, LabAgreementReview } from '@/types/labRequest.types';
```

After the `deleteLabRequest` function (line 299), add:

```ts
export async function saveLabAgreementReview(
  petitionId: string,
  review: Omit<LabAgreementReview, 'reviewedAt' | 'reviewedBy'>,
  actor: string,
): Promise<{ updated: number; review: LabAgreementReview }> {
  return apiFetch<{ updated: number; review: LabAgreementReview }>(
    `/petitions/${petitionId}/lab-agreement-review`,
    {
      method: 'POST',
      body: JSON.stringify({ review, actor }),
    },
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors in `usePetition.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePetition.ts
git commit -m "feat(lab-agreement): saveLabAgreementReview client mutation"
```

---

### Task 6: `LabAgreementReviewDialog` editor

**Files:**
- Create: `src/components/review/LabAgreementReviewDialog.tsx`

The dialog shows BOTH the standard and custom sections (like the paper). Local state mirrors `LabAgreementReview` minus the stamped fields.

- [ ] **Step 1: Create the component**

Create `src/components/review/LabAgreementReviewDialog.tsx`:

```tsx
import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, Save } from 'lucide-react';
import { releaseBodyPointerLock } from '@/context/ConfirmDialog';
import type { LabAgreementReview } from '@/types/labRequest.types';
import {
  PERSONNEL_ABLE_REASON_LABELS, PERSONNEL_UNABLE_REASON_LABELS,
  WORKLOAD_LABELS, EQUIP_READY_REASON_LABELS, EQUIP_NOT_READY_REASON_LABELS,
} from '@/lib/labAgreementReview';

type Draft = Omit<LabAgreementReview, 'reviewedAt' | 'reviewedBy'>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: LabAgreementReview | null;
  onSave: (draft: Draft) => Promise<void>;
}

function toggle<T>(arr: T[] | undefined, v: T, on: boolean): T[] {
  const set = new Set(arr ?? []);
  if (on) set.add(v); else set.delete(v);
  return Array.from(set);
}

const RadioRow = ({ checked, onSelect, children }:
  { checked: boolean; onSelect: () => void; children: React.ReactNode }) => (
  <button type="button" onClick={onSelect}
    className={`flex items-start gap-2 text-left text-sm w-full py-1 ${checked ? 'font-medium text-sky-700' : 'text-grey-700'}`}>
    <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border ${checked ? 'border-sky-600 bg-sky-600' : 'border-grey-400'}`} />
    <span>{children}</span>
  </button>
);

const CheckRow = ({ checked, onChange, children }:
  { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) => (
  <label className="flex items-start gap-2 text-sm py-1 cursor-pointer">
    <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} className="mt-0.5" />
    <span>{children}</span>
  </label>
);

export default function LabAgreementReviewDialog({ open, onOpenChange, initial, onSave }: Props) {
  const [d, setD] = useState<Draft>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const { reviewedAt: _a, reviewedBy: _b, ...rest } = initial ?? {};
      setD(rest);
    }
  }, [open, initial]);

  const set = (patch: Partial<Draft>) => setD((prev) => ({ ...prev, ...patch }));

  const close = (v: boolean) => { if (!v) releaseBodyPointerLock(); onOpenChange(v); };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(d);
      close(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>การทบทวนข้อตกลงการบริการทดสอบ — สำหรับหัวหน้าห้องปฏิบัติการ</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* กรณีวิธีปกติ */}
          <section className="space-y-2">
            <h3 className="font-semibold underline text-sm">กรณีลูกค้าระบุวิธีทดสอบตามปกติ</h3>

            <p className="font-medium text-sm">1. บุคลากร</p>
            <RadioRow checked={d.personnel === 'able'} onSelect={() => set({ personnel: 'able' })}>
              1.1 ทำได้เนื่องจาก
            </RadioRow>
            {d.personnel === 'able' && (
              <div className="ml-6 space-y-1">
                {(Object.keys(PERSONNEL_ABLE_REASON_LABELS) as (keyof typeof PERSONNEL_ABLE_REASON_LABELS)[]).map((k) => (
                  <CheckRow key={k} checked={d.personnelAbleReasons?.includes(k) ?? false}
                    onChange={(v) => set({ personnelAbleReasons: toggle(d.personnelAbleReasons, k, v) })}>
                    {PERSONNEL_ABLE_REASON_LABELS[k]}
                  </CheckRow>
                ))}
              </div>
            )}
            <RadioRow checked={d.personnel === 'unable'} onSelect={() => set({ personnel: 'unable' })}>
              1.2 ไม่สามารถทำได้เนื่องจาก
            </RadioRow>
            {d.personnel === 'unable' && (
              <div className="ml-6 space-y-1">
                {(Object.keys(PERSONNEL_UNABLE_REASON_LABELS) as (keyof typeof PERSONNEL_UNABLE_REASON_LABELS)[]).map((k) => (
                  <CheckRow key={k} checked={d.personnelUnableReasons?.includes(k) ?? false}
                    onChange={(v) => set({ personnelUnableReasons: toggle(d.personnelUnableReasons, k, v) })}>
                    {PERSONNEL_UNABLE_REASON_LABELS[k]}
                  </CheckRow>
                ))}
              </div>
            )}

            <p className="font-medium text-sm pt-2">2. ปริมาณงาน</p>
            {(Object.keys(WORKLOAD_LABELS) as (keyof typeof WORKLOAD_LABELS)[]).map((k, i) => (
              <RadioRow key={k} checked={d.workload === k} onSelect={() => set({ workload: k })}>
                {`2.${i + 1} ${WORKLOAD_LABELS[k]}`}
              </RadioRow>
            ))}

            <p className="font-medium text-sm pt-2">3. การใช้บริการผู้รับเหมาช่วง (Sub contractor)</p>
            <RadioRow checked={d.subcontractor === 'none'} onSelect={() => set({ subcontractor: 'none' })}>
              3.1 ไม่ใช้ผู้รับเหมาช่วง
            </RadioRow>
            <RadioRow checked={d.subcontractor === 'used'} onSelect={() => set({ subcontractor: 'used' })}>
              3.2 ใช้บริการทดสอบโดยผู้รับเหมาช่วง
            </RadioRow>
            {d.subcontractor === 'used' && (
              <Input className="ml-6" placeholder="บริษัท/หน่วยงาน"
                value={d.subcontractorName ?? ''} onChange={(e) => set({ subcontractorName: e.target.value })} />
            )}
          </section>

          {/* กรณีวิธีเฉพาะ */}
          <section className="space-y-2">
            <h3 className="font-semibold underline text-sm">กรณีลูกค้าระบุวิธีการทดสอบตามเอกสารของลูกค้า</h3>

            <p className="font-medium text-sm">1. พิจารณาแล้วว่า</p>
            <RadioRow checked={d.methodSuitable === true} onSelect={() => set({ methodSuitable: true })}>
              เหมาะสม
            </RadioRow>
            <RadioRow checked={d.methodSuitable === false} onSelect={() => set({ methodSuitable: false })}>
              ไม่เหมาะสม เนื่องจาก
            </RadioRow>
            {d.methodSuitable === false && (
              <Input className="ml-6" placeholder="เหตุผล"
                value={d.methodSuitableReason ?? ''} onChange={(e) => set({ methodSuitableReason: e.target.value })} />
            )}

            <p className="font-medium text-sm pt-2">2. เครื่องมือทดสอบ</p>
            <Input placeholder="ชื่อเครื่องมือ"
              value={d.equipmentName ?? ''} onChange={(e) => set({ equipmentName: e.target.value })} />
            <RadioRow checked={d.equipment === 'ready'} onSelect={() => set({ equipment: 'ready' })}>
              2.1 มีความพร้อม เนื่องจาก
            </RadioRow>
            {d.equipment === 'ready' && (
              <div className="ml-6 space-y-1">
                {(Object.keys(EQUIP_READY_REASON_LABELS) as (keyof typeof EQUIP_READY_REASON_LABELS)[]).map((k) => (
                  <CheckRow key={k} checked={d.equipmentReadyReasons?.includes(k) ?? false}
                    onChange={(v) => set({ equipmentReadyReasons: toggle(d.equipmentReadyReasons, k, v) })}>
                    {EQUIP_READY_REASON_LABELS[k]}
                  </CheckRow>
                ))}
              </div>
            )}
            <RadioRow checked={d.equipment === 'notReady'} onSelect={() => set({ equipment: 'notReady' })}>
              2.2 ไม่มีความพร้อม เนื่องจาก
            </RadioRow>
            {d.equipment === 'notReady' && (
              <div className="ml-6 space-y-1">
                {(Object.keys(EQUIP_NOT_READY_REASON_LABELS) as (keyof typeof EQUIP_NOT_READY_REASON_LABELS)[]).map((k) => (
                  <CheckRow key={k} checked={d.equipmentNotReadyReasons?.includes(k) ?? false}
                    onChange={(v) => set({ equipmentNotReadyReasons: toggle(d.equipmentNotReadyReasons, k, v) })}>
                    {EQUIP_NOT_READY_REASON_LABELS[k]}
                  </CheckRow>
                ))}
              </div>
            )}
          </section>

          {/* สรุป */}
          <section className="space-y-2 border-t pt-3">
            <p className="font-semibold text-sm">สรุปความพร้อมของงานบริการ</p>
            <RadioRow checked={d.acceptable === true} onSelect={() => set({ acceptable: true })}>
              พร้อมรับงาน
            </RadioRow>
            <RadioRow checked={d.acceptable === false} onSelect={() => set({ acceptable: false })}>
              ไม่พร้อมรับงาน เนื่องจาก
            </RadioRow>
            {d.acceptable === false && (
              <Input className="ml-6" placeholder="เหตุผล"
                value={d.notAcceptableReason ?? ''} onChange={(e) => set({ notAcceptableReason: e.target.value })} />
            )}
            <div className="pt-2">
              <Label className="text-sm">หมายเหตุ</Label>
              <Textarea value={d.remark ?? ''} onChange={(e) => set({ remark: e.target.value })} rows={2} />
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => close(false)} disabled={saving}>ยกเลิก</Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            บันทึกการทบทวน
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors in `LabAgreementReviewDialog.tsx`. If `Checkbox` lacks an `onCheckedChange` prop, open `src/components/ui/checkbox.tsx` to confirm the prop name and adjust.

- [ ] **Step 3: Commit**

```bash
git add src/components/review/LabAgreementReviewDialog.tsx
git commit -m "feat(lab-agreement): full-form review dialog editor"
```

---

### Task 7: Wire the review card into `LabApprovalReviewPage`

**Files:**
- Modify: `src/pages/LabApprovalReviewPage.tsx`

- [ ] **Step 1: Add imports**

Add near the existing imports (after line 20):

```tsx
import { useLabRequestsByPetition, saveLabAgreementReview } from "@/hooks/usePetition";
import LabAgreementReviewDialog from "@/components/review/LabAgreementReviewDialog";
import LabAgreementReviewView from "@/components/review/LabAgreementReviewView";
import { isReviewFilled } from "@/lib/labAgreementReview";
import { Card as ReviewCard, CardContent as ReviewCardContent, CardHeader as ReviewCardHeader, CardTitle as ReviewCardTitle } from "@/components/ui/card";
import { ClipboardCheck } from "lucide-react";
```

(Note: `Card`/`CardContent`/`CardHeader`/`CardTitle` are already imported on line 8 — reuse those directly instead of aliasing. Use the aliases ONLY if a name clash appears; otherwise delete the alias import line and use `Card`, `CardContent`, etc.)

- [ ] **Step 2: Load LabRequests + dialog state**

Inside the component, after the existing `useState`/hook declarations (after line 38), add:

```tsx
  const { data: labRequests, refresh: refreshLabRequests } = useLabRequestsByPetition(id);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const currentReview = labRequests?.[0]?.labAgreementReview ?? null;

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

- [ ] **Step 3: Render the card**

Immediately after the `petition.labRedoExplanation` block (after line 155, before `{groups.map(...)}`), add:

```tsx
        {(labRequests?.length ?? 0) > 0 && (
          <Card className="overflow-hidden">
            <CardHeader className="pb-3 bg-grey-50">
              <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
                <span className="inline-flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-sky-500" />
                  การทบทวนข้อตกลงการบริการทดสอบ — สำหรับหัวหน้าห้องปฏิบัติการ
                </span>
                {canApproveLab && (
                  <Button variant="outline" size="sm" onClick={() => setReviewDialogOpen(true)}>
                    {isReviewFilled(currentReview) ? "แก้ไขการทบทวน" : "กรอกการทบทวน"}
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {isReviewFilled(currentReview) ? (
                <LabAgreementReviewView data={currentReview!} />
              ) : (
                <p className="text-sm text-grey-400 italic">ยังไม่กรอกการทบทวน</p>
              )}
            </CardContent>
          </Card>
        )}
```

- [ ] **Step 4: Render the dialog**

Just before the closing `</div>` that wraps the page content (next to the existing `<RevisionRequestDialog ... />`, ~line 245), add:

```tsx
        <LabAgreementReviewDialog
          open={reviewDialogOpen}
          onOpenChange={setReviewDialogOpen}
          initial={currentReview}
          onSave={handleSaveReview}
        />
```

- [ ] **Step 5: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors in `LabApprovalReviewPage.tsx`. (Remove the unused aliased card import from Step 1 if you went with the plain `Card` names.)

- [ ] **Step 6: Commit**

```bash
git add src/pages/LabApprovalReviewPage.tsx
git commit -m "feat(lab-agreement): review card + dialog on lab-approval page"
```

---

### Task 8: Update the read-only `LabAgreementReviewView`

**Files:**
- Modify: `src/components/review/LabAgreementReviewView.tsx` (full rewrite)

- [ ] **Step 1: Rewrite the view for the expanded fields**

Replace the whole file with:

```tsx
import type { LabAgreementReview } from '@/types/labRequest.types';
import {
  PERSONNEL_ABLE_REASON_LABELS, PERSONNEL_UNABLE_REASON_LABELS,
  WORKLOAD_LABELS, EQUIP_READY_REASON_LABELS, EQUIP_NOT_READY_REASON_LABELS,
} from '@/lib/labAgreementReview';

const Line = ({ label, value }: { label: string; value?: string }) =>
  value ? (
    <p className="text-sm py-0.5">
      <span className="text-grey-500">{label}: </span>
      <span className="text-black-600 font-medium">{value}</span>
    </p>
  ) : null;

function joinLabels<T extends string>(keys: T[] | undefined, map: Record<T, string>): string {
  return (keys ?? []).map((k) => map[k]).filter(Boolean).join(', ');
}

export default function LabAgreementReviewView({ data }: { data: LabAgreementReview }) {
  return (
    <div className="space-y-1">
      {data.personnel && (
        <Line
          label="บุคลากร"
          value={data.personnel === 'able'
            ? `ทำได้ (${joinLabels(data.personnelAbleReasons, PERSONNEL_ABLE_REASON_LABELS) || '-'})`
            : `ไม่สามารถทำได้ (${joinLabels(data.personnelUnableReasons, PERSONNEL_UNABLE_REASON_LABELS) || '-'})`}
        />
      )}
      {data.workload && <Line label="ปริมาณงาน" value={WORKLOAD_LABELS[data.workload]} />}
      {data.subcontractor && (
        <Line label="ผู้รับเหมาช่วง"
          value={data.subcontractor === 'none' ? 'ไม่ใช้' : `ใช้: ${data.subcontractorName || '-'}`} />
      )}
      {data.methodSuitable !== undefined && (
        <Line label="พิจารณาวิธีเฉพาะ"
          value={data.methodSuitable ? 'เหมาะสม' : `ไม่เหมาะสม (${data.methodSuitableReason || '-'})`} />
      )}
      {data.equipment && (
        <Line label={`เครื่องมือ${data.equipmentName ? ` (${data.equipmentName})` : ''}`}
          value={data.equipment === 'ready'
            ? `พร้อม (${joinLabels(data.equipmentReadyReasons, EQUIP_READY_REASON_LABELS) || '-'})`
            : `ไม่พร้อม (${joinLabels(data.equipmentNotReadyReasons, EQUIP_NOT_READY_REASON_LABELS) || '-'})`} />
      )}
      {data.acceptable !== undefined && (
        <Line label="สรุป"
          value={data.acceptable ? 'พร้อมรับงาน' : `ไม่พร้อมรับงาน (${data.notAcceptableReason || '-'})`} />
      )}
      <Line label="หมายเหตุ" value={data.remark} />
      <p className="text-xs text-grey-500 pt-2">
        โดย {data.reviewedBy} ·{' '}
        {data.reviewedAt
          ? new Date(data.reviewedAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
          : '-'}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors in `LabAgreementReviewView.tsx` (the previous wrong import from `petition.types` is now gone).

- [ ] **Step 3: Commit**

```bash
git add src/components/review/LabAgreementReviewView.tsx
git commit -m "feat(lab-agreement): read-only view for expanded review fields"
```

---

### Task 9: Wire the expanded fields into the print template

**Files:**
- Modify: `src/components/petition/PetitionPrintTemplate.tsx:236-349` (PageOne right column)

The right column currently has many static `<CB />` / `<RD />`. Bind them to `lar` (which is `lr.labAgreementReview`). `RD` is a radio glyph and `CB` a checkbox glyph; both accept a `checked` prop (used elsewhere in this file).

- [ ] **Step 1: Bind the standard-method block (personnel / workload / subcontractor)**

In the `<td className="pr-p1-body-r">` block, replace the personnel + workload + subcontractor markup (lines ~241-277) with `checked`-bound versions:

```tsx
                    <div className="pr-q"><b>1. บุคลากร</b></div>
                    <div className="pr-ind">
                      <CB checked={lar?.personnel === 'able'} /> 1.1 ทำได้เนื่องจาก
                    </div>
                    <div className="pr-ind3">
                      <RD checked={lar?.personnelAbleReasons?.includes('trained')} /> ได้รับการฝึกอบรมแล้ว
                    </div>
                    <div className="pr-ind3">
                      <RD checked={lar?.personnelAbleReasons?.includes('assigned')} /> ได้รับการมอบหมายให้ทดลอง
                    </div>
                    <div className="pr-ind">
                      <CB checked={lar?.personnel === 'unable'} /> 1.2 ไม่สามารถทำได้เนื่องจาก
                    </div>
                    <div className="pr-ind3"><RD checked={lar?.personnelUnableReasons?.includes('neverDone')} /> ยังไม่เคยทำการทดลอง</div>
                    <div className="pr-ind3"><RD checked={lar?.personnelUnableReasons?.includes('notTrained')} /> ยังไม่ได้รับการฝึกอบรม</div>
                    <div className="pr-ind3"><RD checked={lar?.personnelUnableReasons?.includes('notAssigned')} /> ยังไม่ได้รับการมอบหมายให้ทำงานทดลอง</div>

                    <div className="pr-q"><b>2. ปริมาณงาน</b></div>
                    <div className="pr-ind">
                      <CB checked={lar?.workload === 'normal'} /> 2.1 ยังมีความสามารถรับงานได้ตามปกติ
                    </div>
                    <div className="pr-ind">
                      <CB checked={lar?.workload === 'slower'} /> 2.2 สามารถรับงานได้แต่อาจช้ากว่าปกติ ซึ่งลูกค้ายินยอม
                    </div>
                    <div className="pr-ind">
                      <CB checked={lar?.workload === 'cannot'} /> 2.3 ไม่สามารถรับงานได้ เพราะมีงานสะสมมาก
                    </div>

                    <div className="pr-q"><b>3. การใช้บริการผู้รับเหมาช่วงการทดสอบ (Sub contractor)</b></div>
                    <div className="pr-ind"><CB checked={lar?.subcontractor === 'none'} /> 3.1 ไม่ใช้ผู้รับเหมาช่วง</div>
                    <div className="pr-ind">
                      <CB checked={lar?.subcontractor === 'used'} /> 3.2 การทดสอบนี้ใช้บริการทดสอบโดยผู้รับเหมาช่วง บริษัท/หน่วยงาน{' '}
                      <Line width="5cm" value={lar?.subcontractor === 'used' ? (lar?.subcontractorName ?? '') : ''} />
                    </div>
                    <div className="pr-ind3 pr-note">
                      (เนื่องจากห้องปฏิบัติการทดสอบไม่สามารถทดสอบได้ ซึ่งลูกค้ารับทราบ และยินยอมแล้ว)
                    </div>
```

- [ ] **Step 2: Bind the standard summary**

Replace the first "สรุปความพร้อมของงานบริการ" block (lines ~279-288) with:

```tsx
                    <div className="pr-mt-sm"><b>สรุปความพร้อมของงานบริการ</b></div>
                    <div className="pr-ind pr-fill-row">
                      <span>
                        <CB checked={isStandardMethod && lar?.acceptable === true} /> พร้อมรับงาน&nbsp;&nbsp;
                        <CB checked={isStandardMethod && lar?.acceptable === false} /> ไม่พร้อมรับงาน&nbsp;เนื่องจาก
                      </span>
                      <span className="pr-line-fill">
                        {isStandardMethod && lar?.acceptable === false ? (lar?.notAcceptableReason ?? '') : ' '}
                      </span>
                    </div>
```

- [ ] **Step 3: Bind the custom-method block**

Replace the custom-method markup (lines ~290-329: "พิจารณาแล้วว่า", equipment, second summary) with:

```tsx
                    <div className="pr-mt-sm">
                      <b><u>กรณีลูกค้าระบุวิธีการทดสอบตามเอกสารของลูกค้า</u></b>
                    </div>
                    <div className="pr-q"><b>พิจารณาแล้วว่า</b></div>
                    <div className="pr-ind pr-fill-row">
                      <span>
                        1.&nbsp;<CB checked={lar?.methodSuitable === true} /> เหมาะสม&nbsp;&nbsp;
                        <CB checked={lar?.methodSuitable === false} /> ไม่เหมาะสม&nbsp;เนื่องจาก
                      </span>
                      <span className="pr-line-fill">
                        {lar?.methodSuitable === false ? (lar?.methodSuitableReason ?? '') : ' '}
                      </span>
                    </div>
                    <div className="pr-ind">
                      2. เครื่องมือทดสอบ (เครื่องมือ <Line width="4cm" value={lar?.equipmentName ?? ''} /> )
                    </div>
                    <div className="pr-ind2">
                      <CB checked={lar?.equipment === 'ready'} /> 2.1 มีความพร้อม เนื่องจาก&nbsp;
                      <RD checked={lar?.equipmentReadyReasons?.includes('hasInstrument')} /> มีเครื่องมือ&nbsp;
                      <RD checked={lar?.equipmentReadyReasons?.includes('calibrated')} /> สอบเทียบแล้ว
                    </div>
                    <div className="pr-ind2">
                      <CB checked={lar?.equipment === 'notReady'} /> 2.2 ไม่มีความพร้อม เนื่องจาก
                    </div>
                    <div className="pr-ind3"><RD checked={lar?.equipmentNotReadyReasons?.includes('noInstrument')} /> ไม่มีเครื่องมือ</div>
                    <div className="pr-ind3"><RD checked={lar?.equipmentNotReadyReasons?.includes('notCalibrated')} /> ยังไม่มีการสอบเทียบ</div>
                    <div className="pr-ind3"><RD checked={lar?.equipmentNotReadyReasons?.includes('outOfRange')} /> เครื่องมือไม่ครอบคลุมช่วงทดสอบที่ต้องการ</div>
                    <div className="pr-ind3"><RD checked={lar?.equipmentNotReadyReasons?.includes('broken')} /> เครื่องมือเสีย</div>
                    <div className="pr-ind">
                      3. บุคลากร และปริมาณงาน ทบทวน ตามวิธีทดสอบของ ไอ ซี พี ลัดดา จำกัด (ข้อ 1 และ 2)
                    </div>

                    <div className="pr-mt-sm"><b>สรุปความพร้อมของงานบริการ</b></div>
                    <div className="pr-ind pr-fill-row">
                      <span>
                        <CB checked={isCustomMethod && lar?.acceptable === true} /> พร้อมรับงาน&nbsp;&nbsp;
                        <CB checked={isCustomMethod && lar?.acceptable === false} /> ไม่พร้อมรับงาน&nbsp;เนื่องจาก
                      </span>
                      <span className="pr-line-fill">
                        {isCustomMethod && lar?.acceptable === false ? (lar?.notAcceptableReason ?? '') : ' '}
                      </span>
                    </div>
```

- [ ] **Step 4: Verify `RD` accepts `checked`**

Read `PetitionPrintTemplate.tsx` near the top where `RD` and `CB` are defined. `CB` already takes `checked`. If `RD` does NOT accept a `checked` prop, add it the same way `CB` does (a filled vs empty radio glyph based on `checked`). Show the existing `CB` definition for reference and mirror it.

- [ ] **Step 5: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors in `PetitionPrintTemplate.tsx`.

- [ ] **Step 6: Commit**

```bash
git add src/components/petition/PetitionPrintTemplate.tsx
git commit -m "feat(lab-agreement): bind expanded review fields into print template"
```

---

### Task 10: Full verification pass

- [ ] **Step 1: Lint + tests + type-check**

```bash
npm run lint
npm test -- src/lib/labAgreementReview.test.ts
npx tsc -p tsconfig.app.json --noEmit
```
Expected: lint clean for touched files; tests PASS; no NEW type errors (pre-existing ~12 latent errors unrelated to these files are acceptable).

- [ ] **Step 2: Manual E2E (with both frontend `npm run dev` and backend `cd server && npm run dev` running)**

  1. Open a petition that is in the `/lab-approval` queue and HAS a lab batch (batchNo ending 1 or 6).
  2. Confirm the new card "การทบทวนข้อตกลงการบริการทดสอบ — สำหรับหัวหน้าห้องปฏิบัติการ" shows, status "ยังไม่กรอก".
  3. Click "กรอกการทบทวน", fill some standard + custom fields, save → toast success; card now shows the summary + reviewer/time.
  4. Reload the page → review persists.
  5. Confirm the "อนุมัติผล Lab" button still works independently (approving without touching the review is allowed).
  6. From PetitionDetailPage, print/preview the lab request → the "สำหรับหัวหน้าห้องปฏิบัติการ" column shows the ticked boxes and filled reasons.
  7. Open a petition with NO lab batch → the review card is hidden.

- [ ] **Step 3: Final note**

No `seed:export` needed (no schema-shape data to back up beyond the auto-sync cycle). If you manually changed any LabRequest data during testing on prod, run `npm run seed:export` and commit. Push `develop` only when the user asks.

---

## Notes for the implementer

- **Concurrent committers:** other processes may commit on `develop`. Stage with explicit pathspecs (as written in each commit step) — never `git add -A`.
- **Type-check command:** `npx tsc --noEmit` (per CLAUDE.md) is a no-op (root tsconfig has `files: []`). Use `npx tsc -p tsconfig.app.json --noEmit` for a real check; expect ~12 pre-existing latent errors unrelated to this work.
- **Do not run `npm run build`** — it disrupts the dev/prod HTML split. Type-check instead.
- **Pointer-lock:** the dialog calls `releaseBodyPointerLock()` on close (matching the codebase fix for raw Radix dialogs). It does not navigate, so it is low-risk.
