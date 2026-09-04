# Label Tolerance None Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `ไม่มี` dropdown option for both label-tolerance pass and head-review bands, with correct persistence, validation, display, and verdict calculation.

**Architecture:** Treat `none` as a first-class split-band mode only for `autoMode` and `headMode`. Keep legacy `mode: "percent" | "abs" | "range"` behavior unchanged, and keep `src/lib/parameterValidation.ts` synchronized with `server/lib/abnormal.js`.

**Tech Stack:** React 18, TypeScript, Vite, shadcn/Radix Select, Vitest, Node test runner, Mongoose schema validation.

## Global Constraints

- Preserve existing `percent`, `abs`, and `range` behavior.
- Do not add dependencies.
- Do not restructure large files outside the requested behavior.
- Keep `server/lib/abnormal.js` in sync with `src/lib/parameterValidation.ts`.
- Do not modify generated `assets/` files.
- Worktree already has unrelated dirty files; stage and commit only files touched for this feature.

---

## File Structure

- `src/lib/api.ts` owns frontend API-facing TypeScript types for `LabelToleranceRule`.
- `src/lib/parameterValidation.ts` owns frontend verdict calculation for label tolerance.
- `server/lib/abnormal.js` mirrors the label-tolerance resolver for backend-side abnormal checks.
- `server/models/Parameter.js` owns persisted schema enum and server-side validation.
- `src/lib/standardOperators.ts` owns compact rule descriptions shown in parameter lists.
- `src/components/lis/LabelToleranceDialog.tsx` owns the dropdowns and input visibility.
- Tests live next to the existing focused suites:
  - `src/lib/parameterValidation.test.ts`
  - `server/lib/abnormal.test.js`
  - `server/models/Parameter.test.js`
  - `src/lib/standardOperators.test.ts`

---

### Task 1: Frontend Resolver Supports `none`

**Files:**
- Modify: `src/lib/api.ts`
- Modify: `src/lib/parameterValidation.ts`
- Test: `src/lib/parameterValidation.test.ts`

**Interfaces:**
- Consumes: `LabelToleranceRule.autoMode` and `LabelToleranceRule.headMode`.
- Produces: `LabelToleranceRule` allows `autoMode?: "none" | "percent" | "abs" | "range"` and `headMode?: "none" | "percent" | "abs" | "range"`.
- Produces: `resolveLabelTolerance(std, rawSpec, value)` returns `review` when only `headMode` exists and the value is inside `headRange`; returns `pass` or `fail` when only `autoMode` exists.

- [ ] **Step 1: Write failing frontend resolver tests**

Append these tests inside the existing `describe("resolveLabelTolerance — abs mode", ...)` or directly after the split-mode tests in `src/lib/parameterValidation.test.ts`:

```ts
  it("supports head-only split mode when autoMode is none", () => {
    const std = {
      substance: "A",
      autoMode: "none" as const,
      headMode: "abs" as const,
      autoPct: null,
      headPct: null,
      headAbs: 0.1,
    };

    const r = resolveLabelTolerance(std, "A 1.8%", 1.8);

    expect(r.autoRange).toBeNull();
    expect(r.headRange).toEqual([1.7, 1.9]);
    expect(r.status).toBe("review");
    expect(resolveLabelTolerance(std, "A 1.8%", 1.91).status).toBe("fail");
    expect(isLabelToleranceAbnormal(std, "A 1.8%", 1.8)).toBe(true);
  });

  it("supports auto-only split mode when headMode is none", () => {
    const std = {
      substance: "A",
      autoMode: "abs" as const,
      headMode: "none" as const,
      autoPct: null,
      headPct: null,
      autoAbs: 0.05,
    };

    const r = resolveLabelTolerance(std, "A 1.8%", 1.8);

    expect(r.autoRange).toEqual([1.75, 1.85]);
    expect(r.headRange).toBeNull();
    expect(r.status).toBe("pass");
    expect(resolveLabelTolerance(std, "A 1.8%", 1.86).status).toBe("fail");
  });

  it("returns none for split mode with both bands disabled", () => {
    const std = {
      substance: "A",
      autoMode: "none" as const,
      headMode: "none" as const,
      autoPct: null,
      headPct: null,
    };

    expect(resolveLabelTolerance(std, "A 1.8%", 1.8)).toEqual({
      status: "none",
      center: 1.8,
      autoRange: null,
      headRange: null,
    });
  });
```

- [ ] **Step 2: Run frontend resolver tests and confirm failure**

Run:

```bash
npm run test -- src/lib/parameterValidation.test.ts
```

Expected: FAIL because TypeScript does not allow `"none"` for `autoMode`/`headMode`, or assertions fail because resolver returns `none` for head-only mode.

- [ ] **Step 3: Widen frontend types**

In `src/lib/api.ts`, replace the `autoMode` and `headMode` union inside `LabelToleranceRule` with:

```ts
  autoMode?: "none" | "percent" | "abs" | "range";
  headMode?: "none" | "percent" | "abs" | "range";
```

- [ ] **Step 4: Update frontend normalization type**

In `src/lib/parameterValidation.ts`, update `normalizeLabelToleranceModes` split-mode casts:

```ts
      autoMode: (std.autoMode ?? (std.passLow != null || std.passHigh != null ? "range" : "abs")) as "none" | "percent" | "abs" | "range",
      headMode: (std.headMode ?? (std.failLow != null || std.failHigh != null ? "range" : std.headAbs != null || std.headPct != null ? "abs" : null)) as "none" | "percent" | "abs" | "range" | null,
```

- [ ] **Step 5: Update frontend resolver logic**

In `src/lib/parameterValidation.ts`, replace the `if (!autoRange)` block and verdict block at the end of `resolveLabelTolerance` with:

```ts
  if (!autoRange && !headRange) {
    return { status: "none", center, autoRange: null, headRange: null };
  }
  if (value === null || value === undefined || value === "" || Number.isNaN(num)) {
    return { status: "none", center, autoRange, headRange };
  }
  let status: LabelToleranceStatus;
  if (autoRange && num >= autoRange[0] && num <= autoRange[1]) status = "pass";
  else if (headRange && num >= headRange[0] && num <= headRange[1]) status = "review";
  else status = "fail";
  return { status, center, autoRange, headRange };
```

Do not change the legacy `normalized.mode === "range"` branch.

- [ ] **Step 6: Run frontend resolver tests and confirm pass**

Run:

```bash
npm run test -- src/lib/parameterValidation.test.ts
```

Expected: PASS for `src/lib/parameterValidation.test.ts`.

- [ ] **Step 7: Commit Task 1**

```bash
git add src/lib/api.ts src/lib/parameterValidation.ts src/lib/parameterValidation.test.ts
git commit -m "feat(param): support none label tolerance resolver modes"
```

---

### Task 2: Backend Schema And Mirror Resolver Support `none`

**Files:**
- Modify: `server/models/Parameter.js`
- Modify: `server/lib/abnormal.js`
- Test: `server/models/Parameter.test.js`
- Test: `server/lib/abnormal.test.js`

**Interfaces:**
- Consumes: same persisted `LabelToleranceStandardSchema.autoMode/headMode` values as frontend.
- Produces: Mongoose accepts `none` for `autoMode` and `headMode`.
- Produces: Server resolver returns the same statuses as frontend resolver for head-only, auto-only, and both-disabled rules.

- [ ] **Step 1: Write failing backend schema tests**

Append to `server/models/Parameter.test.js` near the existing label tolerance split-mode tests:

```js
test('accepts labelTolerance autoMode none with a valid head reviewer band', async () => {
  const doc = new Parameter({
    name: 'x',
    valueFields: [{ label: 'v', type: 'number', unit: '%', labelToleranceMode: true,
      labelToleranceStandards: [{ substance: 'A', autoMode: 'none', headMode: 'abs', headAbs: 0.1 }] }],
  });

  await assert.doesNotReject(() => doc.validate());
  const s = doc.valueFields[0].labelToleranceStandards[0];
  assert.strictEqual(s.autoMode, 'none');
  assert.strictEqual(s.headMode, 'abs');
});

test('accepts labelTolerance headMode none with a valid automatic pass band', async () => {
  const doc = new Parameter({
    name: 'x',
    valueFields: [{ label: 'v', type: 'number', unit: '%', labelToleranceMode: true,
      labelToleranceStandards: [{ substance: 'A', autoMode: 'abs', headMode: 'none', autoAbs: 0.05 }] }],
  });

  await assert.doesNotReject(() => doc.validate());
  const s = doc.valueFields[0].labelToleranceStandards[0];
  assert.strictEqual(s.autoMode, 'abs');
  assert.strictEqual(s.headMode, 'none');
});

test('rejects labelTolerance when both split bands are none', async () => {
  const doc = new Parameter({
    name: 'x',
    valueFields: [{ label: 'v', type: 'number', unit: '%', labelToleranceMode: true,
      labelToleranceStandards: [{ substance: 'A', autoMode: 'none', headMode: 'none' }] }],
  });

  await assert.rejects(() => doc.validate(), /อย่างน้อยหนึ่งช่วง|usable threshold|เกณฑ์กรม|ผ่าน/);
});
```

- [ ] **Step 2: Write failing backend resolver tests**

Append to `server/lib/abnormal.test.js` near the split-mode tests:

```js
test('resolveLabelTolerance supports head-only split mode when autoMode is none (BE mirror)', () => {
  const std = { substance: 'A', autoMode: 'none', headMode: 'abs', headAbs: 0.1 };
  const r = resolveLabelTolerance(std, 'A 1.8%', 1.8);

  assert.strictEqual(r.autoRange, null);
  assert.deepStrictEqual(r.headRange, [1.7, 1.9]);
  assert.strictEqual(r.status, 'review');
  assert.strictEqual(resolveLabelTolerance(std, 'A 1.8%', 1.91).status, 'fail');
  assert.strictEqual(isLabelToleranceAbnormal(std, 'A 1.8%', 1.8), true);
});

test('resolveLabelTolerance supports auto-only split mode when headMode is none (BE mirror)', () => {
  const std = { substance: 'A', autoMode: 'abs', headMode: 'none', autoAbs: 0.05 };
  const r = resolveLabelTolerance(std, 'A 1.8%', 1.8);

  assert.deepStrictEqual(r.autoRange, [1.75, 1.85]);
  assert.strictEqual(r.headRange, null);
  assert.strictEqual(r.status, 'pass');
  assert.strictEqual(resolveLabelTolerance(std, 'A 1.8%', 1.86).status, 'fail');
});
```

- [ ] **Step 3: Run backend tests and confirm failure**

Run:

```bash
npm run test -- server/models/Parameter.test.js server/lib/abnormal.test.js
```

Expected: FAIL because Mongoose enum rejects `"none"` or resolver returns `none` for head-only mode.

- [ ] **Step 4: Widen backend schema enum**

In `server/models/Parameter.js`, update `LabelToleranceStandardSchema`:

```js
  autoMode: { type: String, enum: ['none', 'percent', 'abs', 'range'], default: null },
  headMode: { type: String, enum: ['none', 'percent', 'abs', 'range'], default: null },
```

- [ ] **Step 5: Update backend validation**

In `server/models/Parameter.js`, inside the `else` block for `f.labelToleranceMode`, after these lines:

```js
          const headConfigured = normalized.headMode != null;
          let headComparableAbs = null;
          const headIsRange = normalized.headMode === 'range';
          const autoIsRange = normalized.autoMode === 'range';
```

replace with:

```js
          const headConfigured = normalized.headMode != null && normalized.headMode !== 'none';
          let headComparableAbs = null;
          const headIsRange = normalized.headMode === 'range';
          const autoIsRange = normalized.autoMode === 'range';
          if (normalized.autoMode === 'none' && normalized.headMode === 'none') {
            return next(new Error(`ช่อง "${f.label}" สาร "${s.substance}": ต้องตั้งช่วงผ่านอัตโนมัติหรือเกณฑ์กรมอย่างน้อยหนึ่งช่วง`));
          }
```

Also add explicit no-op branches so validation does not accidentally fall through:

```js
          if (normalized.headMode === 'none') {
            // ไม่มีช่วงเกณฑ์กรม
          } else if (normalized.headMode === 'percent') {
```

and:

```js
          if (normalized.autoMode === 'none') {
            // ไม่มีช่วงผ่านอัตโนมัติ
          } else if (normalized.autoMode === 'percent') {
```

Keep all existing validation inside the old percent/abs/range branches.

- [ ] **Step 6: Update backend mirror resolver**

In `server/lib/abnormal.js`, update split-mode normalization to allow `none` conceptually, then replace the final `if (!autoRange)` and verdict block in `resolveLabelTolerance` with:

```js
  if (!autoRange && !headRange) {
    return { status: "none", center, autoRange: null, headRange: null };
  }
  if (value === null || value === undefined || value === "" || Number.isNaN(num)) {
    return { status: "none", center, autoRange, headRange };
  }
  let status;
  if (autoRange && num >= autoRange[0] && num <= autoRange[1]) status = "pass";
  else if (headRange && num >= headRange[0] && num <= headRange[1]) status = "review";
  else status = "fail";
  return { status, center, autoRange, headRange };
```

- [ ] **Step 7: Run backend tests and confirm pass**

Run:

```bash
npm run test -- server/models/Parameter.test.js server/lib/abnormal.test.js
```

Expected: PASS for both files.

- [ ] **Step 8: Commit Task 2**

```bash
git add server/models/Parameter.js server/models/Parameter.test.js server/lib/abnormal.js server/lib/abnormal.test.js
git commit -m "feat(param): persist none label tolerance modes"
```

---

### Task 3: UI Dropdowns And Summaries Show `ไม่มี`

**Files:**
- Modify: `src/components/lis/LabelToleranceDialog.tsx`
- Modify: `src/lib/standardOperators.ts`
- Test: `src/lib/standardOperators.test.ts`

**Interfaces:**
- Consumes: `LabelToleranceRule.autoMode/headMode` can be `"none"`.
- Produces: Dropdowns include `SelectItem value="none"` labeled `ไม่มี`.
- Produces: `describeLabelTolerance(std, unit)` omits disabled bands and returns useful text for head-only or auto-only rules.

- [ ] **Step 1: Write failing standard-operator tests**

Append to `src/lib/standardOperators.test.ts` inside `describe("describeLabelTolerance", ...)`:

```ts
  it("describes split mode with no automatic pass band", () => {
    expect(describeLabelTolerance(
      { substance: "A", autoMode: "none", headMode: "abs", autoPct: null, headPct: null, headAbs: 0.1 }, "g/L",
    )).toBe("หัวหน้า ±0.1 g/L");
  });

  it("describes split mode with no head reviewer band", () => {
    expect(describeLabelTolerance(
      { substance: "A", autoMode: "abs", headMode: "none", autoPct: null, headPct: null, autoAbs: 0.05 }, "g/L",
    )).toBe("ผ่าน ±0.05 g/L");
  });
```

- [ ] **Step 2: Run standard-operator tests and confirm failure**

Run:

```bash
npm run test -- src/lib/standardOperators.test.ts
```

Expected: FAIL because `describeLabelTolerance` treats `none` like the abs fallback and emits empty or incorrect text.

- [ ] **Step 3: Update dialog mode types and defaulting**

In `src/components/lis/LabelToleranceDialog.tsx`, change:

```ts
type BandModeOption = "percent" | "abs" | "range";
```

to:

```ts
type BandModeOption = "none" | "percent" | "abs" | "range";
```

Update `normalizeRuleModes` casts so both `autoMode` and `headMode` use `BandModeOption`, and preserve current defaults:

```ts
      autoMode: (rule.autoMode ?? (rule.passLow != null || rule.passHigh != null ? "range" : "abs")) as BandModeOption,
      headMode: (rule.headMode ?? (rule.failLow != null || rule.failHigh != null ? "range" : rule.headAbs != null || rule.headPct != null ? "abs" : "percent")) as BandModeOption,
```

- [ ] **Step 4: Update dialog invalid-state logic**

In `isRuleInvalid`, replace head/auto validation with mode-aware checks:

```ts
  const headConfigured = normalized.headMode === "none"
    ? false
    : normalized.headMode === "percent"
      ? rule.headPct != null && rule.headPct > 0
      : normalized.headMode === "abs"
        ? rule.headAbs != null && rule.headAbs > 0
        : validRange(rule.failLow, rule.failHigh);

  if (normalized.autoMode === "none" && normalized.headMode === "none") return true;
```

Then update later branches:

```ts
  if (normalized.headMode === "range" && !headConfigured) return true;
```

and make the auto branch start with:

```ts
  if (normalized.autoMode === "none") {
    return !headConfigured;
  } else if (normalized.autoMode === "percent") {
```

Keep existing percent/abs/range validation inside the corresponding branches.

- [ ] **Step 5: Update preview calculation**

In `previewLine`, allow head-only preview by changing the final autoRange guard:

```ts
  if (autoRange == null && headRange == null) return "";
  const auto = autoRange != null ? `ผ่าน ${rangeText(autoRange[0], autoRange[1])}` : "";
  const head = headRange != null ? `เกณฑ์กรม ${rangeText(headRange[0], headRange[1])}` : "";
  return `${selectors || "กฎ"} -> ${[auto, head].filter(Boolean).join(" | ")}`;
```

Apply this same pattern in both split-mode preview paths in the function.

- [ ] **Step 6: Add dropdown option and hide disabled inputs**

In the `ช่วงผ่านอัตโนมัติ` `SelectContent`, add:

```tsx
<SelectItem value="none">ไม่มี</SelectItem>
```

Change the auto input rendering so neither range inputs nor numeric input render for `autoMode === "none"`:

```tsx
{autoMode === "none" ? (
  <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
    ไม่มีช่วงผ่านอัตโนมัติ
  </p>
) : autoMode === "range" ? (
  <div className="grid grid-cols-2 gap-2">
    ...
  </div>
) : (
  <Input ... />
)}
```

In the `เกณฑ์กรม` `SelectContent`, add:

```tsx
<SelectItem value="none">ไม่มี</SelectItem>
```

Change the head input rendering the same way:

```tsx
{headMode === "none" ? (
  <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
    ไม่มีช่วงเกณฑ์กรม
  </p>
) : headMode === "range" ? (
  <div className="grid grid-cols-2 gap-2">
    ...
  </div>
) : (
  <Input ... />
)}
```

- [ ] **Step 7: Clear disabled band values when selecting `none`**

Update `patchAutoMode`:

```ts
function patchAutoMode(
  patchAt: (index: number, patch: Partial<LabelToleranceRule>) => void,
  index: number,
  next: BandModeOption,
) {
  patchAt(index, {
    mode: next === "abs" ? "abs" : "percent",
    autoMode: next,
    ...(next === "none" ? { autoPct: null, autoAbs: null, passLow: null, passHigh: null } : {}),
  });
}
```

Add a sibling helper for head mode:

```ts
function patchHeadMode(
  patchAt: (index: number, patch: Partial<LabelToleranceRule>) => void,
  index: number,
  next: BandModeOption,
) {
  patchAt(index, {
    mode: next === "abs" ? "abs" : "percent",
    headMode: next,
    ...(next === "none" ? { headPct: null, headAbs: null, failLow: null, failHigh: null } : {}),
  });
}
```

Use it in the head `Select`:

```tsx
onValueChange={(value) => patchHeadMode(patchAt, index, value as BandModeOption)}
```

- [ ] **Step 8: Update `describeLabelTolerance`**

In `src/lib/standardOperators.ts`, inside `if (std.autoMode || std.headMode)`, update both split-mode formatting blocks so `none` returns an empty string for that band:

```ts
      const auto = std.autoMode === "none"
        ? ""
        : std.autoMode === "range"
          ? (std.passLow == null || std.passHigh == null ? "" : `ผ่าน ${std.passLow}-${std.passHigh}`)
          : std.autoMode === "percent"
            ? (std.autoPct == null ? "" : `ผ่าน ${std.autoPct}% ของเกณฑ์กรม`)
            : (std.autoAbs == null ? "" : `ผ่าน ±${std.autoAbs}`);
      const head = std.headMode === "none"
        ? ""
        : std.headMode === "range"
          ? (std.failLow == null || std.failHigh == null ? "" : `หัวหน้า ${std.failLow}-${std.failHigh}`)
          : std.headMode === "percent"
            ? (std.headPct == null ? "" : `หัวหน้า ±${std.headPct}%`)
            : (std.headAbs == null ? "" : `หัวหน้า ±${std.headAbs}`);
```

Apply the same `none` checks to the non-range split-mode block immediately below.

- [ ] **Step 9: Run UI-adjacent tests and typecheck**

Run:

```bash
npm run test -- src/lib/standardOperators.test.ts
npx tsc -p tsconfig.app.json --noEmit
```

Expected: both commands pass. If `tsc` reveals a `BandModeOption` exhaustiveness issue in `LabelToleranceDialog.tsx`, update the conditional rendering rather than casting away the error.

- [ ] **Step 10: Commit Task 3**

```bash
git add src/components/lis/LabelToleranceDialog.tsx src/lib/standardOperators.ts src/lib/standardOperators.test.ts
git commit -m "feat(param): add none option to label tolerance dropdowns"
```

---

### Task 4: Final Verification

**Files:**
- No new files.
- Verify all files changed by Tasks 1-3.

**Interfaces:**
- Consumes: all changes from Tasks 1-3.
- Produces: verified implementation ready for user review.

- [ ] **Step 1: Run focused test suite**

Run:

```bash
npm run test -- src/lib/parameterValidation.test.ts src/lib/standardOperators.test.ts server/models/Parameter.test.js server/lib/abnormal.test.js
```

Expected: PASS for all four files.

- [ ] **Step 2: Run app typecheck**

Run:

```bash
npx tsc -p tsconfig.app.json --noEmit
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 3: Inspect working tree**

Run:

```bash
git status --short
```

Expected: only intentional source/test files from this implementation are modified, plus any pre-existing unrelated dirty files. Do not stage unrelated files or generated `assets/`.

- [ ] **Step 4: Final implementation commit if needed**

If any final fix was made after Task 3, commit only those files:

```bash
git add <specific-files-touched>
git commit -m "fix(param): verify label tolerance none mode"
```

If no final fix was made, do not create an empty commit.

---

## Self-Review

- Spec coverage: dropdown option, disabled inputs, API types, schema enum, frontend resolver, backend mirror resolver, validation, and tests are covered by Tasks 1-4.
- Red-flag scan: no unresolved filler wording remains; each code step includes the specific code shape to add or replace.
- Type consistency: the plan uses `none | percent | abs | range` consistently for `autoMode` and `headMode`; legacy top-level `mode` remains unchanged.
