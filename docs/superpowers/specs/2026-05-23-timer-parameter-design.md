# Timer Parameter — Design

**Date:** 2026-05-23
**Status:** Approved
**Scope:** ParameterSettings + QC Testing สำหรับ timer parameter type

## Problem

ฟิลด์ชนิด `timer` มีอยู่ใน type union แล้ว แต่:
- **ParameterSettings** ไม่มีช่องให้กรอกระยะเวลาที่ต้องจับ — schema ไม่มี `timerDuration`/`timerUnit`
- **QC Testing** render เป็น `<Input type="number">` เปล่าๆ — user ต้องกรอกตัวเลขเอง ไม่มี countdown ไม่มีเสียงแจ้งเตือน

ความต้องการ:
1. ใน ParameterSettings ตั้งระยะเวลา (จำนวน + หน่วย: นาที/ชั่วโมง/วัน/เดือน) ต่อ field
2. ใน QC Testing มีปุ่ม "เริ่มจับเวลา" → countdown แสดง remaining → ครบเวลาแล้วเล่นเสียงเตือน (loop) + แสดงปุ่มหยุดเสียง

## Goals

- เพิ่ม `timerDuration` + `timerUnit` บน `ParameterValueField` (number, TimerUnit)
- UI ใน ParameterSettings: ช่องจำนวน + dropdown หน่วย + preview text
- UI ใน QC Testing: 3 states (ยังไม่เริ่ม / กำลังนับ / เสร็จ) พร้อม countdown + sound
- Sound loop จนกว่า user จะกด "หยุดเสียง" (in-session)
- Persistence: `startedAt` ISO timestamp เก็บเป็นค่าของ field — refresh แล้วยัง resume ได้
- Backward compat: field timer เก่าที่ไม่มี duration/unit → แสดงข้อความเตือน ไม่มีปุ่มเริ่ม

## Non-Goals

- ไม่ทำ pause/resume — มีแค่ reset (กดแล้วเริ่มใหม่จาก 0)
- ไม่มี cross-tab/cross-device notification — เสียงดังเฉพาะหน้าที่เปิดอยู่ตอนครบเวลา
- ไม่ใช้ Service Worker / Web Push สำหรับ background notification (long timer หลายวันถ้าปิด tab → ไม่ได้รับเสียง แค่ขึ้น state เสร็จเมื่อกลับมาเปิด)
- ไม่คำนวณตามปฏิทินจริงสำหรับ "เดือน" — ใช้ 30 วัน fix (keep simple)
- ไม่ track ว่าใครกดเริ่ม / ใครรับทราบ — เก็บแค่ `startedAt`
- ไม่ผูกกับ abnormal detection (timer ไม่มีค่ามาตรฐาน)

## Schema Change

### Frontend ([src/lib/api.ts](../../../src/lib/api.ts))

```ts
export type TimerUnit = "minute" | "hour" | "day" | "month";

export type ParameterValueField = {
  // ...existing fields
  timerDuration?: number | null;
  timerUnit?: TimerUnit;
};
```

### Backend ([server/models/Parameter.js](../../../server/models/Parameter.js))

ใน `ValueFieldSchema` เพิ่ม:

```js
timerDuration: { type: Number, default: null },
timerUnit: {
  type: String,
  enum: ['minute', 'hour', 'day', 'month', null],
  default: null,
},
```

ใน `ParameterSchema.pre('validate')` เพิ่ม:

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

## Duration → Milliseconds

```ts
const UNIT_TO_MS: Record<TimerUnit, number> = {
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,  // 30 days (simplified)
};
```

## UI: ParameterSettings

ไฟล์ [src/pages/ParameterSettings.tsx](../../../src/pages/ParameterSettings.tsx) — `ValueFieldEditor`

### Block ใหม่: render เมื่อ `field.type === "timer"`

วางขนาน `requiresUnit` block และ `isEnum` block:

```
ระยะเวลา *  | หน่วย *
[30]        | [นาที ▼]
```

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
          onValueChange={(v) => onChange({ ...field, timerUnit: v as TimerUnit })}
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

### TimerPreview component

```tsx
function TimerPreview({ field }: { field: ParameterValueField }) {
  if (!field.timerDuration || !field.timerUnit) {
    return (
      <p className="text-xs text-muted-foreground">
        ยังไม่ได้กำหนดระยะเวลา
      </p>
    );
  }
  const unitLabels: Record<TimerUnit, string> = {
    minute: "นาที", hour: "ชั่วโมง", day: "วัน", month: "เดือน",
  };
  return (
    <p className="text-xs text-emerald-700">
      จับเวลา: {field.timerDuration} {unitLabels[field.timerUnit]}
    </p>
  );
}
```

### Cleanup เมื่อเปลี่ยน type

ใน Select onValueChange ของ field type — reset 2 fields นี้เมื่อไม่ใช่ timer:

```ts
timerDuration: v === "timer" ? field.timerDuration ?? null : null,
timerUnit: v === "timer" ? field.timerUnit : undefined,
```

### Validation

ใน `validate()` function เพิ่ม block:

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

### emptyValueField

เพิ่ม defaults:

```ts
timerDuration: null,
timerUnit: undefined,
```

## Stored Value Shape

ใน QC result `values[fieldLabel]` สำหรับ timer field เก็บเป็น **ISO string** (หรือ `null`/`undefined`):

```ts
values[fieldLabel] = "2026-05-23T15:30:00.000Z";  // startedAt
// หรือ
values[fieldLabel] = null;  // ยังไม่เริ่ม / reset แล้ว
```

เหตุผลที่ใช้ string แทน object: backward compat กับ shape เดิม (`unknown`) — ไม่ต้องแก้ schema ของ QCTestResult, การคำนวณ `startedAt + duration = endAt` ทำ on-the-fly จาก parameter

## UI: QC Testing

ไฟล์ [src/pages/QCTestingDetailPage.tsx](../../../src/pages/QCTestingDetailPage.tsx) — `TestField`

แทน Input ปัจจุบันสำหรับ `field.type === 'timer'` ด้วย component ใหม่ `<TimerField>`:

### TimerField — 3 states

```tsx
function TimerField({
  field, value, onChange, saveInfo,
}: TimerFieldProps) {
  const startedAt = typeof value === 'string' && value ? value : null;
  const duration = timerDurationMs(field);

  // missing config
  if (!duration) {
    return (
      <p className="text-xs text-amber-700">
        พารามิเตอร์นี้ยังไม่ได้กำหนดระยะเวลา — กรุณาตั้งค่าใน Parameter Settings
      </p>
    );
  }

  if (!startedAt) {
    return <TimerIdle field={field} onStart={() => onChange(new Date().toISOString())} />;
  }

  const remaining = timerRemainingMs(field, startedAt);
  if (remaining == null || remaining <= 0) {
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
      remaining={remaining}
      onReset={() => onChange(null)}
    />
  );
}
```

### State 1 — TimerIdle

```tsx
function TimerIdle({ field, onStart }: ...) {
  return (
    <div className="flex items-center gap-3">
      <Button size="sm" onClick={onStart} className="h-8">
        <Play className="h-3.5 w-3.5 mr-1" />
        เริ่มจับเวลา
      </Button>
      <span className="text-xs text-grey-500">
        ระยะเวลา {field.timerDuration} {unitLabel(field.timerUnit)}
      </span>
    </div>
  );
}
```

### State 2 — TimerRunning (countdown + reset)

```tsx
function TimerRunning({ field, startedAt, remaining, onReset }: ...) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    // tick interval: 1s for minute/hour, 60s for day/month
    const intervalMs = field.timerUnit === 'day' || field.timerUnit === 'month' ? 60000 : 1000;
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [field.timerUnit]);
  // recompute on each tick
  const remainingNow = timerRemainingMs(field, startedAt) ?? 0;
  const total = timerDurationMs(field) ?? 0;
  const pct = total > 0 ? Math.max(0, Math.min(100, ((total - remainingNow) / total) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        <span className="text-sm font-mono">
          เหลือ {formatRemaining(remainingNow)} / {formatTotal(field)}
        </span>
        <Button size="sm" variant="outline" onClick={onReset} className="h-7">
          ↻ รีเซ็ต
        </Button>
      </div>
      <div className="h-1.5 bg-grey-200 rounded overflow-hidden">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
```

**Format helpers:**

```ts
function formatRemaining(ms: number): string {
  if (ms < 60_000) return `${Math.ceil(ms / 1000)}s`;
  if (ms < 3600_000) {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  if (ms < 86400_000) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  }
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  return `${d}d ${h}h`;
}
```

### State 3 — TimerDone (sound + acknowledge)

```tsx
function TimerDone({ field, startedAt, onReset }: ...) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [soundPlaying, setSoundPlaying] = useState(true);
  const endedAt = new Date(new Date(startedAt).getTime() + (timerDurationMs(field) ?? 0));

  // play loop on mount, stop on unmount or on user ack
  useEffect(() => {
    if (!soundPlaying) return;
    const audio = new Audio(`${import.meta.env.BASE_URL}sound/timer-done.mp3`);
    audio.loop = true;
    audioRef.current = audio;
    audio.play().catch(() => {
      // fallback to existing new.mp3
      const fallback = new Audio(`${import.meta.env.BASE_URL}sound/new.mp3`);
      fallback.loop = true;
      audioRef.current = fallback;
      fallback.play().catch(() => {/* autoplay blocked or no sound files */});
    });
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
    };
  }, [soundPlaying]);

  const stopSound = () => setSoundPlaying(false);

  return (
    <div className="flex items-center gap-3 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-1">
      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
      <span className="text-sm font-medium text-emerald-900">
        เสร็จเมื่อ {formatTime(endedAt)}
      </span>
      {soundPlaying && (
        <Button size="sm" variant="outline" onClick={stopSound} className="h-7">
          🔕 หยุดเสียง
        </Button>
      )}
      <Button size="sm" variant="outline" onClick={onReset} className="h-7">
        ↻ เริ่มใหม่
      </Button>
    </div>
  );
}
```

### Save behavior

- เมื่อกด "เริ่มจับเวลา" / "รีเซ็ต" / "เริ่มใหม่" → call `onChange(newValue)` ซึ่ง trigger save (debounced เหมือน field อื่น)
- `startedAt` เก็บใน DB ผ่าน QC result save flow ที่มีอยู่
- รีเฟรช browser หรือ login ใหม่ → load `startedAt` กลับมา → คำนวณ remaining → resume state

## Helper Functions

ไฟล์ [src/lib/parameterValidation.ts](../../../src/lib/parameterValidation.ts) (ไฟล์ที่มีอยู่):

```ts
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
  const remaining = timerRemainingMs(field, startedAtIso);
  return remaining != null && remaining <= 0 && !!startedAtIso;
}
```

## Sound File

- เพิ่มไฟล์ `public/sound/timer-done.mp3` (ถ้า project มี folder `sound/` ที่ root อยู่แล้ว — ใช้ตำแหน่งนั้น)
- **ผู้ใช้ต้องวางไฟล์เอง** — implementation จะ point ไปที่ path นี้, ถ้าโหลดไม่ได้ fallback ไป `new.mp3` (มีอยู่แล้ว) automatic
- ใน plan จะมี step เตือนให้ user ดรอปไฟล์, ถ้ายังไม่มีก็ยัง work (fallback)

## Migration

ไม่ต้อง — fields optional ใน schema. Legacy timer fields (ไม่มี duration/unit) → แสดงข้อความ "ยังไม่ได้กำหนดระยะเวลา" + ไม่มีปุ่มเริ่ม (state แสดง warning)

## Testing

### Unit tests (`src/lib/parameterValidation.test.ts`)

- `timerDurationMs`:
  - type ≠ timer → null
  - duration = 0 / null → null
  - unit = undefined → null
  - 30 minute → 1_800_000
  - 2 hour → 7_200_000
  - 1 day → 86_400_000
  - 1 month → 2_592_000_000 (30 days)
- `timerRemainingMs`:
  - startedAt = null → return full duration
  - startedAt = 5 minutes ago, duration = 30 min → ~25 min remaining (allow small drift)
  - startedAt = 31 minutes ago, duration = 30 min → 0
  - startedAt = invalid → null
- `isTimerDone`:
  - startedAt = null → false (ยังไม่เริ่ม)
  - startedAt = 1 hour ago, duration = 30 min → true
  - startedAt = 5 min ago, duration = 30 min → false

ใช้ `vi.useFakeTimers()` หรือ mock `Date.now()` สำหรับ tests ที่ขึ้นกับเวลาปัจจุบัน

### Manual

- ParameterSettings: สร้าง field timer 1 นาที → บันทึก → เปิดใหม่ ค่ายังอยู่
- เปลี่ยน type จาก timer → text — duration/unit ถูก reset
- บันทึก timer field ที่ไม่ครบ → error message ปรากฏ
- QC Testing: กดเริ่ม → countdown 1 นาที → ครบ → เสียงดัง loop → กด "หยุดเสียง" → เสียงหยุด, state ยังคงเสร็จ → กด "เริ่มใหม่" → กลับ idle
- รีเฟรช browser ขณะ running → resume countdown ถูกต้อง
- รีเฟรชหลังครบเวลา → แสดง state done (ไม่เล่นเสียงเพราะ component mount แล้วเข้า state done ทันที — เล่นเสียงในการ mount นั้น). Note: เพื่อความสม่ำเสมอ จะเล่นเสียงทุกครั้งที่ TimerDone mount with soundPlaying=true; ถ้าไม่อยากให้รีเฟรชแล้วยังดัง อาจ short-circuit ด้วย session flag (out of scope ตอนนี้ — keep simple)

## Edge cases & decisions

| Case | Behavior | Reason |
|---|---|---|
| Tab ปิด ระหว่าง running | resume ตอนเปิดใหม่ ถ้ายังไม่ครบ | startedAt persisted ใน DB |
| Tab ปิด หลังครบเวลา | เปิดใหม่ → state done, **เล่นเสียง** | mount = first entry → loop start |
| User ไม่ขยับเมาส์/คลิกเลย browser block autoplay | catch error → ลอง fallback file → ยัง block → silent | UX degrade gracefully |
| สอง timer ในหน้าเดียวกันครบพร้อมกัน | เล่นเสียงทั้งสอง (overlap) | YAGNI — แต่ละ field มี audio instance อิสระ |
| Duration = 0 หรือ negative | validation block ตอน save | บังคับใน validate() + pre-validate |
| user ลบ field timer ที่กำลังนับอยู่ | ค่าใน DB หาย, state reset เมื่อ render ครั้งต่อไป | อาศัย flow เดิมของ ParameterSettings |

## Open Questions

ไม่มี — design ตอบครบจาก 3 คำถามรอบก่อน
