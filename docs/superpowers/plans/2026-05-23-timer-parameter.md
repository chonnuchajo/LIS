# Timer Parameter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่ม `timerDuration` + `timerUnit` บน timer parameter, สร้าง `TimerField` component ใน QC Testing ที่มี 3 states (idle/running/done) พร้อม countdown + sound loop จนกว่า user จะหยุดเสียง

**Architecture:** ขยาย Mongoose schema + TypeScript type, เพิ่ม helpers `timerDurationMs` / `timerRemainingMs` / `isTimerDone` ใน `src/lib/parameterValidation.ts`, เพิ่ม UI block สำหรับ timer ใน ParameterSettings (`requiresUnit`-style), สร้าง `TimerField` component ใหม่ใน `QCTestingDetailPage` ที่ render แทน Input เดิมเมื่อ `type === "timer"`. Sound ใช้ HTMLAudioElement pattern ที่มีอยู่ใน `QueueDisplay.tsx` พร้อม fallback path

**Tech Stack:** React 18 + TypeScript, Mongoose, Vitest (+ `vi.useFakeTimers`), shadcn/ui (Button, Input, Select), lucide-react icons (Play, CheckCircle2), HTMLAudioElement

**Spec reference:** [docs/superpowers/specs/2026-05-23-timer-parameter-design.md](../specs/2026-05-23-timer-parameter-design.md)

**Prerequisite:** ENUM expected values + numeric operators plans ต้อง implement เสร็จก่อน — งานนี้ extend `src/lib/parameterValidation.ts` ที่มี helpers อยู่แล้ว

---

### Task 1: Backend — add timerDuration + timerUnit to Mongoose schema

**Files:**
- Modify: `server/models/Parameter.js`

- [ ] **Step 1: Add fields to ValueFieldSchema**

แก้ `server/models/Parameter.js` — ใน `ValueFieldSchema` เพิ่ม 2 fields หลัง `standardValue2`:

```js
  standardValue2: { type: Number, default: null },
  timerDuration: { type: Number, default: null },
  timerUnit: {
    type: String,
    enum: ['minute', 'hour', 'day', 'month', null],
    default: null,
  },
  required: { type: Boolean, default: false },
```

- [ ] **Step 2: Add pre-validate for timer**

แก้ `server/models/Parameter.js` ใน `ParameterSchema.pre('validate', ...)` — เพิ่ม block หลัง `standardOperator` validation block (ที่เพิ่มจาก plan ก่อน), ก่อน `if (f.min != null && f.max != null...`:

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

- [ ] **Step 3: Verify schema loads**

Run: `node -e "require('./server/models/Parameter.js'); console.log('schema loaded OK')"`
Expected: `schema loaded OK`

- [ ] **Step 4: Commit**

```bash
git add server/models/Parameter.js
git commit -m "feat(parameters): add timerDuration and timerUnit to schema"
```

---

### Task 2: Frontend type — TimerUnit + extend ParameterValueField

**Files:**
- Modify: `src/lib/api.ts:219-241`

- [ ] **Step 1: Add TimerUnit type and extend ParameterValueField**

แก้ `src/lib/api.ts` — เพิ่ม `TimerUnit` หลัง `StandardOperator` (ที่เพิ่มจาก plan ก่อน), และเพิ่ม 2 fields ใน `ParameterValueField`:

```ts
export type TimerUnit = "minute" | "hour" | "day" | "month";

export type ParameterValueField = {
  label: string;
  type: ParameterValueFieldType;
  unit?: string;
  standardValue?: number | null;
  standardOperator?: StandardOperator;
  standardValue2?: number | null;
  options?: string[];
  requireNoteOn?: string[];
  expectedValues?: string[];
  timerDuration?: number | null;
  timerUnit?: TimerUnit;
  required?: boolean;
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(parameters): add TimerUnit type and timer fields"
```

---

### Task 3: Helpers — timerDurationMs / timerRemainingMs / isTimerDone with tests (TDD)

**Files:**
- Modify: `src/lib/parameterValidation.ts`
- Modify: `src/lib/parameterValidation.test.ts`

- [ ] **Step 1: Write failing tests**

แก้ `src/lib/parameterValidation.test.ts` — เพิ่ม imports และ describe blocks ต่อท้ายไฟล์:

```ts
// add to existing imports at top:
import {
  isEnumAbnormal,
  isNumericAbnormal,
  isFieldAbnormal,
  timerDurationMs,
  timerRemainingMs,
  isTimerDone,
} from "./parameterValidation";
import { vi, beforeEach, afterEach } from "vitest";
```

(ถ้า imports `isEnumAbnormal, isNumericAbnormal, isFieldAbnormal` มีอยู่แล้ว — เพิ่มแค่ 3 ตัวที่เหลือใน import เดิม + เพิ่ม import vi/beforeEach/afterEach)

แล้วเพิ่ม describe blocks ต่อท้ายไฟล์ (หลัง describe `isFieldAbnormal`):

```ts
const makeTimer = (overrides: Partial<ParameterValueField>): ParameterValueField => ({
  label: "incubation",
  type: "timer",
  timerDuration: 30,
  timerUnit: "minute",
  ...overrides,
});

describe("timerDurationMs", () => {
  it("returns null for non-timer types", () => {
    const f: ParameterValueField = { label: "x", type: "number", timerDuration: 30, timerUnit: "minute" };
    expect(timerDurationMs(f)).toBeNull();
  });

  it("returns null when duration is null/0/negative", () => {
    expect(timerDurationMs(makeTimer({ timerDuration: null }))).toBeNull();
    expect(timerDurationMs(makeTimer({ timerDuration: 0 }))).toBeNull();
    expect(timerDurationMs(makeTimer({ timerDuration: -5 }))).toBeNull();
  });

  it("returns null when unit is missing", () => {
    expect(timerDurationMs(makeTimer({ timerUnit: undefined }))).toBeNull();
  });

  it("converts minute to ms", () => {
    expect(timerDurationMs(makeTimer({ timerDuration: 30, timerUnit: "minute" }))).toBe(1_800_000);
  });

  it("converts hour to ms", () => {
    expect(timerDurationMs(makeTimer({ timerDuration: 2, timerUnit: "hour" }))).toBe(7_200_000);
  });

  it("converts day to ms", () => {
    expect(timerDurationMs(makeTimer({ timerDuration: 1, timerUnit: "day" }))).toBe(86_400_000);
  });

  it("converts month (30 days) to ms", () => {
    expect(timerDurationMs(makeTimer({ timerDuration: 1, timerUnit: "month" }))).toBe(2_592_000_000);
  });
});

describe("timerRemainingMs", () => {
  const FIXED_NOW = new Date("2026-05-23T15:30:00Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null when field has no duration", () => {
    const f = makeTimer({ timerDuration: null });
    expect(timerRemainingMs(f, new Date(FIXED_NOW).toISOString())).toBeNull();
  });

  it("returns full duration when startedAt is null/undefined", () => {
    const f = makeTimer({ timerDuration: 30, timerUnit: "minute" });
    expect(timerRemainingMs(f, null)).toBe(1_800_000);
    expect(timerRemainingMs(f, undefined)).toBe(1_800_000);
  });

  it("computes remaining when partially elapsed", () => {
    const startedAt = new Date(FIXED_NOW - 5 * 60_000).toISOString(); // 5 min ago
    const f = makeTimer({ timerDuration: 30, timerUnit: "minute" });
    expect(timerRemainingMs(f, startedAt)).toBe(25 * 60_000);
  });

  it("returns 0 when fully elapsed (clamped, not negative)", () => {
    const startedAt = new Date(FIXED_NOW - 31 * 60_000).toISOString();
    const f = makeTimer({ timerDuration: 30, timerUnit: "minute" });
    expect(timerRemainingMs(f, startedAt)).toBe(0);
  });

  it("returns null for invalid ISO string", () => {
    const f = makeTimer({ timerDuration: 30, timerUnit: "minute" });
    expect(timerRemainingMs(f, "not-a-date")).toBeNull();
  });
});

describe("isTimerDone", () => {
  const FIXED_NOW = new Date("2026-05-23T15:30:00Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false when not started", () => {
    const f = makeTimer({});
    expect(isTimerDone(f, null)).toBe(false);
  });

  it("returns false when still running", () => {
    const startedAt = new Date(FIXED_NOW - 5 * 60_000).toISOString();
    const f = makeTimer({ timerDuration: 30, timerUnit: "minute" });
    expect(isTimerDone(f, startedAt)).toBe(false);
  });

  it("returns true when fully elapsed", () => {
    const startedAt = new Date(FIXED_NOW - 60 * 60_000).toISOString();
    const f = makeTimer({ timerDuration: 30, timerUnit: "minute" });
    expect(isTimerDone(f, startedAt)).toBe(true);
  });

  it("returns true at exact boundary", () => {
    const startedAt = new Date(FIXED_NOW - 30 * 60_000).toISOString();
    const f = makeTimer({ timerDuration: 30, timerUnit: "minute" });
    expect(isTimerDone(f, startedAt)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- src/lib/parameterValidation.test.ts`
Expected: FAIL — `timerDurationMs / timerRemainingMs / isTimerDone is not exported`

- [ ] **Step 3: Add implementations**

แก้ `src/lib/parameterValidation.ts` — เพิ่มหลัง `isFieldAbnormal`:

```ts
import type { ParameterValueField, TimerUnit } from "./api";

const TIMER_UNIT_TO_MS: Record<TimerUnit, number> = {
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  month: 30 * 86_400_000,
};

export function timerDurationMs(field: ParameterValueField): number | null {
  if (field.type !== "timer") return null;
  if (!field.timerDuration || field.timerDuration <= 0) return null;
  if (!field.timerUnit) return null;
  return field.timerDuration * TIMER_UNIT_TO_MS[field.timerUnit];
}

export function timerRemainingMs(
  field: ParameterValueField,
  startedAtIso: string | null | undefined,
): number | null {
  const total = timerDurationMs(field);
  if (total == null) return null;
  if (!startedAtIso) return total;
  const startedAt = new Date(startedAtIso).getTime();
  if (Number.isNaN(startedAt)) return null;
  const elapsed = Date.now() - startedAt;
  return Math.max(0, total - elapsed);
}

export function isTimerDone(
  field: ParameterValueField,
  startedAtIso: string | null | undefined,
): boolean {
  if (!startedAtIso) return false;
  const remaining = timerRemainingMs(field, startedAtIso);
  return remaining != null && remaining <= 0;
}
```

หมายเหตุ: ถ้าไฟล์มี `import type { ParameterValueField } from "./api";` อยู่แล้ว — เพิ่มแค่ `TimerUnit` ลงใน existing import.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- src/lib/parameterValidation.test.ts`
Expected: PASS — ทุก test (เดิม + ใหม่)

- [ ] **Step 5: Commit**

```bash
git add src/lib/parameterValidation.ts src/lib/parameterValidation.test.ts
git commit -m "feat(parameters): add timer duration/remaining helpers with unit tests"
```

---

### Task 4: ParameterSettings — emptyValueField + validate + type-change reset

**Files:**
- Modify: `src/pages/ParameterSettings.tsx`

- [ ] **Step 1: Update emptyValueField**

แก้ `emptyValueField` function — เพิ่ม 2 fields:

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
  timerDuration: null,
  timerUnit: undefined,
  required: false,
});
```

- [ ] **Step 2: Update type-change Select to reset timer fields**

แก้ `Select onValueChange` ของ field type — เพิ่ม reset 2 fields:

```tsx
                onValueChange={(v) =>
                  onChange({
                    ...field,
                    type: v as ParameterValueFieldType,
                    unit: v === "number" || v === "float" ? field.unit ?? "" : "",
                    options: v === "enum" ? field.options ?? [] : [],
                    requireNoteOn: v === "enum" ? field.requireNoteOn ?? [] : [],
                    expectedValues: v === "enum" ? field.expectedValues ?? [] : [],
                    standardValue: v === "number" || v === "float" ? field.standardValue : null,
                    standardOperator: v === "number" || v === "float" ? field.standardOperator : undefined,
                    standardValue2: v === "number" || v === "float" ? field.standardValue2 ?? null : null,
                    timerDuration: v === "timer" ? field.timerDuration ?? null : null,
                    timerUnit: v === "timer" ? field.timerUnit : undefined,
                  })
                }
```

- [ ] **Step 3: Add timer validation to validate()**

แก้ `validate()` function — เพิ่ม block ภายใน `for` loop, หลัง enum check (ที่ end ของ loop body):

```ts
      if (f.type === "enum" && (!f.options || f.options.length === 0)) {
        return `ช่อง "${f.label}": ต้องมีตัวเลือกอย่างน้อย 1 ตัว`;
      }
      if (f.type === "timer") {
        if (f.timerDuration == null || f.timerDuration <= 0) {
          return `ช่อง "${f.label}": ต้องระบุระยะเวลา > 0`;
        }
        if (!f.timerUnit) {
          return `ช่อง "${f.label}": ต้องระบุหน่วยเวลา`;
        }
      }
```

- [ ] **Step 4: Add TimerUnit to import**

แก้ `src/pages/ParameterSettings.tsx` ส่วน import จาก `@/lib/api`:

```ts
import {
  api,
  type ParameterItem,
  type ParameterValueField,
  type ParameterValueFieldType,
  type StandardOperator,
  type TimerUnit,
} from "@/lib/api";
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 6: Commit**

```bash
git add src/pages/ParameterSettings.tsx
git commit -m "feat(parameters): init timer fields in form defaults and validation"
```

---

### Task 5: ParameterSettings — timer block UI + TimerPreview

**Files:**
- Modify: `src/pages/ParameterSettings.tsx`

- [ ] **Step 1: Add TimerPreview component**

แก้ `src/pages/ParameterSettings.tsx` — เพิ่ม component หลัง `StandardPreview` (ที่เพิ่มจาก plan ก่อน), ก่อน `type ValueFieldEditorProps`:

```tsx
const TIMER_UNIT_LABELS: Record<TimerUnit, string> = {
  minute: "นาที",
  hour: "ชั่วโมง",
  day: "วัน",
  month: "เดือน",
};

function TimerPreview({ field }: { field: ParameterValueField }) {
  if (!field.timerDuration || !field.timerUnit) {
    return (
      <p className="text-xs text-muted-foreground">
        ยังไม่ได้กำหนดระยะเวลา
      </p>
    );
  }
  return (
    <p className="text-xs text-emerald-700">
      จับเวลา: {field.timerDuration} {TIMER_UNIT_LABELS[field.timerUnit]}
    </p>
  );
}
```

- [ ] **Step 2: Add timer block in ValueFieldEditor**

แก้ `src/pages/ParameterSettings.tsx` ใน `ValueFieldEditor` — หา block ที่ render `isEnum` (เริ่มด้วย `{isEnum ? (`) แล้วเพิ่ม block ใหม่ก่อนหรือหลัง enum block (เลือกหลังเพื่อให้อยู่ใต้สุด):

ค้นหา closing tag ของ `isEnum` block (มี `) : null}` หรือคล้ายกัน) แล้วเพิ่มต่อหลัง block นั้น:

```tsx
          {field.type === "timer" ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
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
                <div className="sm:col-span-6 space-y-1.5">
                  <Label className="text-sm">หน่วย *</Label>
                  <Select
                    value={field.timerUnit ?? ""}
                    onValueChange={(v) =>
                      onChange({ ...field, timerUnit: v as TimerUnit })
                    }
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="เลือกหน่วย" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minute">นาที</SelectItem>
                      <SelectItem value="hour">ชั่วโมง</SelectItem>
                      <SelectItem value="day">วัน</SelectItem>
                      <SelectItem value="month">เดือน (30 วัน)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <TimerPreview field={field} />
            </div>
          ) : null}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 4: Manual smoke test**

(ถ้า dev server ไม่ได้รัน: `npm run dev` — ดู [memory feedback](C:/Users/it6ic/.claude/projects/c--Project-LIS/memory/feedback_no_npm_run_build.md) อย่าใช้ `npm run build`)

เปิด Parameter Settings → สร้าง field ใหม่ type = `จับเวลา`:
- ปรากฏ 2 ช่อง: "ระยะเวลา" + "หน่วย"
- ไม่กรอก → preview: "ยังไม่ได้กำหนดระยะเวลา"
- กรอก 30 + เลือก "นาที" → preview: "จับเวลา: 30 นาที"
- บันทึก → refresh → เปิดใหม่ ค่ายังอยู่
- เปลี่ยน type จาก timer → text → timerDuration/timerUnit ถูก reset

- [ ] **Step 5: Commit**

```bash
git add src/pages/ParameterSettings.tsx
git commit -m "feat(parameters): add timer duration+unit UI and preview"
```

---

### Task 6: QC Testing — TimerField component (idle + running + done)

**Files:**
- Create: `src/components/lis/TimerField.tsx`
- Modify: `src/pages/QCTestingDetailPage.tsx`

แยก TimerField เป็นไฟล์ใหม่เพื่อให้ logic state machine + audio + interval อยู่ในที่เดียว, แล้ว QCTestingDetailPage แค่ render มัน

- [ ] **Step 1: Create TimerField component**

สร้าง `src/components/lis/TimerField.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Play, RotateCcw, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ParameterValueField } from "@/lib/api";
import { timerDurationMs, timerRemainingMs, isTimerDone } from "@/lib/parameterValidation";

interface TimerFieldProps {
  field: ParameterValueField;
  value: unknown;
  onChange: (val: unknown) => void;
}

const UNIT_LABEL: Record<string, string> = {
  minute: "นาที", hour: "ชั่วโมง", day: "วัน", month: "เดือน",
};

function formatRemaining(ms: number): string {
  if (ms < 60_000) return `${Math.ceil(ms / 1000)}s`;
  if (ms < 3_600_000) {
    const m = Math.floor(ms / 60_000);
    const s = Math.floor((ms % 60_000) / 1000);
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  if (ms < 86_400_000) {
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return `${h}h ${m}m`;
  }
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  return `${d}d ${h}h`;
}

function formatTotal(field: ParameterValueField): string {
  if (!field.timerDuration || !field.timerUnit) return "";
  return `${field.timerDuration} ${UNIT_LABEL[field.timerUnit] ?? field.timerUnit}`;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

export function TimerField({ field, value, onChange }: TimerFieldProps) {
  const startedAt = typeof value === "string" && value ? value : null;
  const duration = timerDurationMs(field);

  if (!duration) {
    return (
      <p className="text-xs text-amber-700">
        พารามิเตอร์นี้ยังไม่ได้กำหนดระยะเวลา — กรุณาตั้งค่าใน Parameter Settings
      </p>
    );
  }

  if (!startedAt) {
    return (
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          onClick={() => onChange(new Date().toISOString())}
          className="h-8"
          type="button"
        >
          <Play className="h-3.5 w-3.5 mr-1" />
          เริ่มจับเวลา
        </Button>
        <span className="text-xs text-grey-500">
          ระยะเวลา {formatTotal(field)}
        </span>
      </div>
    );
  }

  if (isTimerDone(field, startedAt)) {
    return (
      <TimerDone
        field={field}
        startedAt={startedAt}
        onReset={() => onChange(null)}
      />
    );
  }

  return (
    <TimerRunning
      field={field}
      startedAt={startedAt}
      onReset={() => onChange(null)}
    />
  );
}

function TimerRunning({
  field, startedAt, onReset,
}: { field: ParameterValueField; startedAt: string; onReset: () => void }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const isLong = field.timerUnit === "day" || field.timerUnit === "month";
    const intervalMs = isLong ? 60_000 : 1000;
    const id = window.setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [field.timerUnit]);

  const remainingNow = timerRemainingMs(field, startedAt) ?? 0;
  const total = timerDurationMs(field) ?? 0;
  const pct = total > 0 ? Math.max(0, Math.min(100, ((total - remainingNow) / total) * 100)) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        <span className="text-sm font-mono">
          เหลือ {formatRemaining(remainingNow)} / {formatTotal(field)}
        </span>
        <Button size="sm" variant="outline" onClick={onReset} className="h-7" type="button">
          <RotateCcw className="h-3 w-3 mr-1" />
          รีเซ็ต
        </Button>
      </div>
      <div className="h-1.5 bg-grey-200 rounded overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function TimerDone({
  field, startedAt, onReset,
}: { field: ParameterValueField; startedAt: string; onReset: () => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [soundPlaying, setSoundPlaying] = useState(true);
  const endedAt = new Date(new Date(startedAt).getTime() + (timerDurationMs(field) ?? 0));

  useEffect(() => {
    if (!soundPlaying) return;
    const url = `${import.meta.env.BASE_URL}sound/timer-done.mp3`;
    const audio = new Audio(url);
    audio.loop = true;
    audioRef.current = audio;
    audio.play().catch(() => {
      const fallback = new Audio(`${import.meta.env.BASE_URL}sound/new.mp3`);
      fallback.loop = true;
      audioRef.current = fallback;
      fallback.play().catch(() => {/* autoplay blocked */});
    });
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
    };
  }, [soundPlaying]);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5",
        "bg-emerald-50 border-emerald-200",
      )}
    >
      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
      <span className="text-sm font-medium text-emerald-900">
        เสร็จเมื่อ {formatTime(endedAt)}
      </span>
      {soundPlaying && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setSoundPlaying(false)}
          className="h-7"
          type="button"
        >
          <VolumeX className="h-3 w-3 mr-1" />
          หยุดเสียง
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        onClick={onReset}
        className="h-7"
        type="button"
      >
        <RotateCcw className="h-3 w-3 mr-1" />
        เริ่มใหม่
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Use TimerField in QCTestingDetailPage**

แก้ `src/pages/QCTestingDetailPage.tsx` — เพิ่ม import:

```ts
import { TimerField } from "@/components/lis/TimerField";
```

แล้วใน `TestField` function — แทนการ render Input สำหรับ timer ด้วย TimerField. หา block:

```tsx
      {field.type === 'enum' ? (
```

(ที่เริ่มของ render input block) — เพิ่ม branch ใหม่สำหรับ timer ก่อน enum:

```tsx
      {field.type === 'timer' ? (
        <TimerField field={field} value={value} onChange={onChange} />
      ) : field.type === 'enum' ? (
        <Select value={strVal || '__none__'} onValueChange={(v) => onChange(v === '__none__' ? '' : v)}>
```

(ส่วน else chain เดิมยังคงเดิม — แค่ใส่ timer branch ขึ้นก่อน enum)

- [ ] **Step 3: Remove timer from numeric Input type check**

แก้ `src/pages/QCTestingDetailPage.tsx` ใน Input ของ TestField — ตอนนี้มี `field.type === 'timer'` ใน type checker แต่ timer จะไปใช้ TimerField แทน ดังนั้นลบ `timer` ออกจาก `field.type === 'timer'` ใน Input branch:

หาบรรทัด:
```tsx
          type={field.type === 'number' || field.type === 'float' || field.type === 'timer' ? 'number' : 'text'}
```

แทนด้วย:
```tsx
          type={field.type === 'number' || field.type === 'float' ? 'number' : 'text'}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 5: Manual smoke test**

(ถ้า dev server ไม่ได้รัน: `npm run dev`)

1. สร้าง parameter ที่มี field timer 1 นาที (จาก Task 5)
2. เข้า QC Testing detail ของ sample ที่ใช้ parameter นั้น
3. ปรากฏปุ่ม "เริ่มจับเวลา" + label "ระยะเวลา 1 นาที"
4. กด "เริ่มจับเวลา" → countdown ปรากฏ "เหลือ 1:00" + progress bar เริ่มขยับ
5. รอ 60 วินาที (หรือ console: เปลี่ยน duration เป็นทดสอบ) → เปลี่ยนเป็น state "เสร็จเมื่อ HH:MM" + เสียงดัง loop
6. กด "หยุดเสียง" → เสียงหยุด, ยังอยู่ state done
7. กด "เริ่มใหม่" → กลับมา state idle (ปุ่มเริ่มจับเวลา)
8. ทดสอบ refresh ระหว่าง running → countdown resume ต่อ
9. ทดสอบ refresh หลังครบเวลา → state done + เสียงดังอีกครั้ง (พฤติกรรมตามที่ตกลง)

ถ้ายังไม่มีไฟล์ `public/sound/timer-done.mp3` → fallback ไป `sound/new.mp3` อัตโนมัติ

- [ ] **Step 6: Commit**

```bash
git add src/components/lis/TimerField.tsx src/pages/QCTestingDetailPage.tsx
git commit -m "feat(qc-testing): add TimerField component with countdown and sound alert"
```

---

### Task 7: Sound asset — placeholder/fallback note

**Files:**
- N/A (documentation step)

- [ ] **Step 1: Verify fallback works without timer-done.mp3**

ทดสอบจาก Task 6 step 5 ข้อ 5 — ถ้าไม่มีไฟล์ `timer-done.mp3` ที่ `public/sound/` (หรือ `sound/` ตาม structure project) → audio.play() จะ reject → catch ไป fallback `new.mp3` ที่มีอยู่

Browser DevTools Console จะเห็น 404 สำหรับ `timer-done.mp3` แต่ไม่มี crash — สังเกตว่าเสียง `new.mp3` ดังขึ้นแทน

- [ ] **Step 2: Add note in README or repo for user**

ไม่ต้องสร้างไฟล์ใหม่ — ใส่ note ใน commit message ของ Task 6 ไปแล้ว ถ้า user อยากใช้เสียง dedicated สำหรับ timer ให้วางไฟล์ที่ `sound/timer-done.mp3` (path เดียวกับ `sound/new.mp3`)

(skip ถ้าไม่ต้องมีเอกสาร — เป็น optional task)

---

### Task 8: Regression check

**Files:**
- N/A (run existing checks)

- [ ] **Step 1: Run vitest suite**

Run: `npm run test`
Expected: ทุก test PASS (รวม timer helpers ใหม่)

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: ไม่มี new error/warning จากไฟล์ที่แก้ (`TimerField.tsx`, `QCTestingDetailPage.tsx`, `ParameterSettings.tsx`, `api.ts`, `parameterValidation.ts`)

หมายเหตุ: lint errors เดิม (เช่น `(field as any).min/max` ที่ QCTestingDetailPage line 158-159) ข้ามได้ — ไม่เกี่ยวกับงานนี้

- [ ] **Step 3: Update e2e snapshot ถ้ากระทบ**

ถ้า `tests/e2e/qc-testing.spec.ts` มี snapshot ที่กระทบกับการเปลี่ยน UI ของ timer field:

Run: `npx playwright test tests/e2e/qc-testing.spec.ts`

ถ้า fail เพราะ snapshot (ไม่ใช่ logic regression): `npx playwright test tests/e2e/qc-testing.spec.ts --update-snapshots`

Commit ถ้ามี snapshot update:

```bash
git add tests/e2e/
git commit -m "test(qc-testing): update snapshots for timer field"
```

ถ้าไม่มี snapshot กระทบ — ข้าม

---

## Self-Review

**Spec coverage:**
- ✓ Schema `timerDuration` + `timerUnit` → Task 1 (backend) + Task 2 (frontend)
- ✓ TimerUnit type → Task 2
- ✓ Backend pre-validate (timer requires both fields, duration > 0) → Task 1 step 2
- ✓ Frontend validate() → Task 4 step 3
- ✓ Timer block UI + TimerPreview → Task 5
- ✓ Cleanup on type change → Task 4 step 2
- ✓ TimerField component 3 states → Task 6 step 1
- ✓ TimerIdle (start button) → Task 6 step 1 (inline in TimerField)
- ✓ TimerRunning (countdown + progress + reset) → Task 6 step 1
- ✓ TimerDone (sound loop + acknowledge + restart) → Task 6 step 1
- ✓ Stored value = ISO string startedAt → Task 6 step 1 (onChange contract)
- ✓ Helpers `timerDurationMs/timerRemainingMs/isTimerDone` → Task 3
- ✓ Sound file path + fallback → Task 6 step 1 (TimerDone) + Task 7 docs
- ✓ Unit tests with fake timers → Task 3 step 1
- ✓ Backward compat (no duration → warning text) → Task 6 step 1 first guard
- ✓ Persistence (refresh resume) → relies on existing save flow; covered in manual test Task 6 step 5

**Placeholder scan:** ไม่มี TBD/TODO. All code shown explicitly. ทุก step มี exact commands.

**Type consistency:**
- `TimerUnit` consistent ทุกที่ (Task 2, 3, 4, 5, 6)
- `timerDurationMs(field)` / `timerRemainingMs(field, startedAt)` / `isTimerDone(field, startedAt)` signatures ตรงระหว่าง declaration (Task 3) กับ usage (Task 6)
- Backend enum strings `'minute' | 'hour' | 'day' | 'month'` ตรงกับ TypeScript union
- `startedAt` ที่เก็บใน `value` เป็น ISO string — TimerField เช็คด้วย `typeof value === "string"`
- TimerField file path `src/components/lis/TimerField.tsx` ใช้ alias `@/components/lis/TimerField` → ใน QCTestingDetailPage import ถูกต้อง
