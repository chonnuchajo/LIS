# Density Batch-Sync into "ค่า ถพ." (QC) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-button sync on the QC testing form that pulls DMA 501 density readings from the `Result-Density` collection by trailing batch number and fills the multi-entry `ค่า ถพ.` parameter (one entry per reading), polling every 30 s until readings appear.

**Architecture:** Server owns batch matching via a new `GET /result-densities/by-batch/:batch` endpoint backed by pure helpers in `server/lib/densityBatch.js`. The client adds an API method, pure mapping helpers (`src/lib/densitySync.ts`), and a self-contained `DensitySyncButton` (TanStack Query polling) wired into the `param.multiEntry` block of `QCTestingDetailPage`. `T (set)` is display-only (provenance + comparison line), never stored as a value. Entries are persisted by reusing `api.saveQCEntries` (whole-array replace).

**Tech Stack:** Express 4 + Mongoose 8 (server), React 18 + TS + TanStack Query v5 + Tailwind (client), Vitest (client tests), `node:test` (server helper test).

**Spec:** `docs/superpowers/specs/2026-06-13-density-batch-sync-design.md`

---

## File Structure

- **Create** `server/lib/densityBatch.js` — pure: `extractDensityBatch`, `batchMatches`.
- **Create** `server/lib/densityBatch.test.js` — `node:test` unit tests for the above.
- **Modify** `server/routes/result-densities.js` — add `GET /by-batch/:batch`.
- **Modify** `src/lib/api.ts` — add `getResultDensitiesByBatch`.
- **Create** `src/lib/densitySync.ts` — pure: labels, `sourceSiblingKey`, `densityRowToEntry`, `hasHandTypedEntries`, `formatTSetComparison`.
- **Create** `src/lib/densitySync.test.ts` — Vitest unit tests for the above.
- **Create** `src/components/lis/DensitySyncButton.tsx` — button + polling + cancel UI.
- **Modify** `src/pages/QCTestingDetailPage.tsx` — `applyDensityRows` handler, render button + T(set) comparison line in the `param.multiEntry` block.
- **Config (ops)** set `ค่า ถพ.` `multiEntry: true` and `npm run seed:export`.

---

## Task 1: Server batch-matching helpers (pure, TDD)

**Files:**
- Create: `server/lib/densityBatch.js`
- Test: `server/lib/densityBatch.test.js`

- [ ] **Step 1: Write the failing test**

Create `server/lib/densityBatch.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { extractDensityBatch, batchMatches } = require('./densityBatch');

test('extractDensityBatch: trailing segment after last dash', () => {
  assert.equal(extractDensityBatch('26S-FPN5-GMP-009'), '009');
  assert.equal(extractDensityBatch('26S-ACT50-095 bottom'), '095');
  assert.equal(extractDensityBatch('26S-ACT50-095 TOP'), '095');
  assert.equal(extractDensityBatch('PLAIN'), 'PLAIN');
  assert.equal(extractDensityBatch('  26S-X-12  extra words '), '12');
  assert.equal(extractDensityBatch(''), null);
  assert.equal(extractDensityBatch(null), null);
  assert.equal(extractDensityBatch(undefined), null);
});

test('batchMatches: exact and numeric-equal', () => {
  assert.equal(batchMatches('009', '26S-FPN5-GMP-009'), true);
  assert.equal(batchMatches('9', '26S-FPN5-GMP-009'), true);   // 009 == 9
  assert.equal(batchMatches('009', '26S-FPN5-GMP-9'), true);
  assert.equal(batchMatches('095', '26S-ACT50-095 bottom'), true);
  assert.equal(batchMatches('10', '26S-X-009'), false);
  assert.equal(batchMatches('', '26S-X-009'), false);
  assert.equal(batchMatches(null, '26S-X-009'), false);
  assert.equal(batchMatches('009', 'NODASH'), false);          // extract 'NODASH' != '009'
  assert.equal(batchMatches('9a', '26S-X-9a'), true);          // exact string match
  assert.equal(batchMatches('9', '26S-X-9a'), false);          // not numeric-equal (9a not pure digits)
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test server/lib/densityBatch.test.js`
Expected: FAIL — `Cannot find module './densityBatch'`.

- [ ] **Step 3: Write minimal implementation**

Create `server/lib/densityBatch.js`:

```js
// Pure helpers for matching a petition batch number to a Result-Density row's
// "Sample name". The trailing batch number is the segment after the last "-",
// taken from the first whitespace-delimited token (so " TOP"/" bottom" suffixes
// are ignored). See docs/superpowers/specs/2026-06-13-density-batch-sync-design.md.

function extractDensityBatch(sampleName) {
  if (sampleName == null) return null;
  const token = String(sampleName).trim().split(/\s+/)[0] || '';
  if (!token) return null;
  if (token.includes('-')) {
    const seg = token.slice(token.lastIndexOf('-') + 1);
    return seg || null;
  }
  return token;
}

function batchMatches(petitionBatchNo, sampleName) {
  const b = petitionBatchNo == null ? '' : String(petitionBatchNo).trim();
  if (!b) return false;
  const x = extractDensityBatch(sampleName);
  if (!x) return false;
  if (x === b) return true;
  if (/^\d+$/.test(x) && /^\d+$/.test(b)) return parseInt(x, 10) === parseInt(b, 10);
  return false;
}

module.exports = { extractDensityBatch, batchMatches };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test server/lib/densityBatch.test.js`
Expected: PASS — 2 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add server/lib/densityBatch.js server/lib/densityBatch.test.js
git commit -m "feat(density-sync): pure batch-matching helpers + tests"
```

---

## Task 2: Server endpoint `GET /result-densities/by-batch/:batch`

**Files:**
- Modify: `server/routes/result-densities.js`

- [ ] **Step 1: Add the route**

In `server/routes/result-densities.js`, add the import near the top (after `const ResultDensity = require('../models/ResultDensity');`):

```js
const { batchMatches } = require('../lib/densityBatch');
```

Then add this route immediately **after** the `GET /products` handler (before `GET /`):

```js
// GET /api/result-densities/by-batch/:batch — rows whose Sample name trailing
// batch number matches :batch. Matching is done in JS via batchMatches so the
// rule is identical to the unit-tested helper (009 == 9, suffix-tolerant).
router.get('/by-batch/:batch', async (req, res) => {
  try {
    const batch = String(req.params.batch || '').trim();
    if (!batch) return res.json({ batch, docs: [] });
    const all = await ResultDensity.find({}).sort({ _id: 1 }).lean();
    const docs = all.filter((d) => batchMatches(batch, d['Sample name']));
    res.json({ batch, docs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 2: Start the backend**

Run (separate terminal): `cd server && npm run dev`
Expected: `nodemon` boots, connects to MongoDB, no errors.

- [ ] **Step 3: Verify against seeded data**

The seed `server/seed-data/Result-Density.json` contains `Sample name` like `26S-ACT50-095 bottom` (batch `095`). With a DB seeded from it, run:

```bash
curl -s "http://localhost:3001/api/result-densities/by-batch/095"
```
Expected: JSON `{ "batch": "095", "docs": [ ... ] }` where every `docs[i]["Sample name"]` ends in `095` (e.g. `26S-ACT50-095 TOP`, `26S-ACT50-095 bottom`). Also:

```bash
curl -s "http://localhost:3001/api/result-densities/by-batch/95"
```
Expected: same rows (numeric-equal `095` == `95`).

```bash
curl -s "http://localhost:3001/api/result-densities/by-batch/zzzz999"
```
Expected: `{ "batch": "zzzz999", "docs": [] }`.

- [ ] **Step 4: Commit**

```bash
git add server/routes/result-densities.js
git commit -m "feat(density-sync): add /result-densities/by-batch/:batch endpoint"
```

---

## Task 3: API client method

**Files:**
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Add the method**

In `src/lib/api.ts`, immediately after `getResultDensityProducts: () => request<string[]>('/result-densities/products'),` (line ~197), add:

```ts
  // All DMA 501 readings whose Sample name trailing batch matches `batch`.
  getResultDensitiesByBatch: (batch: string) =>
    request<{ batch: string; docs: Record<string, unknown>[] }>(
      `/result-densities/by-batch/${encodeURIComponent(batch)}`,
    ),
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors referencing `api.ts` (repo has ~12 pre-existing latent errors elsewhere; do not introduce new ones here).

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(density-sync): api.getResultDensitiesByBatch"
```

---

## Task 4: Client pure helpers (TDD)

**Files:**
- Create: `src/lib/densitySync.ts`
- Test: `src/lib/densitySync.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/densitySync.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  SG_VALUE_LABEL,
  SG_TEMP_LABEL,
  sourceSiblingKey,
  densityRowToEntry,
  hasHandTypedEntries,
  formatTSetComparison,
} from './densitySync';

const ROW = {
  'Sample name': '26S-ACT50-095 bottom',
  'Density [g/cm³]': '0.9919',
  'T (block) [°C]': '30.00',
  'T (set) [°C]': '30.00',
  'Instrument name': 'DMA 501',
};

describe('labels', () => {
  it('SG value/temp labels', () => {
    expect(SG_VALUE_LABEL).toBe('ค่าถพ.');
    expect(SG_TEMP_LABEL).toBe('อุณหภูมิ');
    expect(sourceSiblingKey('อุณหภูมิ')).toBe('อุณหภูมิ__source');
  });
});

describe('densityRowToEntry', () => {
  it('maps density + T(block) and stores T(set) in provenance', () => {
    const e = densityRowToEntry(ROW, '2026-06-13T03:00:00.000Z');
    expect(e['ค่าถพ.']).toBe(0.9919);
    expect(e['อุณหภูมิ']).toBe(30);
    const tempSrc = e['อุณหภูมิ__source'] as Record<string, unknown>;
    expect(tempSrc.source).toBe('instrument');
    expect(tempSrc.instrument).toBe('DMA 501');
    expect(tempSrc.sampleName).toBe('26S-ACT50-095 bottom');
    expect(tempSrc.tSet).toBe(30);
    expect(tempSrc.fetchedAt).toBe('2026-06-13T03:00:00.000Z');
    const valSrc = e['ค่าถพ.__source'] as Record<string, unknown>;
    expect(valSrc.source).toBe('instrument');
  });
  it('leaves value empty when unparseable', () => {
    const e = densityRowToEntry({ ...ROW, 'Density [g/cm³]': 'n/a' }, '2026-06-13T03:00:00.000Z');
    expect(e['ค่าถพ.']).toBe('');
  });
  it('falls back to DMA 501 when instrument name missing', () => {
    const e = densityRowToEntry({ ...ROW, 'Instrument name': '' }, 'x');
    expect((e['อุณหภูมิ__source'] as Record<string, unknown>).instrument).toBe('DMA 501');
  });
});

describe('hasHandTypedEntries', () => {
  it('false for empty / instrument-sourced entries', () => {
    expect(hasHandTypedEntries(undefined)).toBe(false);
    expect(hasHandTypedEntries([])).toBe(false);
    expect(hasHandTypedEntries([densityRowToEntry(ROW, 'x')])).toBe(false);
  });
  it('true when a value lacks instrument provenance', () => {
    expect(hasHandTypedEntries([{ 'ค่าถพ.': 0.99 }])).toBe(true);
    expect(hasHandTypedEntries([{ 'อุณหภูมิ': 30 }])).toBe(true);
  });
});

describe('formatTSetComparison', () => {
  it('match / differ / no-standard / null', () => {
    expect(formatTSetComparison(30, 30)?.status).toBe('match');
    expect(formatTSetComparison(30, 25)?.status).toBe('differ');
    expect(formatTSetComparison(30, null)?.status).toBe('no-standard');
    expect(formatTSetComparison('', 30)).toBeNull();
    expect(formatTSetComparison(undefined, 30)).toBeNull();
  });
  it('text includes both values when standard present', () => {
    expect(formatTSetComparison(30, 30)?.text).toBe('เครื่องตั้งที่ (T set): 30 • มาตรฐาน: 30');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/densitySync.test.ts`
Expected: FAIL — cannot resolve `./densitySync`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/densitySync.ts`:

```ts
import { SG_FIELD_LABEL } from '@/lib/formSpecificGravity';

// The two visible fields of the "ค่า ถพ." parameter.
export const SG_VALUE_LABEL = SG_FIELD_LABEL; // 'ค่าถพ.'
export const SG_TEMP_LABEL = 'อุณหภูมิ';

// Result-Density column keys (raw DMA 501 export).
const COL_DENSITY = 'Density [g/cm³]';
const COL_TBLOCK = 'T (block) [°C]';
const COL_TSET = 'T (set) [°C]';
const COL_INSTRUMENT = 'Instrument name';
const COL_SAMPLE = 'Sample name';

// Provenance sibling convention: "<label>__source" (mirrors LabTestingDetailPage).
export function sourceSiblingKey(label: string): string {
  return `${label}__source`;
}

function toNum(v: unknown): number | '' {
  if (v == null || v === '') return '';
  const n = Number(v);
  return Number.isFinite(n) ? n : '';
}

// Map one Result-Density row to a QCTestResult entry for the "ค่า ถพ." parameter.
// `fetchedAt` is passed in (pure: no Date access here) and recorded in provenance.
export function densityRowToEntry(
  row: Record<string, unknown>,
  fetchedAt: string,
): Record<string, unknown> {
  const instrument = String(row[COL_INSTRUMENT] || 'DMA 501');
  const sampleName = row[COL_SAMPLE];
  const tSet = toNum(row[COL_TSET]);
  return {
    [SG_VALUE_LABEL]: toNum(row[COL_DENSITY]),
    [SG_TEMP_LABEL]: toNum(row[COL_TBLOCK]),
    [sourceSiblingKey(SG_VALUE_LABEL)]: { source: 'instrument', instrument, sampleName, fetchedAt },
    [sourceSiblingKey(SG_TEMP_LABEL)]: {
      source: 'instrument', instrument, sampleName, fetchedAt,
      tSet, tBlock: toNum(row[COL_TBLOCK]),
    },
  };
}

// True if any entry holds a non-empty SG value/temp without instrument provenance
// (i.e. it was hand-typed) — drives the overwrite confirm.
export function hasHandTypedEntries(entries?: Record<string, unknown>[]): boolean {
  for (const e of entries ?? []) {
    if (!e) continue;
    for (const label of [SG_VALUE_LABEL, SG_TEMP_LABEL]) {
      const v = e[label];
      if (v === '' || v == null) continue;
      const src = e[sourceSiblingKey(label)] as { source?: string } | undefined;
      if (!src || src.source !== 'instrument') return true;
    }
  }
  return false;
}

export interface TSetComparison {
  text: string;
  status: 'match' | 'differ' | 'no-standard';
}

// Build the read-only "T set vs standard" line shown under each entry. Returns
// null when there is no usable T(set) value.
export function formatTSetComparison(tSet: unknown, standardValue: unknown): TSetComparison | null {
  if (tSet == null || tSet === '' || !Number.isFinite(Number(tSet))) return null;
  const t = Number(tSet);
  if (standardValue == null || standardValue === '' || !Number.isFinite(Number(standardValue))) {
    return { text: `เครื่องตั้งที่ (T set): ${t}`, status: 'no-standard' };
  }
  const s = Number(standardValue);
  return {
    text: `เครื่องตั้งที่ (T set): ${t} • มาตรฐาน: ${s}`,
    status: t === s ? 'match' : 'differ',
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/densitySync.test.ts`
Expected: PASS — all assertions green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/densitySync.ts src/lib/densitySync.test.ts
git commit -m "feat(density-sync): pure client helpers (row→entry, provenance, T(set) compare) + tests"
```

---

## Task 5: `DensitySyncButton` component

**Files:**
- Create: `src/components/lis/DensitySyncButton.tsx`
- Test: `src/components/lis/DensitySyncButton.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/lis/DensitySyncButton.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DensitySyncButton from './DensitySyncButton';

function renderWith(props: Partial<React.ComponentProps<typeof DensitySyncButton>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DensitySyncButton batchNo="009" hasHandTyped={false} onRows={vi.fn()} {...props} />
    </QueryClientProvider>,
  );
}

describe('DensitySyncButton', () => {
  it('renders the sync button', () => {
    renderWith();
    expect(screen.getByRole('button', { name: /ดึงค่า ถพ\./ })).toBeInTheDocument();
  });
  it('is disabled when batchNo is empty', () => {
    renderWith({ batchNo: '' });
    expect(screen.getByRole('button', { name: /ดึงค่า ถพ\./ })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/lis/DensitySyncButton.test.tsx`
Expected: FAIL — cannot resolve `./DensitySyncButton`.

- [ ] **Step 3: Write the component**

Create `src/components/lis/DensitySyncButton.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Radio, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

interface DensitySyncButtonProps {
  /** Petition item batch number to match against Result-Density. */
  batchNo: string;
  /** Whether existing entries hold hand-typed values (triggers overwrite confirm). */
  hasHandTyped: boolean;
  /** Called once with the matched rows when readings arrive. */
  onRows: (docs: Record<string, unknown>[]) => void;
  disabled?: boolean;
}

/**
 * Pull DMA 501 density readings for `batchNo` from Result-Density and hand them to
 * `onRows`. If none exist yet, poll every 30 s until they appear, then stop. The
 * parent owns persistence (saveQCEntries) and entry mapping.
 */
export default function DensitySyncButton({
  batchNo, hasHandTyped, onRows, disabled = false,
}: DensitySyncButtonProps) {
  const [active, setActive] = useState(false);
  const appliedRef = useRef(false);

  const { data, isError, error } = useQuery({
    queryKey: ['density-by-batch', batchNo],
    queryFn: () => api.getResultDensitiesByBatch(batchNo),
    enabled: active && !!batchNo,
    refetchInterval: (q) => (q.state.data?.docs?.length ? false : 30_000),
  });

  const docs = data?.docs ?? [];

  // Apply once when readings arrive (initial fetch or a later poll).
  useEffect(() => {
    if (active && docs.length && !appliedRef.current) {
      appliedRef.current = true;
      onRows(docs);
      toast.success(`ดึงค่า ถพ. จากเครื่องแล้ว (${docs.length} รายการ)`);
      setActive(false);
    }
  }, [active, docs, onRows]);

  useEffect(() => {
    if (active && isError) {
      toast.error('ดึงค่าจากเครื่องไม่ได้ — กรอกมือได้', {
        description: error instanceof Error ? error.message : undefined,
      });
      setActive(false);
    }
  }, [active, isError, error]);

  const start = () => {
    if (!batchNo) return;
    if (hasHandTyped && !window.confirm('มีค่าที่กรอกเอง จะเขียนทับด้วยค่าจากเครื่อง?')) return;
    appliedRef.current = false;
    setActive(true);
  };

  if (active && !docs.length) {
    return (
      <div className="flex items-center gap-2 text-xs text-amber-600">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        รอค่าจากเครื่อง…
        <Button
          type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2"
          onClick={() => setActive(false)}
        >
          <X className="h-3.5 w-3.5" /> ยกเลิก
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button" variant="outline" size="sm" className="h-8 gap-1 px-2 text-xs"
      onClick={start}
      disabled={disabled || !batchNo}
      title={!batchNo ? 'ไม่มีเลข batch' : 'ดึงค่า ถพ. จากเครื่อง DMA 501 ตามเลข batch'}
    >
      <Radio className="h-3.5 w-3.5" /> ดึงค่า ถพ.
    </Button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/lis/DensitySyncButton.test.tsx`
Expected: PASS — both tests green.

> Note: polling/apply behaviour is covered by the manual E2E in Task 7 (fake-timer + react-query polling tests are out of scope for this plan).

- [ ] **Step 5: Commit**

```bash
git add src/components/lis/DensitySyncButton.tsx src/components/lis/DensitySyncButton.test.tsx
git commit -m "feat(density-sync): DensitySyncButton with 30s polling + cancel"
```

---

## Task 6: Wire into QCTestingDetailPage

**Files:**
- Modify: `src/pages/QCTestingDetailPage.tsx`

- [ ] **Step 1: Add imports**

Near the other `@/components/lis` / `@/lib` imports at the top of `src/pages/QCTestingDetailPage.tsx`, add:

```ts
import DensitySyncButton from '@/components/lis/DensitySyncButton';
import {
  SG_VALUE_LABEL,
  SG_TEMP_LABEL,
  hasHandTypedEntries,
  densityRowToEntry,
  formatTSetComparison,
} from '@/lib/densitySync';
```

- [ ] **Step 2: Add the `applyDensityRows` handler**

Insert this `useCallback` immediately **after** the `handleRemoveEntry` definition (it ends at line ~616, with deps `[user, entriesByKey, id, loadResults]`):

```ts
  // Density sync: replace the SG param's entries with one entry per matched
  // Result-Density row (Density + T block; T set lives in provenance only).
  const applyDensityRows = useCallback(
    async (
      petition: Petition,
      item: PetitionItem,
      param: ParameterItem,
      docs: Record<string, unknown>[],
    ) => {
      const k = resultKey(item.seq, param._id!);
      const fetchedAt = new Date().toISOString();
      const rows = docs.map((d) => densityRowToEntry(d, fetchedAt));
      setEntriesByKey((prev) => ({ ...prev, [k]: rows.map((e) => ({ ...e })) }));
      setEntryRowCounts((c) => ({ ...c, [k]: Math.max(rows.length, 1) }));
      advanceToInProgress();
      try {
        await api.saveQCEntries({
          petitionId: petition._id!,
          petitionNo: petition.petitionNo,
          itemSeq: item.seq,
          sampleId: item.sampleId,
          sampleName: item.sampleName,
          commonName: item.commonName,
          parameterId: param._id!,
          parameterName: param.name,
          entries: rows,
          enteredBy: { name: user?.name ?? 'Unknown', email: user?.email ?? '' },
        });
        if (id) await loadResults(id);
      } catch {
        toast.error('บันทึกค่าไม่สำเร็จ');
      }
    },
    [user, advanceToInProgress, id, loadResults],
  );
```

- [ ] **Step 3: Render the sync button + T(set) comparison in the multiEntry block**

In the `param.multiEntry ?` branch (the IIFE that starts at line ~1325), make these three edits.

(a) Right after `const savedRows = entriesByKey[k] ?? [];` (line ~1328), add:

```ts
                          const isSgParam = (param.valueFields ?? []).some(
                            (f) => f.label === SG_VALUE_LABEL,
                          );
                          const sgTempField = (param.valueFields ?? []).find(
                            (f) => f.label === SG_TEMP_LABEL,
                          );
```

(b) Immediately inside `<div className="space-y-4">` (line ~1338), as the first child before the `Array.from(...)` cards, add the sync control:

```tsx
                              {isSgParam && !fieldDisabled && (
                                <div className="flex justify-end">
                                  <DensitySyncButton
                                    batchNo={item.batchNo?.trim() ?? ''}
                                    hasHandTyped={hasHandTypedEntries(savedRows)}
                                    onRows={(docs) => applyDensityRows(petition, item, param, docs)}
                                  />
                                </div>
                              )}
```

(c) Inside each entry card, immediately **after** the `renderGrid(...)` call (line ~1365, before the closing `</div>` of the card), add the comparison line:

```tsx
                                    {isSgParam && (() => {
                                      const src = entryValues['อุณหภูมิ__source'] as
                                        | { tSet?: unknown }
                                        | undefined;
                                      const cmp = formatTSetComparison(
                                        src?.tSet,
                                        sgTempField?.standardValue,
                                      );
                                      if (!cmp) return null;
                                      return (
                                        <p
                                          className={`text-[11px] ${
                                            cmp.status === 'differ'
                                              ? 'text-amber-600'
                                              : 'text-emerald-600'
                                          }`}
                                        >
                                          {cmp.text}
                                        </p>
                                      );
                                    })()}
```

- [ ] **Step 4: Type-check + lint**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors in `QCTestingDetailPage.tsx` / `densitySync.ts` / `DensitySyncButton.tsx`.

Run: `npm run lint`
Expected: no new lint errors in the changed files.

- [ ] **Step 5: Commit**

```bash
git add src/pages/QCTestingDetailPage.tsx
git commit -m "feat(density-sync): wire sync button + T(set) comparison into QC ค่า ถพ."
```

---

## Task 7: Config prerequisite + verification

**Files:** (no code)

- [ ] **Step 1: Make `ค่า ถพ.` multiEntry**

Start both processes (`npm run dev` at root; `cd server && npm run dev`). In the app, go to **Parameter Settings**, open **ค่า ถพ.**, enable **multiEntry** (กรอกซ้ำได้หลายค่า), and save.

Verify in DB or via API that the parameter now has `multiEntry: true`:
```bash
curl -s "http://localhost:3001/api/parameters" | grep -o '"name":"ค่า ถพ.".*"multiEntry":true'
```
Expected: a non-empty match.

- [ ] **Step 2: Back up seed data**

Run: `cd server && npm run seed:export`
Then commit the updated parameter dump:
```bash
git add server/seed-data/parameters.json
git commit -m "chore(density-sync): set ค่า ถพ. multiEntry in seed data"
```

- [ ] **Step 3: Run all automated tests**

Run: `node --test server/lib/densityBatch.test.js`
Expected: PASS.

Run: `npx vitest run src/lib/densitySync.test.ts src/components/lis/DensitySyncButton.test.tsx`
Expected: PASS.

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual E2E**

1. Open a QC petition whose item has a `batchNo` present in `Result-Density` (e.g. seed batch `095`) at **QC Testing → detail**.
2. On the **ค่า ถพ.** parameter, press **ดึงค่า ถพ.** → entries fill: `ค่าถพ.` = Density, `อุณหภูมิ` = T(block); under each entry a green/amber **T set vs มาตรฐาน** line shows. A multi-row batch (TOP + bottom) yields multiple entry cards.
3. Open an item whose `batchNo` has **no** matching row → press the button → see **"รอค่าจากเครื่อง…"**; insert a matching `Result-Density` row → within 30 s the entries fill and polling stops. Press **ยกเลิก** mid-wait → polling stops.
4. Hand-type a value into a fresh entry, then press the button → an overwrite confirm appears; confirming replaces with instrument values.
5. Open a petition with `qcCompletedAt` set (locked) → the button is absent (read-only form).
6. Reload the page after a sync → entries and the T(set) comparison line persist.

- [ ] **Step 5: Final commit (if any pending changes)**

```bash
git status
# commit any remaining changed files with an appropriate message
```

---

## Self-Review notes

- **Spec coverage:** endpoint + match rule (Tasks 1–2), client API (3), pure mapping/provenance/compare (4), button + 30 s poll + cancel + error toast (5), QC-page wiring incl. overwrite confirm, lock-hide, multi-entry replace, T(set) display (6), multiEntry prerequisite + seed:export + E2E (7). `T (set)` is never written as a value/standard (provenance only).
- **Placeholders:** none — every code step shows complete code; every run step shows command + expected output.
- **Type consistency:** `getResultDensitiesByBatch` return shape matches the endpoint `{ batch, docs }`; `densityRowToEntry(row, fetchedAt)` signature matches its call in `applyDensityRows`; provenance keys use `sourceSiblingKey` / the literal `'อุณหภูมิ__source'` consistently; `saveQCEntries` args match `src/lib/api.ts:439`.
- **Known limitation (no silent cap):** `by-batch` loads all `Result-Density` docs per request and filters in JS — fine at ~230 docs; revisit with an index if the collection grows large.
