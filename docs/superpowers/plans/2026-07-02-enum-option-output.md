# Enum Option Output (ปกติ / ไม่ปกติ / ข้อความ) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each enum parameter option pick one of three outputs — ปกติ (normal), ไม่ปกติ (abnormal), or ข้อความ (a fixed custom text shown as neutral info) — replacing the single per-option "ปกติ" checkbox.

**Architecture:** Add an optional per-option map `optionOutputs` to `ValueFieldSchema`. Its presence is the discriminator: fields that have it use the new three-way logic; legacy fields (absent) keep the old `expectedValues` logic. Abnormal detection lives in a shared frontend helper (`parameterValidation.ts`) plus a backend copy (`server/routes/qcResults.js`); everything abnormal-related routes through `isFieldAbnormal`, so updating those propagates counts/highlights/approval-flags automatically.

**Tech Stack:** React 18 + TypeScript (Vite), Express 4 + Mongoose 8, Vitest (frontend), Node built-in test runner (`node --test`, backend).

## Global Constraints

- **Two copies of `isEnumAbnormal` must stay in sync** — the frontend TS (`src/lib/parameterValidation.ts`) and the backend JS (extracted to `server/lib/abnormal.js` in Task 2). Any rule change touches both.
- **No forced DB migration.** Discriminator = presence/absence of `field.optionOutputs`. Legacy fields keep working unchanged.
- **Type-check command:** `npx tsc -p tsconfig.app.json --noEmit`. The bare `npx tsc --noEmit` is a no-op in this repo (root `tsconfig.json` has `files: []`).
- **Never run `npm run build`** during this work (its `postbuild` rewrites root files). Use the type-check command above.
- **UI labels are Thai.**
- **Commit with explicit pathspec** (`git add -- <files>`) — the repo occasionally has concurrent committers; never `git add -A`.
- **Commit message trailer:** end every commit body with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Behavior preservation on legacy upgrade:** seeding `optionOutputs` from a legacy field must not change what gets flagged. In particular, a legacy field with **empty** `expectedValues` had *no* abnormal detection → seed every option to `text` (neutral), NOT `abnormal`.

---

### Task 1: Types + frontend abnormal logic & display helpers

**Files:**
- Modify: `src/lib/api.ts:831` (add types near `ParameterValueField`)
- Modify: `src/lib/parameterValidation.ts:5-16` (`isEnumAbnormal`) + append new helpers
- Test: `src/lib/parameterValidation.test.ts`

**Interfaces:**
- Produces:
  - `type OptionOutputKind = "normal" | "abnormal" | "text"`
  - `type OptionOutput = { kind: OptionOutputKind; text?: string }`
  - `ParameterValueField.optionOutputs?: Record<string, OptionOutput>`
  - `isEnumAbnormal(field: ParameterValueField, value: unknown): boolean` (updated)
  - `optionOutputText(field: ParameterValueField, value: unknown): string | null`
  - `enumNormalValues(field: ParameterValueField): string[]`
  - `seedOptionOutputsFromLegacy(options: string[] | undefined, expectedValues: string[] | undefined): Record<string, OptionOutput>`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/parameterValidation.test.ts` (inside the file, after the existing `describe("isEnumAbnormal", …)` block). Also add the three new helpers to the import list at the top (`optionOutputText`, `enumNormalValues`, `seedOptionOutputsFromLegacy`) and `OptionOutput` to the `import type` from `./api`.

```ts
describe("isEnumAbnormal with optionOutputs", () => {
  it("flags only options whose kind is 'abnormal'", () => {
    const field = makeField({
      options: ["ใส", "ขุ่น", "ตะกอน"],
      optionOutputs: {
        "ใส": { kind: "normal" },
        "ขุ่น": { kind: "abnormal" },
        "ตะกอน": { kind: "text", text: "เฝ้าระวัง" },
      },
    });
    expect(isEnumAbnormal(field, "ใส")).toBe(false);
    expect(isEnumAbnormal(field, "ขุ่น")).toBe(true);
    expect(isEnumAbnormal(field, "ตะกอน")).toBe(false);
  });

  it("takes precedence over expectedValues when both present", () => {
    const field = makeField({
      options: ["a", "b"],
      expectedValues: ["a"], // legacy would mark b abnormal
      optionOutputs: { "a": { kind: "normal" }, "b": { kind: "text", text: "-" } },
    });
    expect(isEnumAbnormal(field, "b")).toBe(false);
  });

  it("returns false for a value not present in the map", () => {
    const field = makeField({
      options: ["a"],
      optionOutputs: { "a": { kind: "abnormal" } },
    });
    expect(isEnumAbnormal(field, "unknown")).toBe(false);
    expect(isEnumAbnormal(field, "")).toBe(false);
    expect(isEnumAbnormal(field, null)).toBe(false);
  });
});

describe("optionOutputText", () => {
  const field = makeField({
    options: ["ใส", "ตะกอน"],
    optionOutputs: { "ใส": { kind: "normal" }, "ตะกอน": { kind: "text", text: "เฝ้าระวัง" } },
  });
  it("returns the custom text for a text-kind option", () => {
    expect(optionOutputText(field, "ตะกอน")).toBe("เฝ้าระวัง");
  });
  it("returns null for non-text kinds and empty/legacy fields", () => {
    expect(optionOutputText(field, "ใส")).toBeNull();
    expect(optionOutputText(field, "")).toBeNull();
    expect(optionOutputText(makeField({ optionOutputs: undefined }), "ใส")).toBeNull();
  });
});

describe("enumNormalValues", () => {
  it("returns options whose kind is normal when optionOutputs present", () => {
    const field = makeField({
      options: ["a", "b", "c"],
      optionOutputs: { "a": { kind: "normal" }, "b": { kind: "abnormal" }, "c": { kind: "normal" } },
    });
    expect(enumNormalValues(field).sort()).toEqual(["a", "c"]);
  });
  it("falls back to expectedValues for legacy fields", () => {
    expect(enumNormalValues(makeField({ expectedValues: ["a"] }))).toEqual(["a"]);
  });
});

describe("seedOptionOutputsFromLegacy", () => {
  it("maps expected->normal and the rest->abnormal when expectedValues is non-empty", () => {
    expect(seedOptionOutputsFromLegacy(["a", "b", "c"], ["a"])).toEqual({
      a: { kind: "normal" },
      b: { kind: "abnormal" },
      c: { kind: "abnormal" },
    });
  });
  it("maps everything to text=label when expectedValues is empty (no legacy detection)", () => {
    expect(seedOptionOutputsFromLegacy(["a", "b"], [])).toEqual({
      a: { kind: "text", text: "a" },
      b: { kind: "text", text: "b" },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/parameterValidation.test.ts`
Expected: FAIL — `optionOutputText`, `enumNormalValues`, `seedOptionOutputsFromLegacy` are not exported; the new `isEnumAbnormal` cases fail because the current impl ignores `optionOutputs`.

- [ ] **Step 3: Add the types in `src/lib/api.ts`**

Insert immediately above `export type ParameterValueField = {` (currently line 810):

```ts
export type OptionOutputKind = "normal" | "abnormal" | "text";
export type OptionOutput = { kind: OptionOutputKind; text?: string };
```

Then add this line inside `ParameterValueField`, right after `expectedValues?: string[];` (line 831):

```ts
  // Per-option result classification (enum). Presence = new model; absence = legacy expectedValues.
  // { kind:'normal' } → pass; { kind:'abnormal' } → flagged; { kind:'text', text } → neutral, shows `text`.
  optionOutputs?: Record<string, OptionOutput>;
```

- [ ] **Step 4: Update `isEnumAbnormal` and append helpers in `src/lib/parameterValidation.ts`**

Replace the existing `isEnumAbnormal` (lines 5-16) with:

```ts
export function isEnumAbnormal(
  field: ParameterValueField,
  value: unknown,
): boolean {
  if (field.type !== "enum") return false;
  if (value === null || value === undefined) return false;
  const str = String(value);
  if (str === "") return false;
  if (field.optionOutputs) {
    return field.optionOutputs[str]?.kind === "abnormal";
  }
  const expected = field.expectedValues ?? [];
  if (expected.length === 0) return false;
  return !expected.includes(str);
}
```

Add these exports (place them right after `isEnumAbnormal`). Import the `OptionOutput` type by extending the existing `import type { … } from "./api"` at the top of the file to include `OptionOutput`:

```ts
// Custom text to display when a `text`-kind option is selected (else null).
export function optionOutputText(
  field: ParameterValueField,
  value: unknown,
): string | null {
  if (field.type !== "enum" || !field.optionOutputs) return null;
  if (value === null || value === undefined) return null;
  const str = String(value);
  if (str === "") return null;
  const entry = field.optionOutputs[str];
  return entry?.kind === "text" ? (entry.text ?? "") : null;
}

// The set of "normal/expected" option labels — from optionOutputs when present, else legacy expectedValues.
export function enumNormalValues(field: ParameterValueField): string[] {
  if (field.optionOutputs) {
    return Object.entries(field.optionOutputs)
      .filter(([, o]) => o?.kind === "normal")
      .map(([k]) => k);
  }
  return field.expectedValues ?? [];
}

// Build a full optionOutputs map from a legacy enum field, preserving its abnormal behavior:
// empty expectedValues meant "no detection" → all neutral (text=label); otherwise expected→normal, rest→abnormal.
export function seedOptionOutputsFromLegacy(
  options: string[] | undefined,
  expectedValues: string[] | undefined,
): Record<string, OptionOutput> {
  const opts = options ?? [];
  const expected = expectedValues ?? [];
  const out: Record<string, OptionOutput> = {};
  if (expected.length === 0) {
    for (const opt of opts) out[opt] = { kind: "text", text: opt };
    return out;
  }
  const set = new Set(expected);
  for (const opt of opts) out[opt] = set.has(opt) ? { kind: "normal" } : { kind: "abnormal" };
  return out;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/parameterValidation.test.ts`
Expected: PASS (all existing + new cases).

- [ ] **Step 6: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors from `api.ts` / `parameterValidation.ts` (repo has ~12 pre-existing latent errors elsewhere — confirm none are in these two files).

- [ ] **Step 7: Commit**

```bash
git add -- src/lib/api.ts src/lib/parameterValidation.ts src/lib/parameterValidation.test.ts
git commit -m "feat(params): optionOutputs type + enum abnormal/display helpers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Backend abnormal helpers — extract + honor optionOutputs

**Files:**
- Create: `server/lib/abnormal.js` (moved `isEnumAbnormal` / `isNumericAbnormal` / `isFieldAbnormal`)
- Modify: `server/routes/qcResults.js:10-49` (remove local defs, require from `../lib/abnormal`)
- Test: `server/lib/abnormal.test.js`

**Interfaces:**
- Consumes: nothing from other tasks (mirror of Task 1 logic in JS).
- Produces: `module.exports = { isEnumAbnormal, isNumericAbnormal, isFieldAbnormal }` from `server/lib/abnormal.js`. `qcResults.js` keeps its existing local `isSubstanceAbnormalJS` / `resolveFieldStandardJS` / `matchSubstanceKeyJS` untouched.

- [ ] **Step 1: Write the failing test**

Create `server/lib/abnormal.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { isEnumAbnormal } = require('./abnormal');

test('optionOutputs: only abnormal kind is flagged', () => {
  const field = {
    type: 'enum',
    optionOutputs: {
      'ใส': { kind: 'normal' },
      'ขุ่น': { kind: 'abnormal' },
      'ตะกอน': { kind: 'text', text: 'เฝ้าระวัง' },
    },
  };
  assert.strictEqual(isEnumAbnormal(field, 'ใส'), false);
  assert.strictEqual(isEnumAbnormal(field, 'ขุ่น'), true);
  assert.strictEqual(isEnumAbnormal(field, 'ตะกอน'), false);
  assert.strictEqual(isEnumAbnormal(field, 'unknown'), false);
});

test('legacy expectedValues still works when optionOutputs absent', () => {
  const field = { type: 'enum', expectedValues: ['ดี'] };
  assert.strictEqual(isEnumAbnormal(field, 'ดี'), false);
  assert.strictEqual(isEnumAbnormal(field, 'แย่'), true);
  assert.strictEqual(isEnumAbnormal(field, ''), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test server/lib/abnormal.test.js`
Expected: FAIL — `Cannot find module './abnormal'`.

- [ ] **Step 3: Create `server/lib/abnormal.js`**

Move the three functions out of `qcResults.js` (lines 11-49) into this module, updating `isEnumAbnormal` to honor `optionOutputs`:

```js
// Backend copy of the frontend src/lib/parameterValidation.ts abnormal logic.
// KEEP IN SYNC with that file if rules change.

function isEnumAbnormal(field, value) {
  if (field.type !== "enum") return false;
  if (value === null || value === undefined) return false;
  const str = String(value);
  if (str === "") return false;
  if (field.optionOutputs) {
    const entry =
      typeof field.optionOutputs.get === "function"
        ? field.optionOutputs.get(str)
        : field.optionOutputs[str];
    return entry != null && entry.kind === "abnormal";
  }
  const expected = field.expectedValues || [];
  if (expected.length === 0) return false;
  return !expected.includes(str);
}

function isNumericAbnormal(field, value) {
  if (field.type !== "number" && field.type !== "float") return false;
  if (!field.standardOperator) return false;
  if (field.standardValue == null) return false;
  if (value === null || value === undefined || value === "") return false;
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return false;
  const v1 = field.standardValue;
  const v2 = field.standardValue2;
  switch (field.standardOperator) {
    case "lt": return num >= v1;
    case "lte": return num > v1;
    case "eq": return num !== v1;
    case "gte": return num < v1;
    case "gt": return num <= v1;
    case "between":
      if (v2 == null) return false;
      return num < v1 || num > v2;
    case "tolerance":
      if (v2 == null || v2 <= 0) return false;
      return Math.abs(num - v1) > Math.abs(v1) * (v2 / 100);
    default:
      return false;
  }
}

function isFieldAbnormal(field, value) {
  return isEnumAbnormal(field, value) || isNumericAbnormal(field, value);
}

module.exports = { isEnumAbnormal, isNumericAbnormal, isFieldAbnormal };
```

> Note: `optionOutputs` arrives as a plain object from `.lean()` queries, but the `.get`-aware branch keeps the helper correct if ever handed a live Mongoose `Map`.

- [ ] **Step 4: Wire `qcResults.js` to the new module**

In `server/routes/qcResults.js`, delete the local `isEnumAbnormal`, `isNumericAbnormal`, and `isFieldAbnormal` definitions (lines 10-49, i.e. from the `// Mirrors src/lib/...` comment through the end of `isFieldAbnormal`). Add near the other requires (after line 8):

```js
const { isEnumAbnormal, isNumericAbnormal, isFieldAbnormal } = require('../lib/abnormal');
```

Leave `getEntryValuesJS`, `fieldValueListJS`, `isSubstanceAbnormalJS`, `resolveFieldStandardJS`, `matchSubstanceKeyJS` and everything else in place — they still reference `isNumericAbnormal`, now imported.

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test server/lib/abnormal.test.js`
Expected: PASS (2 tests).

- [ ] **Step 6: Sanity-check the route still loads**

Run: `node -e "require('./server/routes/qcResults'); console.log('qcResults loads OK')"`
Expected: prints `qcResults loads OK` with no `ReferenceError` (confirms no dangling references to the removed local functions).

- [ ] **Step 7: Commit**

```bash
git add -- server/lib/abnormal.js server/lib/abnormal.test.js server/routes/qcResults.js
git commit -m "feat(qc): backend enum abnormal honors optionOutputs (extracted to lib/abnormal)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Model schema + validation (`Parameter.js`)

**Files:**
- Modify: `server/models/Parameter.js:4-61` (add sub-schema + field) and `:85-131` (enum validation branch)
- Test: `server/models/Parameter.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `ValueFieldSchema.optionOutputs` — a `Map` of `{ kind: 'normal'|'abnormal'|'text', text: String }`, `default: undefined`. Validation drops orphan keys not in `options` and rejects `kind:'text'` with blank `text`.

- [ ] **Step 1: Write the failing test**

Create `server/models/Parameter.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const Parameter = require('./Parameter');

function build(optionOutputs, options = ['ใส', 'ขุ่น']) {
  return new Parameter({
    name: 'ทดสอบ',
    valueFields: [{ label: 'ลักษณะ', type: 'enum', options, optionOutputs }],
  });
}

test('accepts a valid optionOutputs map', async () => {
  const doc = build({ 'ใส': { kind: 'normal' }, 'ขุ่น': { kind: 'abnormal' } });
  await doc.validate(); // must not throw
  assert.strictEqual(doc.valueFields[0].optionOutputs.get('ขุ่น').kind, 'abnormal');
});

test('drops orphan keys not present in options', async () => {
  const doc = build({ 'ใส': { kind: 'normal' }, 'ghost': { kind: 'abnormal' } });
  await doc.validate();
  assert.strictEqual(doc.valueFields[0].optionOutputs.has('ghost'), false);
  assert.strictEqual(doc.valueFields[0].optionOutputs.has('ใส'), true);
});

test('rejects text kind with blank text', async () => {
  const doc = build({ 'ใส': { kind: 'text', text: '  ' }, 'ขุ่น': { kind: 'normal' } });
  await assert.rejects(() => doc.validate(), /ข้อความ/);
});

test('rejects an invalid kind', async () => {
  const doc = build({ 'ใส': { kind: 'bogus' } });
  await assert.rejects(() => doc.validate());
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test server/models/Parameter.test.js`
Expected: FAIL — orphan `ghost` is still present (no cleanup yet) and blank-text is accepted (no rule yet). (The `optionOutputs` path may also be stripped entirely if the schema field doesn't exist — that also fails the first assertion.)

- [ ] **Step 3: Add the sub-schema + field**

In `server/models/Parameter.js`, add this schema definition just above `const ValueFieldSchema = …` (line 4):

```js
const OptionOutputSchema = new mongoose.Schema({
  kind: { type: String, enum: ['normal', 'abnormal', 'text'], required: true },
  text: { type: String, default: '' },
}, { _id: false });
```

Then add this field inside `ValueFieldSchema`, right after the `optionFilters` block (after line 60, before the closing `}, { _id: false });`):

```js
  // Per-option result classification for enum fields.
  // Absent = legacy (expectedValues). Present = { option: {kind, text?} }.
  optionOutputs: { type: Map, of: OptionOutputSchema, default: undefined },
```

- [ ] **Step 4: Add validation in the enum branch**

In the `pre('validate')` hook's per-field loop, add this block right after the existing `expectedValues` validation (after line 131, before the `if (['number','float'].includes(f.type) && f.standardOperator)` block):

```js
    if (f.type === 'enum' && f.optionOutputs) {
      const opts = new Set(f.options || []);
      // Drop orphan keys (option ถูกลบไปแล้ว แต่ output ยังค้าง)
      for (const key of Array.from(f.optionOutputs.keys())) {
        if (!opts.has(key)) f.optionOutputs.delete(key);
      }
      for (const [key, val] of f.optionOutputs.entries()) {
        if (val && val.kind === 'text' && (!val.text || !String(val.text).trim())) {
          return next(new Error(`ช่อง "${f.label}" ตัวเลือก "${key}": ต้องระบุข้อความเมื่อเลือก output แบบ "ข้อความ"`));
        }
      }
    }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test server/models/Parameter.test.js`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add -- server/models/Parameter.js server/models/Parameter.test.js
git commit -m "feat(params): optionOutputs schema + enum validation (orphan cleanup, text non-empty)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: ParameterSettings UI — 3-way output control

**Files:**
- Modify: `src/pages/ParameterSettings.tsx` — imports, `addOption` (990-997), `removeOption` (999-1009), `toggleExpected` → `setOptionOutput`/`setOptionText` (1019-1025), type-switch reset (1229-1254), enum summary (711-718), per-option row (1509-1563), per-field helper text (1570-1592)

**Interfaces:**
- Consumes: `seedOptionOutputsFromLegacy` from `@/lib/parameterValidation`; `OptionOutput`, `OptionOutputKind` from `@/lib/api`.
- Produces: enum fields whose `optionOutputs` map is written by the UI (source of truth for the new model).

- [ ] **Step 1: Add imports**

Add to the existing `@/lib/api` type import the names `OptionOutput` and `OptionOutputKind`. Add a new import (place with the other `@/lib/...` imports near the top of the file):

```ts
import { seedOptionOutputsFromLegacy } from "@/lib/parameterValidation";
```

- [ ] **Step 2: Add output handlers + update add/remove (inside the field-editor component, near `toggleExpected` at 1019)**

Replace `toggleExpected` (lines 1019-1025) with:

```ts
  const seedOutputs = (): Record<string, OptionOutput> =>
    field.optionOutputs ?? seedOptionOutputsFromLegacy(field.options ?? [], field.expectedValues ?? []);

  const setOptionOutput = (opt: string, kind: OptionOutputKind) => {
    const base = seedOutputs();
    const next: OptionOutput =
      kind === "text" ? { kind, text: base[opt]?.text ?? opt } : { kind };
    onChange({ ...field, optionOutputs: { ...base, [opt]: next } });
  };

  const setOptionText = (opt: string, text: string) => {
    const base = seedOutputs();
    onChange({ ...field, optionOutputs: { ...base, [opt]: { kind: "text", text } } });
  };
```

Update `addOption` (lines 990-997) to seed the map and add the new option as neutral text=label:

```ts
  const addOption = () => {
    const v = optionDraft.trim();
    if (!v || (field.options ?? []).includes(v)) return;
    const base = seedOutputs();
    onChange({
      ...field,
      options: [...(field.options ?? []), v],
      optionOutputs: { ...base, [v]: { kind: "text", text: v } },
    });
    setOptionDraft("");
  };
```

Update `removeOption` (lines 999-1009) to also drop the option from `optionOutputs`:

```ts
  const removeOption = (opt: string) => {
    const nextFilters = { ...(field.optionFilters ?? {}) };
    delete nextFilters[opt];
    const nextOutputs = field.optionOutputs ? { ...field.optionOutputs } : undefined;
    if (nextOutputs) delete nextOutputs[opt];
    onChange({
      ...field,
      options: (field.options ?? []).filter((o) => o !== opt),
      requireNoteOn: (field.requireNoteOn ?? []).filter((o) => o !== opt),
      expectedValues: (field.expectedValues ?? []).filter((o) => o !== opt),
      optionFilters: Object.keys(nextFilters).length > 0 ? nextFilters : undefined,
      optionOutputs: nextOutputs && Object.keys(nextOutputs).length > 0 ? nextOutputs : undefined,
    });
  };
```

- [ ] **Step 3: Clear optionOutputs on type switch**

In the `<Select … onValueChange>` of the type picker, add one line to the `onChange({...})` object, right after `expectedValues: …` (line 1236):

```ts
                    optionOutputs: v === "enum" ? field.optionOutputs : undefined,
```

- [ ] **Step 4: Replace the per-option row (the `(field.options ?? []).map((opt) => { … })` block, lines 1509-1563)**

Replace the whole map callback body with a 3-way control + conditional text input. New JSX:

```tsx
                  {(field.options ?? []).map((opt) => {
                    const needsNote = (field.requireNoteOn ?? []).includes(opt);
                    const outputs =
                      field.optionOutputs ??
                      seedOptionOutputsFromLegacy(field.options ?? [], field.expectedValues ?? []);
                    const kind: OptionOutputKind = outputs[opt]?.kind ?? "text";
                    const customText = outputs[opt]?.text ?? opt;
                    const KINDS: readonly [OptionOutputKind, string, string][] = [
                      ["normal", "ปกติ", "text-emerald-700"],
                      ["abnormal", "ไม่ปกติ", "text-red-600"],
                      ["text", "ข้อความ", "text-sky-700"],
                    ];
                    return (
                      <div
                        key={opt}
                        className="rounded border bg-background px-2 py-1 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="font-medium truncate">{opt}</span>
                            <OptionFilterBadge filter={field.optionFilters?.[opt]} groupNameById={groupNameById} />
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-0.5">
                              {KINDS.map(([k, lbl, color]) => (
                                <button
                                  key={k}
                                  type="button"
                                  onClick={() => setOptionOutput(opt, k)}
                                  className={cn(
                                    "rounded px-1.5 py-0.5 border text-[11px]",
                                    kind === k
                                      ? `${color} border-current bg-muted font-medium`
                                      : "text-muted-foreground border-transparent hover:bg-muted",
                                  )}
                                >
                                  {lbl}
                                </button>
                              ))}
                            </div>
                            <label className="flex cursor-pointer items-center gap-1 text-muted-foreground">
                              <Checkbox
                                checked={needsNote}
                                onCheckedChange={() => toggleRequireNote(opt)}
                                className="h-3.5 w-3.5"
                              />
                              ต้องการคำอธิบาย
                            </label>
                            <OptionFilterDialog
                              opt={opt}
                              filter={field.optionFilters?.[opt]}
                              itemNameOptions={itemNameOptions}
                              commonNameOptions={commonNameOptions}
                              productTypeOptions={productTypeOptions}
                              categoryOptions={categoryOptions}
                              subCategoryByParent={subCategoryByParent}
                              groupOptions={groupOptions}
                              groupIdByName={groupIdByName}
                              groupNameById={groupNameById}
                              onSetFilter={(next) => setOptionFilter(opt, next)}
                              onClear={() => clearOptionFilter(opt)}
                            />
                            <button
                              type="button"
                              onClick={() => removeOption(opt)}
                              className="rounded p-0.5 text-destructive hover:bg-destructive/10"
                              title="ลบตัวเลือก"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        {kind === "text" && (
                          <Input
                            value={customText}
                            onChange={(e) => setOptionText(opt, e.target.value)}
                            placeholder="ข้อความที่จะแสดงเมื่อเลือกตัวเลือกนี้"
                            className="h-8 text-xs"
                          />
                        )}
                      </div>
                    );
                  })}
```

- [ ] **Step 5: Update the enum summary line (`case "enum":`, lines 711-718)**

Replace with:

```ts
    case "enum": {
      const opts = field.options ?? [];
      if (opts.length === 0) return "ยังไม่มีตัวเลือก";
      const head = opts.slice(0, 3).join("/");
      const more = opts.length > 3 ? `+${opts.length - 3}` : "";
      const outputs = field.optionOutputs;
      if (outputs) {
        const vals = Object.values(outputs);
        const n = vals.filter((o) => o.kind === "normal").length;
        const a = vals.filter((o) => o.kind === "abnormal").length;
        const t = vals.filter((o) => o.kind === "text").length;
        return `${head}${more} · ปกติ ${n}/ไม่ปกติ ${a}/ข้อความ ${t}`;
      }
      const expected = field.expectedValues ?? [];
      const exp = expected.length > 0 ? ` · ปกติ: ${expected.join(",")}` : "";
      return `${head}${more}${exp}`;
    }
```

- [ ] **Step 6: Update the per-field helper text (the IIFE at lines 1570-1592)**

Replace that whole `{(field.options ?? []).length > 0 ? (() => { … })() : null}` block with:

```tsx
              {(field.options ?? []).length > 0 ? (() => {
                const outputs =
                  field.optionOutputs ??
                  seedOptionOutputsFromLegacy(field.options ?? [], field.expectedValues ?? []);
                const abn = Object.entries(outputs)
                  .filter(([, o]) => o.kind === "abnormal")
                  .map(([k]) => k);
                if (abn.length === 0) {
                  return (
                    <p className="mt-1 text-xs text-muted-foreground">
                      ยังไม่มีตัวเลือกที่ตั้งเป็น "ไม่ปกติ" — จะไม่มี abnormal
                    </p>
                  );
                }
                return (
                  <p className="mt-1 text-xs text-red-600">
                    ไม่ปกติ: {abn.join(", ")} — ตัวเลือกเหล่านี้จะถูกมาร์คผิดปกติ
                  </p>
                );
              })() : null}
```

- [ ] **Step 7: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors in `ParameterSettings.tsx`. (Confirm `cn`, `Input`, `Checkbox`, `X`, `OptionFilterBadge`, `OptionFilterDialog` are already imported in this file — they are used by the existing code you are replacing.)

- [ ] **Step 8: Manual verification (dev server)**

Ensure backend is running (`cd server && npm run dev`) and frontend (`npm run dev`), then in **ตั้งค่า Parameter**:
1. Create/edit an enum field, add options. Confirm each row shows **ปกติ / ไม่ปกติ / ข้อความ** and that choosing **ข้อความ** reveals a text box prefilled with the option label.
2. Set one option to ไม่ปกติ, save, reopen — the selection persists.
3. Open an existing (legacy) enum param that used ปกติ checkboxes: confirm the rows render with the equivalent 3-way state (previously-ปกติ → ปกติ, others → ไม่ปกติ; or all → ข้อความ if it had no expected values), and saving keeps behavior.

- [ ] **Step 9: Commit**

```bash
git add -- src/pages/ParameterSettings.tsx
git commit -m "feat(params): 3-way enum output UI (ปกติ/ไม่ปกติ/ข้อความ) in ParameterSettings

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: QC + Lab detail — render custom text, fix abnormal message

**Files:**
- Modify: `src/pages/QCTestingDetailPage.tsx:13` (import), `:114` (compute customText), `:129` (message), after `:216` (render text line)
- Modify: `src/pages/LabTestingDetailPage.tsx:26` (import), `:155` (compute customText), `:171` (message), after `:264` (render text line)

**Interfaces:**
- Consumes: `optionOutputText`, `enumNormalValues` from `@/lib/parameterValidation`.
- Produces: no new interface.

- [ ] **Step 1: QC — extend the parameterValidation import (line 13)**

Change:

```ts
import { isFieldAbnormal, expandFieldForItem, resolveFieldStandard, resolveStandard, getEntryValues } from '@/lib/parameterValidation';
```

to add `optionOutputText, enumNormalValues`:

```ts
import { isFieldAbnormal, expandFieldForItem, resolveFieldStandard, resolveStandard, getEntryValues, optionOutputText, enumNormalValues } from '@/lib/parameterValidation';
```

- [ ] **Step 2: QC — compute customText + fix the abnormal message**

In `TestField`, after `const isAbnormal = isFieldAbnormal(field, value);` (line 114) add:

```ts
  const customText = optionOutputText(field, value);
```

Change the enum branch of the warning `title` (line 129) from `field.expectedValues ?? []` to the helper:

```ts
                ? `ค่าผิดปกติ — คาดหวัง: ${enumNormalValues(field).join(', ')}`
```

- [ ] **Step 3: QC — render the neutral custom-text line**

Immediately after the closing `)}` of the `{/* Input by type */}` block (i.e. right after line 216, before the `{/* Live resolved-criterion line … */}` comment at line 218) insert:

```tsx
      {customText && (
        <p className="text-[11px] text-grey-600">ℹ️ {customText}</p>
      )}
```

- [ ] **Step 4: Lab — extend the parameterValidation import (line 26)**

Add `optionOutputText, enumNormalValues` to the existing `@/lib/parameterValidation` import (mirror of Step 1).

- [ ] **Step 5: Lab — compute customText + fix the abnormal message**

After `const isAbnormal = isFieldAbnormal(field, value);` (line 155) add:

```ts
  const customText = optionOutputText(field, value);
```

Change the enum branch of the `title` (line 171) to:

```ts
                ? `ค่าผิดปกติ — คาดหวัง: ${enumNormalValues(field).join(', ')}`
```

- [ ] **Step 6: Lab — render the neutral custom-text line**

Immediately after the closing `)}` of the type-branch block (right after line 264, before the `{/* Provenance badge… */}` comment at line 266) insert:

```tsx
      {customText && (
        <p className="text-[11px] text-grey-600">ℹ️ {customText}</p>
      )}
```

- [ ] **Step 7: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors in `QCTestingDetailPage.tsx` / `LabTestingDetailPage.tsx`.

- [ ] **Step 8: Manual verification**

With both dev servers running and a petition that uses an enum param configured with all three output kinds:
1. Select a **ไม่ปกติ** option → red highlight + ⚠ warning appears; the warning tooltip lists the ปกติ options.
2. Select a **ข้อความ** option → **no** red highlight; the configured custom text shows as a grey `ℹ️ …` line.
3. Select a **ปกติ** option → no highlight, no info line.
4. Open the QC list / Lab approval list — the abnormal flag/priority reflects only the ไม่ปกติ selections (served by `/qc-results/abnormal-flags`).

- [ ] **Step 9: Commit**

```bash
git add -- src/pages/QCTestingDetailPage.tsx src/pages/LabTestingDetailPage.tsx
git commit -m "feat(testing): show enum custom-text (neutral) + optionOutputs-aware abnormal message

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Data model `optionOutputs` map → Task 3 (schema) + Task 1 (type). ✔
- Abnormal detection honoring optionOutputs, both copies → Task 1 (frontend) + Task 2 (backend). ✔
- Backward compat / no migration (presence discriminator) → Task 1 `isEnumAbnormal` + `seedOptionOutputsFromLegacy`; legacy fields untouched. ✔
- Legacy graceful upgrade on edit → Task 4 `seedOutputs()` in handlers/add/remove. ✔
- UI 3-way + custom text input + requireNoteOn kept → Task 4. ✔
- Default new option = text(label) → Task 4 `addOption`. ✔
- Display custom text + abnormal message from normal set → Task 5. ✔
- Validation (orphan cleanup, text non-empty) → Task 3. ✔
- Tests → Task 1 (vitest), Task 2 & 3 (node --test). ✔

**Placeholder scan:** No TBD/TODO; every code step has complete code. ✔

**Type consistency:** `OptionOutput`/`OptionOutputKind` defined in Task 1 (api.ts) and consumed with identical names in Tasks 4-5; `seedOptionOutputsFromLegacy`, `optionOutputText`, `enumNormalValues` signatures match between definition (Task 1) and use (Tasks 4-5). Backend `isEnumAbnormal` signature unchanged (Task 2). ✔

**Note on the empty-expectedValues legacy case:** handled explicitly in `seedOptionOutputsFromLegacy` (maps to neutral text, not abnormal) so upgrading a "no-check" legacy field does not start flagging — matches Global Constraint on behavior preservation. This refines the spec's migration note (which described only the non-empty case).
