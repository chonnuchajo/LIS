# Timer Compound Input — Design

**Date:** 2026-05-23
**Status:** Approved
**Scope:** Refactor timer field ใน ParameterSettings ให้รับค่าแบบ compound (วัน:ชั่วโมง:นาที:วินาที ฯลฯ)

## Problem

ใน feature timer parameter ที่เพิ่ง implement ([2026-05-23-timer-parameter-design](2026-05-23-timer-parameter-design.md)):
- ใส่ระยะเวลาได้แค่ค่าเดียว + เลือกหน่วยอย่างเดียว เช่น "12 ชั่วโมง"
- **กรอก "12 ชั่วโมง 30 นาที 45 วินาที" ไม่ได้** — ต้องแปลงเป็น 12.5 ชั่วโมง หรือใช้นาทีแทน (750 นาที) ซึ่งไม่ intuitive

User ต้องการให้ ตามหน่วยที่เลือก แสดงช่องย่อยลงมาให้ครบ:
- หน่วย = นาที → `[นาที] : [วิ]`
- หน่วย = ชั่วโมง → `[ชม] : [นาที] : [วิ]`
- หน่วย = วัน → `[วัน] : [ชม] : [นาที] : [วิ]`
- หน่วย = เดือน → `[เดือน] : [วัน] : [ชม] : [นาที] : [วิ]`

## Goals

- เปลี่ยน storage จาก `timerDuration + timerUnit` → `timerDurationSec` (วินาที) + `timerUnit` (input layout)
- UI compound input หลายช่อง ตาม `timerUnit`
- Preview text "1 ชม 30 นาที 45 วินาที (5,445 วินาที)"
- Helper functions แปลง parts ↔ seconds + format human-readable
- QC Testing display ใช้ format ใหม่ — countdown logic เดิม (ms-based) ไม่ต้องแก้
- ลด field เก่า `timerDuration` ออก (refactor — ไม่ใช่ migrate เพราะยังไม่ deploy)

## Non-Goals

- ไม่ทำ smart parser (เช่น user พิมพ์ "1h30m" แล้ว parse) — ใช้ multi-box เท่านั้น
- ไม่ cap ค่าสูงสุดต่อช่อง (ใส่ minute=90 ก็ได้ — รวมเป็น 1h30m)
- ไม่เปลี่ยน countdown / sound logic ใน TimerField — ใช้ ms อยู่แล้ว
- ไม่ทำ migration หรือ backward-compat สำหรับ data เก่า — feature timer เพิ่ง implement และยังไม่ push สู่ origin/main; ข้อมูลที่อาจมีใน DB ของ dev = 0-2 records ผู้ใช้ recreate ได้

## Schema Change

### Frontend ([src/lib/api.ts](../../../src/lib/api.ts))

**ลบ:**
```ts
timerDuration?: number | null;
```

**เพิ่ม:**
```ts
timerDurationSec?: number | null;
```

`TimerUnit` คงเดิม

### Backend ([server/models/Parameter.js](../../../server/models/Parameter.js))

**ลบ field:** `timerDuration: { type: Number, default: null }`
**เพิ่ม field:** `timerDurationSec: { type: Number, default: null }`

**pre-validate เปลี่ยน:**
```js
if (f.type === 'timer') {
  if (f.timerDurationSec == null || f.timerDurationSec <= 0) {
    return next(new Error(`ช่อง "${f.label}": ต้องระบุระยะเวลา > 0`));
  }
  if (!f.timerUnit) {
    return next(new Error(`ช่อง "${f.label}": ต้องระบุหน่วยเวลา`));
  }
}
```

## Helpers

ไฟล์ [src/lib/parameterValidation.ts](../../../src/lib/parameterValidation.ts):

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

// แตก sec → parts ตามลำดับจากใหญ่ไปเล็ก เริ่มที่ระดับ "unit" หรือใหญ่กว่า
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
  // minute level ทุก unit (รวม minute เอง)
  out.minutes = Math.floor(remaining / SEC_PER_MINUTE);
  out.seconds = remaining % SEC_PER_MINUTE;
  return out;
}

// "1 ชม 30 นาที 45 วินาที" — skip 0 ยกเว้น sec=0 ทั้งหมด → "0 วินาที"
export function formatTimerHuman(sec: number): string { ... }
```

Update `timerDurationMs`:
```ts
export function timerDurationMs(field: ParameterValueField): number | null {
  if (field.type !== "timer") return null;
  if (!field.timerDurationSec || field.timerDurationSec <= 0) return null;
  return field.timerDurationSec * 1000;
}
```

(เอา `timerUnit` ออกจาก check เพราะ duration อยู่ใน sec แล้ว — แต่ยังเช็คให้ unit มีอยู่ใน validate() เพื่อให้ UI ทำงานถูก)

## UI: ParameterSettings

ไฟล์ [src/pages/ParameterSettings.tsx](../../../src/pages/ParameterSettings.tsx)

แทนช่อง "ระยะเวลา *" Input เดี่ยว ด้วย component ใหม่ `<TimerDurationInput>`:

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

### TimerDurationInput component (local ใน ParameterSettings.tsx หรือไฟล์ใหม่ใน components/lis)

```tsx
function TimerDurationInput({
  unit, sec, onChange,
}: {
  unit: TimerUnit | undefined;
  sec: number;
  onChange: (newSec: number) => void;
}) {
  if (!unit) {
    return <p className="text-xs text-muted-foreground">เลือก "หน่วย" ก่อน</p>;
  }
  const parts = secToParts(sec, unit);
  const fields = pickPartsForUnit(unit);  // ลำดับ keys ที่จะแสดง
  return (
    <div className="flex items-center gap-1">
      {fields.map((key, i) => (
        <Fragment key={key}>
          {i > 0 && <span className="text-grey-400">:</span>}
          <div className="flex flex-col items-center">
            <Input
              type="number"
              min={0}
              value={parts[key] ?? 0}
              onChange={(e) => {
                const next = { ...parts, [key]: Number(e.target.value) || 0 };
                onChange(partsToSec(next));
              }}
              className="h-10 w-20 text-center"
            />
            <span className="text-[10px] text-grey-500 mt-0.5">
              {PART_LABEL[key]}
            </span>
          </div>
        </Fragment>
      ))}
    </div>
  );
}

function pickPartsForUnit(unit: TimerUnit): Array<keyof TimerParts> {
  switch (unit) {
    case "minute": return ["minutes", "seconds"];
    case "hour": return ["hours", "minutes", "seconds"];
    case "day": return ["days", "hours", "minutes", "seconds"];
    case "month": return ["months", "days", "hours", "minutes", "seconds"];
  }
}

const PART_LABEL: Record<keyof TimerParts, string> = {
  months: "เดือน", days: "วัน", hours: "ชม", minutes: "นาที", seconds: "วิ",
};
```

### TimerPreview component update

```tsx
function TimerPreview({ field }: { field: ParameterValueField }) {
  if (!field.timerDurationSec || field.timerDurationSec <= 0 || !field.timerUnit) {
    return <p className="text-xs text-muted-foreground">ยังไม่ได้กำหนดระยะเวลา</p>;
  }
  return (
    <p className="text-xs text-emerald-700">
      จับเวลา: {formatTimerHuman(field.timerDurationSec)} ({field.timerDurationSec.toLocaleString()} วินาที)
    </p>
  );
}
```

### emptyValueField

เปลี่ยน:
```ts
timerDuration: null,  // ลบ
timerDurationSec: null,  // เพิ่ม
timerUnit: undefined,
```

### Type-change reset

```ts
timerDurationSec: v === "timer" ? field.timerDurationSec ?? null : null,
timerUnit: v === "timer" ? field.timerUnit : undefined,
```

### Unit-change

เมื่อ user เปลี่ยน timerUnit (เช่น จาก hour → day):
- ค่า `timerDurationSec` คงเดิม (เช่น 5445 sec)
- UI แค่ render breakdown ตาม unit ใหม่ (5445 sec ตอน day → 0d 1h 30m 45s)

### Validation

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

## UI: QC Testing

ไฟล์ [src/pages/QCTestingDetailPage.tsx](../../../src/pages/QCTestingDetailPage.tsx) / [src/components/lis/TimerField.tsx](../../../src/components/lis/TimerField.tsx)

### Idle state

แทน `formatTotal(field)` เดิมด้วย `formatTimerHuman(field.timerDurationSec)`:

```tsx
<span className="text-xs text-grey-500">
  ระยะเวลา {formatTimerHuman(field.timerDurationSec ?? 0)}
</span>
```

### Running state

`formatTotal()` แสดงหลัง `/` → ใช้ `formatTimerHuman` แทน:
```tsx
<span className="text-sm font-mono">
  เหลือ {formatRemaining(remainingNow)} / {formatTimerHuman(field.timerDurationSec ?? 0)}
</span>
```

### Done state

ยังคงใช้ `endedAt = startedAt + timerDurationMs(field)` เดิม — ไม่ต้องแก้

`formatRemaining(ms)` เดิมยังคงใช้ได้ — รับ ms เหมือนเดิม

### countdown interval

เดิมเลือก interval 1s หรือ 60s ตาม unit:
```ts
const isLong = field.timerUnit === "day" || field.timerUnit === "month";
const intervalMs = isLong ? 60_000 : 1000;
```

คงเดิม — logic ไม่กระทบ

## Migration

**ไม่ทำ** — feature นี้ยังไม่ push, dev DB อาจมี record ไม่กี่ตัว ผู้ใช้ recreate ได้. Backend pre-validate ที่บังคับ `timerDurationSec` จะทำให้ document เก่าที่มีแต่ `timerDuration` save ไม่ผ่าน — user ต้องไปแก้ใน UI ก่อน

## Testing

### Unit tests (`src/lib/parameterValidation.test.ts`)

เพิ่ม describe blocks:

#### `partsToSec`
- empty parts → 0
- only seconds → seconds
- mixed: months=1, days=2, hours=3, minutes=4, seconds=5 → 1*2592000 + 2*86400 + 3*3600 + 4*60 + 5 = 2,776,805
- undefined fields treated as 0

#### `secToParts`
- 0 sec + unit=hour → { hours: 0, minutes: 0, seconds: 0 }
- 5445 sec + unit=hour → { hours: 1, minutes: 30, seconds: 45 }
- 90 sec + unit=minute → { minutes: 1, seconds: 30 }
- 90061 sec + unit=day → { days: 1, hours: 1, minutes: 1, seconds: 1 }
- 2592000 sec + unit=month → { months: 1, days: 0, hours: 0, minutes: 0, seconds: 0 }
- negative → clamp to 0
- fractional → floor

#### `formatTimerHuman`
- 0 → "0 วินาที"
- 60 → "1 นาที"
- 3661 → "1 ชม 1 นาที 1 วินาที"
- 90061 → "1 วัน 1 ชม 1 นาที 1 วินาที"
- 30 days in sec → "1 เดือน"
- skip 0 parts: 3600 → "1 ชม" (ไม่ "1 ชม 0 นาที 0 วินาที")

#### Update existing `timerDurationMs` tests
- เปลี่ยนจาก `timerDuration: 30, timerUnit: "minute"` → `timerDurationSec: 1800`
- expected ms ยังเดิม (1_800_000)
- ลบ test ที่เกี่ยวกับ unit conversion เพราะ logic ย้ายไป partsToSec

### Manual / E2E

- ParameterSettings:
  - เลือก type=timer, unit=hour → ปรากฏ 3 ช่อง (ชม/นาที/วิ) เป็น 0
  - กรอก 1:30:45 → preview: "จับเวลา: 1 ชม 30 นาที 45 วินาที (5,445 วินาที)"
  - บันทึก → refresh → เปิดใหม่ ค่าครบ
  - เปลี่ยน unit hour → day → 3 ช่อง กลายเป็น 4 ช่อง, ค่า redistributed (0d 1h 30m 45s)
  - เปลี่ยน unit hour → minute → 2 ช่อง, ค่า redistributed (90m 45s)
- QC Testing:
  - parameter "1 ชม 30 นาที 45 วิ" → idle: "ระยะเวลา 1 ชม 30 นาที 45 วินาที"
  - กดเริ่ม → running: "เหลือ 1:30:45 / 1 ชม 30 นาที 45 วินาที" (อาจเป็น h:m แสดง)

## Edge cases

| Case | Behavior |
|---|---|
| ทุกช่อง = 0 | timerDurationSec = 0 → save fail validation |
| minute > 59 ในช่อง minute | accept (90 minute → รวมเป็น 1h 30m เมื่อ display crackdown ใหม่) |
| user เปลี่ยน unit หลังกรอกค่า | ค่า sec คงเดิม, UI redistribute parts |
| Refresh ขณะ unit=day แต่ value=5445 sec | secToParts(5445, "day") = { days: 0, hours: 1, minutes: 30, seconds: 45 } |
| Backward compat data เก่า (มีแค่ timerDuration) | UI จะแสดง 0 หมด, user ต้องกรอกใหม่; save fail ถ้ายังไม่กรอก |

## Open Questions

ไม่มี — design ครบจาก image ที่ user แสดง
