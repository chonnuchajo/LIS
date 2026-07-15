# Petition Lab-Result Print + Sample-Label Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide the "ป้ายนำส่งตัวอย่าง" button on the petition timeline once QC/Lab has received the sample, and add a "พิมพ์ผลวิเคราะห์ Lab" print button to the timeline and petition-detail pages.

**Architecture:** Two pure helpers (`canPrintLabResult` gate, `buildLabResultReportPages` page builder) drive small wiring changes in two pages. All report rendering reuses the existing `LabResultReportTemplate` / `buildLabReportPages` path that already powers `/lab-results/:id`. No backend changes.

**Tech Stack:** React 18 + TypeScript, Vitest + React Testing Library, existing print stack (`PrintPreviewDialog`, `LAB_REPORT_CSS`).

## Global Constraints

- UI labels are Thai; match surrounding copy exactly.
- Type-check with `npx tsc -p tsconfig.app.json --noEmit` (root `npx tsc --noEmit` is a no-op in this repo).
- Run unit tests with `npm run test`.
- Commit with explicit file pathspecs only — other sessions have unrelated uncommitted changes in the tree; never `git add -A` / `git add .`.
- Lab-scope filter: a parameter is Lab-scope when `(param.scope ?? 'qc') === 'lab'`.

---

### Task 1: `canPrintLabResult` gate helper

**Files:**
- Modify: `src/lib/petitionPrintability.ts`
- Test: `src/lib/petitionPrintability.test.ts`

**Interfaces:**
- Produces: `canPrintLabResult(petition: PrintabilityInput): boolean` — true iff `labCompletedAt` or `labApprovedAt` is set.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/petitionPrintability.test.ts`:

```ts
import { canPrintLabResult } from './petitionPrintability';

describe('canPrintLabResult', () => {
  it('false when Lab has neither completed nor issued results', () => {
    expect(canPrintLabResult({ status: 'inProgress' })).toBe(false);
  });
  it('true when labCompletedAt is set', () => {
    expect(canPrintLabResult({ status: 'inProgress', labCompletedAt: '2026-07-15T00:00:00.000Z' })).toBe(true);
  });
  it('true when labApprovedAt is set', () => {
    expect(canPrintLabResult({ status: 'success', labApprovedAt: '2026-07-15T00:00:00.000Z' })).toBe(true);
  });
  it('false for null/empty timestamps', () => {
    expect(canPrintLabResult({ status: 'inProgress', labCompletedAt: null, labApprovedAt: null })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/petitionPrintability.test.ts`
Expected: FAIL — `canPrintLabResult is not a function` / not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/petitionPrintability.ts`, extend the input type and add the helper. The full file becomes:

```ts
import type { PetitionStatus } from '@/types/petition.types';

type PrintabilityInput = {
  status: PetitionStatus;
  qcReceivedBy?: string;
  labReceivedBy?: string;
  labCompletedAt?: string | null;
  labApprovedAt?: string | null;
};

const received = (name?: string) => !!name?.trim();

/**
 * ฉลากตัวอย่างติดที่ขวดก่อนส่งของให้ QC — พอ QC หรือ Lab รับตัวอย่างเข้าระบบแล้ว
 * ตัวอย่างอยู่ในมือห้องแล็บ ไม่มีเหตุให้พิมพ์ฉลากใหม่
 */
export function canPrintSampleLabel(petition: PrintabilityInput): boolean {
  return !received(petition.qcReceivedBy) && !received(petition.labReceivedBy);
}

/** Pre Report ใช้ได้จนกว่าหัวหน้า QC จะออก Final Result — หลังจากนั้นใช้ Final Report แทน */
export function canPrintPreReport(petition: PrintabilityInput): boolean {
  return petition.status !== 'approved';
}

/** ผลวิเคราะห์ Lab พิมพ์ได้เมื่อ Lab ตรวจเสร็จ (labCompletedAt) หรือหัวหน้า Lab ออกผลแล้ว (labApprovedAt) */
export function canPrintLabResult(petition: PrintabilityInput): boolean {
  return !!(petition.labCompletedAt || petition.labApprovedAt);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/petitionPrintability.test.ts`
Expected: PASS (all `canPrintLabResult` + existing cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/petitionPrintability.ts src/lib/petitionPrintability.test.ts
git commit -m "feat(petition): add canPrintLabResult gate helper"
```

---

### Task 2: `buildLabResultReportPages` shared page builder

**Files:**
- Create: `src/lib/labResultReport.ts`
- Test: `src/lib/labResultReport.test.ts`

**Interfaces:**
- Consumes: `buildApprovalGroups` (`@/lib/qcApprovalRows`), `buildLabReportPages` + `LabReportPage` (`@/lib/labReport`).
- Produces:
  ```ts
  buildLabResultReportPages(input: {
    petition: Petition;
    labRequests: LabRequest[];
    parameters: ParameterItem[];
    qcResults: QCTestResult[];
    groupMembership: Map<string, string[]>;
  }): LabReportPage[]
  ```
  Filters `parameters` to Lab-scope, then builds approval groups → lab report pages.

- [ ] **Step 1: Write the failing test**

Create `src/lib/labResultReport.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

const buildApprovalGroups = vi.fn(() => [{ seq: 1 }]);
const buildLabReportPages = vi.fn(() => [{ reportNo: 'LR-1' }]);
vi.mock('@/lib/qcApprovalRows', () => ({ buildApprovalGroups: (...a: unknown[]) => buildApprovalGroups(...a) }));
vi.mock('@/lib/labReport', () => ({ buildLabReportPages: (...a: unknown[]) => buildLabReportPages(...a) }));

import { buildLabResultReportPages } from './labResultReport';

const petition = { _id: 'p1', items: [{ seq: 1 }] } as never;
const labRequests = [{ _id: 'lr1' }] as never;
const qcResults = [] as never;
const groupMembership = new Map<string, string[]>();

describe('buildLabResultReportPages', () => {
  it('passes only Lab-scope parameters to buildApprovalGroups', () => {
    const parameters = [
      { _id: 'a', scope: 'lab' },
      { _id: 'b', scope: 'qc' },
      { _id: 'c' }, // undefined scope defaults to qc
    ] as never;
    buildLabResultReportPages({ petition, labRequests, parameters, qcResults, groupMembership });
    const labParamsArg = buildApprovalGroups.mock.calls[0][1] as Array<{ _id: string }>;
    expect(labParamsArg.map((p) => p._id)).toEqual(['a']);
  });

  it('returns the pages from buildLabReportPages', () => {
    const pages = buildLabResultReportPages({ petition, labRequests, parameters: [] as never, qcResults, groupMembership });
    expect(pages).toEqual([{ reportNo: 'LR-1' }]);
    expect(buildLabReportPages).toHaveBeenCalledWith(petition, labRequests, [{ seq: 1 }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/labResultReport.test.ts`
Expected: FAIL — cannot resolve `./labResultReport`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/labResultReport.ts`:

```ts
import type { Petition, QCTestResult } from '@/types/petition.types';
import type { LabRequest } from '@/types/labRequest.types';
import type { ParameterItem } from '@/lib/api';
import { buildApprovalGroups } from '@/lib/qcApprovalRows';
import { buildLabReportPages, type LabReportPage } from '@/lib/labReport';

/**
 * รวม 3 ขั้นสร้าง "ผลวิเคราะห์ Lab" ให้เป็น code path เดียว: กรอง parameter เฉพาะฝั่ง Lab
 * (ไม่รวม param QC ที่แชร์ให้ Lab เช่น ค่า ถพ.) → buildApprovalGroups → buildLabReportPages
 */
export function buildLabResultReportPages(input: {
  petition: Petition;
  labRequests: LabRequest[];
  parameters: ParameterItem[];
  qcResults: QCTestResult[];
  groupMembership: Map<string, string[]>;
}): LabReportPage[] {
  const { petition, labRequests, parameters, qcResults, groupMembership } = input;
  const labParams = parameters.filter((p) => (p.scope ?? 'qc') === 'lab');
  const groups = buildApprovalGroups(petition, labParams, qcResults, groupMembership);
  return buildLabReportPages(petition, labRequests, groups);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/labResultReport.test.ts`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/labResultReport.ts src/lib/labResultReport.test.ts
git commit -m "feat(petition): add buildLabResultReportPages shared helper"
```

---

### Task 3: Timeline — hide sample-label button once received (Part 1)

**Files:**
- Modify: `src/pages/PetitionTimelineDetailPage.tsx` (import ~`:23`, button ~`:546`)
- Test: `src/pages/PetitionTimelineDetailPage.test.tsx`

**Interfaces:**
- Consumes: `canPrintSampleLabel` (Task 1, already existed).

- [ ] **Step 1: Write the failing test**

The file already has a `renderDetail()` helper and a `beforeEach` that resets `mocks.petition` (including `qcReceivedBy: undefined`, `labApprovedAt: undefined`), so no per-test cleanup is needed. The default mock sets `qcReceivedAt` but leaves `qcReceivedBy` undefined, so `canPrintSampleLabel` returns true by default (label shows). Add inside the top-level `describe("PetitionTimelineDetailPage", …)`:

```ts
it('hides the sample-label button once QC has received the sample', async () => {
  mocks.petition.qcReceivedBy = 'QC Staff';
  renderDetail();
  await screen.findByRole('heading', { name: 'P-2607-001' });
  expect(screen.queryByRole('button', { name: /ป้ายนำส่งตัวอย่าง/ })).not.toBeInTheDocument();
});

it('shows the sample-label button when not yet received', async () => {
  renderDetail();
  await screen.findByRole('heading', { name: 'P-2607-001' });
  expect(screen.getByRole('button', { name: /ป้ายนำส่งตัวอย่าง/ })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/pages/PetitionTimelineDetailPage.test.tsx`
Expected: FAIL — the "hides" test fails because the button still renders (currently ungated).

- [ ] **Step 3: Implement the gate**

In `src/pages/PetitionTimelineDetailPage.tsx`:

1. Update the import (~line 23) from:
```ts
import { canPrintPreReport } from "@/lib/petitionPrintability";
```
to:
```ts
import { canPrintPreReport, canPrintSampleLabel } from "@/lib/petitionPrintability";
```

2. Wrap the sample-label button (~line 546) in the gate. From:
```tsx
<Button variant="primary-outline" className={cn(documentButtonClass, documentButtonColors.sampleLabel)} disabled={documentLoading} onClick={() => { void openDocument(setLabelPrintOpen); }}><Printer className="h-4 w-4" />ป้ายนำส่งตัวอย่าง</Button>
```
to:
```tsx
{canPrintSampleLabel(petition) && <Button variant="primary-outline" className={cn(documentButtonClass, documentButtonColors.sampleLabel)} disabled={documentLoading} onClick={() => { void openDocument(setLabelPrintOpen); }}><Printer className="h-4 w-4" />ป้ายนำส่งตัวอย่าง</Button>}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/pages/PetitionTimelineDetailPage.test.tsx`
Expected: PASS (both new tests + existing tests).

- [ ] **Step 5: Commit**

```bash
git add src/pages/PetitionTimelineDetailPage.tsx src/pages/PetitionTimelineDetailPage.test.tsx
git commit -m "fix(timeline): hide sample-label button once QC/Lab received"
```

---

### Task 4: Timeline — add "พิมพ์ผลวิเคราะห์ Lab" button + dialog (Part 2)

**Files:**
- Modify: `src/pages/PetitionTimelineDetailPage.tsx` (imports, `documentButtonColors` ~`:175`, state ~`:200`, a `useMemo`, Documents card ~`:548`, dialogs ~`:556`)
- Test: `src/pages/PetitionTimelineDetailPage.test.tsx`

**Interfaces:**
- Consumes: `canPrintLabResult` (Task 1), `buildLabResultReportPages` (Task 2), `LabResultReportTemplate` + `LAB_REPORT_CSS` (`@/components/petition/LabResultReportTemplate`).

- [ ] **Step 1: Write the failing test**

Mock the page builder at the top of `src/pages/PetitionTimelineDetailPage.test.tsx` (near the other `vi.mock` calls) so the button's `pages.length > 0` condition is deterministic:

```ts
vi.mock("@/lib/labResultReport", () => ({
  buildLabResultReportPages: () => [{ reportNo: "LR-1" }],
}));
```

Add tests (the shared `beforeEach` resets `labApprovedAt` to undefined between tests):

```ts
it('shows the lab-result print button when Lab has issued results', async () => {
  mocks.petition.labApprovedAt = '2026-07-14T00:00:00.000Z';
  renderDetail();
  await screen.findByRole('heading', { name: 'P-2607-001' });
  expect(screen.getByRole('button', { name: /พิมพ์ผลวิเคราะห์ Lab/ })).toBeInTheDocument();
});

it('hides the lab-result print button when Lab is not finished', async () => {
  renderDetail();
  await screen.findByRole('heading', { name: 'P-2607-001' });
  expect(screen.queryByRole('button', { name: /พิมพ์ผลวิเคราะห์ Lab/ })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/pages/PetitionTimelineDetailPage.test.tsx`
Expected: FAIL — the "shows" test fails (button not rendered yet).

- [ ] **Step 3: Implement the button + dialog**

In `src/pages/PetitionTimelineDetailPage.tsx`:

1. Add imports near the other component imports:
```ts
import LabResultReportTemplate, { LAB_REPORT_CSS } from "@/components/petition/LabResultReportTemplate";
import { buildLabResultReportPages } from "@/lib/labResultReport";
```
And add `canPrintLabResult` to the existing petitionPrintability import:
```ts
import { canPrintPreReport, canPrintSampleLabel, canPrintLabResult } from "@/lib/petitionPrintability";
```

2. Add a color entry to `documentButtonColors` (~line 175-180), after `finalReport`:
```ts
  labResult: "border-sky-500 text-sky-500 hover:bg-sky-50",
```

3. Add state next to the other `*Open` states (~line 200-203):
```ts
  const [labResultOpen, setLabResultOpen] = useState(false);
```

4. Add a memoized page build. Place it after `petition`, `parameters`, `qcResults`, `labRequests`, and `groupMembership` are all in scope (e.g. just below where `qcResults`/`parameters` are declared, or alongside the other `useMemo`s ~line 270-280). Guard on `petition` being loaded — inside the component `petition` is already narrowed non-null by the loading/error early returns, but this memo may sit above them, so use optional handling:
```ts
  const labReportPages = useMemo(
    () => (petition ? buildLabResultReportPages({ petition, labRequests: labRequests ?? [], parameters, qcResults, groupMembership }) : []),
    [petition, labRequests, parameters, qcResults, groupMembership],
  );
```
> If the surrounding `useMemo`s already assume a non-null `petition` (they run after the early return), drop the ternary and call `buildLabResultReportPages` directly. Match the file's existing convention.

5. Add the button in the Documents card, after the Final Report button (~line 549):
```tsx
{canPrintLabResult(petition) && labReportPages.length > 0 && <Button variant="primary-outline" className={cn(documentButtonClass, documentButtonColors.labResult)} disabled={documentLoading} onClick={() => { void openDocument(setLabResultOpen); }}><FlaskConical className="h-4 w-4" />พิมพ์ผลวิเคราะห์ Lab</Button>}
```
Ensure `FlaskConical` is imported from `lucide-react` (add to the existing lucide import if absent).

6. Add the dialog next to the other print dialogs (~line 556-559):
```tsx
{labResultOpen && <PrintPreviewDialog open={labResultOpen} onOpenChange={setLabResultOpen} docType="coa" css={LAB_REPORT_CSS}><LabResultReportTemplate pages={labReportPages} /></PrintPreviewDialog>}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/pages/PetitionTimelineDetailPage.test.tsx`
Expected: PASS (all tests). Then type-check:
Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors referencing these files.

- [ ] **Step 5: Commit**

```bash
git add src/pages/PetitionTimelineDetailPage.tsx src/pages/PetitionTimelineDetailPage.test.tsx
git commit -m "feat(timeline): add print lab-result button to Documents card"
```

---

### Task 5: Petition detail page — add "พิมพ์ผลวิเคราะห์ Lab" button + dialog (Part 2)

**Files:**
- Modify: `src/pages/PetitionDetailPage.tsx` (imports, state, a `useMemo`, PageHeader actions ~`:296-311`, dialogs ~`:495-510`)
- Test: `src/pages/PetitionDetailPage.test.tsx`

**Interfaces:**
- Consumes: `canPrintLabResult` (Task 1), `buildLabResultReportPages` (Task 2), `LabResultReportTemplate` + `LAB_REPORT_CSS`.
- Reuses existing in-scope data: `data` (petition), `labRequests`, `parameters`, `qcResults`, `groupMembership`.

- [ ] **Step 1: Write the failing test**

The file uses `mocks` (`vi.hoisted`, mutable `mocks.petition`) and a `renderPage()` helper, and PageHeader's mock renders `actions`. There is **no** `beforeEach` that resets `mocks.petition`, so the test MUST delete `labApprovedAt` in a `finally` to avoid leaking into later tests.

Mock the builder near the other `vi.mock`s:
```ts
vi.mock("@/lib/labResultReport", () => ({
  buildLabResultReportPages: () => [{ reportNo: "LR-1" }],
}));
```
Add a test:
```ts
it('shows the print lab-result action when Lab has issued results', async () => {
  mocks.petition.labApprovedAt = '2026-07-14T00:00:00.000Z';
  try {
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: /พิมพ์ผลวิเคราะห์ Lab/ })).toBeInTheDocument());
  } finally {
    delete (mocks.petition as { labApprovedAt?: string }).labApprovedAt;
  }
});
```
> Ensure `waitFor` and `screen` are imported at the top of the file (add to the existing `@testing-library/react` import if missing).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/pages/PetitionDetailPage.test.tsx`
Expected: FAIL — button not rendered yet.

- [ ] **Step 3: Implement the button + dialog**

In `src/pages/PetitionDetailPage.tsx`:

1. Add imports:
```ts
import LabResultReportTemplate, { LAB_REPORT_CSS } from '@/components/petition/LabResultReportTemplate';
import { buildLabResultReportPages } from '@/lib/labResultReport';
import { canPrintLabResult } from '@/lib/petitionPrintability';
```
(`canPrintSampleLabel`/`canPrintPreReport` are already imported — add `canPrintLabResult` to that line instead of a new import if they share one.)

2. Add state near the other `*Open` states:
```ts
  const [labResultOpen, setLabResultOpen] = useState(false);
```

3. Add the memoized pages near the existing `approvalGroups` memo (~line 194), reusing the same in-scope data:
```ts
  const labReportPages = useMemo(
    () => data ? buildLabResultReportPages({ petition: data, labRequests: labRequests ?? [], parameters, qcResults, groupMembership }) : [],
    [data, labRequests, parameters, qcResults, groupMembership],
  );
```

4. Add the action button in the PageHeader `actions` block (after the Final Report / Pre Report buttons, ~line 311+). Match the existing `size="sm"` action style:
```tsx
{canPrintLabResult(data) && labReportPages.length > 0 && (
  <Button variant="primary-outline" size="sm" onClick={() => setLabResultOpen(true)}>
    <FlaskConical className="h-4 w-4" />
    พิมพ์ผลวิเคราะห์ Lab
  </Button>
)}
```
Add `FlaskConical` to the `lucide-react` import if absent.

5. Add the dialog next to the other `PrintPreviewDialog`s (~line 508-510):
```tsx
<PrintPreviewDialog open={labResultOpen} onOpenChange={setLabResultOpen} docType="coa" css={LAB_REPORT_CSS}>
  <LabResultReportTemplate pages={labReportPages} />
</PrintPreviewDialog>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/pages/PetitionDetailPage.test.tsx`
Expected: PASS. Then:
Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors referencing these files.

- [ ] **Step 5: Commit**

```bash
git add src/pages/PetitionDetailPage.tsx src/pages/PetitionDetailPage.test.tsx
git commit -m "feat(petition): add print lab-result action to detail page"
```

---

### Task 6: DRY — route `/lab-results/:id` through the shared helper

**Files:**
- Modify: `src/pages/LabResultDetailPage.tsx` (~`:32-53`)

**Interfaces:**
- Consumes: `buildLabResultReportPages` (Task 2). Removes local `buildApprovalGroups`/param-filter duplication.

- [ ] **Step 1: Replace the inline build with the shared helper**

In `src/pages/LabResultDetailPage.tsx`:

1. Remove the now-unused imports of `buildApprovalGroups` (`@/lib/qcApprovalRows`) and `buildLabReportPages` (`@/lib/labReport`); add:
```ts
import { buildLabResultReportPages } from '@/lib/labResultReport';
```
Keep the `LabResultReportTemplate` + `LAB_REPORT_CSS` and `useItemGroupMembership` imports.

2. The page currently filters parameters to `scope === 'lab'` at fetch time and builds `groups` + `pages` separately. Since `buildLabResultReportPages` filters Lab-scope internally, you may stop the fetch-time filter (pass all parameters) OR keep it (idempotent). To minimize churn, keep the fetch-time filter and replace the `groups`/`pages` memos:

Replace:
```ts
  const groups = useMemo(() => {
    if (!petition) return [];
    return buildApprovalGroups(petition, parameters, results, groupMembership);
  }, [petition, parameters, results, groupMembership]);

  const pages = useMemo(() => {
    if (!petition) return [];
    return buildLabReportPages(petition, labRequests ?? [], groups);
  }, [petition, labRequests, groups]);
```
with:
```ts
  const pages = useMemo(
    () => (petition ? buildLabResultReportPages({ petition, labRequests: labRequests ?? [], parameters, qcResults: results, groupMembership }) : []),
    [petition, labRequests, parameters, results, groupMembership],
  );
```

3. `LabResultGroups` still needs `groups`. It is rendered from `groups` (~line 106). Keep a `groups` memo for the on-screen list — the report no longer depends on it, but the list does:
```ts
  const groups = useMemo(
    () => (petition ? buildApprovalGroups(petition, parameters, results, groupMembership) : []),
    [petition, parameters, results, groupMembership],
  );
```
> This means Task 6 keeps `buildApprovalGroups` imported (for the on-screen `LabResultGroups`), and only the *report page* build (`pages`) moves to the shared helper. Do NOT remove `buildApprovalGroups`; only remove the standalone `buildLabReportPages` import.

- [ ] **Step 2: Run tests + type-check**

Run: `npm run test -- src/pages/LabResultDetailPage`
Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS / no new errors. Manually confirm the page's print button still yields the same report (pages non-empty for a lab-completed petition).

- [ ] **Step 3: Commit**

```bash
git add src/pages/LabResultDetailPage.tsx
git commit -m "refactor(lab-results): build report pages via shared helper"
```

---

## Final Verification

- [ ] Run the full suite: `npm run test`
- [ ] Type-check: `npx tsc -p tsconfig.app.json --noEmit` (no NEW errors vs. the ~12 pre-existing latent ones)
- [ ] Lint touched files: `npm run lint`
- [ ] Manual smoke (dev server): on `/petition-timeline/:id` for a received petition, the "ป้ายนำส่งตัวอย่าง" button is gone; for a Lab-completed petition, "พิมพ์ผลวิเคราะห์ Lab" appears and opens a preview matching `/lab-results/:id`; same button appears on `/petitions/:id`.

## Notes / Known limitations

- `canPrintSampleLabel` keys off `qcReceivedBy`/`labReceivedBy`. The `/receive` route sets `*By` and `*At` together, so this is correct for all modern petitions. Truly legacy petitions (pre side-split, only `receivedBy`/`receivedAt`) are not covered — this matches the existing `/petitions/:id` behavior and is intentionally left consistent, not expanded in this change.
