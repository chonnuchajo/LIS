# Editable submissionNo (unlock delivery note number) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users type the delivery note number (`submissionNo`) as one shared field per petition; blank defaults to the petition number on save.

**Architecture:** One editable field in the `ItemsStep` header (controlled by each parent page). On submit the page copies that single value into every `items[].submissionNo`. The backend stops force-overwriting and only defaults blank → `petitionNo`. Data model unchanged (still stored per item), so print templates / PetitionView keep working.

**Tech Stack:** React + TypeScript (Vitest), Express + Mongoose (CommonJS).

---

## File Structure

- `src/lib/submissionNo.ts` (create) — pure helper `resolveSubmissionNo(raw, fallback)`; the one TDD-tested unit.
- `src/lib/submissionNo.test.ts` (create) — Vitest tests for the helper.
- `src/components/petition/wizard/ItemsStep.tsx` (modify) — add header field props; remove per-item locked input.
- `src/pages/petitions/ProductionPetitionNewPage.tsx` (modify) — own shared `submissionNo` state; map into items on submit.
- `src/pages/PetitionEditPage.tsx` (modify) — load existing value (fallback petitionNo) via helper; map into items on save.
- `server/routes/petitions.js` (modify) — default-on-blank in create + update instead of overwrite.

Note: server is CommonJS and is **not** in the Vitest `include` (`src/**` only), so the backend uses the same one-line default logic inline (mirrors the helper) and is verified manually.

---

### Task 1: `resolveSubmissionNo` helper (TDD)

**Files:**
- Create: `src/lib/submissionNo.ts`
- Test: `src/lib/submissionNo.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/submissionNo.test.ts
import { describe, it, expect } from 'vitest';
import { resolveSubmissionNo } from './submissionNo';

describe('resolveSubmissionNo', () => {
  it('returns the trimmed raw value when non-empty', () => {
    expect(resolveSubmissionNo('  DN-123 ', 'P-001')).toBe('DN-123');
  });

  it('falls back when raw is empty or whitespace', () => {
    expect(resolveSubmissionNo('', 'P-001')).toBe('P-001');
    expect(resolveSubmissionNo('   ', 'P-001')).toBe('P-001');
  });

  it('falls back when raw is undefined or null', () => {
    expect(resolveSubmissionNo(undefined, 'P-001')).toBe('P-001');
    expect(resolveSubmissionNo(null, 'P-001')).toBe('P-001');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/submissionNo.test.ts`
Expected: FAIL — cannot resolve `./submissionNo` / `resolveSubmissionNo is not a function`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/submissionNo.ts
/**
 * เลขที่ใบนำส่ง (submissionNo): ใช้ค่าที่กรอก (trim) ถ้าว่าง → fallback (เลขคำขอ).
 */
export function resolveSubmissionNo(raw: string | null | undefined, fallback: string): string {
  const trimmed = (raw ?? '').trim();
  return trimmed || fallback;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/submissionNo.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/submissionNo.ts src/lib/submissionNo.test.ts
git commit -m "feat(petition): add resolveSubmissionNo helper (blank -> fallback)" -- src/lib/submissionNo.ts src/lib/submissionNo.test.ts
```

---

### Task 2: ItemsStep — single editable header field, remove per-item lock

**Files:**
- Modify: `src/components/petition/wizard/ItemsStep.tsx`

- [ ] **Step 1: Add props to the `Props` interface**

In the `interface Props { ... }` block (currently ends at `onDelivererChange: (v: SubmitterValues) => void;`), add two props:

```ts
  deliverer: SubmitterValues;
  onDelivererChange: (v: SubmitterValues) => void;
  submissionNo: string;
  onSubmissionNoChange: (v: string) => void;
```

- [ ] **Step 2: Destructure the new props**

In `export default function ItemsStep({ ... })`, add to the destructure list (after `onDelivererChange,`):

```ts
  deliverer,
  onDelivererChange,
  submissionNo,
  onSubmissionNoChange,
}: Props) {
```

- [ ] **Step 3: Add the shared header field**

Insert this block immediately AFTER the `รายการตัวอย่าง` header `</div>` that closes at the line with the `เพิ่มตัวอย่าง` button group (the `</div>` currently on the line right before `<div className="space-y-4">`), and BEFORE `<div className="space-y-4">`:

```tsx
      <div className="border-t border-grey-200 pt-4">
        <Label htmlFor="submissionNo">เลขที่ใบนำส่ง</Label>
        <Input
          id="submissionNo"
          value={submissionNo}
          onChange={(e) => onSubmissionNoChange(e.target.value)}
          placeholder="เว้นว่าง = ใช้เลขคำขออัตโนมัติ"
          className="sm:max-w-xs"
        />
        <p className="mt-1 text-xs text-grey-400">ใช้ร่วมทุกตัวอย่างในใบนี้ · เว้นว่างจะใช้เลขคำขอให้อัตโนมัติ</p>
      </div>

```

- [ ] **Step 4: Remove the per-item locked submissionNo input**

Delete this entire block from inside the item loop (currently the `เลขที่ใบนำส่ง` field, the one with `readOnly disabled`):

```tsx
                <div>
                  <Label>เลขที่ใบนำส่ง</Label>
                  <Input
                    value={it.submissionNo}
                    readOnly
                    disabled
                    placeholder="ใช้เลขคำขออัตโนมัติเมื่อบันทึก"
                    className="bg-grey-50 text-grey-500"
                  />
                  <p className="mt-1 text-xs text-grey-400">= เลขคำขอ (กำหนดอัตโนมัติ แก้ไขไม่ได้)</p>
                </div>
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: New errors ONLY in the two pages that render `<ItemsStep>` (missing `submissionNo` / `onSubmissionNoChange` props) — `ProductionPetitionNewPage.tsx` and `PetitionEditPage.tsx`. These are fixed in Tasks 3–4. No errors inside `ItemsStep.tsx` itself.

- [ ] **Step 6: Commit**

```bash
git add src/components/petition/wizard/ItemsStep.tsx
git commit -m "feat(petition): single editable submissionNo field in ItemsStep header" -- src/components/petition/wizard/ItemsStep.tsx
```

---

### Task 3: ProductionPetitionNewPage — own shared state + map on submit

**Files:**
- Modify: `src/pages/petitions/ProductionPetitionNewPage.tsx`

- [ ] **Step 1: Add shared state**

Right after the `items` state (`const [items, setItems] = useState<ItemRowValues[]>(() => ...)`), add:

```tsx
  const [submissionNo, setSubmissionNo] = useState('');
```

- [ ] **Step 2: Pre-fill from rejected predecessor**

In the `revisionOfId` effect, right after the existing `setItems(source.items.map(...))` call (after its closing `);`), add:

```tsx
        setSubmissionNo(source.items[0]?.submissionNo ?? '');
```

- [ ] **Step 3: Pass props to ItemsStep**

In the `<ItemsStep ... />` render, add the two props (after `onDelivererChange={...}`):

```tsx
                onDelivererChange={(v) => {
                  setDelivererTouched(true);
                  setDeliverer(v);
                }}
                submissionNo={submissionNo}
                onSubmissionNoChange={setSubmissionNo}
              />
```

- [ ] **Step 4: Write the shared value into every item on submit**

In `handleSubmit`, change the `items:` line of the payload from:

```tsx
        items: items.map((it, idx) => ({ ...it, seq: idx + 1 })),
```

to:

```tsx
        items: items.map((it, idx) => ({ ...it, seq: idx + 1, submissionNo })),
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors in `ProductionPetitionNewPage.tsx`. (PetitionEditPage may still error until Task 4.)

- [ ] **Step 6: Commit**

```bash
git add src/pages/petitions/ProductionPetitionNewPage.tsx
git commit -m "feat(petition): wire shared submissionNo in production new page" -- src/pages/petitions/ProductionPetitionNewPage.tsx
```

---

### Task 4: PetitionEditPage — load existing value + map on save

**Files:**
- Modify: `src/pages/PetitionEditPage.tsx`

- [ ] **Step 1: Import the helper**

Add near the other `@/lib` imports (top of file):

```tsx
import { resolveSubmissionNo } from '@/lib/submissionNo';
```

- [ ] **Step 2: Add shared state**

After `const [items, setItems] = useState<ItemRowValues[]>([]);`, add:

```tsx
  const [submissionNo, setSubmissionNo] = useState('');
```

- [ ] **Step 3: Load existing submissionNo (fallback petitionNo)**

Change the `mappedItems` map line 112 from:

```tsx
      submissionNo: data.petitionNo, // เลขที่ใบนำส่ง = เลขคำขอ เสมอ
```

to:

```tsx
      submissionNo: it.submissionNo ?? '',
```

Then immediately after `setItems(mappedItems);`, add:

```tsx
    setSubmissionNo(resolveSubmissionNo(data.items[0]?.submissionNo, data.petitionNo));
```

- [ ] **Step 4: Pass props to ItemsStep**

In the `<ItemsStep ... />` render, the existing last prop is `onDelivererChange={setDeliverer}` followed by `/>`. Insert the two new props between that line and the closing `/>`, so it reads:

```tsx
                deliverer={deliverer}
                onDelivererChange={setDeliverer}
                submissionNo={submissionNo}
                onSubmissionNoChange={setSubmissionNo}
              />
```

(Only the `submissionNo` and `onSubmissionNoChange` lines are new — do not duplicate `deliverer` / `onDelivererChange`.)

- [ ] **Step 5: Write the shared value into every item on save**

In `handleSave`, change:

```tsx
      const mappedItems = items.map((it, idx) => ({ ...it, seq: idx + 1 }));
```

to:

```tsx
      const mappedItems = items.map((it, idx) => ({ ...it, seq: idx + 1, submissionNo }));
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS — no errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/PetitionEditPage.tsx
git commit -m "feat(petition): wire editable submissionNo in petition edit page" -- src/pages/PetitionEditPage.tsx
```

---

### Task 5: Backend — default on blank instead of overwrite

**Files:**
- Modify: `server/routes/petitions.js`

- [ ] **Step 1: Create path — default blank → petitionNo**

Change the create block (currently lines ~338–339):

```js
    // เลขที่ใบนำส่ง = เลขคำขอ เสมอ (ผู้ใช้แก้ไขไม่ได้)
    const items = body.items.map((it) => ({ ...it, submissionNo: petitionNo }));
```

to:

```js
    // เลขที่ใบนำส่ง: ใช้ค่าที่กรอก ถ้าว่าง → เลขคำขอ
    const items = body.items.map((it) => ({
      ...it,
      submissionNo: (it.submissionNo || '').trim() || petitionNo,
    }));
```

- [ ] **Step 2: Update path — default blank → before.petitionNo**

Change the update block (currently lines ~541–544):

```js
    // เลขที่ใบนำส่ง = เลขคำขอ เสมอ (กันการแก้ค่าจาก client)
    if (Array.isArray(updates.items)) {
      updates.items = updates.items.map((it) => ({ ...it, submissionNo: before.petitionNo }));
    }
```

to:

```js
    // เลขที่ใบนำส่ง: ใช้ค่าที่กรอก ถ้าว่าง → เลขคำขอ
    if (Array.isArray(updates.items)) {
      updates.items = updates.items.map((it) => ({
        ...it,
        submissionNo: (it.submissionNo || '').trim() || before.petitionNo,
      }));
    }
```

- [ ] **Step 3: Commit**

```bash
git add server/routes/petitions.js
git commit -m "feat(petition): backend defaults blank submissionNo to petitionNo" -- server/routes/petitions.js
```

---

### Task 6: Full verification

- [ ] **Step 1: Type-check + lint + unit tests**

Run: `npx tsc --noEmit`
Expected: PASS, no errors.

Run: `npm run lint`
Expected: no new errors in the 4 touched src files.

Run: `npx vitest run src/lib/submissionNo.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 2: Manual smoke (both processes running: `npm run dev` + `cd server && npm run dev`)**

  1. Production new petition → leave เลขที่ใบนำส่ง blank → save. Open the saved petition (PetitionView / DB): every `items[].submissionNo` === `petitionNo`.
  2. New petition → type `DN-123` in เลขที่ใบนำส่ง → save. Every `items[].submissionNo` === `DN-123`.
  3. Edit an existing petition whose submissionNo == petitionNo → field shows the petition number → change to `DN-999` → save → reopen: all items show `DN-999`.
  4. Regression: print preview (`SampleLabelPrintTemplate` / `PetitionPrintTemplate`) and PetitionView still render the เลขที่ใบนำส่ง value.

- [ ] **Step 3: Final note**

No commit needed if Steps 1–2 pass with no code changes. If a fix was required, commit it with an explicit pathspec.
