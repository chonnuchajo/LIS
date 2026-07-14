# Petition Timeline — Estimate Time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เปลี่ยน Metric "End time" ในหน้า Petition Timeline เป็น "Estimate Time" ที่คำนวณเวลาคาดการณ์ผลออกจาก standard time (Lab) และจำนวน parameter (QC)

**Architecture:** เพิ่มโมดูล pure `src/lib/petitionEstimate.ts` (เลขคณิตเวลาทำการ + กติกาคาดการณ์) แล้วให้ `buildTimelineDetailModel()` ใน `src/lib/petitionTimelineDetail.ts` เรียกใช้แทนตรรกะ `buildHeaderTiming()` เดิม จากนั้น `PetitionTimelineDetailPage.tsx` แสดงผลตาม `endKind` ใหม่ ทุกอย่างคำนวณฝั่ง client จากข้อมูลที่ API ส่งมาอยู่แล้ว — **ไม่แตะ backend**

**Tech Stack:** TypeScript, React 18, Vitest

Spec: `docs/superpowers/specs/2026-07-14-petition-estimate-time-design.md`

## Global Constraints

- เวลาทำการ **08:00–17:00** (9 ชม./วัน) — ค่าคงที่เดิมชื่อ `WORK_START_HOUR` / `WORK_END_HOUR` ใน `petitionTimelineDetail.ts`
- วันทำงาน **จันทร์–เสาร์** — ข้ามเฉพาะ **วันอาทิตย์** (`Date.getDay() === 0`)
- ไม่รองรับวันหยุดนักขัตฤกษ์
- QC: 1 task = 1 parameter × 1 ตัวอย่าง = **60 นาที**
- Lab: เครื่องที่ไม่มี `estimatedMinutes` = **240 นาที**; หลายเครื่องเอา **max** (ไม่ใช่ผลรวม)
- ฟังก์ชันทั้งหมดใน `petitionEstimate.ts` ต้อง **pure** และรับ `now`/`Date` เป็นพารามิเตอร์ (ห้ามเรียก `Date.now()` ข้างใน)
- เทสต์ทั้งหมดใช้ local time (`new Date(2026, 6, 13, 10)`) ไม่ใช่ UTC string — ปฏิทินอ้างอิง: **13 ก.ค. 2026 = จันทร์**, 18 ก.ค. = เสาร์, 19 ก.ค. = อาทิตย์
- คำสั่งเทสต์: `npm run test -- <path>` (Vitest run-once)
- type-check: `npx tsc -p tsconfig.app.json --noEmit` (`npx tsc --noEmit` เฉย ๆ เป็น no-op) — repo มี latent error เดิมอยู่ ~12 ตัว ให้ดูเฉพาะไฟล์ที่แตะ
- **ห้ามรัน `npm run build`** (postbuild rewrite ไฟล์ root แล้วทำ dev server พัง)

## File Structure

| ไฟล์ | หน้าที่ |
|---|---|
| `src/lib/petitionEstimate.ts` (ใหม่) | เลขคณิตเวลาทำการ + กติกาคาดการณ์ — pure ทั้งไฟล์ |
| `src/lib/petitionEstimate.test.ts` (ใหม่) | เทสต์ของโมดูลข้างบน |
| `src/lib/petitionTimelineDetail.ts` (แก้) | `TimelineDetailHeader` type, `buildHeaderTiming()`, ปลายแกนเวลา |
| `src/lib/petitionTimelineDetail.test.ts` (แก้) | อัปเดตเทสต์ที่ยืนยันพฤติกรรม `endAt` แบบเดิม |
| `src/pages/PetitionTimelineDetailPage.tsx` (แก้) | Metric label/value/hint |

---

### Task 1: เลขคณิตเวลาทำการ (`addWorkingMinutes`, `endOfNextWorkingDay`)

**Files:**
- Create: `src/lib/petitionEstimate.ts`
- Test: `src/lib/petitionEstimate.test.ts`

**Interfaces:**
- Consumes: ไม่มี (โมดูลแรก)
- Produces:
  ```ts
  export const WORK_START_HOUR = 8;
  export const WORK_END_HOUR = 17;
  export function addWorkingMinutes(from: Date, minutes: number): Date;
  export function endOfNextWorkingDay(from: Date): Date;
  ```

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `src/lib/petitionEstimate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { addWorkingMinutes, endOfNextWorkingDay } from "./petitionEstimate";

// ปฏิทินอ้างอิง: 13 ก.ค. 2026 = จันทร์, 18 ก.ค. = เสาร์, 19 ก.ค. = อาทิตย์
const at = (day: number, hour: number, minute = 0) => new Date(2026, 6, day, hour, minute);

describe("addWorkingMinutes", () => {
  it("บวกภายในวันเดียวกันเมื่อเวลายังเหลือพอ", () => {
    expect(addWorkingMinutes(at(13, 9), 120)).toEqual(at(13, 11));
  });

  it("ข้ามไปวันทำการถัดไปเมื่อเวลาไม่พอ (16:00 + 3 ชม. -> 10:00 วันถัดไป)", () => {
    expect(addWorkingMinutes(at(13, 16), 180)).toEqual(at(14, 10));
  });

  it("เริ่มก่อนเวลางาน ให้ดันไป 08:00 ของวันเดียวกันก่อน", () => {
    expect(addWorkingMinutes(at(13, 6, 30), 60)).toEqual(at(13, 9));
  });

  it("เริ่มหลังเลิกงาน ให้ดันไป 08:00 ของวันถัดไปก่อน", () => {
    expect(addWorkingMinutes(at(13, 19, 14), 60)).toEqual(at(14, 9));
  });

  it("เสาร์เป็นวันทำงานปกติ", () => {
    expect(addWorkingMinutes(at(18, 9), 60)).toEqual(at(18, 10));
  });

  it("ข้ามวันอาทิตย์ (เสาร์ 16:00 + 2 ชม. -> จันทร์ 09:00)", () => {
    expect(addWorkingMinutes(at(18, 16), 120)).toEqual(at(20, 9));
  });

  it("เริ่มวันอาทิตย์ ให้ดันไป 08:00 วันจันทร์ก่อน", () => {
    expect(addWorkingMinutes(at(19, 10), 60)).toEqual(at(20, 9));
  });

  it("ข้ามหลายวัน (9 ชม./วัน)", () => {
    // 08:00 จันทร์ + 20 ชม. = 9 (จ.) + 9 (อ.) + 2 -> พุธ 10:00
    expect(addWorkingMinutes(at(13, 8), 20 * 60)).toEqual(at(15, 10));
  });

  it("นาที <= 0 คืนเวลาหลังดันเข้าหน้าต่างทำงานแล้ว", () => {
    expect(addWorkingMinutes(at(13, 6), 0)).toEqual(at(13, 8));
    expect(addWorkingMinutes(at(13, 10), -30)).toEqual(at(13, 10));
  });

  it("ไม่แก้ค่า Date ที่รับเข้ามา", () => {
    const input = at(13, 9);
    addWorkingMinutes(input, 120);
    expect(input).toEqual(at(13, 9));
  });
});

describe("endOfNextWorkingDay", () => {
  it("คืน 17:00 ของวันทำการถัดไป", () => {
    expect(endOfNextWorkingDay(at(13, 10, 15))).toEqual(at(14, 17));
  });

  it("จากวันศุกร์ไปวันเสาร์ (เสาร์ทำงาน)", () => {
    expect(endOfNextWorkingDay(at(17, 10))).toEqual(at(18, 17));
  });

  it("จากวันเสาร์ ข้ามอาทิตย์ไปจันทร์", () => {
    expect(endOfNextWorkingDay(at(18, 10))).toEqual(at(20, 17));
  });

  it("จากวันอาทิตย์ ไปจันทร์", () => {
    expect(endOfNextWorkingDay(at(19, 10))).toEqual(at(20, 17));
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่า fail**

```bash
npm run test -- src/lib/petitionEstimate.test.ts
```

Expected: FAIL — `Failed to resolve import "./petitionEstimate"`

- [ ] **Step 3: เขียน implementation**

สร้าง `src/lib/petitionEstimate.ts`:

```ts
export const WORK_START_HOUR = 8;
export const WORK_END_HOUR = 17;

// วันอาทิตย์ (getDay() === 0) เป็นวันหยุดวันเดียว — เสาร์ทำงานปกติ
function isWorkingDay(value: Date): boolean {
  return value.getDay() !== 0;
}

function atHour(value: Date, hour: number): Date {
  const result = new Date(value);
  result.setHours(hour, 0, 0, 0);
  return result;
}

function startOfNextWorkingDay(value: Date): Date {
  const result = atHour(value, WORK_START_HOUR);
  do {
    result.setDate(result.getDate() + 1);
  } while (!isWorkingDay(result));
  return result;
}

// ดันเวลาเข้าหน้าต่างทำงาน 08:00-17:00 ของวันทำการ (ไม่ขยับถ้าอยู่ในช่วงอยู่แล้ว)
function clampToWorkingWindow(value: Date): Date {
  if (!isWorkingDay(value)) return startOfNextWorkingDay(value);
  const dayStart = atHour(value, WORK_START_HOUR);
  const dayEnd = atHour(value, WORK_END_HOUR);
  if (value.getTime() < dayStart.getTime()) return dayStart;
  if (value.getTime() >= dayEnd.getTime()) return startOfNextWorkingDay(value);
  return new Date(value);
}

export function addWorkingMinutes(from: Date, minutes: number): Date {
  let cursor = clampToWorkingWindow(from);
  let remaining = Math.max(0, Math.round(minutes));
  while (remaining > 0) {
    const dayEnd = atHour(cursor, WORK_END_HOUR);
    const availableMinutes = Math.round((dayEnd.getTime() - cursor.getTime()) / 60000);
    if (remaining <= availableMinutes) {
      cursor = new Date(cursor.getTime() + remaining * 60000);
      remaining = 0;
    } else {
      remaining -= availableMinutes;
      cursor = startOfNextWorkingDay(cursor);
    }
  }
  return cursor;
}

export function endOfNextWorkingDay(from: Date): Date {
  return atHour(startOfNextWorkingDay(from), WORK_END_HOUR);
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

```bash
npm run test -- src/lib/petitionEstimate.test.ts
```

Expected: PASS ทั้ง 13 เคส

- [ ] **Step 5: Commit**

```bash
git add src/lib/petitionEstimate.ts src/lib/petitionEstimate.test.ts
git commit -m "feat(timeline): เพิ่มเลขคณิตเวลาทำการสำหรับ Estimate Time"
```

---

### Task 2: กติกาคาดการณ์ (`estimatePetitionEnd`)

**Files:**
- Modify: `src/lib/petitionEstimate.ts`
- Test: `src/lib/petitionEstimate.test.ts`

**Interfaces:**
- Consumes: `addWorkingMinutes(from: Date, minutes: number): Date`, `endOfNextWorkingDay(from: Date): Date` (Task 1)
- Produces:
  ```ts
  export const LAB_DEFAULT_MINUTES = 240;
  export const QC_MINUTES_PER_TASK = 60;
  export type PetitionEstimate = { at: string; kind: "unreceived" | "estimated" };
  export function estimatePetitionEnd(input: {
    petition: Petition;
    qcTaskCount: number;
    now: Date;
  }): PetitionEstimate;
  ```
  `at` เป็น ISO string (`Date.toISOString()`)

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

ต่อท้าย `src/lib/petitionEstimate.test.ts` (เพิ่ม import `estimatePetitionEnd` และ type `Petition`):

```ts
import type { Petition } from "@/types/petition.types";

function petition(overrides: Partial<Petition> = {}): Petition {
  return {
    _id: "petition-1",
    petitionNo: "P-2607-001",
    dept: "production",
    status: "inProgress",
    submittedBy: { name: "Requester", submittedAt: at(13, 9).toISOString() },
    items: [{ seq: 1, sampleName: "Sample A", batchNo: "BATCH-002", sampleId: "sample-1" }],
    createdAt: at(13, 9).toISOString(),
    updatedAt: at(13, 9).toISOString(),
    ...overrides,
  } as Petition;
}

// batchNo ลงท้าย 1 หรือ 6 = คำขอมีฝั่ง Lab (hasLabTrack)
const labItem = { seq: 1, sampleName: "Sample A", batchNo: "BATCH-001", sampleId: "sample-1" };

describe("estimatePetitionEnd", () => {
  it("ยังไม่รับงานทั้งสองฝั่ง -> unreceived + 17:00 ของวันทำการถัดไปจากเวลายื่นคำขอ", () => {
    const result = estimatePetitionEnd({ petition: petition(), qcTaskCount: 3, now: at(13, 12) });

    expect(result.kind).toBe("unreceived");
    expect(result.at).toBe(at(14, 17).toISOString());
  });

  it("ยังไม่รับงาน แต่มีเวลาส่งตัวอย่าง -> นับจากเวลาส่งตัวอย่าง", () => {
    const result = estimatePetitionEnd({
      petition: petition({ sampleSentAt: at(15, 9).toISOString() }),
      qcTaskCount: 3,
      now: at(15, 12),
    });

    expect(result.at).toBe(at(16, 17).toISOString());
  });

  it("QC รับงานแล้ว -> เวลารับ + (จำนวน task x 60 นาที)", () => {
    const result = estimatePetitionEnd({
      petition: petition({ qcReceivedAt: at(13, 9).toISOString() }),
      qcTaskCount: 3,
      now: at(13, 10),
    });

    expect(result.kind).toBe("estimated");
    expect(result.at).toBe(at(13, 12).toISOString());
  });

  it("ใช้ receivedAt เป็น fallback ของ qcReceivedAt", () => {
    const result = estimatePetitionEnd({
      petition: petition({ receivedAt: at(13, 9).toISOString() }),
      qcTaskCount: 2,
      now: at(13, 10),
    });

    expect(result.at).toBe(at(13, 11).toISOString());
  });

  it("Lab รับงานแล้ว -> เวลารับ + standard time ของเครื่องที่นานที่สุด", () => {
    const result = estimatePetitionEnd({
      petition: petition({
        items: [labItem],
        labReceivedAt: at(13, 9).toISOString(),
        assignedMachines: [
          { machineId: "m1", code: "GC-01", name: "GC 1", estimatedMinutes: 90 },
          { machineId: "m2", code: "GC-02", name: "GC 2", estimatedMinutes: 300 },
        ],
      }),
      qcTaskCount: 0,
      now: at(13, 10),
    });

    // 09:00 + 300 นาที = 14:00 (ไม่ใช่ผลรวม 390 นาที)
    expect(result.at).toBe(at(13, 14).toISOString());
  });

  it("เครื่องที่ไม่มี standard time นับเป็น 240 นาที", () => {
    const result = estimatePetitionEnd({
      petition: petition({
        items: [labItem],
        labReceivedAt: at(13, 9).toISOString(),
        assignedMachines: [{ machineId: "m1", code: "HPLC-01", name: "HPLC 1" }],
      }),
      qcTaskCount: 0,
      now: at(13, 10),
    });

    expect(result.at).toBe(at(13, 13).toISOString());
  });

  it("Lab รับงานแล้วแต่ไม่มีเครื่อง -> 240 นาที", () => {
    const result = estimatePetitionEnd({
      petition: petition({ items: [labItem], labReceivedAt: at(13, 9).toISOString() }),
      qcTaskCount: 0,
      now: at(13, 10),
    });

    expect(result.at).toBe(at(13, 13).toISOString());
  });

  it("รับครบสองฝั่ง -> เอาฝั่งที่นานที่สุด", () => {
    const result = estimatePetitionEnd({
      petition: petition({
        items: [labItem],
        qcReceivedAt: at(13, 9).toISOString(),
        labReceivedAt: at(13, 9).toISOString(),
        assignedMachines: [{ machineId: "m1", code: "GC-01", name: "GC 1", estimatedMinutes: 60 }],
      }),
      qcTaskCount: 4, // QC = 4 ชม. -> 13:00 ; Lab = 1 ชม. -> 10:00
      now: at(13, 10),
    });

    expect(result.at).toBe(at(13, 13).toISOString());
  });

  it("QC รับแล้วแต่ Lab ยังไม่รับ -> คิดจาก QC ฝั่งเดียว (ไม่เดาฝั่งที่ยังไม่รับ)", () => {
    const result = estimatePetitionEnd({
      petition: petition({
        items: [labItem],
        qcReceivedAt: at(13, 9).toISOString(),
        assignedMachines: [{ machineId: "m1", code: "GC-01", name: "GC 1", estimatedMinutes: 600 }],
      }),
      qcTaskCount: 1,
      now: at(13, 10),
    });

    expect(result.kind).toBe("estimated");
    expect(result.at).toBe(at(13, 10).toISOString());
  });

  it("รับงานแล้วแต่ไม่มี parameter และไม่มีฝั่ง Lab -> 17:00 ของวันทำการถัดไปจากเวลารับงาน", () => {
    const result = estimatePetitionEnd({
      petition: petition({ qcReceivedAt: at(13, 10, 15).toISOString() }),
      qcTaskCount: 0,
      now: at(13, 12),
    });

    expect(result.kind).toBe("estimated");
    expect(result.at).toBe(at(14, 17).toISOString());
  });

  it("รับงานนอกเวลาทำการ -> ดันไปเริ่ม 08:00 วันถัดไปก่อนบวก", () => {
    const result = estimatePetitionEnd({
      petition: petition({ qcReceivedAt: at(13, 19, 14).toISOString() }),
      qcTaskCount: 2,
      now: at(13, 19, 30),
    });

    expect(result.at).toBe(at(14, 10).toISOString());
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่า fail**

```bash
npm run test -- src/lib/petitionEstimate.test.ts
```

Expected: FAIL — `estimatePetitionEnd is not a function` / import error

- [ ] **Step 3: เขียน implementation**

ต่อท้าย `src/lib/petitionEstimate.ts`:

```ts
import { hasLabTrack } from "@/lib/statusBadge";
import type { Petition } from "@/types/petition.types";

export const LAB_DEFAULT_MINUTES = 240;
export const QC_MINUTES_PER_TASK = 60;

export type PetitionEstimate = { at: string; kind: "unreceived" | "estimated" };

function validDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// เครื่องรันคู่ขนานกันได้ -> เอาเครื่องที่นานที่สุด ไม่ใช่ผลรวม
function labMinutes(petition: Petition): number {
  const machines = petition.assignedMachines ?? [];
  if (machines.length === 0) return LAB_DEFAULT_MINUTES;
  return Math.max(...machines.map((machine) => {
    const minutes = Number(machine.estimatedMinutes);
    return Number.isFinite(minutes) && minutes > 0 ? minutes : LAB_DEFAULT_MINUTES;
  }));
}

export function estimatePetitionEnd(input: { petition: Petition; qcTaskCount: number; now: Date }): PetitionEstimate {
  const { petition } = input;
  const qcReceivedAt = validDate(petition.qcReceivedAt) ?? validDate(petition.receivedAt);
  const labReceivedAt = validDate(petition.labReceivedAt);

  if (!qcReceivedAt && !labReceivedAt) {
    const anchor = validDate(petition.sampleSentAt)
      ?? validDate(petition.submittedBy?.submittedAt)
      ?? validDate(petition.createdAt)
      ?? input.now;
    return { at: endOfNextWorkingDay(anchor).toISOString(), kind: "unreceived" };
  }

  // คิดเฉพาะฝั่งที่รับงานแล้วจริง — ฝั่งที่ยังไม่รับ ไม่ต้องเดา
  const candidates: Date[] = [];
  if (qcReceivedAt && input.qcTaskCount > 0) {
    candidates.push(addWorkingMinutes(qcReceivedAt, input.qcTaskCount * QC_MINUTES_PER_TASK));
  }
  if (labReceivedAt && hasLabTrack(petition)) {
    candidates.push(addWorkingMinutes(labReceivedAt, labMinutes(petition)));
  }

  if (candidates.length === 0) {
    const receivedAt = [qcReceivedAt, labReceivedAt].filter((date): date is Date => !!date)
      .reduce((earliest, date) => (date.getTime() < earliest.getTime() ? date : earliest));
    return { at: endOfNextWorkingDay(receivedAt).toISOString(), kind: "estimated" };
  }

  const latest = new Date(Math.max(...candidates.map((date) => date.getTime())));
  return { at: latest.toISOString(), kind: "estimated" };
}
```

> `import` ต้องอยู่บนสุดของไฟล์ (ย้ายไปรวมกับ import เดิม ถ้ามี)
> ถ้า `Petition["assignedMachines"]` ยังไม่มี field `estimatedMinutes` ใน `src/types/petition.types.ts` ให้เพิ่ม `estimatedMinutes?: number;` (backend ส่งมาแล้วจาก `matchStandardTime()`)

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

```bash
npm run test -- src/lib/petitionEstimate.test.ts
```

Expected: PASS ทั้งหมด (13 เคสจาก Task 1 + 11 เคสใหม่)

- [ ] **Step 5: Commit**

```bash
git add src/lib/petitionEstimate.ts src/lib/petitionEstimate.test.ts src/types/petition.types.ts
git commit -m "feat(timeline): กติกาคำนวณเวลาคาดการณ์ผลออกของคำขอ"
```

---

### Task 3: ต่อเข้า timeline model (header + ปลายแกน)

**Files:**
- Modify: `src/lib/petitionTimelineDetail.ts`
- Test: `src/lib/petitionTimelineDetail.test.ts`

**Interfaces:**
- Consumes: `estimatePetitionEnd({ petition, qcTaskCount, now })` → `{ at: string; kind: "unreceived" | "estimated" }` (Task 2)
- Produces:
  ```ts
  export type TimelineDetailHeader = {
    startAt: string;
    startKind: "received" | "submitted";
    endAt: string;
    endKind: "actual" | "estimated" | "unreceived";
    overdue: boolean;
  };
  ```

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

แก้ 3 เคสเดิมใน `src/lib/petitionTimelineDetail.test.ts` (เคสอื่นไม่ต้องแตะ) — **แทนที่** เคสที่ชื่อ:
- `"uses the first received timestamp and a same-day 17:00 estimate for open work"`
- `"คำร้องที่รับตัวอย่างนอกเวลาทำการ (19:14): ..."`
- `"uses the current time and daily boundaries for open work that crosses dates"`

ด้วยเคสใหม่ข้างล่างนี้ (วางไว้ตำแหน่งเดิม):

```ts
  it("รับตัวอย่างแล้วแต่ยังไม่มี parameter/Lab -> คาดการณ์ 17:00 ของวันทำการถัดไป", () => {
    const result = model(petition({ qcReceivedAt: at(13, 10, 15) }), [], [], [], new Date(2026, 6, 13, 12));

    expect(result.header.startAt).toBe(at(13, 10, 15));
    expect(result.header.endAt).toBe(at(14, 17));
    expect(result.header.endKind).toBe("estimated");
    expect(result.header.overdue).toBe(false);
    expect(result.timeline.endAt).toBe(at(14, 17));
    expect(result.timeline.days.map((day) => day.label)).toEqual(["13 ก.ค.", "14 ก.ค."]);
  });

  it("ยังไม่รับตัวอย่าง -> endKind = unreceived", () => {
    const result = model(petition(), [requiredParameter], [], [], new Date(2026, 6, 13, 12));

    expect(result.header.endKind).toBe("unreceived");
    expect(result.header.endAt).toBe(at(14, 17));
  });

  it("QC รับตัวอย่างแล้ว -> คาดการณ์จากจำนวน task (1 task = 1 ชม.)", () => {
    // requiredParameter x 1 ตัวอย่าง = 1 task -> 10:00 + 1 ชม. = 11:00
    const result = model(
      petition({ qcReceivedAt: at(13, 10) }),
      [requiredParameter],
      [],
      [],
      new Date(2026, 6, 13, 10, 30),
    );

    expect(result.header.endAt).toBe(at(13, 11));
    expect(result.header.endKind).toBe("estimated");
  });

  it("งานเลยเวลาคาดการณ์ -> overdue = true และแกนเวลาลากถึงตอนนี้", () => {
    const now = new Date(2026, 6, 13, 15);
    const result = model(petition({ qcReceivedAt: at(13, 10) }), [requiredParameter], [], [], now);

    expect(result.header.endAt).toBe(at(13, 11));
    expect(result.header.overdue).toBe(true);
    // แท่งที่ยังทำอยู่ลากถึง now — แกนต้องไม่จบก่อน now ไม่งั้นแท่งทะลุขอบ
    expect(result.timeline.endAt).toBe(now.toISOString());
  });

  it("คำร้องที่รับตัวอย่างนอกเวลาทำการ (19:14): เวลาคาดการณ์ต้องไม่ย้อนไปก่อนเวลาเริ่ม", () => {
    const now = new Date(2026, 6, 13, 19, 30);
    const result = model(petition({ qcReceivedAt: at(13, 19, 14) }), [requiredParameter], [], [], now);

    expect(result.header.startAt).toBe(at(13, 19, 14));
    // ดันไป 08:00 วันถัดไปก่อน แล้วบวก 1 ชม.
    expect(result.header.endAt).toBe(at(14, 9));
    expect(new Date(result.header.endAt).getTime()).toBeGreaterThanOrEqual(new Date(result.header.startAt).getTime());
  });
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่า fail**

```bash
npm run test -- src/lib/petitionTimelineDetail.test.ts
```

Expected: FAIL — เคสใหม่พังหมด (`endAt` ยังเป็นค่าเดิม, `overdue` เป็น `undefined`)

- [ ] **Step 3: เขียน implementation**

ใน `src/lib/petitionTimelineDetail.ts`:

**3.1** เพิ่ม import บนสุด:

```ts
import { estimatePetitionEnd } from "@/lib/petitionEstimate";
```

**3.2** แก้ type `TimelineDetailHeader` (บรรทัด ~47):

```ts
export type TimelineDetailHeader = {
  startAt: string;
  startKind: "received" | "submitted";
  endAt: string;
  endKind: "actual" | "estimated" | "unreceived";
  overdue: boolean;
};
```

**3.3** แทนที่ `buildHeaderTiming()` ทั้งฟังก์ชัน (บรรทัด ~129-141) ด้วย:

```ts
function buildHeaderTiming(
  petition: Petition,
  startAt: string,
  actualEndAt: string | null,
  qcTaskCount: number,
  now: Date,
): TimelineDetailHeader {
  if (actualEndAt && FINISHED_STATUSES.has(petition.status)) {
    return { startAt, startKind: "received", endAt: actualEndAt, endKind: "actual", overdue: false };
  }
  const estimate = estimatePetitionEnd({ petition, qcTaskCount, now });
  return {
    startAt,
    startKind: "received",
    endAt: estimate.at,
    endKind: estimate.kind,
    overdue: estimate.kind === "estimated" && new Date(estimate.at).getTime() < now.getTime(),
  };
}
```

> `atHour` / `isSameLocalDay` / `WORK_END_HOUR` อาจกลายเป็น unused หลังแก้ — เช็คก่อนลบ (`atHour` ยังใช้ที่อื่น เช่น `timeline.startAt`)

**3.4** ใน `buildTimelineDetailModel()` — ย้ายการเรียก `buildRequiredTasks()` ขึ้นมา **ก่อน** `buildHeaderTiming()` แล้วส่ง `allTasks.length` เข้าไป และคำนวณปลายแกนแยกจาก `header.endAt`:

```ts
  const allTasks = buildRequiredTasks(input.petition, input.parameters, input.progressEntries, input.itemGroupIds);
  const header = buildHeaderTiming(input.petition, startAt, actualEndAt, allTasks.length, now);
  // คำขอที่ปิดแล้วจบแกนที่เวลาจริง; ที่ยังเปิดอยู่ต้องลากอย่างน้อยถึง now (แท่ง in-progress ลากถึง now)
  const timelineEndAt = header.endKind === "actual"
    ? header.endAt
    : latestValidDate(header.endAt, now.toISOString())!;
```

แล้วเปลี่ยนบล็อก `timeline` ให้ใช้ `timelineEndAt`:

```ts
    timeline: {
      startAt: atHour(new Date(timelineStartAt), WORK_START_HOUR).toISOString(),
      endAt: timelineEndAt,
      ticks: buildTicks(timelineStartAt, timelineEndAt),
      rows,
      days: buildTimelineDays(timelineStartAt, timelineEndAt, rows, now),
    },
```

(ลบบรรทัด `const allTasks = ...` เดิมที่อยู่หลัง `buildHeaderTiming` ออก — อย่าให้เรียกซ้ำ)

- [ ] **Step 4: รันเทสต์ทั้งไฟล์ให้ผ่าน**

```bash
npm run test -- src/lib/petitionTimelineDetail.test.ts
```

Expected: PASS ทั้งไฟล์ (เคส `"expands a same-day completed timeline after 17:00"` และ `"splits multi-day timelines into local day windows"` ต้องยังผ่านเหมือนเดิม — ถ้าไม่ผ่านแปลว่า clamp ผิด)

- [ ] **Step 5: type-check**

```bash
npx tsc -p tsconfig.app.json --noEmit
```

Expected: ไม่มี error ใหม่จาก `petitionEstimate.ts` / `petitionTimelineDetail.ts` (repo มี latent error เดิมอยู่แล้ว — เทียบกับ `git stash` ถ้าไม่แน่ใจ)

- [ ] **Step 6: Commit**

```bash
git add src/lib/petitionTimelineDetail.ts src/lib/petitionTimelineDetail.test.ts
git commit -m "feat(timeline): header ใช้เวลาคาดการณ์แทน End time เดิม"
```

---

### Task 4: UI — Metric "Estimate Time"

**Files:**
- Modify: `src/pages/PetitionTimelineDetailPage.tsx`

**Interfaces:**
- Consumes: `model.header.endAt`, `model.header.endKind` (`"actual" | "estimated" | "unreceived"`), `model.header.overdue` (Task 3)
- Produces: ไม่มี (ปลายทาง)

- [ ] **Step 1: แก้ Metric**

หา `<Metric label="End time" ...>` (อยู่ในบล็อก `grid gap-4 sm:grid-cols-2 xl:grid-cols-5` ถัดจาก Metric ของ Start time) แล้วแทนที่ทั้งบรรทัดด้วย:

```tsx
          <Metric {...estimateMetric(model.header)} />
```

แล้วเพิ่มฟังก์ชันช่วยไว้ข้าง ๆ component `Metric` (ราว ๆ บรรทัด 162):

```tsx
function estimateMetric(header: TimelineDetailModel["header"]): { label: string; value: string; hint: string } {
  if (header.endKind === "actual") {
    return { label: "End time", value: formatDateTime(header.endAt), hint: "เวลาจริง" };
  }
  if (header.endKind === "unreceived") {
    return { label: "Estimate Time", value: "คาดว่าผลจะออก 1-2 วัน", hint: "ยังไม่รับงาน" };
  }
  return {
    label: "Estimate Time",
    value: formatDateTime(header.endAt),
    hint: header.overdue ? "เลยกำหนด" : "ค่าประมาณ",
  };
}
```

> ต้อง import type `TimelineDetailModel` จาก `@/lib/petitionTimelineDetail` ถ้ายังไม่ได้ import

- [ ] **Step 2: type-check**

```bash
npx tsc -p tsconfig.app.json --noEmit
```

Expected: ไม่มี error ใหม่จาก `PetitionTimelineDetailPage.tsx`

- [ ] **Step 3: รันเทสต์ทั้งชุด**

```bash
npm run test
```

Expected: PASS ทั้งหมด (ไม่มี regression)

- [ ] **Step 4: ตรวจของจริงในเบราว์เซอร์**

รัน backend (`cd server && npm run dev`) + frontend (`npm run dev`) แล้วเปิด `/LIS/petition-timeline` → เลือกคำขอ

ตรวจ 3 เคส:
1. คำขอที่ยังไม่รับตัวอย่าง → Metric แสดง `Estimate Time` / `คาดว่าผลจะออก 1-2 วัน` / `ยังไม่รับงาน`
2. คำขอที่กำลังทำอยู่ → `Estimate Time` เป็นวัน-เวลา + hint `ค่าประมาณ` (หรือ `เลยกำหนด`)
3. คำขอที่ปิดแล้ว → `End time` + `เวลาจริง` และกราฟไม่ถูกลากมาถึงวันนี้

- [ ] **Step 5: Commit**

```bash
git add src/pages/PetitionTimelineDetailPage.tsx
git commit -m "feat(timeline): แสดง Estimate Time แทน End time"
```

---

## Verification

- [ ] `npm run test` ผ่านทั้งชุด
- [ ] `npx tsc -p tsconfig.app.json --noEmit` ไม่มี error ใหม่
- [ ] `npm run lint` ไม่มี error ใหม่
- [ ] ตรวจในเบราว์เซอร์ครบ 3 เคสตาม Task 4 Step 4
