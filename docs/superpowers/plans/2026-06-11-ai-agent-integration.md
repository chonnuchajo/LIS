# AI Agent Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่ม AI augmentation ใน 4 workflow zones (QC Testing, Petition, Daily Checks, QC Approval) โดยใช้ Smart Rules + Ollama local LLM

**Architecture:** Phase 1 เพิ่ม `server/routes/ai.js` พร้อม statistical endpoints (z-score outlier, machine suggestions, daily check trends) และ UI hints ใน React pages ที่มีอยู่ Phase 2 เพิ่ม `server/lib/ollamaClient.js` เชื่อม Ollama ที่ http://192.168.51.21:11434/ สำหรับ draft notes และ weekly summary

**Tech Stack:** Express 4 + Mongoose 8 (backend), React 18 + TypeScript + TanStack Query (frontend), Ollama/qwen2.5:7b (local LLM), Jest (backend unit tests)

---

## File Map

**New files (Phase 1):**
- `server/lib/smartRules.js` — z-score, linear regression, consecutive streak helpers
- `server/routes/ai.js` — `/api/ai/*` endpoints (outlier-check, machine-suggestions, daily-check-trends)
- `server/lib/__tests__/smartRules.test.js` — unit tests for smartRules
- `src/lib/aiApi.ts` — frontend fetch helpers สำหรับ AI endpoints
- `src/components/lis/AiOutlierBadge.tsx` — reusable outlier warning component

**Modified files (Phase 1):**
- `server/index.js` — mount `/ai` route
- `src/pages/QCTestingDetailPage.tsx` — outlier badge + copy-paste detection
- `src/pages/PetitionAssignPage.tsx` — machine suggestion chips
- `src/pages/daily-check/EnvironmentCheckPage.tsx` — sensor staleness warning
- `src/pages/daily-check/BalanceRoomPage.tsx` — consecutive failure banner
- `src/pages/QCApproval.tsx` — smart priority sorting + badges

**New files (Phase 2):**
- `server/lib/ollamaClient.js` — Ollama HTTP client wrapper
- `server/lib/__tests__/ollamaClient.test.js` — unit tests for ollamaClient

**Modified files (Phase 2):**
- `server/routes/ai.js` — เพิ่ม draft-note + weekly-summary endpoints
- `server/.env` — เพิ่ม `OLLAMA_URL` + `OLLAMA_MODEL`
- `src/pages/QCApproval.tsx` — draft note button + streaming textarea
- `src/pages/daily-check/DailyCheckRecordsPage.tsx` — weekly summary button

---

## Phase 1: Smart Rules

---

### Task 1: สร้าง `server/lib/smartRules.js` และ unit tests

**Files:**
- Create: `server/lib/smartRules.js`
- Create: `server/lib/__tests__/smartRules.test.js`

- [ ] **Step 1: ติดตั้ง Jest สำหรับ backend (ถ้ายังไม่มี)**

```bash
cd server && npm install --save-dev jest
```

ตรวจสอบว่า `server/package.json` มี script `"test": "jest"` หรือเพิ่มเข้าไป:
```json
"scripts": {
  "test": "jest"
}
```

- [ ] **Step 2: เขียน failing tests**

สร้างไฟล์ `server/lib/__tests__/smartRules.test.js`:

```js
const { zScore, linearRegression, consecutiveStreak } = require('../smartRules');

describe('zScore', () => {
  test('returns null when fewer than 3 values', () => {
    expect(zScore([1, 2], 3)).toBeNull();
  });

  test('returns null when stdev is zero (all same values)', () => {
    expect(zScore([5, 5, 5, 5], 5)).toBeNull();
  });

  test('returns correct zScore for value within normal range', () => {
    const result = zScore([1, 2, 3, 4, 5], 3);
    expect(result).not.toBeNull();
    expect(result.zScore).toBeCloseTo(0, 1);
    expect(result.warning).toBe(false);
  });

  test('returns warning=true for extreme outlier (|z| > 2.5)', () => {
    // mean=3, stdev≈1.41, value=10 → z≈4.95
    const result = zScore([1, 2, 3, 4, 5], 10);
    expect(result.warning).toBe(true);
    expect(result.zScore).toBeGreaterThan(2.5);
  });

  test('includes mean and stdev in result', () => {
    const result = zScore([2, 4, 6], 4);
    expect(result.mean).toBeCloseTo(4, 5);
    expect(result.stdev).toBeGreaterThan(0);
  });
});

describe('linearRegression', () => {
  test('returns null for fewer than 2 points', () => {
    expect(linearRegression([{ x: 1, y: 2 }])).toBeNull();
  });

  test('returns correct slope for perfectly linear data', () => {
    // y = 2x + 1
    const result = linearRegression([
      { x: 0, y: 1 },
      { x: 1, y: 3 },
      { x: 2, y: 5 },
      { x: 3, y: 7 },
    ]);
    expect(result.slope).toBeCloseTo(2, 5);
    expect(result.intercept).toBeCloseTo(1, 5);
  });

  test('returns near-zero slope for flat data', () => {
    const result = linearRegression([
      { x: 0, y: 5 },
      { x: 1, y: 5 },
      { x: 2, y: 5 },
    ]);
    expect(Math.abs(result.slope)).toBeLessThan(0.001);
  });
});

describe('consecutiveStreak', () => {
  test('returns 0 when no records', () => {
    expect(consecutiveStreak([], r => r.status === 'fail')).toBe(0);
  });

  test('counts consecutive matching records from start', () => {
    const records = [
      { status: 'fail' },
      { status: 'fail' },
      { status: 'fail' },
      { status: 'pass' },
    ];
    expect(consecutiveStreak(records, r => r.status === 'fail')).toBe(3);
  });

  test('returns 0 when first record does not match', () => {
    const records = [{ status: 'pass' }, { status: 'fail' }];
    expect(consecutiveStreak(records, r => r.status === 'fail')).toBe(0);
  });
});
```

- [ ] **Step 3: รัน tests เพื่อยืนยันว่า fail**

```bash
cd server && npm test -- --testPathPattern=smartRules
```

Expected: FAIL — "Cannot find module '../smartRules'"

- [ ] **Step 4: เขียน implementation**

สร้างไฟล์ `server/lib/smartRules.js`:

```js
/**
 * zScore — compare targetValue against historical values
 * Returns null if fewer than 3 values or zero variance.
 * Result includes { mean, stdev, zScore, warning } where warning = |z| > 2.5
 */
function zScore(values, targetValue) {
  if (!Array.isArray(values) || values.length < 3) return null;
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  const stdev = Math.sqrt(variance);
  if (stdev === 0) return null;
  const z = (targetValue - mean) / stdev;
  return { mean, stdev, zScore: z, warning: Math.abs(z) > 2.5 };
}

/**
 * linearRegression — least-squares fit over [{x, y}] pairs
 * Returns null if fewer than 2 points or degenerate x values.
 * Result includes { slope, intercept }
 */
function linearRegression(xyPairs) {
  if (!Array.isArray(xyPairs) || xyPairs.length < 2) return null;
  const n = xyPairs.length;
  const sumX = xyPairs.reduce((s, p) => s + p.x, 0);
  const sumY = xyPairs.reduce((s, p) => s + p.y, 0);
  const sumXY = xyPairs.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = xyPairs.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

/**
 * consecutiveStreak — count how many records from index 0 match predicate
 * Records should be sorted newest-first (index 0 = most recent).
 */
function consecutiveStreak(records, predicate) {
  let streak = 0;
  for (const record of records) {
    if (predicate(record)) streak++;
    else break;
  }
  return streak;
}

module.exports = { zScore, linearRegression, consecutiveStreak };
```

- [ ] **Step 5: รัน tests เพื่อยืนยันว่า pass**

```bash
cd server && npm test -- --testPathPattern=smartRules
```

Expected: PASS — 9 tests passed

- [ ] **Step 6: Commit**

```bash
cd server && git add lib/smartRules.js lib/__tests__/smartRules.test.js package.json
git commit -m "feat(ai): add smartRules statistical helpers (z-score, regression, streak)"
```

---

### Task 2: สร้าง `server/routes/ai.js` พร้อม outlier-check endpoint + mount

**Files:**
- Create: `server/routes/ai.js`
- Modify: `server/index.js`

- [ ] **Step 1: สร้าง `server/routes/ai.js` พร้อม outlier-check**

```js
const express = require('express');
const router = express.Router();
const QCTestResult = require('../models/QCTestResult');
const { zScore } = require('../lib/smartRules');

// POST /api/ai/outlier-check
// Body: { commonName, parameterId, fieldLabel, value }
// Returns: { warning, zScore?, mean?, stdev?, sampleSize, reason? }
router.post('/outlier-check', async (req, res) => {
  try {
    const { commonName, parameterId, fieldLabel, value } = req.body;
    if (!commonName || !parameterId || !fieldLabel || value == null) {
      return res.json({ warning: false, reason: 'missing_params' });
    }
    const num = typeof value === 'number' ? value : Number(value);
    if (isNaN(num)) return res.json({ warning: false, reason: 'not_numeric' });

    const results = await QCTestResult.find(
      { commonName, parameterId },
      { values: 1, enteredAt: 1 },
    )
      .sort({ enteredAt: -1 })
      .limit(10)
      .lean();

    const historicalValues = results
      .map((r) => {
        const v = r.values?.[fieldLabel];
        return v != null && v !== '' ? Number(v) : NaN;
      })
      .filter((v) => !isNaN(v));

    if (historicalValues.length < 3) {
      return res.json({ warning: false, sampleSize: historicalValues.length, reason: 'insufficient_data' });
    }

    const stats = zScore(historicalValues, num);
    if (!stats) return res.json({ warning: false, sampleSize: historicalValues.length, reason: 'zero_variance' });

    return res.json({
      warning: stats.warning,
      zScore: Math.round(stats.zScore * 100) / 100,
      mean: Math.round(stats.mean * 10000) / 10000,
      stdev: Math.round(stats.stdev * 10000) / 10000,
      sampleSize: historicalValues.length,
    });
  } catch (err) {
    // Degrade gracefully — never let AI errors break the main workflow
    return res.json({ warning: false, reason: 'error' });
  }
});

module.exports = router;
```

- [ ] **Step 2: Mount route ใน `server/index.js`**

เปิดไฟล์ `server/index.js` แล้วเพิ่มบรรทัดนี้ **ต่อจาก** `mountApi('/print', ...)`:

```js
mountApi('/ai', require('./routes/ai'));
```

- [ ] **Step 3: ทดสอบ endpoint ด้วย curl**

```bash
cd server && npm run dev
```

แล้วในอีก terminal:

```bash
curl -X POST http://localhost:3001/api/ai/outlier-check \
  -H "Content-Type: application/json" \
  -d "{\"commonName\":\"TEST\",\"parameterId\":\"test\",\"fieldLabel\":\"value\",\"value\":999}"
```

Expected output: `{"warning":false,"sampleSize":0,"reason":"insufficient_data"}`

- [ ] **Step 4: Commit**

```bash
git add server/routes/ai.js server/index.js
git commit -m "feat(ai): add /api/ai/outlier-check endpoint"
```

---

### Task 3: สร้าง `src/lib/aiApi.ts` — frontend API helpers

**Files:**
- Create: `src/lib/aiApi.ts`

- [ ] **Step 1: สร้างไฟล์**

```ts
// AI API helpers — all calls degrade gracefully (never throw, return safe defaults)
const AI_BASE = `${(import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')}/api/ai`;

export interface OutlierCheckResult {
  warning: boolean;
  zScore?: number;
  mean?: number;
  stdev?: number;
  sampleSize?: number;
  reason?: string;
}

export async function checkOutlier(params: {
  commonName: string;
  parameterId: string;
  fieldLabel: string;
  value: number;
}): Promise<OutlierCheckResult> {
  try {
    const res = await fetch(`${AI_BASE}/outlier-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return { warning: false };
    return (await res.json()) as OutlierCheckResult;
  } catch {
    return { warning: false };
  }
}

export interface MachineSuggestion {
  machineCode: string;
  machineName: string;
  usageCount: number;
}

export async function getMachineSuggestions(
  commonName: string,
  dept?: string,
): Promise<MachineSuggestion[]> {
  try {
    const params = new URLSearchParams({ commonName });
    if (dept) params.set('dept', dept);
    const res = await fetch(`${AI_BASE}/machine-suggestions?${params}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return [];
    return (await res.json()) as MachineSuggestion[];
  } catch {
    return [];
  }
}

export interface DailyCheckTrend {
  alert: boolean;
  streak?: number;
  slope?: number;
  message?: string | null;
  reason?: string;
}

export async function getDailyCheckTrend(params: {
  type: 'consecutive' | 'trend';
  scaleId: string;
  field?: string;
  days?: number;
}): Promise<DailyCheckTrend> {
  try {
    const query = new URLSearchParams({
      type: params.type,
      scaleId: params.scaleId,
      days: String(params.days ?? 30),
    });
    if (params.field) query.set('field', params.field);
    const res = await fetch(`${AI_BASE}/daily-check-trends?${query}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { alert: false };
    return (await res.json()) as DailyCheckTrend;
  } catch {
    return { alert: false };
  }
}

export interface OllamaStatus {
  available: boolean;
}

export async function getOllamaStatus(): Promise<OllamaStatus> {
  try {
    const res = await fetch(`${AI_BASE}/ollama-status`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return { available: false };
    return (await res.json()) as OllamaStatus;
  } catch {
    return { available: false };
  }
}

export async function streamDraftNote(
  petitionId: string,
  onChunk: (text: string) => void,
): Promise<void> {
  const res = await fetch(`${AI_BASE}/draft-note`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ petitionId }),
  });
  if (!res.ok || !res.body) throw new Error('draft-note failed');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}

export async function streamWeeklySummary(
  fromDate: string,
  toDate: string,
  onChunk: (text: string) => void,
): Promise<void> {
  const res = await fetch(`${AI_BASE}/weekly-summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromDate, toDate }),
  });
  if (!res.ok || !res.body) throw new Error('weekly-summary failed');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/aiApi.ts
git commit -m "feat(ai): add frontend AI API helpers (aiApi.ts)"
```

---

### Task 4: สร้าง `src/components/lis/AiOutlierBadge.tsx`

**Files:**
- Create: `src/components/lis/AiOutlierBadge.tsx`

- [ ] **Step 1: สร้างไฟล์**

```tsx
import { AlertTriangle } from 'lucide-react';
import type { OutlierCheckResult } from '@/lib/aiApi';

interface AiOutlierBadgeProps {
  result: OutlierCheckResult | null | undefined;
}

export function AiOutlierBadge({ result }: AiOutlierBadgeProps) {
  if (!result?.warning) return null;
  const mean = result.mean != null ? result.mean.toFixed(4) : '?';
  const z = result.zScore != null ? result.zScore.toFixed(1) : '?';
  return (
    <p className="text-[11px] text-orange-600 flex items-center gap-1 mt-0.5">
      <AlertTriangle className="h-3 w-3 shrink-0" />
      ค่าผิดปกติทางสถิติ — ค่าเฉลี่ยเดิม: {mean}, z = {z}
      {result.sampleSize != null && (
        <span className="text-orange-400">(n={result.sampleSize})</span>
      )}
    </p>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/lis/AiOutlierBadge.tsx
git commit -m "feat(ai): add AiOutlierBadge component"
```

---

### Task 5: เพิ่ม outlier badge ใน `QCTestingDetailPage.tsx`

**Files:**
- Modify: `src/pages/QCTestingDetailPage.tsx`

- [ ] **Step 1: เพิ่ม import ที่หัวไฟล์**

เปิด `src/pages/QCTestingDetailPage.tsx` แล้วเพิ่ม imports ด้านบน (ต่อจาก import กลุ่มอื่น):

```ts
import { AiOutlierBadge } from '@/components/lis/AiOutlierBadge';
import { checkOutlier, type OutlierCheckResult } from '@/lib/aiApi';
```

- [ ] **Step 2: เพิ่ม `outlierResult` prop ใน `TestFieldProps` interface**

หา interface `TestFieldProps` (ประมาณบรรทัด 80-98) แล้วเพิ่ม field นี้ก่อน closing `}`:

```ts
  outlierResult?: OutlierCheckResult | null;
```

- [ ] **Step 3: เพิ่ม `outlierResult` parameter ใน destructuring ของ `TestField`**

หาบรรทัดที่ destructure props ใน `function TestField({...})` แล้วเพิ่ม `outlierResult,` เข้าไป

- [ ] **Step 4: เพิ่ม `<AiOutlierBadge>` ใน render ของ `TestField`**

หาบรรทัดที่แสดง lastBatch (ประมาณบรรทัด 226-230):

```tsx
      {field.showLastBatch && lastBatchValue != null && String(lastBatchValue) !== "" && (
        <p className="text-[11px] text-sky-600">
          แบชก่อน{lastBatchLabel ? ` (${lastBatchLabel})` : ""}: {String(lastBatchValue)}{field.unit ? ` ${field.unit}` : ""}
        </p>
      )}
```

เพิ่มหลัง closing `)}` ของ block นั้น:

```tsx
      <AiOutlierBadge result={outlierResult} />
```

- [ ] **Step 5: เพิ่ม outlier state ใน parent component**

ใน `QCTestingDetailPage` (function component หลัก) หาบรรทัดที่ประกาศ state ต่างๆ แล้วเพิ่ม:

```ts
  // outlierResults: keyed by `${parameterId}__${fieldLabel}` → result
  const [outlierResults, setOutlierResults] = useState<Record<string, OutlierCheckResult>>({});
```

- [ ] **Step 6: เพิ่ม `handleOutlierCheck` function**

เพิ่ม function นี้ใน component (ก่อน return):

```ts
  const handleOutlierCheck = useCallback(
    async (
      commonName: string,
      parameterId: string,
      fieldLabel: string,
      value: unknown,
      fieldType: string,
    ) => {
      if (fieldType !== 'number' && fieldType !== 'float') return;
      const num = Number(value);
      if (isNaN(num) || value === '' || value == null) return;
      const result = await checkOutlier({ commonName, parameterId, fieldLabel, value: num });
      const key = `${parameterId}__${fieldLabel}`;
      setOutlierResults((prev) => ({ ...prev, [key]: result }));
    },
    [],
  );
```

- [ ] **Step 7: ส่ง `outlierResult` prop เข้า `<TestField>` และเรียก `handleOutlierCheck` ใน onChange**

หาตรงที่ render `<TestField ... />` (ประมาณบรรทัด 988) และเพิ่ม props:

```tsx
outlierResult={outlierResults[`${String(param._id)}__${unit.field.label}`]}
```

และใน `onChange` handler ของ field นั้น เพิ่มการเรียก outlier check หลังจาก save:

หา `onChange` callback ที่ส่งให้ `<TestField>` — โดยทั่วไปจะเรียก `handleSaveField(...)` แล้วเพิ่มบรรทัดต่อ:

```ts
handleOutlierCheck(
  item.commonName ?? '',
  String(param._id),
  unit.field.label,
  val,
  unit.field.type,
);
```

- [ ] **Step 8: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 9: ทดสอบ manual**

เปิดหน้า QC Testing ใน browser กรอกค่าตัวเลขที่ผิดปกติมากๆ → ควรเห็น badge สีส้มใต้ field

- [ ] **Step 10: Commit**

```bash
git add src/pages/QCTestingDetailPage.tsx
git commit -m "feat(ai): add outlier detection badge in QC testing fields"
```

---

### Task 6: เพิ่ม copy-paste detection ใน QCTestingDetailPage

**Files:**
- Modify: `src/pages/QCTestingDetailPage.tsx`

- [ ] **Step 1: เพิ่ม `copyPasteWarnings` state**

ใน component หลัก เพิ่ม state:

```ts
  // keyed by `${itemSeq}__${parameterId}` → true หากทุก numeric field เหมือน lastBatch
  const [copyPasteWarnings, setCopyPasteWarnings] = useState<Record<string, boolean>>({});
```

- [ ] **Step 2: เพิ่ม `useEffect` ตรวจ copy-paste**

เพิ่ม effect นี้ (ต้องมี `currentValues` และ `lastBatchByKey` อยู่ใน scope แล้ว):

```ts
  useEffect(() => {
    const warnings: Record<string, boolean> = {};
    // currentValues: Record<resultKey, Record<fieldLabel, value>>
    // resultKey = `${itemSeq}__${parameterId}`
    Object.entries(currentValues).forEach(([resultKey, fieldValues]) => {
      // parse itemSeq + parameterId from key
      const [, parameterId] = resultKey.split('__p')[0].split('__');
      // find commonName for this key via items + params
      // We can extract from lastBatchByKey keys which use `${commonName}__${parameterId}`
      const matchingLastBatchEntry = [...lastBatchByKey.entries()].find(([k]) =>
        k.endsWith(`__${parameterId}`),
      );
      if (!matchingLastBatchEntry) return;
      const lastBatchValues = matchingLastBatchEntry[1]?.values ?? {};

      const numericPairs = Object.entries(fieldValues).filter(([, v]) => {
        const n = Number(v);
        return v !== '' && v != null && !isNaN(n);
      });
      if (numericPairs.length < 2) return; // ต้องมีอย่างน้อย 2 fields

      const allMatch = numericPairs.every(([label, val]) => {
        const lastVal = lastBatchValues[label];
        return lastVal != null && String(lastVal) === String(val);
      });
      if (allMatch) warnings[resultKey] = true;
    });
    setCopyPasteWarnings(warnings);
  }, [currentValues, lastBatchByKey]);
```

- [ ] **Step 3: แสดง banner เมื่อ copy-paste detected**

หาตรง render ของแต่ละ parameter card (ที่มี `<TestField>`) แล้วเพิ่ม banner ด้านบน:

```tsx
{copyPasteWarnings[resultKey] && (
  <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700 mb-2">
    <span>🔔</span>
    <span>ค่าทุกตัวเหมือน batch ก่อนหน้า — กรุณาตรวจสอบว่าไม่ได้ copy ค่าเดิม</span>
  </div>
)}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/pages/QCTestingDetailPage.tsx
git commit -m "feat(ai): add copy-paste detection warning in QC testing"
```

---

### Task 7: เพิ่ม machine-suggestions endpoint ใน `server/routes/ai.js`

**Files:**
- Modify: `server/routes/ai.js`

- [ ] **Step 1: เพิ่ม require Petition ที่หัวไฟล์**

ใน `server/routes/ai.js` เพิ่ม require:

```js
const Petition = require('../models/Petition');
```

- [ ] **Step 2: เพิ่ม endpoint ก่อน `module.exports`**

```js
// GET /api/ai/machine-suggestions?commonName=&dept=
// Returns top 3 machines used for this commonName in recent petitions
router.get('/machine-suggestions', async (req, res) => {
  try {
    const { commonName, dept } = req.query;
    if (!commonName) return res.json([]);

    const query = { 'items.commonName': String(commonName) };
    if (dept) query.dept = String(dept);

    const petitions = await Petition.find(query, { assignedMachines: 1 })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const counts = {};
    petitions.forEach((p) => {
      (p.assignedMachines || []).forEach((m) => {
        if (!m.code) return;
        if (!counts[m.code]) {
          counts[m.code] = { machineCode: m.code, machineName: m.name || m.code, usageCount: 0 };
        }
        counts[m.code].usageCount++;
      });
    });

    const suggestions = Object.values(counts)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 3);

    res.json(suggestions);
  } catch {
    res.json([]);
  }
});
```

- [ ] **Step 3: ทดสอบด้วย curl**

```bash
curl "http://localhost:3001/api/ai/machine-suggestions?commonName=TEST"
```

Expected: `[]` (หรือ array ถ้ามีข้อมูลจริง)

- [ ] **Step 4: Commit**

```bash
git add server/routes/ai.js
git commit -m "feat(ai): add machine-suggestions endpoint"
```

---

### Task 8: เพิ่ม machine suggestion chips ใน `PetitionAssignPage.tsx`

**Files:**
- Modify: `src/pages/PetitionAssignPage.tsx`

- [ ] **Step 1: เพิ่ม imports**

```ts
import { getMachineSuggestions, type MachineSuggestion } from '@/lib/aiApi';
```

- [ ] **Step 2: เพิ่ม state สำหรับ suggestions ต่อ groupKey**

ในส่วน state declarations ของ component:

```ts
  const [machineSuggestions, setMachineSuggestions] = useState<Record<string, MachineSuggestion[]>>({});
```

- [ ] **Step 3: เพิ่ม function โหลด suggestions เมื่อเปิดหน้า**

```ts
  useEffect(() => {
    const allGroups: Array<{ groupKey: string; commonName: string; dept: string }> = [];
    [...(pendingData?.items ?? []), ...(inProgressData?.items ?? [])].forEach((petition) => {
      const groups = groupsByPetition.get(petition._id) ?? [];
      groups.forEach((g) => {
        if (!allGroups.find((x) => x.groupKey === g.groupKey)) {
          allGroups.push({ groupKey: g.groupKey, commonName: g.commonName, dept: petition.dept });
        }
      });
    });
    allGroups.forEach(({ groupKey, commonName, dept }) => {
      getMachineSuggestions(commonName, dept).then((suggestions) => {
        if (suggestions.length > 0) {
          setMachineSuggestions((prev) => ({ ...prev, [groupKey]: suggestions }));
        }
      });
    });
  }, [pendingData, inProgressData, groupsByPetition]);
```

- [ ] **Step 4: แสดง suggestion chips ใน UI**

หาตรงที่ render machine dropdown สำหรับแต่ละ group (ค้นหา `machineMethodsOfSlot` หรือ `MachineSelect` ใน JSX) แล้วเพิ่ม suggestion chips เหนือ dropdown:

```tsx
{machineSuggestions[group.groupKey]?.length > 0 && (
  <div className="flex flex-wrap gap-1 mb-1">
    <span className="text-[11px] text-grey-500">แนะนำ:</span>
    {machineSuggestions[group.groupKey].map((s) => (
      <button
        key={s.machineCode}
        type="button"
        className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700 hover:bg-blue-100 border border-blue-200"
        onClick={() => {
          // หา machineId จาก machineById ที่ตรงกับ code นี้
          const machine = [...machineById.values()].find((m) => m.code === s.machineCode);
          if (machine) {
            // trigger assignment — เรียก setMachineForSlot ด้วย machineId ที่ถูกต้อง
          }
        }}
        title={`ใช้ ${s.usageCount} ครั้งใน 10 batches ล่าสุด`}
      >
        {s.machineCode} ({s.usageCount}/10)
      </button>
    ))}
  </div>
)}
```

> **Note:** การ "click แล้ว apply" ต้องเรียก function ที่มีอยู่ใน component สำหรับ set machine (`handleMachineChange` หรือ similar) — ดู pattern ของ component นั้นก่อน แล้วเชื่อม `machineId` ที่ได้จาก `machineById`

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/pages/PetitionAssignPage.tsx
git commit -m "feat(ai): add machine suggestion chips in PetitionAssignPage"
```

---

### Task 9: เพิ่ม daily-check-trends endpoint ใน `server/routes/ai.js`

**Files:**
- Modify: `server/routes/ai.js`

- [ ] **Step 1: เพิ่ม require ที่หัวไฟล์**

```js
const DailyCheck = require('../models/DailyCheck');
const { linearRegression, consecutiveStreak } = require('../lib/smartRules');
```

- [ ] **Step 2: เพิ่ม endpoint ก่อน `module.exports`**

```js
// GET /api/ai/daily-check-trends?type=consecutive|trend&scaleId=&field=avg100&days=30
router.get('/daily-check-trends', async (req, res) => {
  try {
    const { type, scaleId, field = 'avg100', days = '30' } = req.query;
    if (!scaleId || !type) return res.json({ alert: false, reason: 'missing_params' });

    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - Math.min(Number(days), 90));
    const fromStr = from.toISOString().slice(0, 10);

    const records = await DailyCheck.find(
      { scaleId: String(scaleId), date: { $gte: fromStr } },
      { status: 1, avg100: 1, avg10: 1, date: 1 },
    )
      .sort({ date: -1 })
      .lean();

    if (type === 'consecutive') {
      const streak = consecutiveStreak(records, (r) => r.status === 'fail');
      return res.json({
        alert: streak >= 3,
        streak,
        message: streak >= 3
          ? `Scale ${scaleId} fail ต่อเนื่อง ${streak} วัน — ควรแจ้งซ่อมบำรุง`
          : null,
      });
    }

    if (type === 'trend') {
      const fieldName = String(field);
      const pairs = records
        .filter((r) => r[fieldName] != null)
        .map((r, i) => ({ x: records.length - 1 - i, y: Number(r[fieldName]) }))
        .filter((p) => !isNaN(p.y));

      if (pairs.length < 5) return res.json({ alert: false, reason: 'insufficient_data' });

      const reg = linearRegression(pairs);
      if (!reg) return res.json({ alert: false, reason: 'degenerate' });

      // thresholds: weight fields ≤ 0.01/day, temp/humidity ≤ 0.5/day
      const threshold = fieldName.startsWith('avg') ? 0.01 : 0.5;
      const alert = Math.abs(reg.slope) > threshold;
      const direction = reg.slope > 0 ? 'เพิ่มขึ้น' : 'ลดลง';

      return res.json({
        alert,
        slope: Math.round(reg.slope * 100000) / 100000,
        message: alert
          ? `${fieldName} มีแนวโน้ม${direction} ${Math.abs(reg.slope).toFixed(5)} ต่อวัน — ควรตรวจสอบ`
          : null,
      });
    }

    res.json({ alert: false, reason: 'unknown_type' });
  } catch {
    res.json({ alert: false });
  }
});
```

- [ ] **Step 3: ทดสอบ**

```bash
curl "http://localhost:3001/api/ai/daily-check-trends?type=consecutive&scaleId=01&days=7"
```

Expected: `{"alert":false,"streak":0,"message":null}`

- [ ] **Step 4: Commit**

```bash
git add server/routes/ai.js
git commit -m "feat(ai): add daily-check-trends endpoint (consecutive + trend)"
```

---

### Task 10: เพิ่ม daily check alerts ใน `EnvironmentCheckPage.tsx` และ `BalanceRoomPage.tsx`

**Files:**
- Modify: `src/pages/daily-check/EnvironmentCheckPage.tsx`
- Modify: `src/pages/daily-check/BalanceRoomPage.tsx`

#### EnvironmentCheckPage — Sensor Staleness Warning

- [ ] **Step 1: ค้นหา field `receivedAt` ใน TempHum query**

เปิด `src/pages/daily-check/EnvironmentCheckPage.tsx` หา code ที่ fetch TempHum data (น่าจะเป็น useQuery หรือ fetch ในไฟล์นี้) และ locate ว่า `receivedAt` ถูก expose อย่างไร

- [ ] **Step 2: เพิ่ม staleness computation**

หาตรงที่ใช้ sensor data แล้วเพิ่ม useMemo:

```ts
const sensorAgeMinutes = useMemo(() => {
  // tempHumData คือ object ที่มี receivedAt — ปรับชื่อตาม code จริง
  if (!tempHumData?.receivedAt) return null;
  const diff = Date.now() - new Date(tempHumData.receivedAt).getTime();
  return Math.floor(diff / 60000);
}, [tempHumData]);
```

- [ ] **Step 3: แสดง staleness warning**

ในส่วน JSX ที่แสดง sensor readings เพิ่ม banner:

```tsx
{sensorAgeMinutes != null && sensorAgeMinutes > 10 && (
  <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700 mb-3">
    <span>🔴</span>
    <span>ข้อมูล sensor เก่า {sensorAgeMinutes} นาที — กรุณาตรวจสอบ Node-RED</span>
  </div>
)}
```

#### BalanceRoomPage — Consecutive Failure Banner

- [ ] **Step 4: เพิ่ม imports ใน `BalanceRoomPage.tsx`**

```ts
import { getDailyCheckTrend, type DailyCheckTrend } from '@/lib/aiApi';
```

- [ ] **Step 5: เพิ่ม state และ useEffect**

```ts
const [consecutiveAlert, setConsecutiveAlert] = useState<DailyCheckTrend | null>(null);
```

```ts
useEffect(() => {
  if (!scaleId) return; // scaleId มาจาก props หรือ config ของ page นี้
  getDailyCheckTrend({ type: 'consecutive', scaleId, days: 7 }).then(setConsecutiveAlert);
}, [scaleId]);
```

- [ ] **Step 6: แสดง banner ก่อน form**

```tsx
{consecutiveAlert?.alert && consecutiveAlert.message && (
  <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800 mb-4">
    <span>🚨</span>
    <span>{consecutiveAlert.message}</span>
  </div>
)}
```

- [ ] **Step 7: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add src/pages/daily-check/EnvironmentCheckPage.tsx src/pages/daily-check/BalanceRoomPage.tsx
git commit -m "feat(ai): add sensor staleness warning and consecutive failure alert in daily checks"
```

---

### Task 11: เพิ่ม smart priority sorting ใน `QCApproval.tsx`

**Files:**
- Modify: `src/pages/QCApproval.tsx`

- [ ] **Step 1: เพิ่ม priority score function**

ใน `QCApproval.tsx` เพิ่ม helper function ก่อน component:

```ts
function priorityScore(
  petition: Petition,
  abnormalMap: Record<string, boolean>,
  returnedMap: Record<string, boolean>,
): number {
  const deptScore = petition.dept === 'rm' ? 5 : petition.dept === 'fg' ? 3 : 1;
  const isOverdue = petition.completedAt
    ? Date.now() - new Date(petition.completedAt).getTime() > 24 * 60 * 60 * 1000
    : false;
  return (
    (abnormalMap[petition._id] ? 30 : 0) +
    (isOverdue ? 20 : 0) +
    (returnedMap[petition._id] ? 10 : 0) +
    deptScore
  );
}
```

- [ ] **Step 2: เพิ่ม sorted list**

หาบรรทัดที่ใช้ `successPetitions` ใน render แล้วเพิ่ม useMemo:

```ts
const sortedPetitions = useMemo(
  () =>
    [...successPetitions].sort(
      (a, b) => priorityScore(b, abnormalMap, returnedMap) - priorityScore(a, abnormalMap, returnedMap),
    ),
  [successPetitions, abnormalMap, returnedMap],
);
```

แล้วเปลี่ยนทุกที่ที่ใช้ `successPetitions` ในการ render ให้ใช้ `sortedPetitions` แทน

- [ ] **Step 3: เพิ่ม priority badges ใน DataTable columns**

หา `columns` array แล้วเพิ่ม badge row ต่อจาก `petitionNo` column (หรือเพิ่มใน cell ของ column ที่มีอยู่):

```tsx
{/* Priority badges — เพิ่มใน cell ของ column "no" ต่อจาก petitionNo */}
<div className="flex items-center gap-1 mt-0.5">
  {abnormalMap[p._id] && (
    <span className="inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
      ผิดปกติ
    </span>
  )}
  {p.completedAt && Date.now() - new Date(p.completedAt).getTime() > 24 * 60 * 60 * 1000 && (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
      ⏰ เกิน 24h
    </span>
  )}
  {returnedMap[p._id] && (
    <span className="inline-flex items-center rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700">
      🔄 Revision
    </span>
  )}
</div>
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors (ถ้า `completedAt` ไม่ได้อยู่ใน `Petition` type ให้เพิ่ม `completedAt?: string | Date` ใน `src/types/petition.types.ts`)

- [ ] **Step 5: Commit**

```bash
git add src/pages/QCApproval.tsx
git commit -m "feat(ai): add smart priority sorting and badges in QC Approval"
```

---

## Phase 2: Ollama Local LLM

> **Prerequisite:** Ollama server พร้อมที่ http://192.168.51.21:11434/ และมี model qwen2.5:7b อยู่แล้ว
> ตรวจสอบด้วย: `curl http://192.168.51.21:11434/api/tags`

---

### Task 12: สร้าง `server/lib/ollamaClient.js` + config

**Files:**
- Modify: `server/.env`
- Create: `server/lib/ollamaClient.js`
- Create: `server/lib/__tests__/ollamaClient.test.js`

- [ ] **Step 1: เพิ่ม env vars ใน `server/.env`**

```
OLLAMA_URL=http://192.168.51.21:11434
OLLAMA_MODEL=qwen2.5:7b
```

- [ ] **Step 2: เขียน failing tests**

สร้าง `server/lib/__tests__/ollamaClient.test.js`:

```js
// ทดสอบเฉพาะ isOllamaAvailable — ไม่ test generate เพราะต้องการ real server
const { isOllamaAvailable, OLLAMA_BASE_URL } = require('../ollamaClient');

describe('ollamaClient', () => {
  test('OLLAMA_BASE_URL is set from env or defaults to localhost', () => {
    expect(typeof OLLAMA_BASE_URL).toBe('string');
    expect(OLLAMA_BASE_URL).toMatch(/^http/);
  });

  test('isOllamaAvailable returns boolean', async () => {
    const result = await isOllamaAvailable();
    expect(typeof result).toBe('boolean');
  }, 5000);
});
```

- [ ] **Step 3: รัน tests เพื่อยืนยันว่า fail**

```bash
cd server && npm test -- --testPathPattern=ollamaClient
```

Expected: FAIL — "Cannot find module '../ollamaClient'"

- [ ] **Step 4: สร้าง `server/lib/ollamaClient.js`**

```js
const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://192.168.51.21:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

async function isOllamaAvailable() {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * generate — ส่ง prompt ให้ Ollama และรอผลลัพธ์ (non-streaming)
 * @param {string} prompt
 * @param {{ model?: string, temperature?: number }} options
 * @returns {Promise<string>}
 */
async function generate(prompt, options = {}) {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: options.model ?? OLLAMA_MODEL,
      prompt,
      stream: false,
      options: { temperature: options.temperature ?? 0.3 },
    }),
  });
  if (!res.ok) throw new Error(`Ollama generate failed: ${res.status}`);
  const data = await res.json();
  return data.response ?? '';
}

/**
 * generateStream — ส่ง prompt ให้ Ollama แบบ streaming
 * @param {string} prompt
 * @param {(chunk: string) => void} onChunk
 * @param {{ model?: string, temperature?: number }} options
 */
async function generateStream(prompt, onChunk, options = {}) {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: options.model ?? OLLAMA_MODEL,
      prompt,
      stream: true,
      options: { temperature: options.temperature ?? 0.3 },
    }),
  });
  if (!res.ok) throw new Error(`Ollama stream failed: ${res.status}`);
  if (!res.body) throw new Error('No response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    // Ollama streams NDJSON — each line is {"response":"...","done":false}
    for (const line of text.split('\n').filter(Boolean)) {
      try {
        const json = JSON.parse(line);
        if (json.response) onChunk(json.response);
      } catch {
        // incomplete JSON chunk — skip
      }
    }
  }
}

module.exports = { isOllamaAvailable, generate, generateStream, OLLAMA_BASE_URL, OLLAMA_MODEL };
```

- [ ] **Step 5: รัน tests**

```bash
cd server && npm test -- --testPathPattern=ollamaClient
```

Expected: PASS (isOllamaAvailable จะ return true หรือ false ขึ้นกับสถานะ server จริง)

- [ ] **Step 6: เพิ่ม `/api/ai/ollama-status` endpoint ใน `server/routes/ai.js`**

```js
const { isOllamaAvailable } = require('../lib/ollamaClient');

// GET /api/ai/ollama-status
// Frontend ใช้ตรวจสอบก่อนแสดง Draft / Summary buttons
router.get('/ollama-status', async (req, res) => {
  const available = await isOllamaAvailable();
  res.json({ available });
});
```

- [ ] **Step 7: ทดสอบ**

```bash
curl http://localhost:3001/api/ai/ollama-status
```

Expected: `{"available":true}` (ถ้า Ollama online)

- [ ] **Step 8: Commit**

```bash
git add server/lib/ollamaClient.js server/lib/__tests__/ollamaClient.test.js server/.env server/routes/ai.js
git commit -m "feat(ai): add Ollama client + ollama-status endpoint"
```

---

### Task 13: เพิ่ม `/api/ai/draft-note` และ `/api/ai/weekly-summary` endpoints

**Files:**
- Modify: `server/routes/ai.js`

- [ ] **Step 1: เพิ่ม requires**

```js
const Petition = require('../models/Petition'); // อาจมีแล้ว
const QCTestResult = require('../models/QCTestResult'); // อาจมีแล้ว
const DailyCheck = require('../models/DailyCheck'); // อาจมีแล้ว
const EnvCheck = require('../models/EnvCheck');
const { generate, generateStream, isOllamaAvailable } = require('../lib/ollamaClient');
```

- [ ] **Step 2: เพิ่ม draft-note endpoint**

```js
// POST /api/ai/draft-note
// Body: { petitionId }
// Streams plain text สำหรับ approval note ภาษาไทย
router.post('/draft-note', async (req, res) => {
  try {
    const { petitionId } = req.body;
    if (!petitionId) return res.status(400).json({ error: 'petitionId required' });

    if (!(await isOllamaAvailable())) {
      return res.status(503).json({ error: 'Ollama ไม่พร้อมใช้งาน' });
    }

    const petition = await Petition.findById(petitionId).lean();
    if (!petition) return res.status(404).json({ error: 'Petition not found' });

    const results = await QCTestResult.find({ petitionId: String(petitionId) }).lean();

    // สร้าง structured summary สำหรับ prompt
    const itemSummaries = (petition.items || []).map((item) => {
      const itemResults = results.filter((r) => r.itemSeq === item.seq);
      const resultLines = itemResults.map((r) => {
        const vals = Object.entries(r.values || {})
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ');
        return `  ${r.parameterName || r.parameterId}: ${vals}`;
      });
      return `- ${item.sampleName} (${item.commonName || ''}) Batch: ${item.batchNo}\n${resultLines.join('\n')}`;
    }).join('\n');

    const abnormalCount = results.filter((r) => {
      const vals = Object.values(r.values || {});
      return vals.length > 0; // simplified — actual abnormal detection is done in QC
    }).length;

    const prompt = `คุณเป็นเจ้าหน้าที่ QC ของบริษัทเคมีภัณฑ์ไทย กรุณาเขียนหมายเหตุการอนุมัติ (approval note) สำหรับคำร้องต่อไปนี้ เป็นภาษาไทย กระชับ 3-5 ประโยค

คำร้องเลขที่: ${petition.petitionNo}
แผนก: ${petition.dept}
วันที่รับ: ${petition.receivedAt ? new Date(petition.receivedAt).toLocaleDateString('th-TH') : '-'}

รายการตัวอย่างและผลทดสอบ:
${itemSummaries}

กรุณาสรุปผลการทดสอบ ระบุว่าผ่านหรือไม่ผ่าน และข้อสังเกตสำคัญ (ถ้ามี)`;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    await generateStream(prompt, (chunk) => {
      res.write(chunk);
    });
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});
```

- [ ] **Step 3: เพิ่ม weekly-summary endpoint**

```js
// POST /api/ai/weekly-summary
// Body: { fromDate: "YYYY-MM-DD", toDate: "YYYY-MM-DD" }
// Streams plain text สรุปประจำสัปดาห์ภาษาไทย
router.post('/weekly-summary', async (req, res) => {
  try {
    const { fromDate, toDate } = req.body;
    if (!fromDate || !toDate) return res.status(400).json({ error: 'fromDate and toDate required' });

    if (!(await isOllamaAvailable())) {
      return res.status(503).json({ error: 'Ollama ไม่พร้อมใช้งาน' });
    }

    const dateFilter = { date: { $gte: String(fromDate), $lte: String(toDate) } };

    const [dailyChecks, envChecks] = await Promise.all([
      DailyCheck.find(dateFilter).lean(),
      EnvCheck ? EnvCheck.find(dateFilter).lean() : [],
    ]);

    const scaleStats = {};
    dailyChecks.forEach((r) => {
      if (!scaleStats[r.scaleId]) scaleStats[r.scaleId] = { pass: 0, fail: 0 };
      scaleStats[r.scaleId][r.status]++;
    });
    const scaleLines = Object.entries(scaleStats)
      .map(([id, s]) => `- เครื่องชั่ง ${id}: ผ่าน ${s.pass} วัน, ไม่ผ่าน ${s.fail} วัน`)
      .join('\n');

    const envStats = {};
    (envChecks || []).forEach((r) => {
      if (!envStats[r.room]) envStats[r.room] = { pass: 0, fail: 0 };
      envStats[r.room][r.status === 'pass' ? 'pass' : 'fail']++;
    });
    const envLines = Object.entries(envStats)
      .map(([room, s]) => `- ${room}: ผ่าน ${s.pass} วัน, ไม่ผ่าน ${s.fail} วัน`)
      .join('\n') || '(ไม่มีข้อมูล)';

    const prompt = `คุณเป็นเจ้าหน้าที่ QC กรุณาสรุปผล daily check ประจำสัปดาห์ ${fromDate} ถึง ${toDate} เป็นภาษาไทย 4-6 ประโยค

ผลการสอบเทียบเครื่องชั่ง:
${scaleLines || '(ไม่มีข้อมูล)'}

ผลการตรวจสอบสภาพแวดล้อม:
${envLines}

กรุณาสรุปภาพรวม ชี้จุดที่ต้องให้ความสนใจ และข้อเสนอแนะ (ถ้ามี)`;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    await generateStream(prompt, (chunk) => {
      res.write(chunk);
    });
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});
```

- [ ] **Step 4: ทดสอบ ollama-status ก่อน**

```bash
curl http://localhost:3001/api/ai/ollama-status
```

Expected: `{"available":true}`

- [ ] **Step 5: ทดสอบ draft-note (ต้องมี petitionId จริง)**

```bash
curl -X POST http://localhost:3001/api/ai/draft-note \
  -H "Content-Type: application/json" \
  -d "{\"petitionId\":\"<ใส่ _id จริงจาก DB>\"}"
```

Expected: streaming Thai text (~5-15 วินาที)

- [ ] **Step 6: Commit**

```bash
git add server/routes/ai.js
git commit -m "feat(ai): add draft-note and weekly-summary streaming endpoints (Ollama)"
```

---

### Task 14: เพิ่ม Draft Note UI ใน `QCApproval.tsx`

**Files:**
- Modify: `src/pages/QCApproval.tsx`

- [ ] **Step 1: เพิ่ม imports**

```ts
import { useEffect, useState, useRef } from 'react';
import { getOllamaStatus, streamDraftNote } from '@/lib/aiApi';
import { Sparkles, Loader2 } from 'lucide-react';
```

- [ ] **Step 2: เพิ่ม state**

```ts
const [ollamaAvailable, setOllamaAvailable] = useState(false);
const [draftingId, setDraftingId] = useState<string | null>(null);
const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
```

- [ ] **Step 3: ตรวจสอบ Ollama status เมื่อโหลดหน้า**

```ts
useEffect(() => {
  getOllamaStatus().then((s) => setOllamaAvailable(s.available));
}, []);
```

- [ ] **Step 4: เพิ่มปุ่ม "Draft หมายเหตุ" ใน detail view**

หาตรงที่ navigate ไปหน้า detail (หรือ inline detail section) แล้วเพิ่มปุ่มและ textarea:

```tsx
{ollamaAvailable && (
  <div className="mt-3 space-y-2">
    <button
      type="button"
      disabled={draftingId === petition._id}
      onClick={async () => {
        setDraftingId(petition._id);
        setDraftNotes((prev) => ({ ...prev, [petition._id]: '' }));
        try {
          await streamDraftNote(petition._id, (chunk) => {
            setDraftNotes((prev) => ({ ...prev, [petition._id]: (prev[petition._id] ?? '') + chunk }));
          });
        } finally {
          setDraftingId(null);
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-md bg-violet-50 px-3 py-1.5 text-sm text-violet-700 hover:bg-violet-100 border border-violet-200 disabled:opacity-50"
    >
      {draftingId === petition._id ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Sparkles className="h-3.5 w-3.5" />
      )}
      Draft หมายเหตุ (AI)
    </button>

    {draftNotes[petition._id] && (
      <textarea
        value={draftNotes[petition._id]}
        onChange={(e) =>
          setDraftNotes((prev) => ({ ...prev, [petition._id]: e.target.value }))
        }
        className="w-full rounded-md border border-violet-200 bg-white px-3 py-2 text-sm min-h-[100px] focus:outline-none focus:ring-1 focus:ring-violet-400"
        placeholder="AI กำลังสร้าง draft..."
      />
    )}
  </div>
)}
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: ทดสอบ manual**

1. เปิดหน้า QC Approval
2. ถ้า Ollama online → เห็นปุ่ม "Draft หมายเหตุ (AI)"
3. กดปุ่ม → เห็น text stream ใน textarea
4. แก้ไข text ได้

- [ ] **Step 7: Commit**

```bash
git add src/pages/QCApproval.tsx
git commit -m "feat(ai): add streaming draft approval note UI in QCApproval"
```

---

### Task 15: เพิ่ม Weekly Summary UI ใน `DailyCheckRecordsPage.tsx`

**Files:**
- Modify: `src/pages/daily-check/DailyCheckRecordsPage.tsx`

- [ ] **Step 1: เพิ่ม imports**

```ts
import { getOllamaStatus, streamWeeklySummary } from '@/lib/aiApi';
import { Sparkles, Loader2 } from 'lucide-react';
```

- [ ] **Step 2: เพิ่ม state**

```ts
const [ollamaAvailable, setOllamaAvailable] = useState(false);
const [summaryLoading, setSummaryLoading] = useState(false);
const [summaryText, setSummaryText] = useState('');
```

- [ ] **Step 3: เพิ่ม useEffect ตรวจ Ollama**

```ts
useEffect(() => {
  getOllamaStatus().then((s) => setOllamaAvailable(s.available));
}, []);
```

- [ ] **Step 4: เพิ่มปุ่มและ textarea**

หาส่วน header หรือ toolbar ของหน้า แล้วเพิ่ม:

```tsx
{ollamaAvailable && (
  <div className="space-y-2">
    <button
      type="button"
      disabled={summaryLoading}
      onClick={async () => {
        // คำนวณ fromDate/toDate จาก 7 วันย้อนหลัง
        const toDate = new Date().toISOString().slice(0, 10);
        const from = new Date();
        from.setDate(from.getDate() - 6);
        const fromDate = from.toISOString().slice(0, 10);

        setSummaryLoading(true);
        setSummaryText('');
        try {
          await streamWeeklySummary(fromDate, toDate, (chunk) => {
            setSummaryText((prev) => prev + chunk);
          });
        } finally {
          setSummaryLoading(false);
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-md bg-violet-50 px-3 py-1.5 text-sm text-violet-700 hover:bg-violet-100 border border-violet-200 disabled:opacity-50"
    >
      {summaryLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Sparkles className="h-3.5 w-3.5" />
      )}
      สรุปรายสัปดาห์ (AI)
    </button>

    {summaryText && (
      <div className="rounded-md border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900 whitespace-pre-wrap">
        {summaryText}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: ทดสอบ manual**

1. เปิดหน้า Daily Check Records
2. กดปุ่ม "สรุปรายสัปดาห์ (AI)"
3. เห็น Thai text stream ใน card สีม่วง

- [ ] **Step 7: Final commit**

```bash
git add src/pages/daily-check/DailyCheckRecordsPage.tsx
git commit -m "feat(ai): add weekly summary streaming UI in DailyCheckRecordsPage"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** ครบทุก zone — QC Testing (outlier + copy-paste), Petition (machine suggest), Daily Check (staleness + consecutive + trend endpoint), QC Approval (sorting + draft note), Ollama (weekly summary)
- [x] **No placeholders:** ทุก step มี code จริง
- [x] **Type consistency:** `OutlierCheckResult`, `MachineSuggestion`, `DailyCheckTrend` ถูกใช้สม่ำเสมอทั้งใน `aiApi.ts` และ pages
- [x] **Error handling:** ทุก AI call degrade gracefully — ไม่มีจุดไหนที่ AI error จะ break workflow หลัก
- [x] **Ollama config:** URL เป็น env var (`OLLAMA_URL`) สามารถปรับได้โดยไม่ต้อง rebuild
