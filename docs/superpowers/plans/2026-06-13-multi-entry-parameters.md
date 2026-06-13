# Multi-entry Parameters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let selected parameters/fields be filled more than once and keep all values — a single field repeated (`multiple`) or the whole parameter repeated as independent rows (`multiEntry`).

**Architecture:** Structured-array storage (spec approach B). Field-level repeat stores the field value as an array inside the existing flat `values` object; parameter-level repeat stores an `entries` array of value-objects on `QCTestResult`. Two central accessors (`getEntryValues`, `fieldValueList`) normalize every reader so abnormal/progress logic loops once and flags abnormal if **any** value is out of standard (strictest). Server logic in `qcResults.js` mirrors the client logic in `parameterValidation.ts` (files already carry "keep in sync" comments).

**Tech Stack:** Express 4 + Mongoose 8 (`server/`), React 18 + TypeScript + Vite, Vitest. Lab and QC parameter results share the `QCTestResult` collection (`PhysicalResult` is out of scope).

**Reference:** `docs/superpowers/specs/2026-06-13-multi-entry-parameters-design.md`

---

## File Structure

**Schema / models (backend)**
- `server/models/Parameter.js` — add `multiEntry` (parameter), `multiple` (ValueFieldSchema) + guardrail validation.
- `server/models/QCTestResult.js` — add `entries` array.

**Logic (shared, mirrored)**
- `src/lib/parameterValidation.ts` — add `getEntryValues`, `fieldValueList`; update `countAbnormalInResults`.
- `src/lib/parameterValidation.test.ts` — new/updated Vitest cases (find or create alongside).
- `server/routes/qcResults.js` — mirror accessors; update `/abnormal-flags`, `/progress`, and `PUT /` save path.

**Types (frontend)**
- `src/lib/api.ts` — add `multiple` to `ParameterValueField`, `multiEntry` to `ParameterItem`.
- `src/types/petition.types.ts` — add `entries` to `QCTestResult`, `entryIndex` to `SaveQCResultPayload`.

**UI (frontend)**
- `src/pages/ParameterSettings.tsx` — config toggles.
- `src/pages/QCTestingDetailPage.tsx` + `src/pages/LabTestingDetailPage.tsx` — entry/value add-remove rendering + save wiring.
- `src/pages/QCApprovalReviewPage.tsx` + `src/pages/LabApprovalReviewPage.tsx` — read-only display of all entries/values.

---

## Task 1: Backend schema — add `multiple` / `multiEntry` / `entries`

**Files:**
- Modify: `server/models/Parameter.js:26` (ValueFieldSchema), `server/models/Parameter.js:76` (ParameterSchema)
- Modify: `server/models/QCTestResult.js:16`

- [ ] **Step 1: Add `multiple` to ValueFieldSchema**

In `server/models/Parameter.js`, inside `ValueFieldSchema` (after the `required` field around line 26), add:

```javascript
  // Field-level repeat — when true this single field is filled multiple times;
  // its stored value becomes an array. Only valid for text/number/float/enum.
  multiple: { type: Boolean, default: false },
```

- [ ] **Step 2: Add `multiEntry` to ParameterSchema**

In `server/models/Parameter.js`, in `ParameterSchema` next to `hasPhases` (around line 76), add:

```javascript
  // Parameter-level repeat — when true the whole valueFields set repeats as
  // independent rows stored in QCTestResult.entries. Mutually exclusive with hasPhases.
  multiEntry: { type: Boolean, default: false, index: true },
```

- [ ] **Step 3: Add `entries` to QCTestResult**

In `server/models/QCTestResult.js`, after the `valuesPhase2` field (line 16), add:

```javascript
    // For multiEntry parameters only — an array of value-objects, each holding
    // the full field set for one entry. Empty/absent for normal parameters.
    entries:       { type: [mongoose.Schema.Types.Mixed], default: undefined },
```

- [ ] **Step 4: Verify the server boots (syncIndexes runs on boot)**

Run: `cd server && node -e "require('./models/Parameter'); require('./models/QCTestResult'); console.log('models load ok')"`
Expected: `models load ok` with no schema errors.

- [ ] **Step 5: Commit**

```bash
git add server/models/Parameter.js server/models/QCTestResult.js
git commit -m "feat(multi-entry): schema fields multiple/multiEntry/entries"
```

---

## Task 2: Backend guardrail validation

**Files:**
- Modify: `server/models/Parameter.js` (the `pre('validate')` hook, around lines 79-193)

- [ ] **Step 1: Add field-level guardrails inside the per-field loop**

In `server/models/Parameter.js`, inside the `for (const f of this.valueFields || [])` loop in `pre('validate')` (after the existing `reference` checks, before the `min/max` check around line 163), add:

```javascript
    if (f.multiple) {
      if (!['text', 'number', 'float', 'enum'].includes(f.type)) {
        return next(new Error(`ช่อง "${f.label}": กรอกหลายค่าได้เฉพาะชนิด text/number/float/enum`));
      }
      if (f.substanceMode) {
        return next(new Error(`ช่อง "${f.label}": ใช้ "กรอกหลายค่า" ร่วมกับโหมดรายสารไม่ได้`));
      }
      if (f.type === 'reference') {
        return next(new Error(`ช่อง "${f.label}": field แบบ reference กรอกหลายค่าไม่ได้`));
      }
      if (f.triggersPhase2) {
        return next(new Error(`ช่อง "${f.label}": ตัว trigger Phase 2 กรอกหลายค่าไม่ได้`));
      }
    }
```

- [ ] **Step 2: Add parameter-level guardrail near the phase block**

In the same hook, before the `if (this.hasPhases)` block (around line 169), add:

```javascript
  if (this.multiEntry && this.hasPhases) {
    return next(new Error('Parameter แบบ "กรอกหลายรายการ" ใช้ร่วมกับโหมด 2 phase ไม่ได้'));
  }
```

- [ ] **Step 3: Manually verify validation rejects a bad combo**

Run:
```bash
cd server && node -e "
const P = require('./models/Parameter');
const p = new P({ name:'t', multiEntry:true, hasPhases:true, valueFields:[{label:'a',type:'text'}] });
p.validate().then(()=>console.log('UNEXPECTED PASS')).catch(e=>console.log('OK rejected:', e.message));
"
```
Expected: `OK rejected: Parameter แบบ "กรอกหลายรายการ" ใช้ร่วมกับโหมด 2 phase ไม่ได้`

- [ ] **Step 4: Verify a multiple-on-photo combo is rejected**

Run:
```bash
cd server && node -e "
const P = require('./models/Parameter');
const p = new P({ name:'t', valueFields:[{label:'a',type:'photo',multiple:true}] });
p.validate().then(()=>console.log('UNEXPECTED PASS')).catch(e=>console.log('OK rejected:', e.message));
"
```
Expected: `OK rejected: ช่อง "a": กรอกหลายค่าได้เฉพาะชนิด text/number/float/enum`

- [ ] **Step 5: Commit**

```bash
git add server/models/Parameter.js
git commit -m "feat(multi-entry): validate guardrails for multiple/multiEntry"
```

---

## Task 3: Central accessors + abnormal logic (client) — TDD

**Files:**
- Modify: `src/lib/parameterValidation.ts`
- Test: `src/lib/parameterValidation.test.ts` (create if absent)

- [ ] **Step 1: Write failing tests for the accessors + strictest abnormal**

Add to `src/lib/parameterValidation.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getEntryValues, fieldValueList, countAbnormalInResults } from "./parameterValidation";
import type { ParameterItem } from "./api";
import type { QCTestResult } from "@/types/petition.types";

const numField = { label: "pH", type: "number" as const, unit: "x", standardOperator: "lte" as const, standardValue: 7 };

describe("getEntryValues", () => {
  it("non-multiEntry → single entry from values", () => {
    const r = { values: { pH: 5 } } as unknown as QCTestResult;
    expect(getEntryValues(r, { valueFields: [numField] })).toEqual([{ pH: 5 }]);
  });
  it("multiEntry → entries array", () => {
    const r = { values: {}, entries: [{ pH: 5 }, { pH: 6 }] } as unknown as QCTestResult;
    expect(getEntryValues(r, { multiEntry: true, valueFields: [numField] })).toEqual([{ pH: 5 }, { pH: 6 }]);
  });
  it("multiEntry but empty entries → [{}]", () => {
    const r = { values: {} } as unknown as QCTestResult;
    expect(getEntryValues(r, { multiEntry: true, valueFields: [numField] })).toEqual([{}]);
  });
});

describe("fieldValueList", () => {
  it("non-multiple → wraps scalar", () => {
    expect(fieldValueList({ pH: 5 }, numField)).toEqual([5]);
  });
  it("multiple → returns array as-is", () => {
    expect(fieldValueList({ pH: [5, 6] }, { ...numField, multiple: true })).toEqual([5, 6]);
  });
  it("multiple but missing → []", () => {
    expect(fieldValueList({}, { ...numField, multiple: true })).toEqual([]);
  });
});

describe("countAbnormalInResults strictest", () => {
  const param = { _id: "p1", valueFields: [numField] } as unknown as ParameterItem;
  const mk = (values: Record<string, unknown>, extra: Partial<QCTestResult> = {}) =>
    ([{ petitionId: "x", itemSeq: 1, parameterId: "p1", values, ...extra }] as unknown as QCTestResult[]);

  it("one bad value among a multiple field → counts abnormal", () => {
    const p = { ...param, valueFields: [{ ...numField, multiple: true }] } as unknown as ParameterItem;
    expect(countAbnormalInResults(mk({ pH: [5, 9] }), [p])).toBe(1);
  });
  it("all good multiple values → 0", () => {
    const p = { ...param, valueFields: [{ ...numField, multiple: true }] } as unknown as ParameterItem;
    expect(countAbnormalInResults(mk({ pH: [5, 6] }), [p])).toBe(0);
  });
  it("multiEntry: one bad entry → counts abnormal", () => {
    const p = { ...param, multiEntry: true } as unknown as ParameterItem;
    expect(countAbnormalInResults(mk({}, { entries: [{ pH: 5 }, { pH: 9 }] }), [p])).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- parameterValidation`
Expected: FAIL — `getEntryValues`/`fieldValueList` not exported.

- [ ] **Step 3: Add the accessors**

In `src/lib/parameterValidation.ts`, after the imports/`isFieldAbnormal` block (near line 54), add:

```typescript
// Normalize a result into a list of per-entry value-objects.
// Non-multiEntry parameters yield a single entry from `values`; multiEntry yields `entries`.
export function getEntryValues(
  result: { values?: Record<string, unknown>; entries?: Record<string, unknown>[] },
  param: { multiEntry?: boolean },
): Record<string, unknown>[] {
  if (param.multiEntry) {
    const e = result.entries;
    return Array.isArray(e) && e.length ? e : [{}];
  }
  return [result.values ?? {}];
}

// Normalize a field's stored value into a list. `multiple` fields hold an array;
// normal fields are wrapped into a single-element list.
export function fieldValueList(
  values: Record<string, unknown>,
  field: ParameterValueField,
): unknown[] {
  if (field.multiple) {
    const v = values[field.label];
    return Array.isArray(v) ? v : [];
  }
  return [values[field.label]];
}
```

- [ ] **Step 4: Add `multiple` to the `ParameterValueField` type**

In `src/lib/api.ts`, inside `ParameterValueField` (after `substanceMode?` near line 780), add:

```typescript
  // Field-level repeat — value stored as an array. text/number/float/enum only.
  multiple?: boolean;
```

In the same file, inside `ParameterItem` (next to `hasPhases?` near line 838), add:

```typescript
  // Parameter-level repeat — whole field set repeats into QCTestResult.entries.
  multiEntry?: boolean;
```

- [ ] **Step 5: Rewrite `countAbnormalInResults` to loop entries × fieldValueList**

In `src/lib/parameterValidation.ts`, replace the body of `countAbnormalInResults` (lines ~120-170) so the inner loop becomes:

```typescript
export function countAbnormalInResults(
  results: QCTestResult[],
  parameters: ParameterItem[],
): number {
  if (!results?.length || !parameters?.length) return 0;
  const paramById = new Map<string, ParameterItem>();
  for (const p of parameters) {
    if (p._id) paramById.set(String(p._id), p);
  }
  // group entry values per item for cross-parameter conditional ctx (uses entry 0)
  const valuesByItem = new Map<string, Record<string, Record<string, unknown>>>();
  for (const r of results) {
    const param = paramById.get(String(r.parameterId));
    const itemKey = `${r.petitionId}__${r.itemSeq}`;
    let bucket = valuesByItem.get(itemKey);
    if (!bucket) { bucket = {}; valuesByItem.set(itemKey, bucket); }
    bucket[String(r.parameterId)] = getEntryValues(r, param ?? {})[0] ?? {};
  }
  let count = 0;
  for (const r of results) {
    const param = paramById.get(String(r.parameterId));
    if (!param?.valueFields?.length) continue;
    const itemKey = `${r.petitionId}__${r.itemSeq}`;
    for (const values of getEntryValues(r, param)) {
      for (const field of param.valueFields) {
        const isNumeric = field.type === "number" || field.type === "float";
        if (field.substanceMode && isNumeric) {
          const prefix = `${field.label}::`;
          for (const [vkey, vval] of Object.entries(values)) {
            if (!vkey.startsWith(prefix)) continue;
            const subKey = vkey.slice(prefix.length);
            const std = (field.substanceStandards ?? []).find(
              (s) => matchSubstanceKey(s.substance) === subKey,
            );
            if (isSubstanceAbnormal(field, std, vval)) count += 1;
          }
          continue;
        }
        const vf = field.conditionalMode && isNumeric
          ? resolveFieldStandard(field, { sameParam: values, otherParams: valuesByItem.get(itemKey) ?? {} })
          : field;
        for (const v of fieldValueList(values, field)) {
          if (isFieldAbnormal(vf, v)) count += 1;
        }
      }
    }
  }
  return count;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run test -- parameterValidation`
Expected: PASS (all new cases green, existing cases still green).

- [ ] **Step 7: Commit**

```bash
git add src/lib/parameterValidation.ts src/lib/parameterValidation.test.ts src/lib/api.ts
git commit -m "feat(multi-entry): central accessors + strictest abnormal (client)"
```

---

## Task 4: Server mirror — accessors + abnormal-flags + progress

**Files:**
- Modify: `server/routes/qcResults.js` (helpers near line 49; `/abnormal-flags` lines 185-251; `/progress` lines 150-181)

- [ ] **Step 1: Add the JS mirror accessors**

In `server/routes/qcResults.js`, after `isFieldAbnormal` (line 49), add:

```javascript
// mirror of src/lib/parameterValidation.ts getEntryValues / fieldValueList — keep in sync
function getEntryValuesJS(result, param) {
  if (param && param.multiEntry) {
    const e = result.entries;
    return Array.isArray(e) && e.length ? e : [{}];
  }
  return [result.values || {}];
}

function fieldValueListJS(values, field) {
  if (field.multiple) {
    const v = values[field.label];
    return Array.isArray(v) ? v : [];
  }
  return [values[field.label]];
}
```

- [ ] **Step 2: Rewrite the `/abnormal-flags` inner evaluation to loop entries × values**

In `server/routes/qcResults.js`, replace the `for (const d of docs)` evaluation block in `/abnormal-flags` (lines ~213-245) with:

```javascript
    for (const d of docs) {
      if (map[d.petitionId]) continue;
      const param = paramById.get(String(d.parameterId));
      if (!param?.valueFields?.length) continue;
      const ctxBucket = valuesByItem[`${d.petitionId}__${d.itemSeq}`] || {};
      let flagged = false;
      for (const values of getEntryValuesJS(d, param)) {
        for (const field of param.valueFields) {
          const isNumeric = field.type === "number" || field.type === "float";
          if (field.substanceMode && isNumeric) {
            const prefix = `${field.label}::`;
            for (const [vkey, vval] of Object.entries(values)) {
              if (!vkey.startsWith(prefix)) continue;
              const subKey = vkey.slice(prefix.length);
              const std = (field.substanceStandards || []).find(
                (s) => matchSubstanceKeyJS(s.substance) === subKey,
              );
              if (isSubstanceAbnormalJS(field, std, vval)) { flagged = true; break; }
            }
            if (flagged) break;
            continue;
          }
          const vf = field.conditionalMode && isNumeric
            ? resolveFieldStandardJS(field, { sameParam: values, otherParams: ctxBucket })
            : field;
          for (const v of fieldValueListJS(values, field)) {
            if (isFieldAbnormal(vf, v)) { flagged = true; break; }
          }
          if (flagged) break;
        }
        if (flagged) break;
      }
      if (flagged) map[d.petitionId] = true;
    }
```

- [ ] **Step 3: Fix the `valuesByItem` builder in `/abnormal-flags` to use entry 0**

In the same handler, the loop that builds `valuesByItem` (lines ~204-208) must use the param-aware accessor. Replace it with:

```javascript
    const valuesByItem = {};   // `${petitionId}__${itemSeq}` -> { [parameterId]: values }
    for (const d of docs) {
      const key = `${d.petitionId}__${d.itemSeq}`;
      if (!valuesByItem[key]) valuesByItem[key] = {};
      const param = paramById.get(String(d.parameterId));
      valuesByItem[key][String(d.parameterId)] = getEntryValuesJS(d, param || {})[0] || {};
    }
```

Note: `paramById` is defined just above this loop (line ~201), so this ordering is valid.

- [ ] **Step 4: Update `/progress` filledLabels to count across entries/values**

In `server/routes/qcResults.js`, the `/progress` handler needs the parameter to know which fields repeat. Replace the `QCTestResult.find` + map block (lines ~157-177) with:

```javascript
    const docs = await QCTestResult.find(
      { petitionId: { $in: ids } },
      { petitionId: 1, itemSeq: 1, parameterId: 1, values: 1, entries: 1 }
    ).lean();

    const paramIds = Array.from(new Set(docs.map((d) => String(d.parameterId))));
    const params = paramIds.length
      ? await Parameter.find({ _id: { $in: paramIds } }, { valueFields: 1, multiEntry: 1 }).lean()
      : [];
    const paramById = new Map(params.map((p) => [String(p._id), p]));

    const map = {};
    for (const id of ids) map[id] = [];
    for (const d of docs) {
      const param = paramById.get(String(d.parameterId)) || {};
      const labels = new Set();
      for (const values of getEntryValuesJS(d, param)) {
        for (const [k, v] of Object.entries(values)) {
          // a field counts as filled if any entry/element carries a non-empty value
          if (Array.isArray(v)) {
            if (v.some((x) => x != null && String(x).trim() !== "")) labels.add(k);
          } else if (v != null && String(v).trim() !== "") {
            labels.add(k);
          }
        }
      }
      const bucket = map[d.petitionId];
      if (bucket) {
        bucket.push({
          itemSeq: d.itemSeq,
          parameterId: String(d.parameterId),
          filledLabels: Array.from(labels),
        });
      }
    }
    res.json(map);
```

- [ ] **Step 5: Smoke-test the server starts and routes load**

Run: `cd server && node -e "require('./routes/qcResults'); console.log('qcResults route ok')"`
Expected: `qcResults route ok` (no syntax errors).

- [ ] **Step 6: Commit**

```bash
git add server/routes/qcResults.js
git commit -m "feat(multi-entry): mirror accessors in abnormal-flags/progress (server)"
```

---

## Task 5: Save path — `entryIndex` support

**Files:**
- Modify: `server/routes/qcResults.js` (`PUT /` handler, lines 287-376)
- Modify: `src/types/petition.types.ts` (`QCTestResult`, `SaveQCResultPayload`)

- [ ] **Step 1: Add `entries` / `entryIndex` to the TS types**

In `src/types/petition.types.ts`, inside `QCTestResult` (after `valuesPhase2?` line 254), add:

```typescript
  // For multiEntry parameters — array of per-entry value-objects.
  entries?: Record<string, unknown>[];
```

In `SaveQCResultPayload` (after `value: unknown;` line 271), add:

```typescript
  // For multiEntry parameters — which entry row this field write targets.
  entryIndex?: number;
```

- [ ] **Step 2: Read `entryIndex` and branch the save in `PUT /`**

In `server/routes/qcResults.js` `PUT /` handler, destructure `entryIndex` from `req.body` (add to the list around line 295):

```javascript
      fieldLabel, value, entryIndex,
```

Then replace the `update` construction + write (lines ~317-336) with:

```javascript
    const existing = await QCTestResult.findOne(filter);
    const isNew = !existing;

    const baseSet = {
      petitionNo, sampleId, sampleName, commonName, parameterName,
      updatedBy: enteredBy,
      updatedAt: now,
    };
    if (isNew || !existing?.enteredBy) {
      baseSet.enteredBy = enteredBy;
      baseSet.enteredAt = now;
    }

    let existingFieldValue;
    const update = { $set: baseSet };

    if (phaseNum === 1 && Number.isInteger(entryIndex) && entryIndex >= 0) {
      // multiEntry write: read-modify-write the entries array (avoids dot-path
      // numeric-index creating an object instead of an array)
      const entries = Array.isArray(existing?.entries)
        ? existing.entries.map((e) => ({ ...(e || {}) }))
        : [];
      while (entries.length <= entryIndex) entries.push({});
      existingFieldValue = entries[entryIndex][fieldLabel];
      entries[entryIndex][fieldLabel] = value;
      update.$set.entries = entries;
    } else {
      existingFieldValue = existing?.[valuesKey]?.[fieldLabel];
      update.$set[`${valuesKey}.${fieldLabel}`] = value;
    }

    const doc = await QCTestResult.findOneAndUpdate(filter, update, {
      upsert: true,
      new: true,
    });
```

Note: the later audit-log block already references `existingFieldValue`; keep it. Add `entryIndex` into its `metadata` object (line ~350): `metadata: { itemSeq, sampleName, commonName, parameterId, parameterName, fieldLabel, phase: phaseNum, entryIndex },`.

- [ ] **Step 3: Manually verify a multiEntry write builds an array**

Start the backend (`cd server && npm run dev` in another terminal), then run:
```bash
curl -s -X PUT http://localhost:3001/api/qc-results -H "Content-Type: application/json" -d '{"petitionId":"TESTPID","itemSeq":1,"parameterId":"TESTPARAM","fieldLabel":"pH","value":7.2,"entryIndex":1,"enteredBy":{"name":"t","email":"t@t"}}' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const o=JSON.parse(s);console.log('entries is array:',Array.isArray(o.entries),'len:',o.entries&&o.entries.length)})"
```
Expected: `entries is array: true len: 2` (index 0 padded `{}`, index 1 has pH). Then clean up: delete the `TESTPID` doc via Mongo, or leave it (soft-deletable test data).

- [ ] **Step 4: Commit**

```bash
git add server/routes/qcResults.js src/types/petition.types.ts
git commit -m "feat(multi-entry): entryIndex save path for entries array"
```

---

## Task 6: ParameterSettings — config toggles

**Files:**
- Modify: `src/pages/ParameterSettings.tsx`

- [ ] **Step 1: Add the parameter-level `multiEntry` checkbox**

In `src/pages/ParameterSettings.tsx`, find the JSX where `hasPhases` is toggled (search for `hasPhases`). Next to it, add a checkbox bound to the editing parameter's `multiEntry`, disabled when `hasPhases` is on:

```tsx
<label className="flex items-center gap-2 text-sm">
  <Checkbox
    checked={!!draft.multiEntry}
    disabled={!!draft.hasPhases}
    onCheckedChange={(v) => setDraft((d) => ({ ...d, multiEntry: !!v }))}
  />
  กรอกได้หลายรายการ (เก็บทุกค่า)
</label>
```

(Use the same `draft`/`setDraft` state setter the surrounding parameter editor already uses — match the local variable names in this file; `Checkbox` is already imported at line 35.)

- [ ] **Step 2: Add the per-field `multiple` checkbox**

In the field editor block (search for where `substanceMode` or `required` is toggled per field), add a checkbox bound to that field's `multiple`, disabled unless the field type is text/number/float/enum:

```tsx
<label className="flex items-center gap-2 text-sm">
  <Checkbox
    checked={!!field.multiple}
    disabled={!['text', 'number', 'float', 'enum'].includes(field.type) || !!field.substanceMode}
    onCheckedChange={(v) => updateField(idx, { multiple: !!v })}
  />
  ช่องนี้กรอกได้หลายค่า
</label>
```

(Match the file's existing per-field update helper — whatever the surrounding code calls to patch one field by index. If it spreads inline like `onChange={(e)=>...map...}`, follow that same pattern instead of `updateField`.)

- [ ] **Step 3: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors referencing `multiEntry` / `multiple` (repo has ~12 pre-existing latent errors per project notes — confirm none are new in these files).

- [ ] **Step 4: Commit**

```bash
git add src/pages/ParameterSettings.tsx
git commit -m "feat(multi-entry): config toggles in ParameterSettings"
```

---

## Task 7: QCTestingDetailPage — repeated value / entry rendering

**Files:**
- Modify: `src/pages/QCTestingDetailPage.tsx`

Context: the page renders fields via `expandFieldForItem` and saves each field with `api.saveQCResult({ ... fieldLabel, value, phase })`. We add two render modes.

- [ ] **Step 1: Add a local helper to read a field's current array value**

Near the other field-value helpers in `QCTestingDetailPage.tsx`, add:

```tsx
// current array value for a `multiple` field (always returns an array for editing)
const readMultiple = (values: Record<string, unknown>, label: string): unknown[] => {
  const v = values?.[label];
  return Array.isArray(v) ? v : (v == null || v === "" ? [] : [v]);
};
```

- [ ] **Step 2: Render `multiple` fields as a repeatable input list**

In the field-render JSX (where a single input is rendered per `unit` from `expandFieldForItem`), branch when `unit.field.multiple` is true: render one input per element of `readMultiple(values, unit.key)` plus an empty trailing slot, each numbered "ค่าที่ N", with a `[ลบ]` per row and a `[+ เพิ่มค่า]` button. On any change, rebuild the array and save the **whole array** as the field value:

```tsx
// inside the multiple branch — `arr` = readMultiple(values, unit.key)
const saveArray = (next: unknown[]) =>
  api.saveQCResult({
    petitionId, petitionNo, itemSeq: item.itemSeq, sampleId: item.sampleId,
    sampleName: item.sampleName, commonName: item.commonName,
    parameterId: param._id!, parameterName: param.name,
    fieldLabel: unit.key, value: next, enteredBy,
  });
// row change: const next = [...arr]; next[i] = newVal; saveArray(next);
// add:        saveArray([...arr, ""]);
// remove:     saveArray(arr.filter((_, j) => j !== i));
```

(Reuse the existing input component/markup for each row so validation highlighting via `isFieldAbnormal(unit.field, value)` still applies per row. Match the real local variable names — `petitionId`, `item`, `enteredBy`, etc. — already in scope in this render.)

- [ ] **Step 3: Render `multiEntry` parameters as repeatable cards**

Where a parameter card is rendered, branch when `param.multiEntry`: render the field set once per entry from `getEntryValues(result, param)` plus a trailing empty entry, each card titled "รายการที่ N" with `[ลบรายการ]`, and a `[+ เพิ่มรายการ]` button below. Each field write passes the entry index:

```tsx
// per entry index `ei`, per field — save with entryIndex
api.saveQCResult({
  petitionId, petitionNo, itemSeq: item.itemSeq, sampleId: item.sampleId,
  sampleName: item.sampleName, commonName: item.commonName,
  parameterId: param._id!, parameterName: param.name,
  fieldLabel: unit.key, value: newVal, enteredBy, entryIndex: ei,
});
// add entry: write nothing yet — just grow the local rendered count (ei = entries.length)
// remove entry: save the trimmed entries array via a dedicated call (see Step 4)
```

- [ ] **Step 4: Wire entry removal through a trimmed-array save**

Removing a `multiEntry` row can't go through the per-field path. Add a small helper that re-saves remaining entries. Simplest: send one `entryIndex` write per surviving field is overkill — instead PUT the trimmed array directly. Reuse the field path by writing each remaining entry's first field is fragile; instead add an explicit client call that sets the whole array.

Add to `src/lib/api.ts` (next to `saveQCResult`, line ~419):

```typescript
  saveQCEntries: (data: {
    petitionId: string; petitionNo?: string; itemSeq: number; sampleId?: string;
    sampleName?: string; commonName?: string; parameterId: string; parameterName?: string;
    entries: Record<string, unknown>[]; enteredBy: { name: string; email: string };
  }) =>
    request<import("@/types/petition.types").QCTestResult>("/qc-results/entries", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
```

Add the matching route in `server/routes/qcResults.js` before `module.exports` (line 378):

```javascript
// PUT /api/qc-results/entries — replace the whole entries array (multiEntry add/remove)
router.put("/entries", async (req, res) => {
  try {
    const {
      petitionId, petitionNo, itemSeq, sampleId, sampleName, commonName,
      parameterId, parameterName, entries, enteredBy,
    } = req.body;
    if (!petitionId || itemSeq == null || !parameterId || !Array.isArray(entries)) {
      return res.status(400).json({ error: "petitionId, itemSeq, parameterId, entries[] required" });
    }
    const filter = { petitionId, itemSeq, parameterId };
    const now = new Date();
    const existing = await QCTestResult.findOne(filter);
    const update = {
      $set: {
        petitionNo, sampleId, sampleName, commonName, parameterName,
        entries, updatedBy: enteredBy, updatedAt: now,
      },
    };
    if (!existing || !existing.enteredBy) {
      update.$set.enteredBy = enteredBy;
      update.$set.enteredAt = now;
    }
    const doc = await QCTestResult.findOneAndUpdate(filter, update, { upsert: true, new: true });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

Use `api.saveQCEntries({ ..., entries: trimmed })` for the `[ลบรายการ]` action.

- [ ] **Step 5: Type-check + manual smoke**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors in `QCTestingDetailPage.tsx` / `api.ts`.

Manual: with backend + `npm run dev` running, open a petition's QC testing detail that has a multiEntry param / multiple field; add 2 values + 2 entries; reload; confirm values persist and out-of-standard ones highlight.

- [ ] **Step 6: Commit**

```bash
git add src/pages/QCTestingDetailPage.tsx src/lib/api.ts server/routes/qcResults.js
git commit -m "feat(multi-entry): repeatable value/entry UI in QC testing detail"
```

---

## Task 8: LabTestingDetailPage — repeated value / entry rendering

**Files:**
- Modify: `src/pages/LabTestingDetailPage.tsx`

Context: identical render pattern to Task 7 (this page uses the same `expandFieldForItem` + `api.saveQCResult` and only handles `param.scope === 'lab'` writes — read-only for shared QC params at line 583).

- [ ] **Step 1: Mirror the `readMultiple` helper**

Add the same helper as Task 7 Step 1 into `LabTestingDetailPage.tsx`.

- [ ] **Step 2: Render `multiple` fields as a repeatable input list**

Apply the same branch as Task 7 Step 2, but only for editable (lab-owned) params — keep the existing `param.scope !== 'lab'` read-only guard (the shared-QC branch at line 583 should display the array values read-only, not show add/remove).

- [ ] **Step 3: Render `multiEntry` parameters as repeatable cards**

Apply Task 7 Step 3 for lab-owned params; shared-QC multiEntry params render read-only (display all entries, no add/remove).

- [ ] **Step 4: Wire entry removal**

Use `api.saveQCEntries` (added in Task 7 Step 4) for `[ลบรายการ]` on lab-owned params.

- [ ] **Step 5: Type-check + manual smoke**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors in `LabTestingDetailPage.tsx`.

Manual: open a Lab testing detail with a lab-owned multiEntry/multiple param; add values + entries; reload; confirm persistence and highlighting.

- [ ] **Step 6: Commit**

```bash
git add src/pages/LabTestingDetailPage.tsx
git commit -m "feat(multi-entry): repeatable value/entry UI in Lab testing detail"
```

---

## Task 9: Approval review pages — read-only display of all entries/values

**Files:**
- Modify: `src/pages/QCApprovalReviewPage.tsx`, `src/pages/LabApprovalReviewPage.tsx`

- [ ] **Step 1: QC approval — iterate entries × values for display**

In `src/pages/QCApprovalReviewPage.tsx`, find where a parameter's fields/values are rendered for review. Wrap the per-field display so it iterates `getEntryValues(result, param)` (import from `@/lib/parameterValidation`) and, for each field, iterates `fieldValueList(values, field)` — rendering each value read-only with its "รายการที่ N / ค่าที่ N" label and existing abnormal highlight via `isFieldAbnormal`.

```tsx
import { getEntryValues, fieldValueList, isFieldAbnormal } from "@/lib/parameterValidation";
// for (const [ei, values] of getEntryValues(result, param).entries())
//   for (const field of param.valueFields ?? [])
//     fieldValueList(values, field).map((v, vi) => <ValueCell abnormal={isFieldAbnormal(field, v)} .../>)
```

- [ ] **Step 2: Lab approval — same display treatment**

Apply the same iteration in `src/pages/LabApprovalReviewPage.tsx` (note this file is already modified in the working tree per `git status` — integrate without reverting existing changes).

- [ ] **Step 3: Type-check + manual smoke**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors in the two approval pages.

Manual: approve-review a petition with multiEntry/multiple data; confirm every entry/value shows and bad ones highlight.

- [ ] **Step 4: Commit**

```bash
git add src/pages/QCApprovalReviewPage.tsx src/pages/LabApprovalReviewPage.tsx
git commit -m "feat(multi-entry): show all entries/values in approval review"
```

---

## Task 10: Full verification sweep

- [ ] **Step 1: Run the full unit suite**

Run: `npm run test`
Expected: all pass (including the new `parameterValidation` cases).

- [ ] **Step 2: Lint + type-check**

Run: `npm run lint && npx tsc -p tsconfig.app.json --noEmit`
Expected: no new lint errors; no new type errors in touched files.

- [ ] **Step 3: End-to-end manual checklist (backend + `npm run dev` up)**

- Create a parameter with a `multiple` number field (standard `lte 7`) and a separate `multiEntry` parameter.
- QC testing detail: enter values `[5, 9]` in the multiple field → list flag shows abnormal; enter 2 entries in the multiEntry param.
- Confirm `/qc-results/abnormal-flags` flips the petition's abnormal badge (strictest).
- Confirm the หัวหน้า QC normal/abnormal buttons key off the abnormal flag correctly (uses `getAbnormalFlags`).
- Approval review pages show all entries/values read-only with highlights.
- Reload everything — data persists.

- [ ] **Step 4: Export seed data (keeps `seed-data/` recoverable)**

Run: `cd server && npm run seed:export`
Then commit any changed `server/seed-data/*.json`:
```bash
git add server/seed-data
git commit -m "chore(multi-entry): refresh seed-data after schema additions"
```

---

## Self-review notes
- Spec §"Data model" → Task 1; §"Guardrails" → Task 2; §"Central accessors" + §"Save path" client → Task 3/5; §abnormal/progress server → Task 4; §"Save path" server → Task 5; §UI ParameterSettings → Task 6; §UI detail pages → Task 7/8; §UI approval → Task 9; §Testing → Task 3 + Task 10.
- `multiEntry` removal can't ride the per-field `$set` path → explicit `PUT /qc-results/entries` (Task 7 Step 4) covers add/remove.
- Names kept consistent: `getEntryValues`/`fieldValueList` (client), `getEntryValuesJS`/`fieldValueListJS` (server), `saveQCEntries` (api) ↔ `PUT /qc-results/entries` (route).
