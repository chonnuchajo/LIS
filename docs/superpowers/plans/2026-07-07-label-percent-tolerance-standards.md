# โหมด "ตาม %สาร" (label-% tolerance) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มโหมดเกณฑ์ที่ 4 "ตาม %สาร" ให้ช่องตัวเลขในหน้า Parameter Settings — ผ่าน/ไม่ผ่านอิงจาก %ฉลากที่แกะจากชื่อสารอัตโนมัติ แบบต่อสาร 3 ช่วง (ผ่านเอง / รอหัวหน้าอนุมัติ / ไม่ผ่าน)

**Architecture:** เพิ่ม `labelToleranceMode` + `labelToleranceStandards[]` บน value-field (คู่ขนานกับ `substanceMode`/`conditionalMode` เดิม ไม่แตะของเดิม). ตอนตรวจ ระบบแกะ %ฉลากจากชื่อสาร (`parseLabelPercent`) เป็นศูนย์กลาง แล้วตัดสิน 3 ช่วงด้วย `resolveLabelTolerance`. ช่วง review+fail = abnormal (binary) เข้า flow หัวหน้า QC เดิม ต่างแค่ป้ายที่แสดง. ค่าผลเก็บด้วย key `${label}::${matchSubstanceKey}` เดิม (reuse progress/storage).

**Tech Stack:** React 18 + TS + Vite (FE), Express + Mongoose (BE). Test: Vitest (FE), `node:test` (BE).

**Spec:** `docs/superpowers/specs/2026-07-07-label-percent-tolerance-standards-design.md`

## Global Constraints

- **FE↔BE parity**: ตรรกะ abnormal ต้อง mirror ตรงกันระหว่าง `src/lib/parameterValidation.ts` ↔ `server/lib/abnormal.js` / `server/routes/qcResults.js` (มีคอมเมนต์ `KEEP IN SYNC` เดิม — คงไว้)
- **tolerance = relative %** ของค่าฉลาก: `autoAbs = |center| * autoPct/100` (สาร 1% ±5% → 0.95–1.05)
- **center ไม่เก็บ** — แกะจากชื่อสารทุกครั้ง; **ไม่มี default** — สารที่ไม่เพิ่ม = ไม่ตรวจ
- **3 ช่วง**: `pass` (ปกติ ไม่ flag) / `review` + `fail` (abnormal ทั้งคู่); ต่างแค่ป้ายแสดง (`fail` หัวหน้าอนุมัติได้แต่ต้องเตือน)
- **สารไม่มี % ในชื่อ** (`parseLabelPercent → null`) = ข้ามการตรวจ + เตือน (ไม่ flag)
- **key เก็บค่าผล** = `substanceFieldKey(label, substance)` เดิม (`${label}::${matchSubstanceKey}`)
- **Commit ด้วย explicit pathspec เท่านั้น** (develop มี process อื่น commit แทรก — ห้าม `git add -A`)
- ไม่ต้องรัน `seed:export` (schema/code change ไม่ใช่ data change); tsconfig lenient (`noImplicitAny:false`)

---

### Task 1: Backend schema + FE types + validation

**Files:**
- Modify: `server/models/Parameter.js` (sub-schema + 2 field + guard ใน `pre('validate')`)
- Modify: `src/lib/api.ts:979` (เพิ่ม type หลัง `SubstanceStandard`) + `src/lib/api.ts:1023` (2 field บน `ParameterValueField`)
- Test: `server/models/Parameter.test.js` (append)

**Interfaces:**
- Produces (BE schema field): `labelToleranceMode: Boolean`, `labelToleranceStandards: [{ substance, autoPct, headPct }]`
- Produces (FE type): `LabelToleranceStandard = { substance: string; autoPct: number | null; headPct: number | null }`; `ParameterValueField.labelToleranceMode?: boolean`; `ParameterValueField.labelToleranceStandards?: LabelToleranceStandard[]`

- [ ] **Step 1: Write failing BE tests** — append to `server/models/Parameter.test.js`:

```js
test('persists labelToleranceMode + labelToleranceStandards (not stripped by strict mode)', () => {
  const doc = new Parameter({
    name: 'ทดสอบ %สาร',
    valueFields: [{
      label: '%w/v', type: 'number', unit: '%',
      labelToleranceMode: true,
      labelToleranceStandards: [{ substance: 'ABAMECTIN', autoPct: 2.5, headPct: 5 }],
    }],
  });
  const f = doc.valueFields[0];
  assert.strictEqual(f.labelToleranceMode, true);
  assert.strictEqual(f.labelToleranceStandards.length, 1);
  assert.strictEqual(f.labelToleranceStandards[0].substance, 'ABAMECTIN');
  assert.strictEqual(f.labelToleranceStandards[0].autoPct, 2.5);
  assert.strictEqual(f.labelToleranceStandards[0].headPct, 5);
});

test('rejects labelToleranceMode together with substanceMode (mutually exclusive)', async () => {
  const doc = new Parameter({
    name: 'x',
    valueFields: [{ label: 'v', type: 'number', unit: '%', substanceMode: true, labelToleranceMode: true }],
  });
  await assert.rejects(() => doc.validate());
});

test('rejects labelTolerance autoPct <= 0', async () => {
  const doc = new Parameter({
    name: 'x',
    valueFields: [{ label: 'v', type: 'number', unit: '%', labelToleranceMode: true,
      labelToleranceStandards: [{ substance: 'A', autoPct: 0, headPct: null }] }],
  });
  await assert.rejects(() => doc.validate(), /autoPct|มากกว่า 0/);
});

test('rejects labelTolerance headPct < autoPct', async () => {
  const doc = new Parameter({
    name: 'x',
    valueFields: [{ label: 'v', type: 'number', unit: '%', labelToleranceMode: true,
      labelToleranceStandards: [{ substance: 'A', autoPct: 5, headPct: 3 }] }],
  });
  await assert.rejects(() => doc.validate(), /headPct|หัวหน้า/);
});

test('rejects multiple + labelToleranceMode', async () => {
  const doc = new Parameter({
    name: 'x',
    valueFields: [{ label: 'v', type: 'number', unit: '%', multiple: true, labelToleranceMode: true,
      labelToleranceStandards: [{ substance: 'A', autoPct: 2, headPct: null }] }],
  });
  await assert.rejects(() => doc.validate());
});
```

- [ ] **Step 2: Run — verify FAIL**

Run: `node --test server/models/Parameter.test.js`
Expected: FAIL (field stripped → `labelToleranceMode` undefined; guards not present)

- [ ] **Step 3: Add sub-schema + fields in `server/models/Parameter.js`**

หลัง `SubstanceStandardSchema` (บรรทัด ~17) เพิ่ม:
```js
const LabelToleranceStandardSchema = new mongoose.Schema({
  substance: { type: String, required: true, trim: true },
  autoPct:   { type: Number, default: null },
  headPct:   { type: Number, default: null },
}, { _id: false });
```
ใน `ValueFieldSchema` ต่อจาก `conditionalResult` (บรรทัด ~103) เพิ่ม:
```js
  // Label-% tolerance (number/float). labelToleranceMode=true → center=%ฉลากที่แกะจากชื่อสาร,
  // 3 ช่วง ต่อสาร. single/substance/conditional ถูก ignore. exclusive กับ substance/conditional.
  labelToleranceMode: { type: Boolean, default: false },
  labelToleranceStandards: { type: [LabelToleranceStandardSchema], default: [] },
```

- [ ] **Step 4: Add validation guards in `pre('validate')`**

แทนที่ guard เดิม (บรรทัด ~230):
```js
    if (f.substanceMode && f.conditionalMode) {
      return next(new Error(`ช่อง "${f.label}": ใช้โหมด "แยกตามสาร" และ "เงื่อนไขพิเศษ" พร้อมกันไม่ได้`));
    }
```
ด้วย:
```js
    if ([f.substanceMode, f.conditionalMode, f.labelToleranceMode].filter(Boolean).length > 1) {
      return next(new Error(`ช่อง "${f.label}": เลือกได้โหมดเดียวจาก แยกตามสาร / เงื่อนไขพิเศษ / ตาม %สาร`));
    }
    if (f.labelToleranceMode) {
      for (const s of f.labelToleranceStandards || []) {
        if (s.autoPct == null || s.autoPct <= 0) {
          return next(new Error(`ช่อง "${f.label}" สาร "${s.substance}": ±ออโต้ (autoPct) ต้องมากกว่า 0`));
        }
        if (s.headPct != null && s.headPct < s.autoPct) {
          return next(new Error(`ช่อง "${f.label}" สาร "${s.substance}": ±หัวหน้า (headPct) ต้อง ≥ ±ออโต้`));
        }
      }
    }
```
และในบล็อก `if (f.multiple) {...}` (บรรทัด ~244) เพิ่มหลัง guard `substanceMode`:
```js
      if (f.labelToleranceMode) {
        return next(new Error(`ช่อง "${f.label}": ใช้ "กรอกหลายค่า" ร่วมกับโหมดตาม %สารไม่ได้`));
      }
```

- [ ] **Step 5: Add FE types in `src/lib/api.ts`**

หลัง `SubstanceStandard` (บรรทัด ~984) เพิ่ม:
```ts
export type LabelToleranceStandard = {
  substance: string;        // เก็บแบบ extractSubstanceName เช่น "ABAMECTIN"
  autoPct: number | null;   // ± ชั้นใน (ผ่านเอง) % ของค่าฉลาก, > 0
  headPct: number | null;   // ± ชั้นนอก (หัวหน้าอนุมัติ), ถ้าใส่ต้อง ≥ autoPct; null = ไม่มีช่วง review
};
```
ใน `ParameterValueField` หลัง `conditionalResult?` (บรรทัด ~1029) เพิ่ม:
```ts
  // Label-% tolerance mode (number/float). center = %ฉลากที่แกะจากชื่อสารอัตโนมัติ.
  labelToleranceMode?: boolean;
  labelToleranceStandards?: LabelToleranceStandard[];
```

- [ ] **Step 6: Run — verify PASS**

Run: `node --test server/models/Parameter.test.js`
Expected: PASS (all tests incl new ones)

- [ ] **Step 7: Commit**

```bash
git add server/models/Parameter.js server/models/Parameter.test.js src/lib/api.ts
git commit -m "feat(param): persist labelToleranceMode schema + FE types + guards"
```

---

### Task 2: `parseLabelPercent` helper (FE + BE)

**Files:**
- Modify: `src/lib/substances.ts` (append)
- Modify: `src/lib/substances.test.ts` (append)
- Modify: `server/lib/abnormal.js` (add fn + export)
- Modify: `server/lib/abnormal.test.js` (append)

**Interfaces:**
- Produces: `parseLabelPercent(raw: string): number | null` — จับเลขที่ตามด้วย `%` ตัวแรก; ไม่มี → `null`. มีทั้ง FE (`substances.ts`) และ BE (`abnormal.js`, export ใน `module.exports`)

- [ ] **Step 1: Write failing FE test** — append to `src/lib/substances.test.ts`:

```ts
import { parseLabelPercent } from "./substances";

describe("parseLabelPercent", () => {
  it("extracts the percent before a % sign", () => {
    expect(parseLabelPercent("ABAMECTIN 1.8% W/V EC (BROWN)")).toBe(1.8);
  });
  it("skips leading name numbers not followed by %", () => {
    expect(parseLabelPercent("2,4-D DIMETHYLAMMONIUM 58% SL")).toBe(58);
  });
  it("handles a space before the % sign", () => {
    expect(parseLabelPercent("GLYPHOSATE 48 %W/V SL")).toBe(48);
  });
  it("returns null when there is no percent", () => {
    expect(parseLabelPercent("GLYPHOSATE 480 G/L SL")).toBeNull();
    expect(parseLabelPercent("ABAMECTIN")).toBeNull();
  });
  it("returns null for empty input", () => {
    expect(parseLabelPercent("")).toBeNull();
  });
});
```
> ตรวจว่าไฟล์มี `import { describe, it, expect } from "vitest"` อยู่แล้วหัวไฟล์ (append เฉพาะ `import { parseLabelPercent }` + block); ถ้า `parseLabelPercent` ยังไม่มี ให้รวมเข้ากับ import เดิมจาก `./substances`

- [ ] **Step 2: Run — verify FAIL**

Run: `npx vitest run src/lib/substances.test.ts`
Expected: FAIL (`parseLabelPercent` is not a function)

- [ ] **Step 3: Implement in `src/lib/substances.ts`** (append):

```ts
// แกะเลข %ฉลากจากชื่อสารดิบ (หลัง parseSubstances split "+" แล้ว).
// จับเลขที่ตามด้วย "%" ตัวแรก: "ABAMECTIN 1.8% W/V EC" → 1.8 ; "2,4-D 96% SL" → 96 (ข้าม "2,4").
// ไม่มี "%" → null (สารนั้นข้ามการตรวจโหมด labelTolerance).
export function parseLabelPercent(raw: string): number | null {
  const m = String(raw ?? "").match(/(\d+(?:\.\d+)?)\s*%/);
  return m ? Number(m[1]) : null;
}
```

- [ ] **Step 4: Run — verify FE PASS**

Run: `npx vitest run src/lib/substances.test.ts`
Expected: PASS

- [ ] **Step 5: Write failing BE test** — append to `server/lib/abnormal.test.js`:

```js
const { parseLabelPercent } = require('./abnormal');

test('parseLabelPercent extracts percent before % sign', () => {
  assert.strictEqual(parseLabelPercent('ABAMECTIN 1.8% W/V EC'), 1.8);
  assert.strictEqual(parseLabelPercent('2,4-D 58% SL'), 58);
  assert.strictEqual(parseLabelPercent('GLYPHOSATE 480 G/L SL'), null);
  assert.strictEqual(parseLabelPercent(''), null);
});
```
> ตรวจหัวไฟล์มี `const test = require('node:test'); const assert = require('node:assert');` และ require `./abnormal` แล้ว — ถ้ามี require เดิมให้เพิ่ม `parseLabelPercent` เข้า destructure เดิม

- [ ] **Step 6: Run — verify BE FAIL**

Run: `node --test server/lib/abnormal.test.js`
Expected: FAIL

- [ ] **Step 7: Implement in `server/lib/abnormal.js`** — เพิ่มก่อน `module.exports`:

```js
// mirror of src/lib/substances.ts parseLabelPercent — keep in sync
function parseLabelPercent(raw) {
  const m = String(raw == null ? "" : raw).match(/(\d+(?:\.\d+)?)\s*%/);
  return m ? Number(m[1]) : null;
}
```
และแก้ `module.exports` เป็น:
```js
module.exports = { isEnumAbnormal, isNumericAbnormal, isFieldAbnormal, parseLabelPercent };
```

- [ ] **Step 8: Run — verify BE PASS**

Run: `node --test server/lib/abnormal.test.js`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/lib/substances.ts src/lib/substances.test.ts server/lib/abnormal.js server/lib/abnormal.test.js
git commit -m "feat(param): parseLabelPercent helper (FE + BE mirror)"
```

---

### Task 3: FE resolver `resolveLabelTolerance` + describe helpers

**Files:**
- Modify: `src/lib/parameterValidation.ts` (types + `findLabelToleranceStandard` + `resolveLabelTolerance` + `isLabelToleranceAbnormal`)
- Modify: `src/lib/standardOperators.ts` (`describeLabelTolerance` + `formatLabelToleranceRange`)
- Modify: `src/lib/parameterValidation.test.ts` (append)
- Modify: `src/lib/standardOperators.test.ts` (append)

**Interfaces:**
- Consumes: `parseLabelPercent` (Task 2), `matchSubstanceKey` (substances.ts), `LabelToleranceStandard` (api.ts)
- Produces:
  - `type LabelToleranceStatus = "pass" | "review" | "fail" | "none"`
  - `type LabelToleranceResolved = { status: LabelToleranceStatus; center: number | null; autoRange: [number, number] | null; headRange: [number, number] | null }`
  - `findLabelToleranceStandard(field: ParameterValueField, substanceName: string): LabelToleranceStandard | undefined`
  - `resolveLabelTolerance(std: LabelToleranceStandard | undefined, rawSpec: string, value: unknown): LabelToleranceResolved`
  - `isLabelToleranceAbnormal(std, rawSpec, value): boolean` (= status review|fail)
  - `describeLabelTolerance(std, unit): string`, `formatLabelToleranceRange(resolved, unit): string`

- [ ] **Step 1: Write failing tests** — append to `src/lib/parameterValidation.test.ts`:

```ts
import {
  resolveLabelTolerance,
  isLabelToleranceAbnormal,
  findLabelToleranceStandard,
} from "./parameterValidation";

describe("resolveLabelTolerance", () => {
  const std = { substance: "ABAMECTIN", autoPct: 2.5, headPct: 5 };
  it("pass when within auto band (center from label %)", () => {
    const r = resolveLabelTolerance(std, "ABAMECTIN 1% W/V EC", 1.0);
    expect(r.center).toBe(1);
    expect(r.autoRange).toEqual([0.975, 1.025]);
    expect(r.headRange).toEqual([0.95, 1.05]);
    expect(r.status).toBe("pass");
  });
  it("review when between auto and head band", () => {
    expect(resolveLabelTolerance(std, "ABAMECTIN 1%", 1.04).status).toBe("review");
  });
  it("fail when beyond head band", () => {
    expect(resolveLabelTolerance(std, "ABAMECTIN 1%", 1.2).status).toBe("fail");
  });
  it("none (skip) when name has no percent — center null", () => {
    const r = resolveLabelTolerance(std, "ABAMECTIN 480 G/L", 1.0);
    expect(r.center).toBeNull();
    expect(r.status).toBe("none");
  });
  it("none but keeps ranges when value is empty (not yet filled)", () => {
    const r = resolveLabelTolerance(std, "ABAMECTIN 1%", "");
    expect(r.status).toBe("none");
    expect(r.center).toBe(1);
    expect(r.autoRange).toEqual([0.975, 1.025]);
  });
  it("no head band → outside auto is fail directly", () => {
    const noHead = { substance: "A", autoPct: 2.5, headPct: null };
    expect(resolveLabelTolerance(noHead, "A 1%", 1.04).status).toBe("fail");
    expect(resolveLabelTolerance(noHead, "A 1%", 1.0).status).toBe("pass");
  });
  it("isLabelToleranceAbnormal true for review and fail, false for pass/none", () => {
    expect(isLabelToleranceAbnormal(std, "A 1%", 1.04)).toBe(true);
    expect(isLabelToleranceAbnormal(std, "A 1%", 1.2)).toBe(true);
    expect(isLabelToleranceAbnormal(std, "A 1%", 1.0)).toBe(false);
    expect(isLabelToleranceAbnormal(std, "A no-percent", 1.0)).toBe(false);
  });
});

describe("findLabelToleranceStandard", () => {
  const field: any = { label: "v", type: "number", labelToleranceMode: true,
    labelToleranceStandards: [{ substance: "ABAMECTIN", autoPct: 2.5, headPct: 5 }] };
  it("matches by substance key regardless of trailing spec", () => {
    expect(findLabelToleranceStandard(field, "ABAMECTIN 1.8% W/V EC")?.autoPct).toBe(2.5);
  });
  it("returns undefined for unlisted substance", () => {
    expect(findLabelToleranceStandard(field, "GLYPHOSATE")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run — verify FAIL**

Run: `npx vitest run src/lib/parameterValidation.test.ts`
Expected: FAIL (functions not exported)

- [ ] **Step 3: Implement in `src/lib/parameterValidation.ts`**

เพิ่ม import type บนหัวไฟล์ (แก้บรรทัด import จาก `./api`): เพิ่ม `LabelToleranceStandard` เข้า import type list เดิม จาก `"./api"`.

เพิ่มท้ายไฟล์:
```ts
export type LabelToleranceStatus = "pass" | "review" | "fail" | "none";
export type LabelToleranceResolved = {
  status: LabelToleranceStatus;              // "none" = ข้ามการตรวจ (center null / ค่าว่าง)
  center: number | null;                     // %ฉลากที่แกะได้ (null = ไม่มี % ในชื่อ → ข้าม)
  autoRange: [number, number] | null;        // ช่วงผ่านเอง
  headRange: [number, number] | null;        // ช่วงหัวหน้าอนุมัติ (null = ไม่มี headPct)
};

export function findLabelToleranceStandard(
  field: ParameterValueField,
  substanceName: string,
): LabelToleranceStandard | undefined {
  const key = matchSubstanceKey(substanceName);
  if (!key) return undefined;
  return (field.labelToleranceStandards ?? []).find(
    (s) => matchSubstanceKey(s.substance) === key,
  );
}

// ศูนย์กลาง = %ฉลากจาก rawSpec; tolerance = relative % ของ center; 3 ช่วง.
export function resolveLabelTolerance(
  std: LabelToleranceStandard | undefined,
  rawSpec: string,
  value: unknown,
): LabelToleranceResolved {
  const center = parseLabelPercent(rawSpec);
  if (!std || std.autoPct == null || std.autoPct <= 0 || center == null) {
    return { status: "none", center, autoRange: null, headRange: null };
  }
  const autoAbs = Math.abs(center) * (std.autoPct / 100);
  const headAbs = std.headPct != null ? Math.abs(center) * (std.headPct / 100) : autoAbs;
  const round = (n: number) => Number(n.toFixed(6));
  const autoRange: [number, number] = [round(center - autoAbs), round(center + autoAbs)];
  const headRange: [number, number] | null =
    std.headPct != null ? [round(center - headAbs), round(center + headAbs)] : null;
  const num = typeof value === "number" ? value : Number(value);
  if (value === null || value === undefined || value === "" || Number.isNaN(num)) {
    return { status: "none", center, autoRange, headRange };
  }
  const dev = Math.abs(num - center);
  let status: LabelToleranceStatus;
  if (dev <= autoAbs) status = "pass";
  else if (dev <= headAbs) status = "review";
  else status = "fail";
  return { status, center, autoRange, headRange };
}

export function isLabelToleranceAbnormal(
  std: LabelToleranceStandard | undefined,
  rawSpec: string,
  value: unknown,
): boolean {
  const s = resolveLabelTolerance(std, rawSpec, value).status;
  return s === "review" || s === "fail";
}
```
เพิ่ม `import { parseLabelPercent } from "./substances"` — แก้บรรทัด import เดิมจาก `./substances` (บรรทัด 3) ให้รวม `parseLabelPercent`:
```ts
import { parseSubstances, extractSubstanceName, matchSubstanceKey, substanceFieldKey, parseLabelPercent } from "./substances";
```

- [ ] **Step 4: Run — verify parameterValidation PASS**

Run: `npx vitest run src/lib/parameterValidation.test.ts`
Expected: PASS

- [ ] **Step 5: Write failing describe test** — append to `src/lib/standardOperators.test.ts`:

```ts
import { describeLabelTolerance, formatLabelToleranceRange } from "./standardOperators";

describe("describeLabelTolerance", () => {
  it("summarizes auto + head percent", () => {
    expect(describeLabelTolerance({ substance: "A", autoPct: 2.5, headPct: 5 }, "%"))
      .toContain("±2.5%");
    expect(describeLabelTolerance({ substance: "A", autoPct: 2.5, headPct: 5 }, "%"))
      .toContain("หัวหน้า ±5%");
  });
  it("omits head when null", () => {
    expect(describeLabelTolerance({ substance: "A", autoPct: 2.5, headPct: null }, ""))
      .not.toContain("หัวหน้า");
  });
});

describe("formatLabelToleranceRange", () => {
  it("formats pass and head ranges", () => {
    const out = formatLabelToleranceRange(
      { status: "pass", center: 1, autoRange: [0.975, 1.025], headRange: [0.95, 1.05] }, "%");
    expect(out).toContain("0.975");
    expect(out).toContain("1.05");
  });
  it("returns empty when center null", () => {
    expect(formatLabelToleranceRange({ status: "none", center: null, autoRange: null, headRange: null }, "%")).toBe("");
  });
});
```

- [ ] **Step 6: Run — verify FAIL**

Run: `npx vitest run src/lib/standardOperators.test.ts`
Expected: FAIL

- [ ] **Step 7: Implement in `src/lib/standardOperators.ts`**

แก้บรรทัด import บนสุดให้รวม type ใหม่:
```ts
import type { StandardOperator, SubstanceStandard, StandardRule, StandardConditionOp, ParameterValueField, LabelToleranceStandard } from "./api";
import type { ResolvedStandard, LabelToleranceResolved } from "./parameterValidation";
```
เพิ่มท้ายไฟล์:
```ts
// สรุปเกณฑ์ labelTolerance ของสารตอน config เช่น "ฉลาก ±2.5% (หัวหน้า ±5%)"
export function describeLabelTolerance(std: LabelToleranceStandard, unit: string): string {
  if (std.autoPct == null) return "";
  const u = unit ? ` ${unit}` : "";
  const head = std.headPct != null ? ` (หัวหน้า ±${std.headPct}%)` : "";
  return `ฉลาก ±${std.autoPct}%${head}${u}`;
}

// ช่วงจริงหลังแกะ %ฉลาก เช่น "ผ่าน 0.975–1.025 · หัวหน้าถึง 0.95–1.05 %"
export function formatLabelToleranceRange(r: LabelToleranceResolved, unit: string): string {
  if (r.center == null || !r.autoRange) return "";
  const u = unit ? ` ${unit}` : "";
  const fmt = (n: number) => Number(n.toFixed(4)).toString();
  const auto = `ผ่าน ${fmt(r.autoRange[0])}–${fmt(r.autoRange[1])}`;
  const head = r.headRange ? ` · หัวหน้าถึง ${fmt(r.headRange[0])}–${fmt(r.headRange[1])}` : "";
  return `${auto}${head}${u}`;
}
```

- [ ] **Step 8: Run — verify PASS + type-check**

Run: `npx vitest run src/lib/standardOperators.test.ts src/lib/parameterValidation.test.ts`
Expected: PASS
Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่ (repo มี ~12 latent errors เดิม — เทียบว่าไม่เพิ่ม)

- [ ] **Step 9: Commit**

```bash
git add src/lib/parameterValidation.ts src/lib/parameterValidation.test.ts src/lib/standardOperators.ts src/lib/standardOperators.test.ts
git commit -m "feat(param): resolveLabelTolerance 3-zone resolver + describe helpers"
```

---

### Task 4: `expandFieldForItem` branch + `RenderFieldUnit.labelTolerance`

**Files:**
- Modify: `src/lib/parameterValidation.ts` (`RenderFieldUnit` type + `expandFieldForItem`)
- Modify: `src/lib/parameterValidation.test.ts` (append)

**Interfaces:**
- Consumes: `findLabelToleranceStandard` (Task 3), `parseSubstances`/`extractSubstanceName`/`substanceFieldKey` (substances.ts)
- Produces: `RenderFieldUnit.labelTolerance?: { std: LabelToleranceStandard | undefined; rawSpec: string }` — set เฉพาะ unit ที่มาจาก labelToleranceMode; consumers (Task 7/8) อ่านไปแสดง/ตัดสิน

- [ ] **Step 1: Write failing test** — append to `expandFieldForItem` describe block ใน `src/lib/parameterValidation.test.ts`:

```ts
describe("expandFieldForItem — labelTolerance", () => {
  const ltField: ParameterValueField = {
    label: "%w/v", type: "number", unit: "%", labelToleranceMode: true,
    labelToleranceStandards: [{ substance: "ABAMECTIN", autoPct: 2.5, headPct: 5 }],
  };
  it("expands per substance with rawSpec (keeps % for center)", () => {
    const units = expandFieldForItem(ltField, "ABAMECTIN 1.8% W/V EC");
    expect(units).toHaveLength(1);
    expect(units[0].key).toBe("%w/v::abamectin");
    expect(units[0].labelTolerance?.rawSpec).toBe("ABAMECTIN 1.8% W/V EC");
    expect(units[0].labelTolerance?.std?.autoPct).toBe(2.5);
    expect(units[0].field.labelToleranceMode).toBe(false);
  });
  it("substance without a configured std → unit with undefined std", () => {
    const units = expandFieldForItem(ltField, "GLYPHOSATE 48% SL");
    expect(units[0].labelTolerance?.std).toBeUndefined();
  });
  it("falls back to single plain unit when commonName empty", () => {
    const units = expandFieldForItem(ltField, "");
    expect(units).toHaveLength(1);
    expect(units[0].key).toBe("%w/v");
    expect(units[0].labelTolerance).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run — verify FAIL**

Run: `npx vitest run src/lib/parameterValidation.test.ts -t labelTolerance`
Expected: FAIL

- [ ] **Step 3: Extend `RenderFieldUnit` type** ใน `src/lib/parameterValidation.ts` (บรรทัด ~155):

```ts
export type RenderFieldUnit = {
  key: string;
  field: ParameterValueField;
  substanceName?: string;
  labelTolerance?: { std: LabelToleranceStandard | undefined; rawSpec: string };
};
```

- [ ] **Step 4: Add branch in `expandFieldForItem`** — แทรกหลังบรรทัด `const isNumeric = ...` ก่อน `if (!field.substanceMode || !isNumeric)` (บรรทัด ~169):

```ts
  if (isNumeric && field.labelToleranceMode) {
    const substances = parseSubstances(commonName ?? "");
    if (substances.length === 0 || (substances.length === 1 && !substances[0])) {
      return [{ key: field.label, field }];
    }
    return substances.map((raw) => {
      const name = extractSubstanceName(raw) || raw;
      const std = findLabelToleranceStandard(field, name);
      const vfield: ParameterValueField = {
        ...field,
        label: `${field.label} — ${name}`,
        labelToleranceMode: false,
      };
      return {
        key: substanceFieldKey(field.label, name),
        field: vfield,
        substanceName: name,
        labelTolerance: { std, rawSpec: raw },
      };
    });
  }
```

- [ ] **Step 5: Run — verify PASS**

Run: `npx vitest run src/lib/parameterValidation.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/parameterValidation.ts src/lib/parameterValidation.test.ts
git commit -m "feat(param): expandFieldForItem branch for labelTolerance units"
```

---

### Task 5: `countAbnormalInResults` branch (FE)

**Files:**
- Modify: `src/lib/parameterValidation.ts` (`countAbnormalInResults`)
- Modify: `src/lib/parameterValidation.test.ts` (append)

**Interfaces:**
- Consumes: `isLabelToleranceAbnormal`, `findLabelToleranceStandard` (Task 3), `parseSubstances`/`extractSubstanceName`/`matchSubstanceKey`; ใช้ `r.commonName` (มีใน `QCTestResult`, `src/types/petition.types.ts:63`)

- [ ] **Step 1: Write failing test** — append to `src/lib/parameterValidation.test.ts`:

```ts
describe("countAbnormalInResults — labelTolerance", () => {
  const param: any = {
    _id: "p1", multiEntry: false,
    valueFields: [{
      label: "%w/v", type: "number", unit: "%", labelToleranceMode: true,
      labelToleranceStandards: [{ substance: "ABAMECTIN", autoPct: 2.5, headPct: 5 }],
    }],
  };
  const mk = (val: number) => ([{
    petitionId: "pt1", itemSeq: 0, parameterId: "p1",
    commonName: "ABAMECTIN 1% W/V EC",
    values: { "%w/v::abamectin": val },
  }] as any);
  it("counts review + fail, not pass", () => {
    expect(countAbnormalInResults(mk(1.0), [param])).toBe(0);   // pass
    expect(countAbnormalInResults(mk(1.04), [param])).toBe(1);  // review
    expect(countAbnormalInResults(mk(1.2), [param])).toBe(1);   // fail
  });
  it("skips substance without percent in name", () => {
    const noPct = [{ petitionId: "pt1", itemSeq: 0, parameterId: "p1",
      commonName: "ABAMECTIN 480 G/L", values: { "%w/v::abamectin": 999 } }] as any;
    expect(countAbnormalInResults(noPct, [param])).toBe(0);
  });
});
```
> ตรวจว่า `countAbnormalInResults` ถูก import ในไฟล์เทสต์อยู่แล้ว (ใช้ที่อื่นแล้ว) — ถ้ายังไม่มี ให้เพิ่มเข้า import

- [ ] **Step 2: Run — verify FAIL**

Run: `npx vitest run src/lib/parameterValidation.test.ts -t "countAbnormalInResults — labelTolerance"`
Expected: FAIL (currently falls through, count 0 ทุกเคส)

- [ ] **Step 3: Add branch in `countAbnormalInResults`** — ใน loop `for (const field of param.valueFields)` แทรกหลัง branch `if (field.substanceMode && isNumeric) {...continue}` (บรรทัด ~235):

```ts
        if (field.labelToleranceMode && isNumeric) {
          const prefix = `${field.label}::`;
          const substances = parseSubstances(r.commonName ?? "");
          for (const [vkey, vval] of Object.entries(values)) {
            if (!vkey.startsWith(prefix)) continue;
            const subKey = vkey.slice(prefix.length);
            const raw = substances.find(
              (s) => matchSubstanceKey(extractSubstanceName(s) || s) === subKey,
            ) ?? "";
            const std = findLabelToleranceStandard(field, subKey);
            if (isLabelToleranceAbnormal(std, raw, vval)) count += 1;
          }
          continue;
        }
```
> `r` อยู่ใน scope ของ `for (const r of results)` แล้ว; `r.commonName` เป็น optional — cast ผ่าน `?? ""` พอ (tsconfig lenient)

- [ ] **Step 4: Run — verify PASS**

Run: `npx vitest run src/lib/parameterValidation.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/parameterValidation.ts src/lib/parameterValidation.test.ts
git commit -m "feat(param): count labelTolerance review/fail as abnormal (FE)"
```

---

### Task 6: Server abnormal-flags branch + BE resolver mirror

**Files:**
- Modify: `server/lib/abnormal.js` (`resolveLabelTolerance` + `isLabelToleranceAbnormal`)
- Modify: `server/lib/abnormal.test.js` (append)
- Modify: `server/routes/qcResults.js` (branch ใน `/abnormal-flags` + เพิ่ม `commonName` ใน projection; helper `resolveLabelToleranceForResult`)

**Interfaces:**
- Consumes: `parseLabelPercent` (Task 2, BE), `matchSubstanceKeyJS` (มีใน qcResults.js)
- Produces (abnormal.js): `resolveLabelTolerance(std, rawSpec, value) → { status, center, autoRange, headRange }` (mirror FE), `isLabelToleranceAbnormal(std, rawSpec, value) → boolean`

- [ ] **Step 1: Write failing BE test** — append to `server/lib/abnormal.test.js`:

```js
const { resolveLabelTolerance, isLabelToleranceAbnormal } = require('./abnormal');

test('resolveLabelTolerance 3-zone (BE mirror)', () => {
  const std = { substance: 'ABAMECTIN', autoPct: 2.5, headPct: 5 };
  assert.strictEqual(resolveLabelTolerance(std, 'ABAMECTIN 1%', 1.0).status, 'pass');
  assert.strictEqual(resolveLabelTolerance(std, 'ABAMECTIN 1%', 1.04).status, 'review');
  assert.strictEqual(resolveLabelTolerance(std, 'ABAMECTIN 1%', 1.2).status, 'fail');
  assert.strictEqual(resolveLabelTolerance(std, 'ABAMECTIN 480 G/L', 1.0).status, 'none');
  assert.strictEqual(isLabelToleranceAbnormal(std, 'ABAMECTIN 1%', 1.04), true);
  assert.strictEqual(isLabelToleranceAbnormal(std, 'ABAMECTIN 1%', 1.0), false);
});
```

- [ ] **Step 2: Run — verify FAIL**

Run: `node --test server/lib/abnormal.test.js`
Expected: FAIL

- [ ] **Step 3: Implement BE resolver in `server/lib/abnormal.js`** — เพิ่มก่อน `module.exports`:

```js
// mirror of src/lib/parameterValidation.ts resolveLabelTolerance — keep in sync
function resolveLabelTolerance(std, rawSpec, value) {
  const center = parseLabelPercent(rawSpec);
  if (!std || std.autoPct == null || std.autoPct <= 0 || center == null) {
    return { status: "none", center, autoRange: null, headRange: null };
  }
  const autoAbs = Math.abs(center) * (std.autoPct / 100);
  const headAbs = std.headPct != null ? Math.abs(center) * (std.headPct / 100) : autoAbs;
  const round = (n) => Number(n.toFixed(6));
  const autoRange = [round(center - autoAbs), round(center + autoAbs)];
  const headRange = std.headPct != null ? [round(center - headAbs), round(center + headAbs)] : null;
  const num = typeof value === "number" ? value : Number(value);
  if (value === null || value === undefined || value === "" || Number.isNaN(num)) {
    return { status: "none", center, autoRange, headRange };
  }
  const dev = Math.abs(num - center);
  let status;
  if (dev <= autoAbs) status = "pass";
  else if (dev <= headAbs) status = "review";
  else status = "fail";
  return { status, center, autoRange, headRange };
}

function isLabelToleranceAbnormal(std, rawSpec, value) {
  const s = resolveLabelTolerance(std, rawSpec, value).status;
  return s === "review" || s === "fail";
}
```
แก้ `module.exports`:
```js
module.exports = { isEnumAbnormal, isNumericAbnormal, isFieldAbnormal, parseLabelPercent, resolveLabelTolerance, isLabelToleranceAbnormal };
```

- [ ] **Step 4: Run — verify BE PASS**

Run: `node --test server/lib/abnormal.test.js`
Expected: PASS

- [ ] **Step 5: Wire into `server/routes/qcResults.js`**

(a) แก้ import (บรรทัด ~9) ให้รวม fn ใหม่:
```js
const { isEnumAbnormal, isNumericAbnormal, isFieldAbnormal, isLabelToleranceAbnormal } = require('../lib/abnormal');
```
(b) เพิ่ม helper หา std (ใกล้ `visibleSubstanceStandardJS`, บรรทัด ~43):
```js
function findLabelToleranceStandardJS(field, subKey) {
  return (field.labelToleranceStandards || []).find(
    (s) => matchSubstanceKeyJS(s.substance) === subKey,
  );
}
// รวม rawSpec (มี %) จาก commonName โดย split "+" แล้ว match ด้วย first-token key
function rawSpecForSubKey(commonName, subKey) {
  const parts = String(commonName || "").split("+").map((s) => s.trim()).filter(Boolean);
  return parts.find((p) => matchSubstanceKeyJS(p) === subKey) || "";
}
```
(c) ใน route `GET /abnormal-flags` เพิ่ม `commonName: 1` ใน projection ของ `QCTestResult.find` (บรรทัด ~211):
```js
      { petitionId: 1, parameterId: 1, itemSeq: 1, commonName: 1, values: 1, entries: 1 }
```
(d) ใน loop fields (บรรทัด ~241) แทรก branch หลัง `if (field.substanceMode && isNumeric) {...continue}`:
```js
          if (field.labelToleranceMode && isNumeric) {
            const prefix = `${field.label}::`;
            for (const [vkey, vval] of Object.entries(values)) {
              if (!vkey.startsWith(prefix)) continue;
              const subKey = vkey.slice(prefix.length);
              const std = findLabelToleranceStandardJS(field, subKey);
              const raw = rawSpecForSubKey(d.commonName, subKey);
              if (isLabelToleranceAbnormal(std, raw, vval)) { flagged = true; break; }
            }
            if (flagged) break;
            continue;
          }
```
> `d` (result doc) อยู่ใน scope ของ `for (const d of docs)`; `d.commonName` มาจาก projection ที่เพิ่งเพิ่ม

- [ ] **Step 6: Smoke-check server ไม่ crash**

Run: `node -e "require('./server/routes/qcResults.js'); console.log('qcResults loads OK')"`
Expected: พิมพ์ `qcResults loads OK` (ไม่มี syntax error)

- [ ] **Step 7: Commit**

```bash
git add server/lib/abnormal.js server/lib/abnormal.test.js server/routes/qcResults.js
git commit -m "feat(param): server abnormal-flags detects labelTolerance (BE mirror + commonName)"
```

---

### Task 7: ParameterSettings UI — radio ที่ 4 + config block + `LabelToleranceDialog`

**Files:**
- Create: `src/components/lis/LabelToleranceDialog.tsx`
- Modify: `src/pages/ParameterSettings.tsx` (mode union/setMode/radio/render-block/type-reset + `StandardPreview` + `summarizeField`)
- Verify: browser (ตาม repo norm สำหรับ dialog UI — ไม่มี unit test)

**Interfaces:**
- Consumes: `LabelToleranceStandard` (api.ts), `describeLabelTolerance` (Task 3), substance picker pattern จาก `SubstanceStandardsDialog.tsx`
- Produces: `<LabelToleranceDialog open field onClose onSave={(next: LabelToleranceStandard[]) => void} />`

- [ ] **Step 1: Create `src/components/lis/LabelToleranceDialog.tsx`**

คัดลอกโครงจาก `SubstanceStandardsDialog.tsx` (picker 3 แท็บ commonName/กลุ่ม/trade name เหมือนกัน) แต่ฝั่งขวากรอก `autoPct`/`headPct`:

```tsx
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2, Search } from "lucide-react";
import { api, type ParameterValueField, type LabelToleranceStandard } from "@/lib/api";
import { parseSubstances, extractSubstanceName, matchSubstanceKey } from "@/lib/substances";
import { tradeNameKeys } from "@/lib/masterItemFields";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const COMMON_NAME_KEYS = ["common_name", "commonname", "commonName", "item_name2", "itemType"];
function pickField(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row?.[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}
function buildSubstances(commonNames: string[]): string[] {
  const byKey = new Map<string, string>();
  for (const cn of commonNames) {
    for (const raw of parseSubstances(cn)) {
      const name = extractSubstanceName(raw) || raw;
      const key = matchSubstanceKey(name);
      if (key && !byKey.has(key)) byKey.set(key, name);
    }
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, ["th", "en"]));
}
function buildCommonNameOptions(commonNames: string[]): string[] {
  return [...new Set(commonNames.map((v) => String(v).trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, ["th", "en"]));
}
function previewLine(std: LabelToleranceStandard): string {
  if (std.autoPct == null) return "";
  const c = 1; // ตัวอย่างฉลาก 1%
  const a = c * (std.autoPct / 100);
  const h = std.headPct != null ? c * (std.headPct / 100) : a;
  const auto = `ผ่าน ${(c - a).toFixed(3)}–${(c + a).toFixed(3)}`;
  const head = std.headPct != null ? ` · หัวหน้าถึง ${(c - h).toFixed(3)}–${(c + h).toFixed(3)}` : "";
  return `ตัวอย่างฉลาก 1% → ${auto}${head}`;
}

type Props = {
  open: boolean;
  field: ParameterValueField;
  onClose: () => void;
  onSave: (next: LabelToleranceStandard[]) => void;
};

export function LabelToleranceDialog({ open, field, onClose, onSave }: Props) {
  const unit = field.unit ? ` ${field.unit}` : "";
  const [list, setList] = useState<LabelToleranceStandard[]>(field.labelToleranceStandards ?? []);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) { setList(field.labelToleranceStandards ?? []); setSearch(""); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const { data: masterRows = [] } = useQuery<Record<string, unknown>[]>({
    queryKey: ["master-items"],
    queryFn: async () => {
      const res = await api.get<Record<string, unknown>[]>("/master-items");
      return Array.isArray(res.data.data) ? res.data.data : [];
    },
    enabled: open,
  });
  const { data: groups = [] } = useQuery<{ _id: string; name: string; commonNames?: string[] }[]>({
    queryKey: ["item-groups"],
    queryFn: async () => {
      const res = await api.get<{ _id: string; name: string; commonNames?: string[] }[]>("/item-groups");
      return Array.isArray(res.data.data) ? res.data.data : [];
    },
    enabled: open,
  });
  const safeRows = Array.isArray(masterRows) ? masterRows : [];
  const safeGroups = Array.isArray(groups) ? groups : [];

  const commonNameOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    const commonNames = safeRows
      .map((row) => pickField(row, COMMON_NAME_KEYS))
      .filter((cn) => !q || cn.toLowerCase().includes(q));
    return buildCommonNameOptions(commonNames);
  }, [safeRows, search]);

  const tradeNameOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byTrade = new Map<string, Set<string>>();
    for (const row of safeRows) {
      const tradeName = pickField(row, tradeNameKeys);
      if (!tradeName) continue;
      const cn = pickField(row, COMMON_NAME_KEYS);
      if (!byTrade.has(tradeName)) byTrade.set(tradeName, new Set());
      if (cn) byTrade.get(tradeName)!.add(cn);
    }
    return [...byTrade.entries()]
      .filter(([t]) => !q || t.toLowerCase().includes(q))
      .map(([tradeName, cns]) => ({ tradeName, substances: buildSubstances([...cns]) }))
      .sort((a, b) => a.tradeName.localeCompare(b.tradeName, ["th", "en"]));
  }, [safeRows, search]);

  const selectedKeys = useMemo(() => new Set(list.map((s) => matchSubstanceKey(s.substance))), [list]);
  const addSubstance = (name: string) => {
    const key = matchSubstanceKey(name);
    if (!key || selectedKeys.has(key)) return;
    setList((prev) => [...prev, { substance: name, autoPct: null, headPct: null }]);
  };
  const removeAt = (i: number) => setList((prev) => prev.filter((_, idx) => idx !== i));
  const patchAt = (i: number, patch: Partial<LabelToleranceStandard>) =>
    setList((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const filterBox = (
    <div className="relative mb-2">
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหา..." className="h-9 pl-8" />
    </div>
  );
  const commonNameList = (names: string[]) => (
    <div className="max-h-[30rem] overflow-y-auto rounded border divide-y">
      {names.length === 0 ? (
        <p className="p-3 text-xs text-muted-foreground">ไม่พบ common name</p>
      ) : names.map((cn) => {
        const subs = buildSubstances([cn]);
        const allAdded = subs.length > 0 && subs.every((n) => selectedKeys.has(matchSubstanceKey(n)));
        return (
          <button key={cn} type="button" disabled={subs.length === 0 || allAdded}
            onClick={() => subs.forEach(addSubstance)}
            className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-40" title={cn}>
            <div className="min-w-0">
              <div className="break-words font-medium text-foreground">{cn}</div>
              {subs.length > 0 && <div className="mt-1 break-words text-xs text-muted-foreground">สาร: {subs.join(", ")}</div>}
            </div>
            {!allAdded && subs.length > 0 && <Plus className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
          </button>
        );
      })}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>ตั้งเกณฑ์ตาม %สาร — {field.label}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            ศูนย์กลางแกะจาก %ในชื่อสารอัตโนมัติ · สารที่ชื่อไม่มี % จะข้ามการตรวจ
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 overflow-hidden md:grid-cols-[1.2fr_1fr]">
          <div>
            <Label className="text-sm mb-1.5 block">เลือกสาร</Label>
            <Tabs defaultValue="common">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="common">commonName</TabsTrigger>
                <TabsTrigger value="group">กลุ่ม</TabsTrigger>
                <TabsTrigger value="trade">trade name</TabsTrigger>
              </TabsList>
              <TabsContent value="common">{filterBox}{commonNameList(commonNameOptions)}</TabsContent>
              <TabsContent value="group">
                <div className="max-h-[30rem] overflow-y-auto rounded border divide-y">
                  {safeGroups.map((g) => {
                    const subs = buildSubstances(g.commonNames ?? []);
                    const allAdded = subs.length > 0 && subs.every((n) => selectedKeys.has(matchSubstanceKey(n)));
                    return (
                      <button key={g._id} type="button" disabled={subs.length === 0 || allAdded}
                        onClick={() => subs.forEach(addSubstance)}
                        className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-40">
                        <span className="truncate">{g.name}</span>
                        {!allAdded && subs.length > 0 && <Plus className="h-4 w-4 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </TabsContent>
              <TabsContent value="trade">
                {filterBox}
                <div className="max-h-[30rem] overflow-y-auto rounded border divide-y">
                  {tradeNameOptions.length === 0 ? (
                    <p className="p-3 text-xs text-muted-foreground">ไม่พบ trade name</p>
                  ) : tradeNameOptions.map(({ tradeName, substances }) => {
                    const allAdded = substances.length > 0 && substances.every((n) => selectedKeys.has(matchSubstanceKey(n)));
                    return (
                      <button key={tradeName} type="button" disabled={substances.length === 0 || allAdded}
                        onClick={() => substances.forEach(addSubstance)}
                        className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-40" title={tradeName}>
                        <div className="min-w-0">
                          <div className="break-words font-medium text-foreground">{tradeName}</div>
                          {substances.length > 0 && <div className="mt-1 break-words text-xs text-muted-foreground">สาร: {substances.join(", ")}</div>}
                        </div>
                        {!allAdded && substances.length > 0 && <Plus className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div>
            <Label className="text-sm mb-1.5 block">เกณฑ์ต่อสาร ({list.length})</Label>
            <div className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
              {list.length === 0 ? (
                <p className="text-xs text-muted-foreground">ยังไม่ได้เลือกสาร</p>
              ) : list.map((std, i) => (
                <div key={matchSubstanceKey(std.substance)} className="rounded border p-2 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{std.substance}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeAt(i)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-muted-foreground">±ออโต้</span>
                    <Input type="number" value={std.autoPct ?? ""} placeholder="เช่น 2.5"
                      onChange={(e) => patchAt(i, { autoPct: e.target.value === "" || !Number.isFinite(Number(e.target.value)) ? null : Number(e.target.value) })}
                      className="h-8 w-20" />
                    <span className="text-muted-foreground">% · ±หัวหน้า</span>
                    <Input type="number" value={std.headPct ?? ""} placeholder="เช่น 5"
                      onChange={(e) => patchAt(i, { headPct: e.target.value === "" || !Number.isFinite(Number(e.target.value)) ? null : Number(e.target.value) })}
                      className="h-8 w-20" />
                    <span className="text-muted-foreground">%{unit}</span>
                  </div>
                  <p className="text-xs text-emerald-700">{previewLine(std)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button type="button" variant="primary" onClick={() => { onSave(list); onClose(); }}>บันทึก</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Wire mode into `src/pages/ParameterSettings.tsx`**

(a) import (ใกล้ import `SubstanceStandardsDialog`):
```tsx
import { LabelToleranceDialog } from "@/components/lis/LabelToleranceDialog";
import { describeLabelTolerance } from "@/lib/standardOperators";
```
(b) state ปุ่ม dialog (ใกล้ `setSubstanceDialogOpen`):
```tsx
const [labelToleranceDialogOpen, setLabelToleranceDialogOpen] = useState(false);
```
(c) type-reset ตอนเปลี่ยน type (บรรทัด ~1267) — เพิ่มบรรทัด:
```tsx
                    labelToleranceMode: v === "number" || v === "float" ? field.labelToleranceMode : false,
```
(d) `mode` union + compute (บรรทัด ~1302):
```tsx
                const mode: "single" | "substance" | "conditional" | "labelTolerance" =
                  field.labelToleranceMode ? "labelTolerance"
                  : field.conditionalMode ? "conditional"
                  : field.substanceMode ? "substance" : "single";
```
(e) `setMode` (บรรทัด ~1304) — แทนทั้งก้อนด้วย:
```tsx
                const setMode = (m: "single" | "substance" | "conditional" | "labelTolerance") =>
                  onChange({
                    ...field,
                    substanceMode: m === "substance",
                    conditionalMode: m === "conditional",
                    labelToleranceMode: m === "labelTolerance",
                    substanceStandards: m === "substance" ? field.substanceStandards ?? [] : field.substanceStandards,
                    conditionalStandards: m === "conditional" ? field.conditionalStandards ?? [] : field.conditionalStandards,
                    labelToleranceStandards: m === "labelTolerance" ? field.labelToleranceStandards ?? [] : field.labelToleranceStandards,
                    standardOperator: m === "single" ? field.standardOperator : undefined,
                    standardValue: m === "single" ? field.standardValue : null,
                    standardValue2: m === "single" ? field.standardValue2 : null,
                    conditionalResult: m === "conditional" ? (field.conditionalResult ?? "standard") : "standard",
                  });
```
(f) radio list (บรรทัด ~1319) — เพิ่มตัวที่ 4:
```tsx
                    {([["single", "ค่าเดียว"], ["substance", "แยกตามสาร"], ["conditional", "เงื่อนไขพิเศษ"], ["labelTolerance", "ตาม %สาร"]] as const).map(([m, lbl]) => (
```

- [ ] **Step 3: Add the labelTolerance render block** ใน `src/pages/ParameterSettings.tsx`

แก้ chain เงื่อนไข render (บรรทัด ~1329) จาก `{field.conditionalMode ? (...)` ให้มี labelTolerance นำหน้า:
```tsx
              {field.labelToleranceMode ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                    <div className="sm:col-span-3 space-y-1.5">
                      <Label className="text-sm">หน่วย *</Label>
                      <Input
                        value={field.unit ?? ""}
                        onChange={(e) => onChange({ ...field, unit: e.target.value })}
                        placeholder="เช่น %"
                        className="h-10"
                      />
                    </div>
                    <div className="sm:col-span-9 flex items-end">
                      <Button type="button" variant="outline" className="h-10" onClick={() => setLabelToleranceDialogOpen(true)}>
                        ตั้งเกณฑ์ตาม %สาร ({(field.labelToleranceStandards ?? []).length} สาร)
                      </Button>
                    </div>
                  </div>
                  <StandardPreview field={field} />
                  <LabelToleranceDialog
                    open={labelToleranceDialogOpen}
                    field={field}
                    onClose={() => setLabelToleranceDialogOpen(false)}
                    onSave={(next) => onChange({ ...field, labelToleranceStandards: next })}
                  />
                </div>
              ) : field.conditionalMode ? (
```
> วงเล็บ/โครงเดิมของ `field.conditionalMode ? (...) : field.substanceMode ? (...) : (...)` คงไว้ทั้งหมด — แค่เติม `field.labelToleranceMode ? (...) :` ไว้หน้าสุด

- [ ] **Step 4: Extend `StandardPreview` + `summarizeField`**

ใน `StandardPreview` (บรรทัด ~466) เพิ่มก่อน `if (field.substanceMode)`:
```tsx
  if (field.labelToleranceMode) {
    const stds = field.labelToleranceStandards ?? [];
    if (stds.length === 0) return <p className="text-xs text-muted-foreground">ยังไม่ได้ตั้งเกณฑ์ตาม %สาร</p>;
    return (
      <p className="text-xs text-emerald-700">
        {stds.map((s) => `${s.substance} ${describeLabelTolerance(s, field.unit ?? "")}`.trim()).join(" · ")}
      </p>
    );
  }
```
ใน `summarizeField` (บรรทัด ~698) เพิ่มก่อน `if (field.conditionalMode)`:
```tsx
      if (field.labelToleranceMode) {
        const n = (field.labelToleranceStandards ?? []).length;
        return n > 0 ? `ตาม %สาร ${n} สาร` : "ตาม %สาร (ยังไม่ตั้ง)";
      }
```

- [ ] **Step 5: Type-check + lint**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่
Run: `npm run lint`
Expected: 0 error (warnings เดิมโอเค)

- [ ] **Step 6: Browser verify** (ต้องมี frontend `npm run dev` + backend `cd server && npm run dev`)

ตรวจ:
1. เข้า `/LIS/parameter-settings` → แก้ parameter → ช่อง number → เห็น radio "ตาม %สาร" ตัวที่ 4
2. เลือก "ตาม %สาร" → กด "ตั้งเกณฑ์ตาม %สาร" → เลือกสาร ABAMECTIN → กรอก ±ออโต้ 2.5 / ±หัวหน้า 5 → preview โชว์ "ตัวอย่างฉลาก 1% → ผ่าน 0.975–1.025 · หัวหน้าถึง 0.95–1.05" → บันทึก
3. บันทึก parameter → refresh หน้า → เปิดใหม่ → ค่ายังอยู่ (persist ผ่าน Task 1 schema)

- [ ] **Step 7: Commit**

```bash
git add src/components/lis/LabelToleranceDialog.tsx src/pages/ParameterSettings.tsx
git commit -m "feat(param): ParameterSettings mode 4 'ตาม %สาร' + LabelToleranceDialog"
```

---

### Task 8: แสดงตอนตรวจ + หัวหน้า QC (render branches)

**Files:**
- Modify: `src/pages/LabTestingDetailPage.tsx`
- Modify: `src/pages/QCTestingDetailPage.tsx`
- Modify: `src/components/petition/PetitionView.tsx`
- Modify: `src/lib/qcApprovalRows.ts`
- Verify: browser

**Interfaces:**
- Consumes: `unit.labelTolerance` (Task 4), `resolveLabelTolerance`/`formatLabelToleranceRange` (Task 3)

**หมายเหตุร่วมทุกหน้า:** unit ที่มี `unit.labelTolerance` ให้ render input เดิม (numeric, key เดิม) แต่แทนที่การแสดง "เกณฑ์/abnormal" ปกติ ด้วยการเรียก `resolveLabelTolerance(unit.labelTolerance.std, unit.labelTolerance.rawSpec, currentValue)` แล้ว:
- แสดงเกณฑ์: `formatLabelToleranceRange(resolved, field.unit)`
- chip สถานะตาม `resolved.status`: `pass`→เขียว "ผ่าน", `review`→เหลือง "รอหัวหน้าอนุมัติ", `fail`→แดง "ไม่ผ่าน (เกินช่วงอนุมัติ)", `none`+`center==null`→เทา "ข้ามการตรวจ — ไม่มี %ฉลาก"

- [ ] **Step 1: Helper สี/ป้าย (วางใน `src/lib/standardOperators.ts` เพื่อ reuse ทุกหน้า)**

เพิ่ม:
```ts
export function labelToleranceBadge(status: "pass" | "review" | "fail" | "none", center: number | null):
  { text: string; cls: string } | null {
  if (status === "pass") return { text: "ผ่าน", cls: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  if (status === "review") return { text: "รอหัวหน้าอนุมัติ", cls: "text-amber-700 bg-amber-50 border-amber-200" };
  if (status === "fail") return { text: "ไม่ผ่าน (เกินช่วงอนุมัติ)", cls: "text-red-700 bg-red-50 border-red-200" };
  if (status === "none" && center == null) return { text: "ข้ามการตรวจ — ไม่มี %ฉลาก", cls: "text-muted-foreground bg-muted border" };
  return null; // none + ยังไม่กรอก = ไม่มี chip
}
```

- [ ] **Step 2: `LabTestingDetailPage.tsx` + `QCTestingDetailPage.tsx`** — ในลูป `expandFieldForItem(...).forEach((unit) => {...})` ที่ render input/เกณฑ์ (เช่น บรรทัด ~1206/~1407 ใน Lab, ~867 ใน QC): ตรงจุดที่แสดงเกณฑ์/สถานะของ unit เพิ่มสาขา — ถ้า `unit.labelTolerance` มีค่า ให้เรียก resolver แล้ว render ช่วง + chip แทน `describeStandard`/`isFieldAbnormal` เดิม (ซึ่งไม่มีผลกับ unit นี้เพราะ virtual field ไม่มี `standardOperator`).

โค้ดสาขา (วางตรงที่ compute abnormal/standard ของ unit):
```tsx
{unit.labelTolerance && (() => {
  const rv = resolveLabelTolerance(unit.labelTolerance.std, unit.labelTolerance.rawSpec, currentValue);
  const badge = labelToleranceBadge(rv.status, rv.center);
  return (
    <div className="mt-1 space-y-0.5">
      <p className="text-xs text-muted-foreground">{formatLabelToleranceRange(rv, unit.field.unit ?? "")}</p>
      {badge && <span className={`inline-block rounded border px-1.5 py-0.5 text-[11px] ${badge.cls}`}>{badge.text}</span>}
    </div>
  );
})()}
```
> `currentValue` = ค่าที่ผู้ใช้กรอกของ unit นี้ (ค่าที่ผูกกับ input key `unit.key` — ใช้ตัวแปรเดียวกับที่ input อ่าน/เขียนอยู่แล้วในหน้านั้น). import: `resolveLabelTolerance`, `formatLabelToleranceRange`, `labelToleranceBadge`.
> import เพิ่มบนหัวไฟล์แต่ละหน้า: `resolveLabelTolerance` จาก `@/lib/parameterValidation`; `formatLabelToleranceRange, labelToleranceBadge` จาก `@/lib/standardOperators`.

- [ ] **Step 3: `PetitionView.tsx`** — read-only: ในลูป `expandFieldForItem(...)` (บรรทัด ~90) เพิ่มสาขาเดียวกัน (แสดงช่วง + chip ตามค่าที่บันทึกไว้) โดยใช้ค่าที่อ่านจาก values ของ unit.key

- [ ] **Step 4: `qcApprovalRows.ts`** — หัวหน้า QC: ในลูป `expandFieldForItem(...).forEach((unit) => {...})` (บรรทัด ~113) สำหรับ unit ที่มี `labelTolerance` ให้ตั้ง flag/ป้ายของแถวจาก `resolveLabelTolerance(...).status`:
  - `review` → mark abnormal + ป้าย "รอหัวหน้าอนุมัติ"
  - `fail` → mark abnormal + ป้ายเตือน "เกินช่วงที่อนุมัติได้" (ยังกดอนุมัติได้ ไม่บล็อก)
  - `pass`/`none` → ปกติ

โครงสร้าง row ของไฟล์นี้เป็นอย่างไรให้ทำตามแบบเดียวกับที่ substanceMode ตั้งค่า abnormal/label อยู่แล้ว (อ่าน pattern เดิมในไฟล์ก่อนแก้). ใช้ `isLabelToleranceAbnormal` สำหรับ flag และ `resolveLabelTolerance(...).status` สำหรับเลือกป้าย

- [ ] **Step 5: Type-check + lint**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่
Run: `npm run lint`
Expected: 0 error

- [ ] **Step 6: Browser E2E verify** (frontend + backend รันอยู่)

1. สร้าง/ใช้ parameter ที่ตั้งโหมด "ตาม %สาร" (ABAMECTIN ±2.5/±5) กับ product ที่ commonName มี "ABAMECTIN 1.8%..."
2. หน้า QC/Lab testing → ช่องสารแตกเป็น "%w/v — ABAMECTIN" → เห็นช่วงเกณฑ์ (1.755–1.845 · หัวหน้าถึง 1.71–1.89)
3. กรอก 1.8 → chip เขียว "ผ่าน"; กรอก 1.87 → เหลือง "รอหัวหน้าอนุมัติ"; กรอก 2.5 → แดง "ไม่ผ่าน"
4. product ที่ชื่อไม่มี % (เช่น "…480 G/L") → chip เทา "ข้ามการตรวจ — ไม่มี %ฉลาก"
5. หน้าอนุมัติหัวหน้า QC → แถวโชว์ป้าย review vs fail; ช่อง fail มีคำเตือนแต่ยังกดอนุมัติได้

- [ ] **Step 7: Commit**

```bash
git add src/pages/LabTestingDetailPage.tsx src/pages/QCTestingDetailPage.tsx src/components/petition/PetitionView.tsx src/lib/qcApprovalRows.ts src/lib/standardOperators.ts
git commit -m "feat(param): render labelTolerance bands + status chips (testing + QC approval)"
```

---

## Self-Review

**Spec coverage:**
- โหมดที่ 4 + data model → Task 1 ✓
- parseLabelPercent → Task 2 ✓
- resolver 3 ช่วง + describe → Task 3 ✓
- expandFieldForItem → Task 4 ✓
- นับ abnormal FE → Task 5 ✓; server abnormal-flags + commonName projection → Task 6 ✓
- UI config (radio + dialog + preview) → Task 7 ✓
- แสดงตอนตรวจ + หัวหน้า QC (chip/เตือน review/fail, ข้าม+เตือน no-%) → Task 8 ✓
- FE↔BE parity → Task 2/3 (FE) + Task 6 (BE mirror + test) ✓
- headPct optional / exclusivity / autoPct>0 guards → Task 1 ✓

**Type consistency:** `LabelToleranceStandard {substance, autoPct, headPct}`, `LabelToleranceResolved {status, center, autoRange, headRange}`, `RenderFieldUnit.labelTolerance {std, rawSpec}`, `labelToleranceMode`/`labelToleranceStandards` — ใช้ชื่อเดียวกันทุก task ✓. `resolveLabelTolerance(std, rawSpec, value)` signature ตรงกัน FE/BE ✓.

**Placeholder scan:** ไม่มี TBD/TODO; ทุก step มี code จริง. Task 8 Step 4 (qcApprovalRows) อ้าง "ทำตาม pattern เดิมในไฟล์" — จงใจ เพราะโครง row ของไฟล์นั้นต้องอ่าน pattern substanceMode ที่มีอยู่ก่อนแก้ (ระบุ helper `isLabelToleranceAbnormal` + `resolveLabelTolerance().status` ให้ใช้ชัดแล้ว).

**Notes:** Task 8 เป็น UI 4 ไฟล์ที่ verify ด้วย browser (ตาม repo norm) — ถ้าระหว่างทำพบว่า qcApprovalRows โครงซับซ้อน อาจแตกเป็น task ย่อยได้.
