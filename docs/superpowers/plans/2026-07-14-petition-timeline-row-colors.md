# Petition Timeline — สีประจำแถว (9 สี) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้ทุกแถวของกราฟ Petition Timeline (5 จุด milestone + 4 แท่ง) มีสีประจำตัวไม่ซ้ำกัน โดยยังสื่อสถานะ ยังไม่เริ่ม/กำลังทำ/เสร็จ ได้เหมือนเดิม

**Architecture:** ย้ายการเลือกสีจาก `barTrackClass(track, done)` (สีตามสายงาน 3 สี) ไปเป็น pure module ใหม่ `src/lib/petitionTimelineColors.ts` ที่ map `row.key` → คู่สี `{ solid, soft }` เป็น class literal ครบทั้ง 9 แถว หน้า `PetitionTimelineDetailPage.tsx` เรียกฟังก์ชันนี้ทั้งจุด milestone และแท่ง โมเดล `petitionTimelineDetail.ts` ไม่แตะเลย (ฟิลด์ `track` คงไว้)

**Tech Stack:** React 18 + TypeScript + Tailwind + Vitest + Testing Library

Spec: `docs/superpowers/specs/2026-07-14-petition-timeline-row-colors-design.md`

## Global Constraints

- `tailwind.config.ts` override `red` / `green` / `yellow` ให้เหลือแค่เฉด `50` และ `500` → **ห้ามใช้** `red-200`, `green-200`, `yellow-200` (ไม่มีอยู่จริง) ใช้ `emerald` / `amber` แทน `green` / `yellow` และใช้ `red-500` เฉพาะจุดที่ไม่ต้องการเฉดอ่อน
- Tailwind JIT scan class จาก source แบบ literal → ชื่อ class ต้องเขียนเต็มเป็น string ห้ามประกอบด้วย template string / concat
- เทสต์รันด้วย `npx vitest run <path>` (ไม่ใช้ `npm run build`)
- Type-check จริงของ repo คือ `npx tsc -p tsconfig.app.json --noEmit` (repo มี latent error เดิมอยู่ ~12 จุด — ดูแค่ว่าไม่มี error ใหม่จากไฟล์ที่แตะ)
- ตารางสีอ้างอิง (ตาม spec):

| row.key | label | solid | soft |
|---------|-------|-------|------|
| `submitted` | ยื่นคำขอ | `bg-violet-500` | `bg-violet-200` |
| `sample-sent` | ส่งตัวอย่าง | `bg-orange-500` | `bg-orange-200` |
| `received-qc` | QC รับตัวอย่าง | `bg-sky-500` | `bg-sky-200` |
| `assigned` | มอบหมายงาน Lab | `bg-rose-500` | `bg-rose-200` |
| `received-lab` | Lab รับตัวอย่าง | `bg-lime-600` | `bg-lime-200` |
| `qc-analyzing` | QC กำลังวิเคราะห์ | `bg-primary-500` | `bg-primary-200` |
| `lab-analyzing` | Lab กำลังวิเคราะห์ | `bg-amber-500` | `bg-amber-200` |
| `pre-result` | Pre Result | `bg-cyan-500` | `bg-cyan-200` |
| `final` | Final Result | `bg-emerald-500` | `bg-emerald-200` |

ข้อยกเว้น: `final` + คำร้องถูก reject → `bg-red-500`
Fallback key ที่ไม่รู้จัก → solid `bg-grey-400` / soft `bg-grey-200`
จุด milestone ที่ยังไม่ถึง → `bg-grey-300` (ทุก key)

---

### Task 1: โมดูลสีประจำแถว (pure)

**Files:**
- Create: `src/lib/petitionTimelineColors.ts`
- Test: `src/lib/petitionTimelineColors.test.ts`

**Interfaces:**
- Consumes: ไม่มี (โมดูลอิสระ ไม่ import อะไรจากโปรเจกต์)
- Produces:
  - `export type TimelineRowColorState = { done: boolean; rejected?: boolean }`
  - `export function timelineDotClass(rowKey: string, state: TimelineRowColorState): string`
  - `export function timelineBarClass(rowKey: string, state: TimelineRowColorState): string`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `src/lib/petitionTimelineColors.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { timelineBarClass, timelineDotClass } from "@/lib/petitionTimelineColors";

const ROW_KEYS = [
  "submitted",
  "sample-sent",
  "received-qc",
  "assigned",
  "received-lab",
  "qc-analyzing",
  "lab-analyzing",
  "pre-result",
  "final",
];

describe("petitionTimelineColors", () => {
  it("ทุกแถวที่เสร็จแล้วได้สีไม่ซ้ำกันเลย", () => {
    const solids = ROW_KEYS.map((key) => timelineBarClass(key, { done: true }));
    expect(new Set(solids).size).toBe(ROW_KEYS.length);
  });

  it("จุด milestone ที่ยังไม่ถึงเป็นสีเทาทุกแถว", () => {
    for (const key of ROW_KEYS) {
      expect(timelineDotClass(key, { done: false })).toBe("bg-grey-300");
    }
  });

  it("จุด milestone ที่ถึงแล้วใช้สีประจำแถว", () => {
    expect(timelineDotClass("submitted", { done: true })).toBe("bg-violet-500");
    expect(timelineDotClass("sample-sent", { done: true })).toBe("bg-orange-500");
    expect(timelineDotClass("received-qc", { done: true })).toBe("bg-sky-500");
    expect(timelineDotClass("assigned", { done: true })).toBe("bg-rose-500");
    expect(timelineDotClass("received-lab", { done: true })).toBe("bg-lime-600");
  });

  it("แท่งที่กำลังทำอยู่ใช้เฉดอ่อนของสีประจำแถว", () => {
    expect(timelineBarClass("qc-analyzing", { done: false })).toBe("bg-primary-200");
    expect(timelineBarClass("lab-analyzing", { done: false })).toBe("bg-amber-200");
  });

  it("แท่งที่เสร็จแล้วใช้เฉดเข้มของสีประจำแถว", () => {
    expect(timelineBarClass("qc-analyzing", { done: true })).toBe("bg-primary-500");
    expect(timelineBarClass("lab-analyzing", { done: true })).toBe("bg-amber-500");
    expect(timelineBarClass("pre-result", { done: true })).toBe("bg-cyan-500");
    expect(timelineBarClass("final", { done: true })).toBe("bg-emerald-500");
  });

  it("Pre Result ไม่ใช้สีเดียวกับ Lab กำลังวิเคราะห์อีกต่อไป", () => {
    expect(timelineBarClass("pre-result", { done: true })).not.toBe(timelineBarClass("lab-analyzing", { done: true }));
  });

  it("แถว final ของคำร้องที่ถูกส่งกลับแก้ไขเป็นสีแดง", () => {
    expect(timelineBarClass("final", { done: true, rejected: true })).toBe("bg-red-500");
  });

  it("rejected ไม่กระทบแถวอื่น", () => {
    expect(timelineBarClass("qc-analyzing", { done: true, rejected: true })).toBe("bg-primary-500");
  });

  it("key ที่ไม่รู้จักถอยไปใช้สีเทา ไม่หายไปจากกราฟ", () => {
    expect(timelineBarClass("unknown-row", { done: true })).toBe("bg-grey-400");
    expect(timelineBarClass("unknown-row", { done: false })).toBe("bg-grey-200");
    expect(timelineDotClass("unknown-row", { done: true })).toBe("bg-grey-400");
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่า fail**

Run: `npx vitest run src/lib/petitionTimelineColors.test.ts`
Expected: FAIL — resolve ไฟล์ `@/lib/petitionTimelineColors` ไม่เจอ

- [ ] **Step 3: เขียน implementation**

สร้าง `src/lib/petitionTimelineColors.ts`:

```ts
export type TimelineRowColorState = { done: boolean; rejected?: boolean };

type RowColor = { solid: string; soft: string };

// สีต้องเขียนเป็น class literal เต็ม ๆ (Tailwind JIT scan จาก source)
// เรียงให้แถวที่อยู่ติดกันในกราฟมี hue ห่างกัน จะได้แยกออกด้วยตา
const ROW_COLORS: Record<string, RowColor> = {
  "submitted": { solid: "bg-violet-500", soft: "bg-violet-200" },
  "sample-sent": { solid: "bg-orange-500", soft: "bg-orange-200" },
  "received-qc": { solid: "bg-sky-500", soft: "bg-sky-200" },
  "assigned": { solid: "bg-rose-500", soft: "bg-rose-200" },
  "received-lab": { solid: "bg-lime-600", soft: "bg-lime-200" },
  "qc-analyzing": { solid: "bg-primary-500", soft: "bg-primary-200" },
  "lab-analyzing": { solid: "bg-amber-500", soft: "bg-amber-200" },
  "pre-result": { solid: "bg-cyan-500", soft: "bg-cyan-200" },
  "final": { solid: "bg-emerald-500", soft: "bg-emerald-200" },
};

const FALLBACK: RowColor = { solid: "bg-grey-400", soft: "bg-grey-200" };
const PENDING_DOT = "bg-grey-300";
const REJECTED_SOLID = "bg-red-500";

function rowColor(rowKey: string): RowColor {
  return ROW_COLORS[rowKey] ?? FALLBACK;
}

export function timelineDotClass(rowKey: string, state: TimelineRowColorState): string {
  return state.done ? rowColor(rowKey).solid : PENDING_DOT;
}

export function timelineBarClass(rowKey: string, state: TimelineRowColorState): string {
  // คำร้องที่ถูกส่งกลับแก้ไข ปิดงานด้วยแท่งแดง (แถวนี้ render เฉพาะตอนจบแล้ว)
  if (rowKey === "final" && state.rejected) return REJECTED_SOLID;
  const color = rowColor(rowKey);
  return state.done ? color.solid : color.soft;
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/lib/petitionTimelineColors.test.ts`
Expected: PASS ทั้ง 9 เทสต์

- [ ] **Step 5: Commit**

```bash
git add src/lib/petitionTimelineColors.ts src/lib/petitionTimelineColors.test.ts
git commit -m "feat(timeline): โมดูลสีประจำแถวของ Petition Timeline"
```

---

### Task 2: ต่อสีเข้ากราฟใน PetitionTimelineDetailPage

**Files:**
- Modify: `src/pages/PetitionTimelineDetailPage.tsx` (ลบ `barTrackClass` ที่บรรทัด 52-61, เพิ่ม import, แก้ JSX ของแถว timeline ที่บรรทัด ~324)
- Test: `src/pages/PetitionTimelineDetailPage.test.tsx` (เพิ่มเทสต์ท้ายไฟล์)

**Interfaces:**
- Consumes: `timelineDotClass(rowKey, state)` / `timelineBarClass(rowKey, state)` จาก Task 1 (`@/lib/petitionTimelineColors`)
- Produces: ไม่มี export ใหม่

**บริบทที่ต้องรู้ก่อนแก้:**
- แถว timeline render ในลูป `activeTimelineDay.rows.map((row) => ...)` แถวละ 1 `div` — ข้างในมี `<span>` (จุด milestone, `aria-label={`${row.label} (จุด)`}`) และ `<div>` (แท่ง, `aria-label={`${row.label} (ช่วงเวลา)`}`)
- ตัวแปร `petition` มีอยู่แล้วใน scope ของคอมโพเนนต์ (ใช้ `petition.status` ได้เลย)
- เทสต์เดิมที่บรรทัด ~379/389 เช็ค `bg-primary-200` / `bg-primary-500` ของแท่ง "QC กำลังวิเคราะห์" — ดีไซน์ใหม่คงสีนี้ไว้ เทสต์เดิมต้องยังผ่าน

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

ต่อท้าย `src/pages/PetitionTimelineDetailPage.test.tsx` เพิ่ม `describe` ใหม่ (ใช้ helper การ mock/render แบบเดียวกับเทสต์เดิมในไฟล์ — ดูของเดิมที่ใช้ `renderPage` / mock `usePetition` แล้วเลียนแบบ pattern เดิมให้ตรง):

```tsx
describe("สีประจำแถวของกราฟ timeline", () => {
  it("จุด milestone แต่ละจุดมีสีของตัวเอง ไม่ซ้ำกัน", async () => {
    // คำร้องที่มี Lab track และเดินครบทุกด่านแล้ว
    renderPage(petitionWithLabCompleted);
    expect(await screen.findByLabelText("ยื่นคำขอ (จุด)")).toHaveClass("bg-violet-500");
    expect(screen.getByLabelText("ส่งตัวอย่าง (จุด)")).toHaveClass("bg-orange-500");
    expect(screen.getByLabelText("QC รับตัวอย่าง (จุด)")).toHaveClass("bg-sky-500");
    expect(screen.getByLabelText("Lab รับตัวอย่าง (จุด)")).toHaveClass("bg-lime-600");
  });

  it("แท่ง Pre Result ไม่ใช้สีเดียวกับแท่ง Lab กำลังวิเคราะห์", async () => {
    renderPage(petitionWithLabCompleted);
    expect(await screen.findByLabelText("Pre Result (ช่วงเวลา)")).toHaveClass("bg-cyan-500");
    expect(screen.getByLabelText("Lab กำลังวิเคราะห์ (ช่วงเวลา)")).toHaveClass("bg-amber-500");
  });

  it("จุดที่ยังไม่ถึงยังเป็นสีเทา", async () => {
    renderPage(petitionJustSubmitted);
    expect(await screen.findByLabelText("QC รับตัวอย่าง (จุด)")).toHaveClass("bg-grey-300");
  });
});
```

หมายเหตุสำหรับผู้ implement: ในไฟล์เทสต์เดิมมี fixture คำร้องอยู่แล้ว (ดูเทสต์ "แสดงจุดรับตัวอย่างแยก QC/Lab..." ที่บรรทัด ~357 และ "QC กำลังวิเคราะห์" ที่ ~378-389) — ให้ reuse fixture/บิลเดอร์เดิม ตั้งชื่อตัวแปรตามของจริงในไฟล์ ไม่ต้องสร้าง mock ชุดใหม่ ขอแค่มี 2 เคส: (ก) คำร้องที่มี Lab เดินครบถึง `labApprovedAt` (ให้แท่ง Pre Result โผล่), (ข) คำร้องที่เพิ่งยื่น ยังไม่มี `qcReceivedAt`

- [ ] **Step 2: รันเทสต์ให้เห็นว่า fail**

Run: `npx vitest run src/pages/PetitionTimelineDetailPage.test.tsx`
Expected: FAIL — จุด milestone ยังเป็น `bg-primary-600`, Pre Result ยังเป็น `bg-amber-500`

- [ ] **Step 3: แก้หน้าให้ใช้โมดูลสีใหม่**

3.1 เพิ่ม import (เรียงตามลำดับ import เดิมของไฟล์ — ต่อจากบรรทัด `import { buildTimelineDetailModel } from "@/lib/petitionTimelineDetail";`):

```tsx
import { timelineBarClass, timelineDotClass } from "@/lib/petitionTimelineColors";
```

3.2 ลบฟังก์ชัน `barTrackClass` ทั้งก้อน (บรรทัด 52-61):

```tsx
function barTrackClass(track: "qc" | "lab" | "stage", done: boolean) {
  if (done) {
    if (track === "lab") return "bg-amber-500";
    if (track === "qc") return "bg-primary-500";
    return "bg-grey-400";
  }
  if (track === "lab") return "bg-amber-200";
  if (track === "qc") return "bg-primary-200";
  return "bg-grey-200";
}
```

3.3 ในลูป `activeTimelineDay.rows.map(...)` เปลี่ยน 2 จุด:

จุด milestone — เดิม:

```tsx
className={cn("absolute top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white", row.done ? "bg-primary-600" : "bg-grey-300")}
```

เป็น:

```tsx
className={cn("absolute top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white", timelineDotClass(row.key, { done: row.done }))}
```

แท่ง — เดิม:

```tsx
className={cn("absolute top-2 h-2 rounded-full", barTrackClass(row.track, row.done), row.continuesBefore && "rounded-l-none", !row.done && "rounded-r-none")}
```

เป็น:

```tsx
className={cn("absolute top-2 h-2 rounded-full", timelineBarClass(row.key, { done: row.done, rejected: petition.status === "rejected" }), row.continuesBefore && "rounded-l-none", !row.done && "rounded-r-none")}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/pages/PetitionTimelineDetailPage.test.tsx src/lib/petitionTimelineColors.test.ts`
Expected: PASS ทั้งหมด (รวมเทสต์เดิมที่เช็ค `bg-primary-200` / `bg-primary-500` ของแท่ง QC)

- [ ] **Step 5: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่จาก `PetitionTimelineDetailPage.tsx` หรือ `petitionTimelineColors.ts` (repo มี latent error เดิมอยู่แล้ว — ไม่ต้องแก้)

- [ ] **Step 6: รันเทสต์ทั้ง suite กันแตกที่อื่น**

Run: `npx vitest run`
Expected: PASS ทั้งหมด

- [ ] **Step 7: Commit**

```bash
git add src/pages/PetitionTimelineDetailPage.tsx src/pages/PetitionTimelineDetailPage.test.tsx
git commit -m "feat(timeline): แต่ละแถวของกราฟใช้สีประจำตัว ไม่ซ้ำกัน"
```

---

## หลัง implement เสร็จ

เปิด `/petitions/:id/timeline` ในเบราว์เซอร์ ดูคำร้องที่มี Lab track และจบงานแล้ว ตรวจด้วยตาว่าครบ 9 แถว 9 สี และแถวที่ติดกันแยกออกจากกันได้ชัด
