# Petition Timeline Hover Crosshair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เอาเมาส์ hover ในคอลัมน์กราฟของการ์ด Petition Timeline แล้วเห็นเส้นตั้งพาดทุกแถว + ป้ายวันเวลา (`15 ก.ค. 10:47`) เกาะเมาส์

**Architecture:** แยกตรรกะ "พิกัดเมาส์ → เวลาบนแกน" เป็นฟังก์ชันบริสุทธิ์ในไฟล์ใหม่ `src/lib/petitionTimelineCrosshair.ts` (เทสต์ด้วย Vitest ล้วน ไม่พึ่ง DOM) แล้วให้ `PetitionTimelineDetailPage.tsx` ทำหน้าที่แค่ (1) วัดขนาด "ราง" (แถบ tick) ด้วย `getBoundingClientRect()` (2) เก็บ state ของ crosshair (3) วาด overlay `pointer-events-none` ทับกราฟ

**Tech Stack:** React 18 + TypeScript, Tailwind (`lis.*` palette), Vitest + @testing-library/react

## Global Constraints

- สเปกอ้างอิง: `docs/superpowers/specs/2026-07-14-petition-timeline-hover-crosshair-design.md`
- แตะไฟล์ได้แค่: สร้าง `src/lib/petitionTimelineCrosshair.ts` + `.test.ts`, แก้ `src/pages/PetitionTimelineDetailPage.tsx` + `.test.tsx` — ห้ามแตะ `petitionTimelineDetail.ts` (row model) และ `petitionTimelineColors.ts`
- overlay ต้อง `pointer-events-none` ทั้งชั้น — ห้ามทำให้ `title="ต่อเนื่องข้ามวัน"` และ `aria-label` ของแท่ง/จุดเดิมใช้ไม่ได้
- ป้ายเวลาเขียน **วัน + เวลาเสมอ** ทุกแท็บ รูปแบบ `15 ก.ค. 10:47` (locale `th-TH`, ไม่มีปี, ไม่มีวินาที)
- เมาส์เท่านั้น — ห้ามเพิ่ม touch/pointer handler
- **ห้ามรัน `npm run build`** (postbuild เขียนทับไฟล์ root, พัง dev server) — type-check ใช้ `npx tsc -p tsconfig.app.json --noEmit` เท่านั้น
- repo มี latent type error อยู่แล้วประมาณ 12 จุด — ดูแค่ว่าไม่มี error ใหม่จากไฟล์ที่แตะ
- คอมเมนต์ในโค้ดเขียนภาษาไทยตามสไตล์ไฟล์เดิม และเขียนเฉพาะจุดที่โค้ดบอกเองไม่ได้

## File Structure

| ไฟล์ | หน้าที่ |
|---|---|
| `src/lib/petitionTimelineCrosshair.ts` *(สร้างใหม่)* | ตรรกะล้วน: `crosshairAt()` แปลงพิกัด→เวลา, `formatCrosshairTime()` ฟอร์แมตป้าย |
| `src/lib/petitionTimelineCrosshair.test.ts` *(สร้างใหม่)* | unit test ของไฟล์ข้างบน |
| `src/pages/PetitionTimelineDetailPage.tsx` *(แก้)* | ref + state + mouse handler + overlay |
| `src/pages/PetitionTimelineDetailPage.test.tsx` *(แก้)* | component test: hover เห็นเส้น/ป้าย, ออกแล้วหาย, นอกรางไม่โผล่ |

---

### Task 1: ตรรกะแปลงพิกัดเมาส์เป็นเวลา (`petitionTimelineCrosshair.ts`)

**Files:**
- Create: `src/lib/petitionTimelineCrosshair.ts`
- Test: `src/lib/petitionTimelineCrosshair.test.ts`

**Interfaces:**
- Consumes: ไม่มี (ฟังก์ชันบริสุทธิ์ ไม่พึ่งไฟล์อื่นในโปรเจกต์)
- Produces:
  - `export type CrosshairPoint = { percent: number; at: Date }`
  - `export function crosshairAt(clientX: number, trackRect: { left: number; width: number }, startAt: string, endAt: string): CrosshairPoint | null`
  - `export function formatCrosshairTime(at: Date): string`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `src/lib/petitionTimelineCrosshair.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { crosshairAt, formatCrosshairTime } from "@/lib/petitionTimelineCrosshair";

// ราง (แถบ tick) กว้าง 400px เริ่มที่ x=100 → แกนเวลา 08:00–12:00 ของ 15 ก.ค. 2026
const TRACK = { left: 100, width: 400 };
const START = new Date(2026, 6, 15, 8, 0).toISOString();
const END = new Date(2026, 6, 15, 12, 0).toISOString();

describe("crosshairAt", () => {
  it("กลางราง = กึ่งกลางช่วงเวลา", () => {
    const point = crosshairAt(300, TRACK, START, END);
    expect(point?.percent).toBe(50);
    expect(point?.at.getHours()).toBe(10);
    expect(point?.at.getMinutes()).toBe(0);
  });

  it("ขอบซ้าย/ขอบขวาของราง = เวลาเริ่ม/เวลาจบพอดี", () => {
    expect(crosshairAt(100, TRACK, START, END)?.at.toISOString()).toBe(START);
    expect(crosshairAt(500, TRACK, START, END)?.percent).toBe(100);
    expect(crosshairAt(500, TRACK, START, END)?.at.toISOString()).toBe(END);
  });

  it("เมาส์อยู่นอกราง (ซ้าย/ขวา) คืน null — ฝั่งซ้ายคือคอลัมน์ชื่อด่าน ไม่ใช่แกนเวลา", () => {
    expect(crosshairAt(99, TRACK, START, END)).toBeNull();
    expect(crosshairAt(501, TRACK, START, END)).toBeNull();
  });

  it("รางกว้าง 0 คืน null", () => {
    expect(crosshairAt(100, { left: 100, width: 0 }, START, END)).toBeNull();
  });

  it("แกนกลับหัวหรือความกว้างเวลาเป็นศูนย์ คืน null", () => {
    expect(crosshairAt(300, TRACK, END, START)).toBeNull();
    expect(crosshairAt(300, TRACK, START, START)).toBeNull();
  });

  it("วันที่ไม่ valid คืน null", () => {
    expect(crosshairAt(300, TRACK, "ไม่ใช่วันที่", END)).toBeNull();
    expect(crosshairAt(300, TRACK, START, "")).toBeNull();
  });
});

describe("formatCrosshairTime", () => {
  it("ได้รูปแบบ วัน + เดือนย่อไทย + เวลา 24 ชม.", () => {
    expect(formatCrosshairTime(new Date(2026, 6, 15, 10, 47))).toBe("15 ก.ค. 10:47");
  });

  it("เติมศูนย์หน้าชั่วโมง/นาทีหลักเดียว", () => {
    expect(formatCrosshairTime(new Date(2026, 6, 5, 9, 5))).toBe("5 ก.ค. 09:05");
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่ามันพัง**

Run: `npx vitest run src/lib/petitionTimelineCrosshair.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/petitionTimelineCrosshair"`

- [ ] **Step 3: เขียน implementation ให้น้อยที่สุดที่ทำให้ผ่าน**

สร้าง `src/lib/petitionTimelineCrosshair.ts`:

```ts
export type CrosshairPoint = { percent: number; at: Date };

// แปลงตำแหน่งเมาส์บน "ราง" (แถบ tick ของแท็บที่กำลังดู) เป็นเวลาบนแกน
// นอกรางคืน null ไม่หนีบขอบ — ฝั่งซ้ายของรางคือคอลัมน์ชื่อด่าน ค่าที่ได้จะไม่มีความหมาย
export function crosshairAt(
  clientX: number,
  trackRect: { left: number; width: number },
  startAt: string,
  endAt: string,
): CrosshairPoint | null {
  if (!(trackRect.width > 0)) return null;

  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;

  const offset = clientX - trackRect.left;
  if (offset < 0 || offset > trackRect.width) return null;

  const ratio = offset / trackRect.width;
  return { percent: ratio * 100, at: new Date(start + ratio * (end - start)) };
}

export function formatCrosshairTime(at: Date): string {
  const day = at.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
  const hour = String(at.getHours()).padStart(2, "0");
  const minute = String(at.getMinutes()).padStart(2, "0");
  return `${day} ${hour}:${minute}`;
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/lib/petitionTimelineCrosshair.test.ts`
Expected: PASS — 8 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/petitionTimelineCrosshair.ts src/lib/petitionTimelineCrosshair.test.ts
git commit -m "feat(timeline): เพิ่มตรรกะแปลงพิกัดเมาส์เป็นเวลาบนแกน (crosshair)"
```

---

### Task 2: เส้น crosshair + ป้ายวันเวลาในการ์ด Petition Timeline

**Files:**
- Modify: `src/pages/PetitionTimelineDetailPage.tsx`
- Test: `src/pages/PetitionTimelineDetailPage.test.tsx`

**Interfaces:**
- Consumes จาก Task 1: `crosshairAt(clientX, trackRect, startAt, endAt): CrosshairPoint | null` และ `formatCrosshairTime(at: Date): string`
- Produces: ไม่มี export ใหม่ — เป็น UI ล้วน. testid ที่เทสต์พึ่ง: `timeline-area` (โซน hover), `timeline-axis` (ราง/แถบ tick), `timeline-crosshair-line`, `timeline-crosshair-label`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

เพิ่มใน `src/pages/PetitionTimelineDetailPage.test.tsx` — วาง helper `mockRect` ไว้ถัดจาก `selectFirstTimelineDayTab()` (บรรทัด ~105) และวาง `describe` ใหม่ไว้ท้ายไฟล์ (นอก describe เดิม):

```tsx
// jsdom คืน getBoundingClientRect() เป็นศูนย์หมด — ต้อง mock ขนาดรางเอง ไม่งั้น crosshairAt คืน null เสมอ
function mockRect(element: HTMLElement, rect: { left: number; width: number }) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    left: rect.left,
    right: rect.left + rect.width,
    width: rect.width,
    top: 0,
    bottom: 200,
    height: 200,
    x: rect.left,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
}
```

```tsx
describe("PetitionTimelineDetailPage crosshair", () => {
  it("hover ในกราฟแล้วเห็นเส้นตั้ง + ป้ายวันเวลา และหายเมื่อเมาส์ออก", async () => {
    renderDetail();

    const area = await screen.findByTestId("timeline-area");
    mockRect(area, { left: 0, width: 500 });
    mockRect(screen.getByTestId("timeline-axis"), { left: 100, width: 400 });

    fireEvent.mouseMove(area, { clientX: 300, clientY: 40 });

    expect(screen.getByTestId("timeline-crosshair-line")).toHaveStyle({ left: "50%" });
    expect(screen.getByTestId("timeline-crosshair-label")).toHaveTextContent(/13 ก\.ค\. \d{2}:\d{2}/);

    fireEvent.mouseLeave(area);

    expect(screen.queryByTestId("timeline-crosshair-line")).not.toBeInTheDocument();
    expect(screen.queryByTestId("timeline-crosshair-label")).not.toBeInTheDocument();
  });

  it("hover ฝั่งคอลัมน์ชื่อด่าน (นอกราง) ไม่ขึ้น crosshair", async () => {
    renderDetail();

    const area = await screen.findByTestId("timeline-area");
    mockRect(area, { left: 0, width: 500 });
    mockRect(screen.getByTestId("timeline-axis"), { left: 100, width: 400 });

    fireEvent.mouseMove(area, { clientX: 40, clientY: 40 });

    expect(screen.queryByTestId("timeline-crosshair-line")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่ามันพัง**

Run: `npx vitest run src/pages/PetitionTimelineDetailPage.test.tsx -t crosshair`
Expected: FAIL — `Unable to find an element by: [data-testid="timeline-area"]`

- [ ] **Step 3: import ฟังก์ชันจาก Task 1**

ใน `src/pages/PetitionTimelineDetailPage.tsx` เพิ่ม import ต่อจากบรรทัด `import { timelineBarClass, timelineDotClass } from "@/lib/petitionTimelineColors";` (บรรทัด 19):

```tsx
import { crosshairAt, formatCrosshairTime } from "@/lib/petitionTimelineCrosshair";
```

- [ ] **Step 4: เพิ่ม ref + state ของ crosshair**

ใน `PetitionTimelineDetailPage()` เพิ่มต่อจาก `const [activeItemSeq, setActiveItemSeq] = useState<number | null>(null);` (บรรทัด ~196):

```tsx
  const [crosshair, setCrosshair] = useState<{ percent: number; label: string; x: number; y: number; flip: boolean } | null>(null);
  const timelineAreaRef = useRef<HTMLDivElement | null>(null);
  const timelineTrackRef = useRef<HTMLDivElement | null>(null);
```

- [ ] **Step 5: ล้าง crosshair เมื่อสลับคำร้อง**

ใน `useEffect` ที่ reset state ตาม `id` (บรรทัด ~233-240) เพิ่มบรรทัดสุดท้ายก่อนปิดปีกกา:

```tsx
    setCrosshair(null);
```

ผลลัพธ์ (effect ทั้งก้อน):

```tsx
  useEffect(() => {
    setLabelPrintOpen(false);
    setServicePrintOpen(false);
    setPreReportOpen(false);
    setFinalReportOpen(false);
    setActiveTimelineDayKey(null);
    setActiveItemSeq(null);
    setCrosshair(null);
  }, [id]);
```

- [ ] **Step 6: เขียน mouse handler**

ก่อนอื่นเพิ่มค่าคงที่ระดับโมดูล ต่อจาก `const ACTIVE_BAR_CLASS = ...` (บรรทัด ~140):

```tsx
// ป้ายกว้างสุดราว 110px — ถ้าเหลือที่ทางขวาไม่พอ ให้พลิกไปโผล่ฝั่งซ้ายของเมาส์แทน
const CROSSHAIR_LABEL_SPACE = 120;
```

จากนั้นเพิ่มฟังก์ชันธรรมดา (ไม่ใช่ hook — อยู่หลัง early return ได้) ต่อจาก `function refreshTimeline() {...}` (บรรทัด ~380):

```tsx
  function handleTimelineMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    const area = timelineAreaRef.current;
    const track = timelineTrackRef.current;
    if (!area || !track) return;

    const point = crosshairAt(event.clientX, track.getBoundingClientRect(), activeTimelineDay.startAt, activeTimelineDay.endAt);
    if (!point) {
      setCrosshair(null);
      return;
    }

    const areaRect = area.getBoundingClientRect();
    setCrosshair({
      percent: point.percent,
      label: formatCrosshairTime(point.at),
      x: event.clientX - areaRect.left,
      y: event.clientY - areaRect.top,
      flip: event.clientX + CROSSHAIR_LABEL_SPACE > areaRect.right,
    });
  }
```

> หมายเหตุ: ไฟล์นี้ import `useRef` อยู่แล้ว (บรรทัด 1) และไม่ต้อง import type `React` เพิ่ม เพราะ `tsconfig` ตั้ง `jsx: react-jsx` ซึ่งมี global namespace `React` ให้ใช้เป็น type ได้

- [ ] **Step 7: ต่อ handler + ref + overlay เข้ากับ JSX**

แทนที่ `<div className="space-y-3">` (บรรทัด ~425) ด้วย container ที่มี ref/handler:

```tsx
            <div
              ref={timelineAreaRef}
              data-testid="timeline-area"
              className="relative space-y-3"
              onMouseMove={handleTimelineMouseMove}
              onMouseLeave={() => setCrosshair(null)}
            >
```

ในแถวหัวตาราง ใส่ `ref` + `data-testid` ให้ **div ของแถบ tick** (คอลัมน์ที่สอง, บรรทัด ~428) — คือ div ที่ `className` ขึ้นต้นด้วย `"relative min-w-0 border-b border-black-50 ..."`:

```tsx
                <div
                  ref={timelineTrackRef}
                  data-testid="timeline-axis"
                  className={cn("relative min-w-0 border-b border-black-50 text-xs text-grey-500", activeTimelineDay.key === "overview" ? "pb-9" : "pb-5")}
                >
```

จากนั้นเพิ่ม overlay เป็น element สุดท้ายภายใน container (ต่อจาก `{activeTimelineRows.map(...)}` ก่อน `</div>` ที่ปิด container):

```tsx
              {crosshair && <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10">
                <div className="grid h-full grid-cols-[minmax(5.75rem,7rem)_minmax(0,1fr)] gap-2 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3">
                  <div />
                  <div className="relative h-full">
                    <span data-testid="timeline-crosshair-line" className="absolute inset-y-0 w-px -translate-x-1/2 bg-primary-500/60" style={{ left: `${crosshair.percent}%` }} />
                  </div>
                </div>
                <span
                  data-testid="timeline-crosshair-label"
                  className={cn("absolute whitespace-nowrap rounded bg-black-500 px-1.5 py-0.5 text-[11px] font-medium text-white shadow", crosshair.flip && "-translate-x-full")}
                  style={{ left: `${crosshair.x + (crosshair.flip ? -12 : 12)}px`, top: `${crosshair.y + 12}px` }}
                >{crosshair.label}</span>
              </div>}
```

> overlay ใช้ grid template ชุดเดียวกับแถวอื่น เส้นจึงตกอยู่ในคอลัมน์เวลาเป๊ะ ๆ โดยไม่ต้องแปลงพิกัดเอง — และทั้งชั้นเป็น `pointer-events-none` เลยไม่บัง `title`/`aria-label` ของแท่งเดิม

- [ ] **Step 8: รันเทสต์ crosshair ให้ผ่าน**

Run: `npx vitest run src/pages/PetitionTimelineDetailPage.test.tsx -t crosshair`
Expected: PASS — 2 tests passed

- [ ] **Step 9: รันเทสต์ทั้งไฟล์ + lib กันของเดิมพัง**

Run: `npx vitest run src/pages/PetitionTimelineDetailPage.test.tsx src/lib/petitionTimelineCrosshair.test.ts src/lib/petitionTimelineDetail.test.ts src/lib/petitionTimelineColors.test.ts`
Expected: PASS ทั้งหมด — เทสต์เดิมของหน้า (แท่ง/จุด/แท็บ/เอกสาร) ต้องไม่มีตัวไหนพัง

- [ ] **Step 10: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่ที่ชี้มาที่ `PetitionTimelineDetailPage.tsx` หรือ `petitionTimelineCrosshair.ts` (repo มี latent error เดิมอยู่ ~12 จุดในไฟล์อื่น — ปล่อยไว้)

- [ ] **Step 11: Commit**

```bash
git add src/pages/PetitionTimelineDetailPage.tsx src/pages/PetitionTimelineDetailPage.test.tsx
git commit -m "feat(timeline): hover ในกราฟแล้วเห็นเส้นตั้ง + ป้ายวันเวลาเกาะเมาส์"
```

---

## ตรวจของจริงบนเบราว์เซอร์ (หลังทั้งสอง task เสร็จ)

- [ ] เปิด `npm run dev` + `cd server && npm run dev` แล้วเข้า `/petition-timeline/<id>` ของคำร้องที่กินหลายวัน
- [ ] ลากเมาส์ในกราฟ: เส้นตั้งพาดทุกแถว ป้ายเกาะเมาส์ อ่านค่าตรงกับ tick ที่อยู่ใกล้ ๆ
- [ ] เอาเมาส์ทาบชื่อด่านฝั่งซ้าย: ไม่มีเส้น
- [ ] ลากไปชิดขอบขวา: ป้ายพลิกไปฝั่งซ้าย ไม่ล้นการ์ด
- [ ] สลับแท็บ ภาพรวม ↔ รายวัน: ค่าเวลายังตรงกับแกนของแท็บนั้น
- [ ] hover ทับแท่งที่ถูกตัดข้ามวัน: tooltip เดิม "ต่อเนื่องข้ามวัน" ยังขึ้นได้
