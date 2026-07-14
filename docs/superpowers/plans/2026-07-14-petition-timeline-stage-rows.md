# Petition Timeline: แถวตามด่านงาน แทนแถวราย parameter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เปลี่ยนกราฟ Petition Timeline จากแถวราย parameter เป็น 8 แถวตามด่านงานจริง (ส่ง → QC รับ → มอบหมาย → Lab รับ → QC วิเคราะห์ → Lab วิเคราะห์ → Pre Result → Final Result)

**Architecture:** ทุกแถวสร้างจาก timestamp ระดับคำร้องใน `src/lib/petitionTimelineDetail.ts` (pure function `buildTimelineDetailModel`) ส่วน `src/pages/PetitionTimelineDetailPage.tsx` แค่ render แถวที่ได้ ตรรกะการ์ด Tasks / Activity / Documents ไม่แตะ

**Tech Stack:** TypeScript + React 18 + Vitest + Testing Library + Tailwind

**Spec:** `docs/superpowers/specs/2026-07-14-petition-timeline-stage-rows-design.md`

## Global Constraints

- ห้ามรัน `npm run build` (postbuild เขียนทับไฟล์ root แล้ว dev server พัง) — type-check ด้วย `npx tsc -p tsconfig.app.json --noEmit` เท่านั้น
- รันเทสต์ด้วย `npx vitest run <path>` (ทั้ง suite: `npm run test`)
- repo มี latent type error เดิมอยู่ ~12 จุดในไฟล์อื่น — ดูแค่ว่าไฟล์ที่แก้ในแผนนี้ไม่มี error ใหม่
- label ทั้งหมดเป็นภาษาไทยตามสเปก ห้ามแปลงเป็นอังกฤษ
- `done` ของ `TimelineDetailRow` แปลว่า "ด่านนี้จบแล้ว" ไม่ใช่ "มีแท่งให้วาด" — แท่งที่กำลังทำมี `startAt`/`endAt` ครบ แต่ `done` = false
- key/label ที่ทุก task ต้องใช้ให้ตรงกัน: `submitted` (ส่งตัวอย่าง), `received-qc` (QC รับตัวอย่าง), `assigned` (มอบหมายงาน Lab), `received-lab` (Lab รับตัวอย่าง), `qc-analyzing` (QC กำลังวิเคราะห์), `lab-analyzing` (Lab กำลังวิเคราะห์), `pre-result` (Pre Result), `final` (Final Result / ส่งกลับแก้ไข)

---

### Task 1: จุด ส่งตัวอย่าง + สลับ มอบหมาย/Lab รับ + ขยายช่วง timeline

**Files:**
- Modify: `src/lib/petitionTimelineDetail.ts` (`buildMilestoneRows` ~397-410, `buildTimelineDetailModel` ~509-545)
- Test: `src/lib/petitionTimelineDetail.test.ts`

**Interfaces:**
- Consumes: helper เดิมในไฟล์ — `firstValidDate(...values)`, `atHour(date, hour)`, `hasLabTrack(petition)`, `WORK_START_HOUR`
- Produces: แถว milestone 4 แถวเรียง `submitted` → `received-qc` → `assigned` → `received-lab` (สองแถวหลังเฉพาะคำร้องที่ `hasLabTrack`) และ `timeline.startAt` / `timeline.ticks` / `timeline.days` ที่เริ่มจากเวลาที่เก่าสุดระหว่างวันส่งกับวันรับตัวอย่าง โดย `header` ไม่เปลี่ยน

- [ ] **Step 1: เขียนเทสต์ที่ยังแดง — แก้เทสต์ milestone เดิม + เพิ่มเทสต์จุดส่งตัวอย่าง**

แก้เทสต์เดิมชื่อ `"แสดง QC/Lab รับตัวอย่าง และมอบหมายงาน เป็นจุด milestone ไม่มีแท่ง"` ใน `src/lib/petitionTimelineDetail.test.ts` ให้เป็น (ชื่อเทสต์เปลี่ยนด้วย):

```ts
  it("แสดงจุด ส่งตัวอย่าง → QC รับ → มอบหมาย → Lab รับ ตามลำดับงานจริง", () => {
    const result = model(petition({
      items: [{ seq: 1, sampleName: "Lab Sample", batchNo: "BATCH-001", sampleId: "sample-1" }],
      qcReceivedAt: at(13, 9),
      labReceivedAt: at(13, 10),
      assignedTo: { employeeId: "L001", name: "Lab Analyst", assignedAt: at(13, 11) },
    }));

    expect(result.timeline.rows.filter((row) => row.kind === "milestone")).toMatchObject([
      { key: "submitted", label: "ส่งตัวอย่าง", at: at(13, 9), startAt: null, endAt: null, done: true },
      { key: "received-qc", label: "QC รับตัวอย่าง", at: at(13, 9), startAt: null, endAt: null, done: true },
      { key: "assigned", label: "มอบหมายงาน Lab", at: at(13, 11), done: true },
      { key: "received-lab", label: "Lab รับตัวอย่าง", at: at(13, 10), done: true },
    ]);
  });
```

แก้เทสต์เดิมชื่อ `"ซ่อนแถวฝั่ง Lab ทั้งหมดสำหรับคำร้องที่ไม่มีงาน Lab"` — บรรทัด assert เปลี่ยนเป็น:

```ts
    expect(result.timeline.rows.map((row) => row.key)).toEqual(["submitted", "received-qc", "final"]);
```

เพิ่มเทสต์ใหม่ต่อท้ายเทสต์ `"ซ่อนแถวฝั่ง Lab..."`:

```ts
  it("จุดส่งตัวอย่างขยายช่วง timeline ให้เริ่มก่อนวันรับตัวอย่าง แต่ header ยังนับจากเวลารับ", () => {
    const result = model(
      petition({
        submittedBy: { name: "Requester", submittedAt: at(12, 9) },
        createdAt: at(12, 9),
        qcReceivedAt: at(13, 10),
      }),
      [],
      [],
      [],
      new Date(2026, 6, 13, 12),
    );

    expect(result.header.startAt).toBe(at(13, 10));
    expect(result.header.startKind).toBe("received");
    expect(result.timeline.startAt).toBe(at(12, 8));
    expect(result.timeline.days.map((day) => day.label)).toEqual(["12 ก.ค.", "13 ก.ค."]);
    expect(result.timeline.days[0]?.rows.find((row) => row.key === "submitted")).toMatchObject({ visible: true });
    expect(result.timeline.rows.find((row) => row.key === "submitted")).toMatchObject({ at: at(12, 9), done: true });
  });
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าแดง**

Run: `npx vitest run src/lib/petitionTimelineDetail.test.ts`
Expected: FAIL — เทสต์ milestone บอกว่าไม่มี key `submitted` และลำดับ `assigned`/`received-lab` สลับกัน

- [ ] **Step 3: แก้ `buildMilestoneRows` ใน `src/lib/petitionTimelineDetail.ts`**

แทนที่ฟังก์ชันเดิมทั้งก้อน:

```ts
function buildMilestoneRows(petition: Petition): TimelineDetailRow[] {
  const hasLab = hasLabTrack(petition);
  const submittedAt = firstValidDate(petition.submittedBy?.submittedAt, petition.createdAt);
  const qcReceivedAt = petition.qcReceivedAt ?? petition.receivedAt ?? null;
  const labReceivedAt = petition.labReceivedAt ?? null;
  const assignedAt = petition.assignedTo?.assignedAt ?? null;
  const milestone = (key: string, label: string, at: string | null): TimelineDetailRow =>
    ({ key, label, kind: "milestone", track: "stage", at, startAt: null, endAt: null, done: !!validDate(at) });

  return [
    milestone("submitted", "ส่งตัวอย่าง", submittedAt),
    milestone("received-qc", "QC รับตัวอย่าง", qcReceivedAt),
    hasLab ? milestone("assigned", "มอบหมายงาน Lab", assignedAt) : null,
    hasLab ? milestone("received-lab", "Lab รับตัวอย่าง", labReceivedAt) : null,
  ].filter((row): row is TimelineDetailRow => row !== null);
}
```

- [ ] **Step 4: ขยายช่วง timeline ใน `buildTimelineDetailModel`**

ใน `buildTimelineDetailModel` เพิ่มบรรทัด `timelineStartAt` ต่อจาก `const startAt = ...` :

```ts
  const startAt = receivedAt ?? submittedAt;
  // กราฟเริ่มที่จุดส่งตัวอย่าง (เก่าสุด) ส่วน header ยังนับจากเวลารับตัวอย่างเหมือนเดิม
  const timelineStartAt = firstValidDate(submittedAt, startAt) ?? startAt;
```

แล้วเปลี่ยน block `timeline: { ... }` ท้ายฟังก์ชันให้ใช้ `timelineStartAt` แทน `startAt`:

```ts
    timeline: {
      startAt: atHour(new Date(timelineStartAt), WORK_START_HOUR).toISOString(),
      endAt: header.endAt,
      ticks: buildTicks(timelineStartAt, header.endAt),
      rows,
      days: buildTimelineDays(timelineStartAt, header.endAt, rows),
    },
```

หมายเหตุ: `buildParameterRows(...)` ที่อยู่ใน `rows` ยังรับ `startAt` (ไม่ใช่ `timelineStartAt`) ตามเดิม — Task 3 จะลบทิ้งทั้งฟังก์ชัน

- [ ] **Step 5: รันเทสต์ให้เขียว**

Run: `npx vitest run src/lib/petitionTimelineDetail.test.ts`
Expected: PASS ทุกเคส

- [ ] **Step 6: รันเทสต์หน้าเพจกันพัง**

Run: `npx vitest run src/pages/PetitionTimelineDetailPage.test.tsx`
Expected: PASS ทุกเคส (หน้าเพจ render แถวจาก model ตรง ๆ ไม่ผูกกับจำนวนแถว)

- [ ] **Step 7: Commit**

```bash
git add src/lib/petitionTimelineDetail.ts src/lib/petitionTimelineDetail.test.ts
git commit -m "feat(timeline): เพิ่มจุดส่งตัวอย่าง และสลับมอบหมายงานมาก่อน Lab รับตัวอย่าง"
```

---

### Task 2: เปลี่ยนชื่อแถว ออกผล Lab เป็น Pre Result

**Files:**
- Modify: `src/lib/petitionTimelineDetail.ts` (`buildClosingRows` ~479-507)
- Test: `src/lib/petitionTimelineDetail.test.ts`

**Interfaces:**
- Consumes: `makeBarRow`, `hasLabTrack`, `latestValidDate` (เดิม)
- Produces: แถว key `pre-result` label `Pre Result` (เดิม key `lab-approved` label `ออกผล Lab`) — ช่วงเวลาเหมือนเดิมทุกอย่าง (`labCompletedAt` → `labApprovedAt`) แถว `final` ไม่เปลี่ยน

- [ ] **Step 1: แก้เทสต์เดิม 2 เคสให้ใช้ key/label ใหม่ (จะแดง)**

ในเทสต์ชื่อ `"ลากแท่ง ออกผล Lab จาก Lab บันทึกครบ ถึง Lab อนุมัติ"` เปลี่ยนชื่อเทสต์และ assert เป็น:

```ts
  it("ลากแท่ง Pre Result จาก Lab บันทึกครบ ถึง Lab อนุมัติ", () => {
    const result = model(petition({
      items: [{ seq: 1, sampleName: "Lab Sample", batchNo: "BATCH-001", sampleId: "sample-1" }],
      qcReceivedAt: at(13, 9),
      labCompletedAt: at(13, 14),
      labApprovedAt: at(13, 15),
    }));

    expect(result.timeline.rows.find((row) => row.key === "pre-result")).toMatchObject({
      label: "Pre Result",
      kind: "bar",
      track: "lab",
      startAt: at(13, 14),
      endAt: at(13, 15),
      done: true,
    });
  });
```

ในเทสต์ชื่อ `"ไม่วาดแท่ง ออกผล Lab เมื่อยังไม่อนุมัติ"` เปลี่ยนชื่อเทสต์และ assert เป็น:

```ts
  it("ไม่วาดแท่ง Pre Result เมื่อยังไม่อนุมัติ", () => {
    const result = model(petition({
      items: [{ seq: 1, sampleName: "Lab Sample", batchNo: "BATCH-001", sampleId: "sample-1" }],
      qcReceivedAt: at(13, 9),
      labCompletedAt: at(13, 14),
    }));

    expect(result.timeline.rows.find((row) => row.key === "pre-result")).toMatchObject({
      startAt: null,
      endAt: null,
      done: false,
    });
  });
```

ในเทสต์ชื่อ `"เรียงแถว: milestone → parameter QC → parameter Lab → ออกผล Lab → Final Result"` เปลี่ยน `"lab-approved"` ในอาร์เรย์ที่ expect เป็น `"pre-result"` (ลำดับแถวอื่นคงเดิม — Task 3 จะรื้อเทสต์นี้ใหม่)

ในเทสต์ชื่อ `"จุด milestone แท่งปิดงาน และแท็บวัน เหมือนกันทุกตัวอย่างที่เลือก"` ใน `expectedStageRows` เปลี่ยนบรรทัด `lab-approved` เป็น:

```ts
      { key: "pre-result", label: "Pre Result", kind: "bar", track: "lab", at: null, startAt: at(13, 14), endAt: at(13, 15), done: true },
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าแดง**

Run: `npx vitest run src/lib/petitionTimelineDetail.test.ts`
Expected: FAIL — หา row `pre-result` ไม่เจอ (ยังเป็น `lab-approved`)

- [ ] **Step 3: แก้ `buildClosingRows`**

ใน `src/lib/petitionTimelineDetail.ts` เปลี่ยนเฉพาะ key กับ label ของแท่งแรก:

```ts
    hasLab ? makeBarRow({
      key: "pre-result",
      label: "Pre Result",
      track: "lab",
      startAt: petition.labCompletedAt ?? null,
      endAt: labApprovedAt,
    }) : null,
```

- [ ] **Step 4: รันเทสต์ให้เขียว**

Run: `npx vitest run src/lib/petitionTimelineDetail.test.ts src/pages/PetitionTimelineDetailPage.test.tsx`
Expected: PASS ทั้งสองไฟล์

- [ ] **Step 5: Commit**

```bash
git add src/lib/petitionTimelineDetail.ts src/lib/petitionTimelineDetail.test.ts
git commit -m "feat(timeline): เปลี่ยนชื่อแถวออกผล Lab เป็น Pre Result"
```

---

### Task 3: แทนแถวราย parameter ด้วยแท่ง QC/Lab กำลังวิเคราะห์

**Files:**
- Modify: `src/lib/petitionTimelineDetail.ts` (ลบ `buildParameterTouches` ~413-434 และ `buildParameterRows` ~436-477, แก้ `makeBarRow`, เพิ่ม `buildAnalyzingRows`, แก้ `TimelineDetailInput` + `buildTimelineDetailModel`)
- Modify: `src/pages/PetitionTimelineDetailPage.tsx:157` (เลิกส่ง `qcResults` เข้า model)
- Test: `src/lib/petitionTimelineDetail.test.ts`, `src/pages/PetitionTimelineDetailPage.test.tsx`

**Interfaces:**
- Consumes: `makeBarRow` (เพิ่ม option `done?: boolean`), `hasLabTrack`, `validDate`
- Produces:
  - `makeBarRow(input: { key: string; label: string; track: TimelineDetailRowTrack; startAt: string | null; endAt: string | null; done?: boolean }): TimelineDetailRow` — `done` ไม่ส่ง = คำนวณจาก "มีทั้ง start และ end"
  - `buildAnalyzingRows(petition: Petition, now: Date): TimelineDetailRow[]` — คืนแถว `qc-analyzing` (เสมอ) และ `lab-analyzing` (เฉพาะ `hasLabTrack`)
  - `TimelineDetailInput` ไม่มี field `qcResults` อีกต่อไป
- ผลข้างเคียงที่ตั้งใจ: ไม่มี row key ขึ้นต้น `param::` ในโมเดลอีกเลย และแท็บตัวอย่าง (`itemSeq`) ไม่กระทบกราฟ timeline แล้ว (ยังกรอง `tasks`/`progress` เหมือนเดิม)

- [ ] **Step 1: ปรับ helper `model()` ในเทสต์ให้เลิกรับ `qcResults` (จะทำให้เทสต์แดงทั้งไฟล์)**

ใน `src/lib/petitionTimelineDetail.test.ts` แทนที่ helper เดิมด้วย:

```ts
function model(
  petitionData: Petition,
  parameters: ParameterItem[] = [],
  progressEntries: QCProgressEntry[] = [],
  auditLogs: PetitionAuditLogEntry[] = [],
  now = new Date(2026, 6, 13, 12),
  itemSeq: number | null = null,
) {
  return buildTimelineDetailModel({ petition: petitionData, parameters, progressEntries, auditLogs, itemSeq }, now);
}
```

และลบ `QCTestResult` ออกจาก import บรรทัดที่ 3 (เหลือ `import type { Petition, PetitionAuditLogEntry } from "@/types/petition.types";`)

- [ ] **Step 2: ลบเทสต์แท่ง parameter ทั้งหมด**

ลบเทสต์ 7 เคสนี้ออกจาก `src/lib/petitionTimelineDetail.test.ts` ทั้งบล็อก:
- `"ลากแท่ง parameter จาก QC รับตัวอย่าง ถึงเวลาที่ใส่ค่า"`
- `"ยืดแท่ง parameter ไปถึงการแก้ค่าครั้งล่าสุด"`
- `"แถว parameter ฝั่ง Lab เริ่มที่ Lab รับตัวอย่าง"`
- `"รวมหลายตัวอย่างเป็นแถวเดียว และไม่วาดแท่งจนกว่าจะใส่ค่าครบทุกตัวอย่าง"`
- `"ใช้เวลาจาก QCTestResult เมื่อคำร้องเก่ายังไม่มี audit log ระดับ field"`
- `"ใช้เวลาจาก audit log เป็นหลัก แม้ QCTestResult จะมีเวลาใหม่กว่า"`
- `"วาดแท่ง parameter ของตัวอย่างที่เลือกทันที แม้ตัวอย่างอื่นยังไม่ได้กรอก"`

พร้อมลบ helper ที่ไม่มีใครใช้แล้ว: `const labParameter: ParameterItem = {...}` และ `const resultAudit = (...) => ({...})`
(เก็บ `const requiredParameter` ไว้ — การ์ด Tasks ยังใช้)

- [ ] **Step 3: เขียนเทสต์แท่งวิเคราะห์ชุดใหม่**

เพิ่มต่อจากเทสต์ `"คำร้องที่ถูกส่งกลับแก้ไข ใช้ชื่อแถวและเวลา rejected"`:

```ts
  it("แท่ง QC กำลังวิเคราะห์ ลากจาก QC รับตัวอย่าง ถึงเวลาปัจจุบันเมื่อยังไม่จบ", () => {
    const result = model(petition({ qcReceivedAt: at(13, 9) }), [], [], [], new Date(2026, 6, 13, 12));

    expect(result.timeline.rows.find((row) => row.key === "qc-analyzing")).toMatchObject({
      label: "QC กำลังวิเคราะห์",
      kind: "bar",
      track: "qc",
      startAt: at(13, 9),
      endAt: at(13, 12),
      done: false,
    });
  });

  it("แท่ง QC กำลังวิเคราะห์ จบที่ QC บันทึกครบ", () => {
    const result = model(petition({ qcReceivedAt: at(13, 9), qcCompletedAt: at(13, 11) }), [], [], [], new Date(2026, 6, 13, 12));

    expect(result.timeline.rows.find((row) => row.key === "qc-analyzing")).toMatchObject({
      startAt: at(13, 9),
      endAt: at(13, 11),
      done: true,
    });
  });

  it("แท่ง Lab กำลังวิเคราะห์ เริ่มที่ Lab รับตัวอย่าง และจบที่ Lab บันทึกครบ", () => {
    const labPetition = petition({
      items: [{ seq: 1, sampleName: "Lab Sample", batchNo: "BATCH-001", sampleId: "sample-1" }],
      qcReceivedAt: at(13, 9),
      labReceivedAt: at(13, 10),
    });

    const open = model(labPetition, [], [], [], new Date(2026, 6, 13, 12));
    expect(open.timeline.rows.find((row) => row.key === "lab-analyzing")).toMatchObject({
      label: "Lab กำลังวิเคราะห์",
      track: "lab",
      startAt: at(13, 10),
      endAt: at(13, 12),
      done: false,
    });

    const done = model(
      petition({
        items: [{ seq: 1, sampleName: "Lab Sample", batchNo: "BATCH-001", sampleId: "sample-1" }],
        qcReceivedAt: at(13, 9),
        labReceivedAt: at(13, 10),
        labCompletedAt: at(13, 14),
      }),
      [], [], [],
      new Date(2026, 6, 13, 16),
    );
    expect(done.timeline.rows.find((row) => row.key === "lab-analyzing")).toMatchObject({
      startAt: at(13, 10),
      endAt: at(13, 14),
      done: true,
    });
  });

  it("ยังไม่รับตัวอย่าง → ไม่วาดแท่งวิเคราะห์ของฝั่งนั้น", () => {
    const result = model(
      petition({
        items: [{ seq: 1, sampleName: "Lab Sample", batchNo: "BATCH-001", sampleId: "sample-1" }],
        qcReceivedAt: at(13, 9),
      }),
      [], [], [],
      new Date(2026, 6, 13, 12),
    );

    expect(result.timeline.rows.find((row) => row.key === "lab-analyzing")).toMatchObject({
      startAt: null,
      endAt: null,
      done: false,
    });
  });

  it("ไม่มีแถวราย parameter ใน timeline อีกต่อไป", () => {
    const result = model(petition({ qcReceivedAt: at(13, 9) }), [requiredParameter], [], []);

    expect(result.timeline.rows.some((row) => row.key.startsWith("param::"))).toBe(false);
    expect(result.tasks).toHaveLength(1);
  });
```

- [ ] **Step 4: แก้เทสต์เดิมที่อ้างแถว parameter ให้ไปอ้างแถวใหม่**

`"เรียงแถว: milestone → parameter QC → parameter Lab → ออกผล Lab → Final Result"` แทนที่ทั้งเคสด้วย:

```ts
  it("เรียงแถว: ส่ง → QC รับ → มอบหมาย → Lab รับ → QC วิเคราะห์ → Lab วิเคราะห์ → Pre Result → Final Result", () => {
    const result = model(petition({
      items: [{ seq: 1, sampleName: "Lab Sample", batchNo: "BATCH-001", sampleId: "sample-1" }],
      qcReceivedAt: at(13, 9),
      labReceivedAt: at(13, 10),
    }));

    expect(result.timeline.rows.map((row) => row.key)).toEqual([
      "submitted",
      "received-qc",
      "assigned",
      "received-lab",
      "qc-analyzing",
      "lab-analyzing",
      "pre-result",
      "final",
    ]);
  });
```

`"ทุกแท็บวันมีครบทุกแถว เพื่อให้ลำดับแถวไม่ขยับ"` แทนที่ด้วย (เลิกใช้ `resultAudit`):

```ts
  it("ทุกแท็บวันมีครบทุกแถว เพื่อให้ลำดับแถวไม่ขยับ", () => {
    const result = model(
      petition({ qcReceivedAt: at(12, 10), qcCompletedAt: at(13, 9) }),
      [requiredParameter],
      [],
      [],
      new Date(2026, 6, 13, 12),
    );

    const keysByDay = result.timeline.days.map((day) => day.rows.map((row) => row.key));
    expect(keysByDay[0]).toEqual(result.timeline.rows.map((row) => row.key));
    expect(keysByDay[1]).toEqual(result.timeline.rows.map((row) => row.key));
  });
```

`"ตัดแท่งที่กินข้ามวันให้พอดีหน้าต่างของแต่ละวัน พร้อมบอกว่าต่อเนื่อง"` แทนที่ด้วย (ใช้แท่ง `qc-analyzing`):

```ts
  it("ตัดแท่งที่กินข้ามวันให้พอดีหน้าต่างของแต่ละวัน พร้อมบอกว่าต่อเนื่อง", () => {
    const result = model(
      petition({ qcReceivedAt: at(12, 10), qcCompletedAt: at(13, 11) }),
      [],
      [],
      [],
      new Date(2026, 6, 13, 12),
    );

    expect(result.timeline.days[0]?.rows.find((row) => row.key === "qc-analyzing")).toMatchObject({
      visible: true,
      segmentStartAt: at(12, 10),
      segmentEndAt: at(12, 17),
      continuesBefore: false,
      continuesAfter: true,
    });

    expect(result.timeline.days[1]?.rows.find((row) => row.key === "qc-analyzing")).toMatchObject({
      visible: true,
      segmentStartAt: at(13, 8),
      segmentEndAt: at(13, 11),
      continuesBefore: true,
      continuesAfter: false,
    });
  });
```

`"แถวที่ไม่มีแท่งหรือจุดในวันนั้น ได้ visible = false"` แทนที่ด้วย (ใช้แท่ง `lab-analyzing` ที่ยังไม่มีเวลาเริ่ม):

```ts
  it("แถวที่ไม่มีแท่งหรือจุดในวันนั้น ได้ visible = false", () => {
    const result = model(petition({
      items: [{ seq: 1, sampleName: "Lab Sample", batchNo: "BATCH-001", sampleId: "sample-1" }],
      qcReceivedAt: at(13, 9),
    }));

    expect(result.timeline.days[0]?.rows.find((row) => row.key === "lab-analyzing")).toMatchObject({
      visible: false,
      segmentStartAt: null,
      segmentEndAt: null,
    });
  });
```

`"กรอง tasks และแถว parameter เหลือเฉพาะตัวอย่างที่เลือก"` แทนที่ด้วย (ตัด assert แถว `param::` ออก, ปรับตำแหน่ง arg `itemSeq` เพราะ helper เลิกรับ `qcResults`):

```ts
  it("กรอง tasks เหลือเฉพาะตัวอย่างที่เลือก โดยไม่มีผลกับแถว timeline", () => {
    const parameterForA: ParameterItem = {
      _id: "parameter-a",
      name: "Assay A",
      scope: "qc",
      status: "active",
      applyAll: false,
      commonNames: ["ABAMECTIN 1.8% EC"],
      valueFields: [
        { label: "Viscosity", type: "number", required: true },
        { label: "Color", type: "text", required: true },
      ],
    };
    const parameterForB: ParameterItem = {
      _id: "parameter-b",
      name: "Assay B",
      scope: "qc",
      status: "active",
      applyAll: false,
      commonNames: ["EMAMECTIN 1.9% EC"],
      valueFields: [
        { label: "Viscosity", type: "number", required: true },
        { label: "Color", type: "text", required: true },
      ],
    };

    const unfiltered = model(twoItemPetition(), [parameterForA, parameterForB], [], [], new Date(2026, 6, 13, 12), null);
    expect(unfiltered.tasks).toHaveLength(2);

    const result = model(
      twoItemPetition(),
      [parameterForA, parameterForB],
      [{ itemSeq: 2, parameterId: "parameter-b", filledLabels: ["Viscosity"] }],
      [],
      new Date(2026, 6, 13, 12),
      2,
    );

    expect(result.tasks).toMatchObject([{ key: "2::parameter-b", itemSeq: 2, sampleName: "Sample B", filled: 1, total: 2 }]);
    expect(result.timeline.rows.map((row) => row.key)).toEqual(unfiltered.timeline.rows.map((row) => row.key));
  });
```

`"progress เป็นของตัวอย่างที่เลือก ส่วน overallProgress รวมทุกตัวอย่าง"` — ลบ arg `[]` (qcResults) ตัวที่ 6 ออก ให้เหลือ `..., new Date(2026, 6, 13, 12), 1)`

`"จุด milestone แท่งปิดงาน และแท็บวัน เหมือนกันทุกตัวอย่างที่เลือก"` แทนที่ทั้งเคสด้วย:

```ts
  it("แถว timeline และแท็บวัน เหมือนกันทุกตัวอย่างที่เลือก", () => {
    // batchNo ลงท้าย 1/6 → hasLabTrack จริง เพื่อให้แถวฝั่ง Lab ถูกสร้างขึ้นมาจริง
    const labTrackPetition = () => petition({
      status: "approved",
      items: [
        { seq: 1, sampleName: "Sample A", commonName: "ABAMECTIN 1.8% EC", batchNo: "BATCH-001", sampleId: "sample-1" },
        { seq: 2, sampleName: "Sample B", commonName: "EMAMECTIN 1.9% EC", batchNo: "BATCH-006", sampleId: "sample-2" },
      ],
      qcReceivedAt: at(13, 9),
      labReceivedAt: at(13, 10),
      assignedTo: { employeeId: "L001", name: "Lab Analyst", assignedAt: at(13, 11) },
      labCompletedAt: at(13, 14),
      labApprovedAt: at(13, 15),
      qcCompletedAt: at(13, 13),
      approvedAt: at(13, 16),
    });

    const build = (itemSeq: number | null) => model(
      labTrackPetition(),
      [requiredParameter],
      [],
      [],
      new Date(2026, 6, 13, 12),
      itemSeq,
    );

    const expectedRows = [
      { key: "submitted", label: "ส่งตัวอย่าง", kind: "milestone", track: "stage", at: at(13, 9), startAt: null, endAt: null, done: true },
      { key: "received-qc", label: "QC รับตัวอย่าง", kind: "milestone", track: "stage", at: at(13, 9), startAt: null, endAt: null, done: true },
      { key: "assigned", label: "มอบหมายงาน Lab", kind: "milestone", track: "stage", at: at(13, 11), startAt: null, endAt: null, done: true },
      { key: "received-lab", label: "Lab รับตัวอย่าง", kind: "milestone", track: "stage", at: at(13, 10), startAt: null, endAt: null, done: true },
      { key: "qc-analyzing", label: "QC กำลังวิเคราะห์", kind: "bar", track: "qc", at: null, startAt: at(13, 9), endAt: at(13, 13), done: true },
      { key: "lab-analyzing", label: "Lab กำลังวิเคราะห์", kind: "bar", track: "lab", at: null, startAt: at(13, 10), endAt: at(13, 14), done: true },
      { key: "pre-result", label: "Pre Result", kind: "bar", track: "lab", at: null, startAt: at(13, 14), endAt: at(13, 15), done: true },
      { key: "final", label: "Final Result", kind: "bar", track: "stage", at: null, startAt: at(13, 15), endAt: at(13, 16), done: true },
    ];

    expect(build(1).timeline.rows).toEqual(expectedRows);
    expect(build(2).timeline.rows).toEqual(expectedRows);
    expect(build(null).timeline.rows).toEqual(expectedRows);
    expect(build(1).timeline.days.map((day) => day.key)).toEqual(build(2).timeline.days.map((day) => day.key));
  });
```

- [ ] **Step 5: รันเทสต์ให้เห็นว่าแดง**

Run: `npx vitest run src/lib/petitionTimelineDetail.test.ts`
Expected: FAIL — TypeScript/runtime บอกว่าไม่มี row `qc-analyzing` และ `buildTimelineDetailModel` ยังต้องการ `qcResults`

- [ ] **Step 6: แก้ `makeBarRow` ให้รับ `done` แบบ override ได้**

ใน `src/lib/petitionTimelineDetail.ts` แทนที่ `makeBarRow` เดิม:

```ts
function makeBarRow(input: {
  key: string;
  label: string;
  track: TimelineDetailRowTrack;
  startAt: string | null;
  endAt: string | null;
  done?: boolean;
}): TimelineDetailRow {
  const start = validDate(input.startAt);
  const end = validDate(input.endAt);
  const complete = !!start && !!end;
  // กันข้อมูลเพี้ยน: ถ้า start มาหลัง end ให้ยุบเป็นแท่งสั้น ๆ ที่ end
  const orderedStart = complete && start.getTime() > end.getTime() ? end : start;
  return {
    key: input.key,
    label: input.label,
    kind: "bar",
    track: input.track,
    at: null,
    startAt: complete ? orderedStart.toISOString() : null,
    endAt: complete ? end.toISOString() : null,
    // แท่งที่ยังทำอยู่มี start/end ครบ (end = ตอนนี้) แต่ยังไม่ done
    done: input.done ?? complete,
  };
}
```

- [ ] **Step 7: เพิ่ม `buildAnalyzingRows` แทน `buildParameterRows`**

ลบฟังก์ชัน `buildParameterTouches` และ `buildParameterRows` ทั้งสองก้อนทิ้ง แล้วใส่ฟังก์ชันนี้แทนที่ตำแหน่งเดิม (ก่อน `buildClosingRows`):

```ts
function buildAnalyzingRows(petition: Petition, now: Date): TimelineDetailRow[] {
  const hasLab = hasLabTrack(petition);
  const qcStartAt = petition.qcReceivedAt ?? petition.receivedAt ?? null;
  const labStartAt = petition.labReceivedAt ?? null;

  // ยังไม่รับตัวอย่าง → ไม่มีแท่ง; รับแล้วแต่ยังไม่บันทึกครบ → ลากถึงตอนนี้ (done = false)
  const analyzing = (key: string, label: string, track: TimelineDetailRowTrack, startAt: string | null, completedAt: string | null) =>
    makeBarRow({
      key,
      label,
      track,
      startAt,
      endAt: startAt ? completedAt ?? now.toISOString() : null,
      done: !!startAt && !!completedAt,
    });

  return [
    analyzing("qc-analyzing", "QC กำลังวิเคราะห์", "qc", qcStartAt, petition.qcCompletedAt ?? null),
    hasLab ? analyzing("lab-analyzing", "Lab กำลังวิเคราะห์", "lab", labStartAt, petition.labCompletedAt ?? null) : null,
  ].filter((row): row is TimelineDetailRow => row !== null);
}
```

- [ ] **Step 8: ตัด `qcResults` ออกจาก input และต่อแถวใหม่เข้า model**

ใน `TimelineDetailInput` ลบบรรทัด `qcResults: QCTestResult[];` และแก้ import บรรทัดที่ 5 ให้เหลือ:

```ts
import { PETITION_STATUS_CONFIG, type Petition, type PetitionAuditLogEntry, type PetitionStatus } from "@/types/petition.types";
```

ใน `buildTimelineDetailModel` แทนที่การประกอบ `rows`:

```ts
  const rows = [
    ...buildMilestoneRows(input.petition),
    ...buildAnalyzingRows(input.petition, now),
    ...buildClosingRows(input.petition),
  ];
```

- [ ] **Step 9: เลิกส่ง `qcResults` เข้า model ในหน้าเพจ**

`src/pages/PetitionTimelineDetailPage.tsx` แก้ `useMemo` ที่สร้าง model (บรรทัด ~155-160):

```tsx
  const model = useMemo(
    () => petition && canViewPetition
      ? buildTimelineDetailModel({ petition, parameters: visibleParameters, progressEntries, auditLogs, itemGroupIds: groupMembership, itemSeq: selectedItemSeq })
      : null,
    [auditLogs, canViewPetition, groupMembership, petition, progressEntries, selectedItemSeq, visibleParameters],
  );
```

(state `qcResults` ยังอยู่ — เอกสาร print ใช้ต่อ)

- [ ] **Step 10: แก้เทสต์หน้าเพจที่อ้างแท่ง parameter**

ใน `src/pages/PetitionTimelineDetailPage.test.tsx`:

ลบเทสต์ `"วาดแท่ง parameter จากผลที่บันทึกไว้ใน QCTestResult ของคำร้องเก่า"` ทั้งเคส

ในเทสต์ `"renders one petition's header, required task progress, and same-day timeline"` เปลี่ยนบรรทัดสุดท้าย (`expect(screen.getAllByText("Required checks").length).toBeGreaterThanOrEqual(2);`) เป็น:

```tsx
    expect(screen.getByLabelText("Tasks")).toHaveTextContent("Required checks");
    expect(screen.getByLabelText("petition timeline")).not.toHaveTextContent("Required checks");
```

- [ ] **Step 11: รันเทสต์ให้เขียว + type-check**

Run: `npx vitest run src/lib/petitionTimelineDetail.test.ts src/pages/PetitionTimelineDetailPage.test.tsx`
Expected: PASS ทั้งสองไฟล์

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใน `petitionTimelineDetail.ts` / `PetitionTimelineDetailPage.tsx` (error เดิมของไฟล์อื่นปล่อยไว้)

- [ ] **Step 12: Commit**

```bash
git add src/lib/petitionTimelineDetail.ts src/lib/petitionTimelineDetail.test.ts src/pages/PetitionTimelineDetailPage.tsx src/pages/PetitionTimelineDetailPage.test.tsx
git commit -m "feat(timeline): แทนแถวราย parameter ด้วยแท่ง QC/Lab กำลังวิเคราะห์"
```

---

### Task 4: สีแท่งที่กำลังทำ (สีอ่อน ปลายขวาตรง)

**Files:**
- Modify: `src/pages/PetitionTimelineDetailPage.tsx` (`barTrackClass` ~52-57, การ render แถวใน `activeTimelineDay.rows.map` ~300-306)
- Test: `src/pages/PetitionTimelineDetailPage.test.tsx`

**Interfaces:**
- Consumes: `TimelineDetailDayRow.done` จาก Task 3 (แท่งกำลังทำ = มี `segmentStartAt`/`segmentEndAt` แต่ `done` = false)
- Produces: แท่ง `done` = false ได้ class `bg-primary-200` (qc) / `bg-amber-200` (lab) / `bg-grey-200` (stage) และ `rounded-r-none`

- [ ] **Step 1: เขียนเทสต์ที่ยังแดง**

เพิ่มเทสต์นี้ใน `src/pages/PetitionTimelineDetailPage.test.tsx` ต่อจากเทสต์ `"จุด milestone ไม่ลากเส้นยาวมาจากขอบซ้ายของแถว"` (คำร้อง mock มี `qcReceivedAt` แต่ไม่มี `qcCompletedAt` → แท่ง QC ยังไม่จบ):

```tsx
  it("แท่งที่ยังทำไม่เสร็จใช้สีอ่อนและปลายขวาตรง", async () => {
    renderDetail();

    const bar = await screen.findByLabelText("QC กำลังวิเคราะห์ (ช่วงเวลา)");
    expect(bar).toHaveClass("bg-primary-200");
    expect(bar).toHaveClass("rounded-r-none");
    expect(bar).not.toHaveClass("bg-primary-500");
  });

  it("แท่งที่ทำเสร็จแล้วใช้สีเข้มและปลายมน", async () => {
    Object.assign(mocks.petition, { qcCompletedAt: "2026-07-13T06:00:00.000Z" });
    renderDetail();

    const bar = await screen.findByLabelText("QC กำลังวิเคราะห์ (ช่วงเวลา)");
    expect(bar).toHaveClass("bg-primary-500");
    expect(bar).not.toHaveClass("rounded-r-none");
  });
```

เพิ่ม `qcCompletedAt: undefined` เข้าไปใน `Object.assign(mocks.petition, {...})` ของ `beforeEach` (ราวบรรทัด 97-103) เพื่อไม่ให้เคสที่สองรั่วไปเคสอื่น:

```tsx
  Object.assign(mocks.petition, {
    status: "inProgress",
    approvedAt: null,
    qcCompletedAt: undefined,
    qcReceivedBy: undefined,
    labReceivedBy: undefined,
    items: [{ seq: 1, sampleName: "Sample A", commonName: "ABAMECTIN 1.8% W/V EC", batchNo: "BATCH-002", lotNo: "LOT-88", sampleId: "sample-1" }],
  });
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าแดง**

Run: `npx vitest run src/pages/PetitionTimelineDetailPage.test.tsx`
Expected: FAIL — แท่งได้ class `bg-grey-200` (เพราะ `done` = false) ไม่ใช่ `bg-primary-200`

- [ ] **Step 3: แก้ `barTrackClass`**

ใน `src/pages/PetitionTimelineDetailPage.tsx` แทนที่ฟังก์ชันเดิม:

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

- [ ] **Step 4: ตัดปลายขวาของแท่งที่ยังไม่จบ**

ในบรรทัด render แท่ง (ภายใน `activeTimelineDay.rows.map`) เพิ่ม `!row.done && "rounded-r-none"` ต่อท้าย `cn(...)` ของ div แท่ง:

```tsx
{row.visible && row.kind === "bar" && start != null && width != null && <div aria-label={`${row.label} (ช่วงเวลา)`} title={row.continuesBefore || row.continuesAfter ? "ต่อเนื่องข้ามวัน" : undefined} className={cn("absolute top-2 h-2 rounded-full", barTrackClass(row.track, row.done), row.continuesBefore && "rounded-l-none", (row.continuesAfter || !row.done) && "rounded-r-none")} style={{ left: `${start}%`, width: `${width}%` }} />}
```

- [ ] **Step 5: รันเทสต์ให้เขียว**

Run: `npx vitest run src/pages/PetitionTimelineDetailPage.test.tsx`
Expected: PASS ทุกเคส

- [ ] **Step 6: รันเทสต์ทั้ง suite + type-check**

Run: `npm run test`
Expected: PASS ทั้งหมด (ไม่มีเทสต์ไฟล์อื่นพังจากการลบ `qcResults` ออกจาก `TimelineDetailInput`)

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่ในสองไฟล์ที่แก้

- [ ] **Step 7: Commit**

```bash
git add src/pages/PetitionTimelineDetailPage.tsx src/pages/PetitionTimelineDetailPage.test.tsx
git commit -m "feat(timeline): แท่งที่กำลังวิเคราะห์ใช้สีอ่อนและปลายขวาตรง"
```
