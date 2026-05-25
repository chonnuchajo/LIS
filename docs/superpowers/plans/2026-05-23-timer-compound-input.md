# Timer Compound Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor timer field ให้รับค่า compound (เช่น "1 ชม 30 นาที 45 วินาที") โดยเก็บ total เป็นวินาที + UI หลายช่องตาม timerUnit

**Architecture:** เปลี่ยน schema field `timerDuration` → `timerDurationSec` (วินาที), เพิ่ม helpers `partsToSec`/`secToParts`/`formatTimerHuman` ใน `parameterValidation.ts`, สร้าง `TimerDurationInput` component ที่แสดงช่องตาม unit, อัปเดต ParameterSettings + TimerField (QC) ให้ใช้ field/format ใหม่. ไม่ทำ migration เพราะ feature ยังไม่ push

**Tech Stack:** React 18 + TypeScript, Mongoose, Vitest, shadcn/ui (Input, Select)

**Spec reference:** [docs/superpowers/specs/2026-05-23-timer-compound-input-design.md](../specs/2026-05-23-timer-compound-input-design.md)

**Prerequisite:** Timer parameter plan ([2026-05-23-timer-parameter.md](2026-05-23-timer-parameter.md)) implement ครบแล้ว — งานนี้ refactor field name + UI ของ feature นั้น

---

### Task 1: Backend — rename timerDuration to timerDurationSec

**Files:**
- Modify: `server/models/Parameter.js`

- [ ] **Step 1: Rename field in ValueFieldSchema**

แก้ `server/models/Parameter.js` — ใน `ValueFieldSchema`:

ลบ:
```js
timerDuration: { type: Number, default: null },
```

เพิ่ม:
```js
timerDurationSec: { type: Number, default: null },
```

(วางในตำแหน่งเดียวกัน — หลัง `standardValue2`, ก่อน `timerUnit`)

- [ ] **Step 2: Update pre-validate to use new field name**

แก้ `server/models/Parameter.js` ใน `ParameterSchema.pre('validate', ...)` — หา block:

```js
    if (f.type === 'timer') {
      if (f.timerDuration == null || f.timerDuration <= 0) {
        return next(new Error(`ช่อง "${f.label}": ต้องระบุระยะเวลา (timer) > 0`));
      }
      if (!f.timerUnit) {
        return next(new Error(`ช่อง "${f.label}": ต้องระบุหน่วยเวลา (นาที/ชั่วโมง/วัน/เดือน)`));
      }
    }
```

แทนด้วย:

```js
    if (f.type === 'timer') {
      if (!f.timerUnit) {
        return next(new Error(`ช่อง "${f.label}": ต้องระบุหน่วยเวลา (นาที/ชั่วโมง/วัน/เดือน)`));
      }
      if (f.timerDurationSec == null || f.timerDurationSec <= 0) {
        return next(new Error(`ช่อง "${f.label}": ต้องระบุระยะเวลา > 0`));
      }
    }
```

- [ ] **Step 3: Verify schema loads**

Run: `node -e "require('./server/models/Parameter.js'); console.log('schema loaded OK')"`
Expected: `schema loaded OK`

- [ ] **Step 4: Commit**

```bash
git add server/models/Parameter.js
git commit -m "refactor(parameters): rename timerDuration to timerDurationSec"
```

---

### Task 2: Frontend type — rename timerDuration to timerDurationSec

**Files:**
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Rename field**

แก้ `src/lib/api.ts` ใน `ParameterValueField` — เปลี่ยนชื่อ field:

ลบ:
```ts
  timerDuration?: number | null;
```

เพิ่ม:
```ts
  timerDurationSec?: number | null;
```

(วางในตำแหน่งเดียวกัน — หลัง `expectedValues`, ก่อน `timerUnit`)

- [ ] **Step 2: Verify TypeScript fails on usage**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: หลายไฟล์ error เพราะใช้ `timerDuration` (จะแก้ใน task ถัดไป) — เก็บ output ไว้ดู

(ไม่ commit ตอนนี้ — ต้องแก้ทุก usage ก่อน commit)

---

### Task 3: Helpers — partsToSec + secToParts + formatTimerHuman with tests (TDD)

**Files:**
- Modify: `src/lib/parameterValidation.ts`
- Modify: `src/lib/parameterValidation.test.ts`

- [ ] **Step 1: Write failing tests**

แก้ `src/lib/parameterValidation.test.ts` — แก้ imports ด้านบน:

```ts
import {
  isEnumAbnormal,
  isNumericAbnormal,
  isFieldAbnormal,
  timerDurationMs,
  timerRemainingMs,
  isTimerDone,
  partsToSec,
  secToParts,
  formatTimerHuman,
} from "./parameterValidation";
```

แล้วเพิ่ม describe blocks ต่อท้ายไฟล์ (หลัง describe `isTimerDone`):

```ts
describe("partsToSec", () => {
  it("returns 0 for empty parts", () => {
    expect(partsToSec({})).toBe(0);
  });

  it("computes seconds only", () => {
    expect(partsToSec({ seconds: 45 })).toBe(45);
  });

  it("computes minutes + seconds", () => {
    expect(partsToSec({ minutes: 1, seconds: 30 })).toBe(90);
  });

  it("computes hour + minute + second", () => {
    expect(partsToSec({ hours: 1, minutes: 30, seconds: 45 })).toBe(5445);
  });

  it("computes day + lower parts", () => {
    expect(partsToSec({ days: 1, hours: 1, minutes: 1, seconds: 1 })).toBe(90061);
  });

  it("computes month + lower parts (30-day month)", () => {
    expect(partsToSec({
      months: 1, days: 2, hours: 3, minutes: 4, seconds: 5,
    })).toBe(1 * 2592000 + 2 * 86400 + 3 * 3600 + 4 * 60 + 5);
  });

  it("treats undefined fields as 0", () => {
    expect(partsToSec({ hours: 2 })).toBe(7200);
  });
});

describe("secToParts", () => {
  it("zero seconds returns zeroed parts for hour unit", () => {
    expect(secToParts(0, "hour")).toEqual({ hours: 0, minutes: 0, seconds: 0 });
  });

  it("90 sec + minute unit → 1m 30s", () => {
    expect(secToParts(90, "minute")).toEqual({ minutes: 1, seconds: 30 });
  });

  it("5445 sec + hour unit → 1h 30m 45s", () => {
    expect(secToParts(5445, "hour")).toEqual({ hours: 1, minutes: 30, seconds: 45 });
  });

  it("90061 sec + day unit → 1d 1h 1m 1s", () => {
    expect(secToParts(90061, "day")).toEqual({
      days: 1, hours: 1, minutes: 1, seconds: 1,
    });
  });

  it("2592000 sec + month unit → 1mo 0d 0h 0m 0s", () => {
    expect(secToParts(2592000, "month")).toEqual({
      months: 1, days: 0, hours: 0, minutes: 0, seconds: 0,
    });
  });

  it("5445 sec + day unit redistributes (no day component)", () => {
    expect(secToParts(5445, "day")).toEqual({
      days: 0, hours: 1, minutes: 30, seconds: 45,
    });
  });

  it("negative seconds clamps to 0", () => {
    expect(secToParts(-100, "hour")).toEqual({ hours: 0, minutes: 0, seconds: 0 });
  });

  it("fractional seconds are floored", () => {
    expect(secToParts(90.7, "minute")).toEqual({ minutes: 1, seconds: 30 });
  });

  it("roundtrip: secToParts → partsToSec returns same value", () => {
    const sec = 90061;
    const parts = secToParts(sec, "day");
    expect(partsToSec(parts)).toBe(sec);
  });
});

describe("formatTimerHuman", () => {
  it("0 → '0 วินาที'", () => {
    expect(formatTimerHuman(0)).toBe("0 วินาที");
  });

  it("60 → '1 นาที'", () => {
    expect(formatTimerHuman(60)).toBe("1 นาที");
  });

  it("3600 → '1 ชม'", () => {
    expect(formatTimerHuman(3600)).toBe("1 ชม");
  });

  it("3661 → '1 ชม 1 นาที 1 วินาที'", () => {
    expect(formatTimerHuman(3661)).toBe("1 ชม 1 นาที 1 วินาที");
  });

  it("5445 → '1 ชม 30 นาที 45 วินาที'", () => {
    expect(formatTimerHuman(5445)).toBe("1 ชม 30 นาที 45 วินาที");
  });

  it("90061 → '1 วัน 1 ชม 1 นาที 1 วินาที'", () => {
    expect(formatTimerHuman(90061)).toBe("1 วัน 1 ชม 1 นาที 1 วินาที");
  });

  it("2592000 (30 days) → '1 เดือน'", () => {
    expect(formatTimerHuman(2592000)).toBe("1 เดือน");
  });

  it("skips zero parts", () => {
    expect(formatTimerHuman(3600 + 45)).toBe("1 ชม 45 วินาที");
  });
});
```

- [ ] **Step 2: Update existing timerDurationMs tests to use new field name**

แก้ `src/lib/parameterValidation.test.ts` — function `makeTimer`:

```ts
const makeTimer = (overrides: Partial<ParameterValueField>): ParameterValueField => ({
  label: "incubation",
  type: "timer",
  timerDurationSec: 1800,
  timerUnit: "minute",
  ...overrides,
});
```

แล้วแก้ test cases ที่ใช้ `timerDuration` → `timerDurationSec` พร้อมแก้ค่าให้เป็นวินาที:

แก้ `describe("timerDurationMs")` ทั้ง block ด้วย:

```ts
describe("timerDurationMs", () => {
  it("returns null for non-timer types", () => {
    const f: ParameterValueField = {
      label: "x", type: "number", timerDurationSec: 1800, timerUnit: "minute",
    };
    expect(timerDurationMs(f)).toBeNull();
  });

  it("returns null when durationSec is null/0/negative", () => {
    expect(timerDurationMs(makeTimer({ timerDurationSec: null }))).toBeNull();
    expect(timerDurationMs(makeTimer({ timerDurationSec: 0 }))).toBeNull();
    expect(timerDurationMs(makeTimer({ timerDurationSec: -5 }))).toBeNull();
  });

  it("converts sec to ms", () => {
    expect(timerDurationMs(makeTimer({ timerDurationSec: 1800 }))).toBe(1_800_000);
    expect(timerDurationMs(makeTimer({ timerDurationSec: 7200 }))).toBe(7_200_000);
    expect(timerDurationMs(makeTimer({ timerDurationSec: 86400 }))).toBe(86_400_000);
    expect(timerDurationMs(makeTimer({ timerDurationSec: 2592000 }))).toBe(2_592_000_000);
  });
});
```

(ลบ test เก่าที่เกี่ยวกับ unit conversion — logic ย้ายไป partsToSec แล้ว, และ test ที่เช็ค timerUnit=undefined)

ใน `describe("timerRemainingMs")` และ `describe("isTimerDone")` — แทน `timerDuration: 30, timerUnit: "minute"` ทุกที่ด้วย `timerDurationSec: 1800`:

```ts
// ใน timerRemainingMs และ isTimerDone — แก้บรรทัดเหล่านี้:
const f = makeTimer({ timerDurationSec: 1800 });  // แทน timerDuration: 30, timerUnit: "minute"
```

- [ ] **Step 3: Run tests to verify they fail (red)**

Run: `npm run test -- src/lib/parameterValidation.test.ts`
Expected: FAIL — `partsToSec`, `secToParts`, `formatTimerHuman` not exported + existing timer tests fail because `timerDurationMs` still reads `timerDuration` (old field)

- [ ] **Step 4: Update timerDurationMs to read timerDurationSec**

แก้ `src/lib/parameterValidation.ts` — function `timerDurationMs`:

```ts
export function timerDurationMs(field: ParameterValueField): number | null {
  if (field.type !== "timer") return null;
  if (!field.timerDurationSec || field.timerDurationSec <= 0) return null;
  return field.timerDurationSec * 1000;
}
```

(เอา timerUnit check ออก — ไม่ใช้ใน duration calc แล้ว)

ลบ `const TIMER_UNIT_TO_MS` ออกจากไฟล์ (ไม่ใช้แล้ว) — เก็บแค่ถ้ายังจำเป็น

- [ ] **Step 5: Add new helpers**

แก้ `src/lib/parameterValidation.ts` — เพิ่มต่อท้ายไฟล์ (หลัง `isTimerDone`):

```ts
export type TimerParts = {
  months?: number;
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
};

const SEC_PER_MINUTE = 60;
const SEC_PER_HOUR = 3600;
const SEC_PER_DAY = 86400;
const SEC_PER_MONTH = 30 * 86400;

export function partsToSec(parts: TimerParts): number {
  return (parts.months ?? 0) * SEC_PER_MONTH
    + (parts.days ?? 0) * SEC_PER_DAY
    + (parts.hours ?? 0) * SEC_PER_HOUR
    + (parts.minutes ?? 0) * SEC_PER_MINUTE
    + (parts.seconds ?? 0);
}

export function secToParts(sec: number, unit: TimerUnit): TimerParts {
  let remaining = Math.max(0, Math.floor(sec));
  const out: TimerParts = {};
  if (unit === "month") {
    out.months = Math.floor(remaining / SEC_PER_MONTH);
    remaining %= SEC_PER_MONTH;
  }
  if (unit === "month" || unit === "day") {
    out.days = Math.floor(remaining / SEC_PER_DAY);
    remaining %= SEC_PER_DAY;
  }
  if (unit === "month" || unit === "day" || unit === "hour") {
    out.hours = Math.floor(remaining / SEC_PER_HOUR);
    remaining %= SEC_PER_HOUR;
  }
  out.minutes = Math.floor(remaining / SEC_PER_MINUTE);
  out.seconds = remaining % SEC_PER_MINUTE;
  return out;
}

export function formatTimerHuman(sec: number): string {
  if (!sec || sec <= 0) return "0 วินาที";
  const total = Math.floor(sec);
  const months = Math.floor(total / SEC_PER_MONTH);
  let r = total % SEC_PER_MONTH;
  const days = Math.floor(r / SEC_PER_DAY);
  r %= SEC_PER_DAY;
  const hours = Math.floor(r / SEC_PER_HOUR);
  r %= SEC_PER_HOUR;
  const minutes = Math.floor(r / SEC_PER_MINUTE);
  const seconds = r % SEC_PER_MINUTE;
  const parts: string[] = [];
  if (months) parts.push(`${months} เดือน`);
  if (days) parts.push(`${days} วัน`);
  if (hours) parts.push(`${hours} ชม`);
  if (minutes) parts.push(`${minutes} นาที`);
  if (seconds) parts.push(`${seconds} วินาที`);
  return parts.join(" ");
}
```

- [ ] **Step 6: Run tests to verify pass (green)**

Run: `npm run test -- src/lib/parameterValidation.test.ts`
Expected: PASS — ทุก test รวม partsToSec/secToParts/formatTimerHuman + timer tests เก่า

- [ ] **Step 7: Commit**

```bash
git add src/lib/parameterValidation.ts src/lib/parameterValidation.test.ts
git commit -m "feat(parameters): add partsToSec/secToParts/formatTimerHuman helpers + use sec storage"
```

---

### Task 4: ParameterSettings — rename field references + TimerDurationInput component

**Files:**
- Modify: `src/pages/ParameterSettings.tsx`

- [ ] **Step 1: Update import to include new helpers**

แก้ `src/pages/ParameterSettings.tsx` — เพิ่ม import จาก `parameterValidation`:

ค้นหาว่ามี import จาก `@/lib/parameterValidation` อยู่หรือไม่. ถ้าไม่มี ให้เพิ่ม:

```ts
import { partsToSec, secToParts, formatTimerHuman, type TimerParts } from "@/lib/parameterValidation";
```

- [ ] **Step 2: Update emptyValueField**

แก้ `emptyValueField` — เปลี่ยน `timerDuration: null` เป็น `timerDurationSec: null`:

```ts
const emptyValueField = (): ParameterValueField => ({
  label: "",
  type: "text",
  unit: "",
  standardValue: null,
  standardOperator: undefined,
  standardValue2: null,
  options: [],
  requireNoteOn: [],
  expectedValues: [],
  timerDurationSec: null,
  timerUnit: undefined,
  required: false,
});
```

- [ ] **Step 3: Update type-change Select onValueChange**

แก้ส่วน `onValueChange` ของ field type Select — แทน `timerDuration` ด้วย `timerDurationSec`:

```tsx
                    timerDurationSec: v === "timer" ? field.timerDurationSec ?? null : null,
                    timerUnit: v === "timer" ? field.timerUnit : undefined,
```

- [ ] **Step 4: Replace TimerPreview to use formatTimerHuman**

แก้ `src/pages/ParameterSettings.tsx` — replace function `TimerPreview` ทั้ง function:

```tsx
function TimerPreview({ field }: { field: ParameterValueField }) {
  if (!field.timerDurationSec || field.timerDurationSec <= 0 || !field.timerUnit) {
    return (
      <p className="text-xs text-muted-foreground">
        ยังไม่ได้กำหนดระยะเวลา
      </p>
    );
  }
  return (
    <p className="text-xs text-emerald-700">
      จับเวลา: {formatTimerHuman(field.timerDurationSec)} ({field.timerDurationSec.toLocaleString()} วินาที)
    </p>
  );
}
```

ลบ const `TIMER_UNIT_LABELS` ที่อยู่ใกล้ๆ ไม่ใช้แล้ว (ถ้ายังไม่มี usage อื่น)

- [ ] **Step 5: Add TimerDurationInput component**

แก้ `src/pages/ParameterSettings.tsx` — เพิ่ม component ใหม่ก่อน `TimerPreview`:

```tsx
const TIMER_PART_LABEL: Record<keyof TimerParts, string> = {
  months: "เดือน",
  days: "วัน",
  hours: "ชม",
  minutes: "นาที",
  seconds: "วิ",
};

function pickPartsForUnit(unit: TimerUnit): Array<keyof TimerParts> {
  switch (unit) {
    case "minute": return ["minutes", "seconds"];
    case "hour": return ["hours", "minutes", "seconds"];
    case "day": return ["days", "hours", "minutes", "seconds"];
    case "month": return ["months", "days", "hours", "minutes", "seconds"];
  }
}

function TimerDurationInput({
  unit,
  sec,
  onChange,
}: {
  unit: TimerUnit | undefined;
  sec: number;
  onChange: (newSec: number) => void;
}) {
  if (!unit) {
    return (
      <p className="text-xs text-muted-foreground">
        เลือก "หน่วย" ก่อน
      </p>
    );
  }
  const parts = secToParts(sec, unit);
  const keys = pickPartsForUnit(unit);
  return (
    <div className="flex items-center gap-1">
      {keys.map((key, i) => (
        <Fragment key={key}>
          {i > 0 && <span className="text-muted-foreground text-lg">:</span>}
          <div className="flex flex-col items-center">
            <Input
              type="number"
              min={0}
              value={parts[key] ?? 0}
              onChange={(e) => {
                const v = Number(e.target.value);
                const next: TimerParts = { ...parts, [key]: Number.isFinite(v) && v >= 0 ? v : 0 };
                onChange(partsToSec(next));
              }}
              className="h-10 w-20 text-center"
            />
            <span className="text-[10px] text-muted-foreground mt-0.5">
              {TIMER_PART_LABEL[key]}
            </span>
          </div>
        </Fragment>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Add Fragment to React import**

หา import `react` ตอนต้นไฟล์ `src/pages/ParameterSettings.tsx`:

```ts
import { useEffect, useMemo, useState } from "react";
```

แก้เป็น:

```ts
import { Fragment, useEffect, useMemo, useState } from "react";
```

- [ ] **Step 7: Replace ระยะเวลา Input with TimerDurationInput**

หา timer block ใน `ValueFieldEditor` (ที่เพิ่มจาก plan ก่อน, มี `<div className="sm:col-span-6 space-y-1.5"><Label className="text-sm">ระยะเวลา *`):

แทน block "ระยะเวลา *" เดิม:

```tsx
                <div className="sm:col-span-6 space-y-1.5">
                  <Label className="text-sm">ระยะเวลา *</Label>
                  <Input
                    type="number"
                    min={1}
                    value={field.timerDuration ?? ""}
                    onChange={(e) =>
                      onChange({
                        ...field,
                        timerDuration: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    className="h-10"
                  />
                </div>
```

ด้วย:

```tsx
                <div className="sm:col-span-6 space-y-1.5">
                  <Label className="text-sm">ระยะเวลา *</Label>
                  <TimerDurationInput
                    unit={field.timerUnit}
                    sec={field.timerDurationSec ?? 0}
                    onChange={(newSec) =>
                      onChange({ ...field, timerDurationSec: newSec })
                    }
                  />
                </div>
```

- [ ] **Step 8: Update validate() to use new field name**

หา block ใน function `validate()`:

```ts
      if (f.type === "timer") {
        if (f.timerDuration == null || f.timerDuration <= 0) {
          return `ช่อง "${f.label}": ต้องระบุระยะเวลา > 0`;
        }
        if (!f.timerUnit) {
          return `ช่อง "${f.label}": ต้องระบุหน่วยเวลา`;
        }
      }
```

แทนด้วย:

```ts
      if (f.type === "timer") {
        if (!f.timerUnit) {
          return `ช่อง "${f.label}": ต้องระบุหน่วยเวลา`;
        }
        if (!f.timerDurationSec || f.timerDurationSec <= 0) {
          return `ช่อง "${f.label}": ต้องระบุระยะเวลา > 0`;
        }
      }
```

- [ ] **Step 9: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 10: Manual smoke test**

(ถ้า dev server ไม่ได้รัน: `npm run dev`)

1. เปิด Parameter Settings → สร้าง field timer ใหม่
2. ก่อนเลือก "หน่วย" → ระยะเวลาแสดง "เลือก 'หน่วย' ก่อน"
3. เลือก "ชั่วโมง" → ปรากฏ 3 ช่อง (ชม / นาที / วิ) value=0
4. กรอก 1, 30, 45 → preview: "จับเวลา: 1 ชม 30 นาที 45 วินาที (5,445 วินาที)"
5. เปลี่ยน unit เป็น "นาที" → 2 ช่อง (นาที / วิ) → ค่า redistribute เป็น 90 และ 45 (90 นาที + 45 วินาที = 5445 วิ ตามเดิม)
6. เปลี่ยน unit เป็น "วัน" → 4 ช่อง (วัน / ชม / นาที / วิ) → 0, 1, 30, 45
7. เปลี่ยน unit เป็น "เดือน" → 5 ช่อง → 0, 0, 1, 30, 45
8. บันทึก → refresh → เปิดใหม่ → ค่ายังอยู่ครบ
9. เปลี่ยน type ไม่ใช่ timer → ค่า timerDurationSec/timerUnit ถูก reset

- [ ] **Step 11: Commit**

```bash
git add src/pages/ParameterSettings.tsx
git commit -m "feat(parameters): compound timer input with N boxes per unit"
```

---

### Task 5: TimerField (QC Testing) — use formatTimerHuman + new field name

**Files:**
- Modify: `src/components/lis/TimerField.tsx`

- [ ] **Step 1: Replace formatTotal with formatTimerHuman**

แก้ `src/components/lis/TimerField.tsx` — เพิ่ม import `formatTimerHuman`:

```ts
import { timerDurationMs, timerRemainingMs, isTimerDone, formatTimerHuman } from "@/lib/parameterValidation";
```

(ลบ `import` ของ `UNIT_LABEL` ถ้ามี — ไม่ใช้แล้ว)

- [ ] **Step 2: Remove formatTotal function**

ลบ function `formatTotal` ที่ define ในไฟล์เดียวกัน (ไม่ใช้แล้ว — แทนด้วย `formatTimerHuman(field.timerDurationSec ?? 0)`)

```ts
// ลบ block นี้:
function formatTotal(field: ParameterValueField): string {
  if (!field.timerDuration || !field.timerUnit) return "";
  return `${field.timerDuration} ${UNIT_LABEL[field.timerUnit] ?? field.timerUnit}`;
}

// และลบ const UNIT_LABEL ถ้ามี (ไม่ได้ใช้ที่อื่น)
```

- [ ] **Step 3: Update Idle state to use formatTimerHuman**

แก้ block render Idle (ใน function `TimerField`) — บรรทัด `<span className="text-xs text-grey-500">ระยะเวลา {formatTotal(field)}</span>`:

แทนด้วย:

```tsx
        <span className="text-xs text-grey-500">
          ระยะเวลา {formatTimerHuman(field.timerDurationSec ?? 0)}
        </span>
```

- [ ] **Step 4: Update Running state to use formatTimerHuman**

แก้ block ใน `TimerRunning` — บรรทัด `เหลือ {formatRemaining(remainingNow)} / {formatTotal(field)}`:

แทนด้วย:

```tsx
        <span className="text-sm font-mono">
          เหลือ {formatRemaining(remainingNow)} / {formatTimerHuman(field.timerDurationSec ?? 0)}
        </span>
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 6: Manual smoke test**

(dev server)

1. สร้าง parameter timer "1 ชม 30 นาที 45 วินาที" (จาก Task 4 step 10)
2. เข้า QC Testing detail ของ sample ที่ใช้ parameter นั้น
3. Idle: "ระยะเวลา 1 ชม 30 นาที 45 วินาที"
4. กด "เริ่มจับเวลา" → Running: "เหลือ 1h 30m / 1 ชม 30 นาที 45 วินาที" + progress bar
5. รอครบ → Done state, เสียงดัง — flow เดิมยังทำงาน

- [ ] **Step 7: Commit**

```bash
git add src/components/lis/TimerField.tsx
git commit -m "feat(qc-testing): timer display uses formatTimerHuman with seconds storage"
```

---

### Task 6: Regression check

**Files:**
- N/A

- [ ] **Step 1: Run vitest suite**

Run: `npm run test`
Expected: ทุก test PASS

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: ไม่มี new error/warning จากไฟล์ที่แก้

หมายเหตุ: lint errors เดิม ((field as any) ที่ QCTestingDetailPage line 161-162) ข้ามได้

- [ ] **Step 3: Search for any leftover `timerDuration` references**

Run: `grep -rn "timerDuration\b" src/ server/ --include="*.ts" --include="*.tsx" --include="*.js"`

(หรือใช้ Grep tool ในกรณีของ Claude Code)

Expected: ไม่เจอ (ทุก reference เป็น `timerDurationSec` หรือไม่มีเลย)

ถ้าเจอ — แก้ให้เป็น `timerDurationSec` แล้ว run tests + lint อีกครั้ง

- [ ] **Step 4: Commit ถ้ามีการแก้เพิ่ม**

```bash
git status  # ดูว่ามีอะไรเปลี่ยนหรือไม่
# ถ้ามี: git add . && git commit -m "fix(parameters): clean up leftover timerDuration references"
```

---

## Self-Review

**Spec coverage:**
- ✓ Schema rename `timerDuration` → `timerDurationSec` → Task 1 (backend) + Task 2 (frontend)
- ✓ Backend pre-validate ใช้ field name ใหม่ → Task 1 step 2
- ✓ Helpers `partsToSec` / `secToParts` / `formatTimerHuman` + tests → Task 3
- ✓ Update `timerDurationMs` ให้อ่าน `timerDurationSec` → Task 3 step 4
- ✓ UI compound input N boxes ตาม unit → Task 4 step 5 (`TimerDurationInput`)
- ✓ Preview text "X ชม Y นาที Z วินาที (sec)" → Task 4 step 4 (`TimerPreview`)
- ✓ pickPartsForUnit mapping (minute=2, hour=3, day=4, month=5 boxes) → Task 4 step 5
- ✓ emptyValueField + type-change reset → Task 4 step 2-3
- ✓ Frontend validate() → Task 4 step 8
- ✓ TimerField (QC) ใช้ formatTimerHuman → Task 5 step 3-4
- ✓ ลบ formatTotal เก่า → Task 5 step 2
- ✓ Unit-change behavior (sec คงเดิม, UI redistribute) → ออกมาจาก `secToParts` ใช้ใน `TimerDurationInput` (Task 4 step 5)
- ✓ Backward compat (ไม่ทำ) → spec ระบุชัด
- ✓ Regression check → Task 6

**Placeholder scan:** ไม่มี TBD/TODO. ทุก step มี exact code

**Type consistency:**
- `timerDurationSec?: number | null` consistent ทุกที่
- `TimerParts` type ใช้ใน partsToSec/secToParts/formatTimerHuman + TimerDurationInput
- `TimerUnit` import ตรงทุก task
- `pickPartsForUnit(unit): Array<keyof TimerParts>` ใช้ใน TimerDurationInput
- Function signatures consistent: `partsToSec(parts: TimerParts): number`, `secToParts(sec: number, unit: TimerUnit): TimerParts`, `formatTimerHuman(sec: number): string`
