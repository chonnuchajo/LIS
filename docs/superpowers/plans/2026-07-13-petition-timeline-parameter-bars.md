# Petition Timeline — parameter bars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เปลี่ยนการ์ด "Project Timeline" ของหน้า `/petition-timeline/:id` จากแถวสถานะตายตัวที่ทุกแท่งเริ่มจากศูนย์ → เป็นจุด milestone (QC/Lab รับตัวอย่าง, มอบหมาย) + แถว parameter รายตัวที่มีช่วงเวลาจริงของตัวเอง

**Architecture:** logic ทั้งหมดอยู่ใน pure module `src/lib/petitionTimelineDetail.ts` (Vitest, ไม่แตะ backend) — เปลี่ยน `TimelineDetailStage` เป็น `TimelineDetailRow` ที่มีทั้งชนิด `milestone` (จุด) และ `bar` (ช่วงเวลา) แล้วตัดเข้าหน้าต่างรายวันด้วย `clipRowToDay` ก่อนส่งให้หน้าเว็บวาด เวลาที่ใส่ค่า parameter ดึงจาก audit log (`resultEntered`/`resultUpdated` → `metadata.parameterId` + `metadata.itemSeq`) และ fallback ไป `QCTestResult.updatedAt ?? enteredAt` สำหรับคำร้องเก่าที่ยังไม่มี audit ระดับ field

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind + Vitest + Testing Library

**Spec:** `docs/superpowers/specs/2026-07-13-petition-timeline-parameter-bars-design.md`

## Global Constraints

- **มี session อื่นแก้ไฟล์ชุดเดียวกันค้างอยู่ (uncommitted)** — งานนี้ต่อยอดบน working tree ปัจจุบัน (WORK_END_HOUR=17 + day tabs) **commit ด้วย explicit pathspec เท่านั้น** ห้าม `git add -A` / `git commit -a`
- Test: `npx vitest run src/lib/petitionTimelineDetail.test.ts src/pages/PetitionTimelineDetailPage.test.tsx`
- Type-check: `npx tsc -p tsconfig.app.json --noEmit` — repo มี latent error ~12 ตัวอยู่แล้ว **ห้ามเพิ่มตัวใหม่ในไฟล์ที่แก้** (`npx tsc --noEmit` เฉย ๆ เป็น no-op — root tsconfig มี `files: []`)
- **ห้ามรัน `npm run build`** (postbuild เขียนทับ root files แล้ว dev server พัง)
- label ทั้งหมดเป็นภาษาไทย ตามข้อความที่ระบุในแผนนี้เป๊ะ ๆ
- `tsconfig` ผ่อนปรน (`strictNullChecks: false`) — ไม่ต้องใส่ non-null assertion เกินจำเป็น

## File Structure

| ไฟล์ | หน้าที่ | การเปลี่ยนแปลง |
|---|---|---|
| `src/lib/petitionTimelineDetail.ts` | pure model builder | เปลี่ยน stage → row (milestone/bar), เพิ่ม parameter rows + day clipping |
| `src/lib/petitionTimelineDetail.test.ts` | Vitest ของ pure module | เขียนเคสใหม่แทนเคส stages |
| `src/pages/PetitionTimelineDetailPage.tsx` | หน้า React | วาด row ใหม่ + โหลด qcResults ตั้งแต่แรก |
| `src/pages/PetitionTimelineDetailPage.test.tsx` | Vitest ของหน้า | ปรับ assertion ที่ชนกับแถวใหม่ |

---

### Task 1: Row model — milestone + closing bars

เปลี่ยน `TimelineDetailStage` เป็น `TimelineDetailRow` และแทน `buildStages()` ด้วย milestone rows (QC รับ / Lab รับ / มอบหมาย) + closing bars (ออกผล Lab / Final Result) — **ยังไม่ทำแถว parameter** (Task 2)

**Files:**
- Modify: `src/lib/petitionTimelineDetail.ts`
- Test: `src/lib/petitionTimelineDetail.test.ts`

**Interfaces:**
- Consumes: `hasLabTrack(petition)` จาก `@/lib/statusBadge`, `validDate()` / `latestValidDate()` / `FINISHED_STATUSES` ที่มีอยู่ในไฟล์แล้ว
- Produces:
  - `type TimelineDetailRowKind = "milestone" | "bar"`
  - `type TimelineDetailRowTrack = "qc" | "lab" | "stage"`
  - `type TimelineDetailRow = { key: string; label: string; kind: TimelineDetailRowKind; track: TimelineDetailRowTrack; at: string | null; startAt: string | null; endAt: string | null; done: boolean }`
  - `function makeBarRow(input: { key: string; label: string; track: TimelineDetailRowTrack; startAt: string | null; endAt: string | null }): TimelineDetailRow`
  - `model.timeline.rows: TimelineDetailRow[]` (แทน `model.timeline.stages`)
  - `TimelineDetailDay.stages` ยังคงอยู่ชั่วคราวจนถึง Task 3

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

ลบเทสต์เก่า 2 ตัวที่อ้าง `timeline.stages` (`"shows Lab assignment, completion, and result stages only for petitions with Lab work"` และ `"hides Lab timeline stages for petitions without Lab work"`) แล้วใส่ชุดนี้แทนท้าย `describe("buildTimelineDetailModel", ...)`:

```ts
  it("แสดง QC/Lab รับตัวอย่าง และมอบหมายงาน เป็นจุด milestone ไม่มีแท่ง", () => {
    const result = model(petition({
      items: [{ seq: 1, sampleName: "Lab Sample", batchNo: "BATCH-001", sampleId: "sample-1" }],
      qcReceivedAt: at(13, 9),
      labReceivedAt: at(13, 10),
      assignedTo: { employeeId: "L001", name: "Lab Analyst", assignedAt: at(13, 11) },
    }));

    expect(result.timeline.rows.filter((row) => row.kind === "milestone")).toMatchObject([
      { key: "received-qc", label: "QC รับตัวอย่าง", at: at(13, 9), startAt: null, endAt: null, done: true },
      { key: "received-lab", label: "Lab รับตัวอย่าง", at: at(13, 10), done: true },
      { key: "assigned", label: "มอบหมายงาน Lab", at: at(13, 11), done: true },
    ]);
  });

  it("ตัดแถวสถานะเก่า (บันทึกผล / QC ครบ / Lab ครบ) ออกจาก timeline", () => {
    const result = model(petition({ qcReceivedAt: at(13, 9), firstResultAt: at(13, 10), qcCompletedAt: at(13, 12) }));

    expect(result.timeline.rows.map((row) => row.key)).not.toContain("results");
    expect(result.timeline.rows.map((row) => row.key)).not.toContain("qc-completed");
    expect(result.timeline.rows.map((row) => row.key)).not.toContain("lab-completed");
  });

  it("ซ่อนแถวฝั่ง Lab ทั้งหมดสำหรับคำร้องที่ไม่มีงาน Lab", () => {
    const result = model(petition({
      qcReceivedAt: at(13, 9),
      assignedTo: { employeeId: "L001", name: "Stray Lab Analyst", assignedAt: at(13, 11) },
    }));

    expect(result.timeline.rows.map((row) => row.key)).toEqual(["received-qc", "final"]);
  });

  it("ลากแท่ง ออกผล Lab จาก Lab บันทึกครบ ถึง Lab อนุมัติ", () => {
    const result = model(petition({
      items: [{ seq: 1, sampleName: "Lab Sample", batchNo: "BATCH-001", sampleId: "sample-1" }],
      qcReceivedAt: at(13, 9),
      labCompletedAt: at(13, 14),
      labApprovedAt: at(13, 15),
    }));

    expect(result.timeline.rows.find((row) => row.key === "lab-approved")).toMatchObject({
      label: "ออกผล Lab",
      kind: "bar",
      track: "lab",
      startAt: at(13, 14),
      endAt: at(13, 15),
      done: true,
    });
  });

  it("ไม่วาดแท่ง ออกผล Lab เมื่อยังไม่อนุมัติ", () => {
    const result = model(petition({
      items: [{ seq: 1, sampleName: "Lab Sample", batchNo: "BATCH-001", sampleId: "sample-1" }],
      qcReceivedAt: at(13, 9),
      labCompletedAt: at(13, 14),
    }));

    expect(result.timeline.rows.find((row) => row.key === "lab-approved")).toMatchObject({
      startAt: null,
      endAt: null,
      done: false,
    });
  });

  it("ลากแท่ง Final Result จาก QC ครบ + Lab ออกผล (เอาอันที่ช้ากว่า) ถึงอนุมัติ", () => {
    const result = model(petition({
      status: "approved",
      items: [{ seq: 1, sampleName: "Lab Sample", batchNo: "BATCH-001", sampleId: "sample-1" }],
      qcReceivedAt: at(13, 9),
      qcCompletedAt: at(13, 13),
      labCompletedAt: at(13, 14),
      labApprovedAt: at(13, 15),
      approvedAt: at(13, 16),
    }));

    expect(result.timeline.rows.find((row) => row.key === "final")).toMatchObject({
      label: "Final Result",
      kind: "bar",
      track: "stage",
      startAt: at(13, 15),
      endAt: at(13, 16),
      done: true,
    });
  });

  it("Final Result ของคำร้องที่ไม่มี Lab เริ่มที่ QC ครบ", () => {
    const result = model(petition({
      status: "approved",
      qcReceivedAt: at(13, 9),
      qcCompletedAt: at(13, 13),
      approvedAt: at(13, 16),
    }));

    expect(result.timeline.rows.find((row) => row.key === "final")).toMatchObject({
      startAt: at(13, 13),
      endAt: at(13, 16),
    });
  });

  it("คำร้องที่ถูกส่งกลับแก้ไข ใช้ชื่อแถวและเวลา rejected", () => {
    const result = model(petition({
      status: "rejected",
      qcReceivedAt: at(13, 9),
      qcCompletedAt: at(13, 13),
      rejectedAt: at(13, 14),
    }));

    expect(result.timeline.rows.find((row) => row.key === "final")).toMatchObject({
      label: "ส่งกลับแก้ไข",
      startAt: at(13, 13),
      endAt: at(13, 14),
      done: true,
    });
  });
```

เทสต์เดิม `"splits multi-day timelines into local day windows"` ยังอ้าง `days[n].stages` — แก้ 2 บรรทัดสุดท้ายเป็น:

```ts
    expect(result.timeline.days[0]?.stages.map((stage) => stage.key)).toContain("received-qc");
    expect(result.timeline.days[1]?.stages.map((stage) => stage.key)).toEqual([]);
```

(บรรทัดนี้จะถูกเขียนใหม่อีกทีใน Task 3 ตอนที่ `days[n].stages` เปลี่ยนเป็น `days[n].rows`)

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run src/lib/petitionTimelineDetail.test.ts`
Expected: FAIL — `result.timeline.rows` เป็น `undefined` (ยังไม่มี field นี้)

- [ ] **Step 3: เขียน implementation**

ใน `src/lib/petitionTimelineDetail.ts` เปลี่ยน type declaration (บรรทัด 20) จาก `TimelineDetailStage` เป็น:

```ts
export type TimelineDetailRowKind = "milestone" | "bar";
export type TimelineDetailRowTrack = "qc" | "lab" | "stage";
export type TimelineDetailRow = {
  key: string;
  label: string;
  kind: TimelineDetailRowKind;
  track: TimelineDetailRowTrack;
  at: string | null;
  startAt: string | null;
  endAt: string | null;
  done: boolean;
};
```

`TimelineDetailDay.stages` เปลี่ยนชนิดเป็น `TimelineDetailRow[]` (ชื่อ field ยังเป็น `stages` — Task 3 จะเปลี่ยนชื่อ)
`TimelineDetailModel.timeline` เปลี่ยน `stages: TimelineDetailStage[]` → `rows: TimelineDetailRow[]` และคง `days` ไว้

แทน `buildStages()` (บรรทัด 292-303) ด้วย:

```ts
function makeBarRow(input: {
  key: string;
  label: string;
  track: TimelineDetailRowTrack;
  startAt: string | null;
  endAt: string | null;
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
    done: complete,
  };
}

function buildMilestoneRows(petition: Petition): TimelineDetailRow[] {
  const hasLab = hasLabTrack(petition);
  const qcReceivedAt = petition.qcReceivedAt ?? petition.receivedAt ?? null;
  const labReceivedAt = petition.labReceivedAt ?? null;
  const assignedAt = petition.assignedTo?.assignedAt ?? null;
  const milestone = (key: string, label: string, at: string | null): TimelineDetailRow =>
    ({ key, label, kind: "milestone", track: "stage", at, startAt: null, endAt: null, done: !!validDate(at) });

  return [
    milestone("received-qc", "QC รับตัวอย่าง", qcReceivedAt),
    hasLab ? milestone("received-lab", "Lab รับตัวอย่าง", labReceivedAt) : null,
    hasLab ? milestone("assigned", "มอบหมายงาน Lab", assignedAt) : null,
  ].filter((row): row is TimelineDetailRow => row !== null);
}

function buildClosingRows(petition: Petition): TimelineDetailRow[] {
  const hasLab = hasLabTrack(petition);
  const labApprovedAt = petition.labApprovedAt ?? null;
  const qcCompletedAt = petition.qcCompletedAt ?? null;
  // Final เริ่มเมื่อ "ทั้งสองฝั่งจบ" — คำร้องที่มี Lab ต้องรอ Lab ออกผลด้วย
  const finalStartAt = hasLab
    ? (qcCompletedAt && labApprovedAt ? latestValidDate(qcCompletedAt, labApprovedAt) : null)
    : qcCompletedAt;
  const finalEndAt = petition.status === "rejected"
    ? petition.rejectedAt ?? null
    : petition.approvedAt ?? null;

  return [
    hasLab ? makeBarRow({
      key: "lab-approved",
      label: "ออกผล Lab",
      track: "lab",
      startAt: petition.labCompletedAt ?? null,
      endAt: labApprovedAt,
    }) : null,
    makeBarRow({
      key: "final",
      label: petition.status === "rejected" ? "ส่งกลับแก้ไข" : "Final Result",
      track: "stage",
      startAt: finalStartAt,
      endAt: finalEndAt,
    }),
  ].filter((row): row is TimelineDetailRow => row !== null);
}
```

ใน `buildTimelineDetailModel` เปลี่ยนบรรทัด `const stages = buildStages(...)` เป็น:

```ts
  const rows = [...buildMilestoneRows(input.petition), ...buildClosingRows(input.petition)];
```

และใน return object เปลี่ยน `timeline` เป็น:

```ts
    timeline: {
      startAt: atHour(new Date(startAt), WORK_START_HOUR).toISOString(),
      endAt: header.endAt,
      ticks: buildTicks(startAt, header.endAt),
      rows,
      days: buildTimelineDays(startAt, header.endAt, rows),
    },
```

`buildTimelineDays` รับ `stages: TimelineDetailStage[]` → เปลี่ยน signature เป็น `rows: TimelineDetailRow[]` (ข้างในกรองด้วย `stage.at` อยู่แล้ว → เปลี่ยนชื่อตัวแปรเป็น `row.at` ให้ตรง) โค้ดที่เหลือของฟังก์ชันไม่ต้องแก้ใน task นี้

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/lib/petitionTimelineDetail.test.ts`
Expected: PASS ทุกตัว (หน้าเว็บยัง compile ไม่ผ่านเพราะยังอ้าง `model.timeline.stages` — ปกติ จะแก้ Task 4)

- [ ] **Step 5: Commit**

```bash
git add src/lib/petitionTimelineDetail.ts src/lib/petitionTimelineDetail.test.ts
git commit -m "refactor(timeline): แทน stage rows ด้วย milestone/bar rows"
```

---

### Task 2: แถว parameter (audit log + QCTestResult fallback)

**Files:**
- Modify: `src/lib/petitionTimelineDetail.ts`
- Test: `src/lib/petitionTimelineDetail.test.ts`

**Interfaces:**
- Consumes: `makeBarRow`, `TimelineDetailRow` จาก Task 1 · `matchParametersForItem` จาก `@/lib/petitionTestItems` · `QCTestResult` จาก `@/types/petition.types`
- Produces:
  - `TimelineDetailInput` เพิ่ม field `qcResults: QCTestResult[]` (required)
  - `function buildParameterRows(petition, parameters, auditLogs, qcResults, itemGroupIds, fallbackStartAt): TimelineDetailRow[]` — คืนแถว key `param::<parameterId>`
  - แถว parameter แทรกอยู่ระหว่าง milestone rows กับ closing rows ใน `model.timeline.rows`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

แก้ helper `model()` ที่หัวไฟล์เทสต์ ให้รับ `qcResults`:

```ts
function model(
  petitionData: Petition,
  parameters: ParameterItem[] = [],
  progressEntries: QCProgressEntry[] = [],
  auditLogs: PetitionAuditLogEntry[] = [],
  now = new Date(2026, 6, 13, 12),
  qcResults: QCTestResult[] = [],
) {
  return buildTimelineDetailModel({ petition: petitionData, parameters, progressEntries, auditLogs, qcResults }, now);
}
```

เพิ่ม import `QCTestResult` เข้า type import ที่บรรทัด 3:

```ts
import type { Petition, PetitionAuditLogEntry, QCTestResult } from "@/types/petition.types";
```

เพิ่ม fixture + เทสต์ต่อท้าย `describe`:

```ts
  const labParameter: ParameterItem = {
    _id: "parameter-lab",
    name: "Lab assay",
    scope: "lab",
    status: "active",
    applyAll: true,
    valueFields: [{ label: "Assay", type: "number", required: true }],
  };

  const resultAudit = (id: string, parameterId: string, itemSeq: number, createdAt: string, event: "resultEntered" | "resultUpdated" = "resultEntered"): PetitionAuditLogEntry => ({
    _id: id,
    petitionId: "petition-1",
    petitionNo: "P-2607-001",
    event,
    actor: "Analyst",
    metadata: { parameterId, itemSeq },
    createdAt,
  });

  it("ลากแท่ง parameter จาก QC รับตัวอย่าง ถึงเวลาที่ใส่ค่า", () => {
    const result = model(
      petition({ qcReceivedAt: at(13, 9) }),
      [requiredParameter],
      [],
      [resultAudit("audit-1", "parameter-1", 1, at(13, 11))],
    );

    expect(result.timeline.rows.find((row) => row.key === "param::parameter-1")).toMatchObject({
      label: "Required checks",
      kind: "bar",
      track: "qc",
      startAt: at(13, 9),
      endAt: at(13, 11),
      done: true,
    });
  });

  it("ยืดแท่ง parameter ไปถึงการแก้ค่าครั้งล่าสุด", () => {
    const result = model(
      petition({ qcReceivedAt: at(13, 9) }),
      [requiredParameter],
      [],
      [
        resultAudit("audit-1", "parameter-1", 1, at(13, 11)),
        resultAudit("audit-2", "parameter-1", 1, at(13, 13), "resultUpdated"),
      ],
    );

    expect(result.timeline.rows.find((row) => row.key === "param::parameter-1")).toMatchObject({ endAt: at(13, 13) });
  });

  it("แถว parameter ฝั่ง Lab เริ่มที่ Lab รับตัวอย่าง", () => {
    const result = model(
      petition({
        items: [{ seq: 1, sampleName: "Lab Sample", batchNo: "BATCH-001", sampleId: "sample-1" }],
        qcReceivedAt: at(13, 9),
        labReceivedAt: at(13, 10),
      }),
      [labParameter],
      [],
      [resultAudit("audit-1", "parameter-lab", 1, at(13, 14))],
    );

    expect(result.timeline.rows.find((row) => row.key === "param::parameter-lab")).toMatchObject({
      track: "lab",
      startAt: at(13, 10),
      endAt: at(13, 14),
    });
  });

  it("รวมหลายตัวอย่างเป็นแถวเดียว และไม่วาดแท่งจนกว่าจะใส่ค่าครบทุกตัวอย่าง", () => {
    const twoItems = petition({
      qcReceivedAt: at(13, 9),
      items: [
        { seq: 1, sampleName: "Sample A", batchNo: "BATCH-002", sampleId: "sample-1" },
        { seq: 2, sampleName: "Sample B", batchNo: "BATCH-003", sampleId: "sample-2" },
      ],
    });

    const partial = model(twoItems, [requiredParameter], [], [resultAudit("audit-1", "parameter-1", 1, at(13, 11))]);
    const paramRows = partial.timeline.rows.filter((row) => row.key.startsWith("param::"));
    expect(paramRows).toHaveLength(1);
    expect(paramRows[0]).toMatchObject({ startAt: null, endAt: null, done: false });

    const complete = model(twoItems, [requiredParameter], [], [
      resultAudit("audit-1", "parameter-1", 1, at(13, 11)),
      resultAudit("audit-2", "parameter-1", 2, at(13, 15)),
    ]);
    expect(complete.timeline.rows.find((row) => row.key === "param::parameter-1")).toMatchObject({
      startAt: at(13, 9),
      endAt: at(13, 15),
    });
  });

  it("ใช้เวลาจาก QCTestResult เมื่อคำร้องเก่ายังไม่มี audit log ระดับ field", () => {
    const result = model(
      petition({ qcReceivedAt: at(13, 9) }),
      [requiredParameter],
      [],
      [],
      new Date(2026, 6, 13, 12),
      [{ petitionId: "petition-1", itemSeq: 1, parameterId: "parameter-1", values: {}, enteredAt: at(13, 10), updatedAt: at(13, 12) }],
    );

    expect(result.timeline.rows.find((row) => row.key === "param::parameter-1")).toMatchObject({ endAt: at(13, 12) });
  });

  it("เรียงแถว: milestone → parameter QC → parameter Lab → ออกผล Lab → Final Result", () => {
    const result = model(
      petition({
        items: [{ seq: 1, sampleName: "Lab Sample", batchNo: "BATCH-001", sampleId: "sample-1" }],
        qcReceivedAt: at(13, 9),
        labReceivedAt: at(13, 10),
      }),
      [labParameter, requiredParameter],
      [],
      [],
    );

    expect(result.timeline.rows.map((row) => row.key)).toEqual([
      "received-qc",
      "received-lab",
      "assigned",
      "param::parameter-1",
      "param::parameter-lab",
      "lab-approved",
      "final",
    ]);
  });
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run src/lib/petitionTimelineDetail.test.ts`
Expected: FAIL — ไม่มีแถว `param::parameter-1` ใน `timeline.rows`

- [ ] **Step 3: เขียน implementation**

เพิ่ม `QCTestResult` เข้า type import บรรทัด 5 ของ `src/lib/petitionTimelineDetail.ts`:

```ts
import { PETITION_STATUS_CONFIG, type Petition, type PetitionAuditLogEntry, type PetitionStatus, type QCTestResult } from "@/types/petition.types";
```

เพิ่ม `qcResults` เข้า `TimelineDetailInput`:

```ts
export type TimelineDetailInput = {
  petition: Petition;
  parameters: ParameterItem[];
  progressEntries: QCProgressEntry[];
  auditLogs: PetitionAuditLogEntry[];
  qcResults: QCTestResult[];
  itemGroupIds?: Map<string, string[]>;
};
```

เพิ่ม helper อ่านตัวเลขจาก metadata (วางใต้ `metadataString`):

```ts
function metadataNumber(metadata: Record<string, unknown> | undefined, key: string): number | null {
  const value = metadata?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}
```

เพิ่มฟังก์ชันสร้างแถว parameter (วางใต้ `buildMilestoneRows`):

```ts
// เวลาล่าสุดที่มีคน "แตะ" แต่ละคู่ (itemSeq, parameterId) — audit log เป็นหลัก, QCTestResult เป็น fallback ของคำร้องเก่า
function buildParameterTouches(auditLogs: PetitionAuditLogEntry[], qcResults: QCTestResult[]): Map<string, string> {
  const latest = new Map<string, number>();

  for (const entry of auditLogs) {
    if (entry.event !== "resultEntered" && entry.event !== "resultUpdated") continue;
    const parameterId = metadataString(entry.metadata, "parameterId");
    const itemSeq = metadataNumber(entry.metadata, "itemSeq");
    const touchedAt = validDate(entry.createdAt);
    if (!parameterId || itemSeq == null || !touchedAt) continue;
    const key = `${itemSeq}::${parameterId}`;
    latest.set(key, Math.max(latest.get(key) ?? 0, touchedAt.getTime()));
  }

  for (const result of qcResults) {
    const key = `${result.itemSeq}::${result.parameterId}`;
    if (latest.has(key)) continue;
    const touchedAt = validDate(result.updatedAt ?? result.enteredAt);
    if (touchedAt) latest.set(key, touchedAt.getTime());
  }

  return new Map(Array.from(latest, ([key, time]) => [key, new Date(time).toISOString()]));
}

function buildParameterRows(
  petition: Petition,
  parameters: ParameterItem[],
  auditLogs: PetitionAuditLogEntry[],
  qcResults: QCTestResult[],
  itemGroupIds: Map<string, string[]> | undefined,
  fallbackStartAt: string,
): TimelineDetailRow[] {
  const touches = buildParameterTouches(auditLogs, qcResults);
  const groups = new Map<string, { parameter: ParameterItem; pairKeys: string[] }>();

  for (const item of petition.items ?? []) {
    const groupIds = itemGroupIds?.get(String(item.sampleId ?? "").trim()) ?? [];
    for (const parameter of matchParametersForItem(item, parameters, groupIds)) {
      const parameterId = parameter._id;
      if (!parameterId) continue;
      const group = groups.get(parameterId) ?? { parameter, pairKeys: [] };
      group.pairKeys.push(`${item.seq}::${parameterId}`);
      groups.set(parameterId, group);
    }
  }

  const rows = Array.from(groups, ([parameterId, group]) => {
    const isLab = group.parameter.scope === "lab";
    const receivedAt = (isLab ? petition.labReceivedAt : petition.qcReceivedAt) ?? fallbackStartAt;
    const touchedAts = group.pairKeys.map((key) => touches.get(key) ?? null);
    // ยังแตะไม่ครบทุกตัวอย่าง → ไม่วาดแท่ง
    const endAt = touchedAts.every((touchedAt) => !!touchedAt) ? latestValidDate(...touchedAts) : null;
    return makeBarRow({
      key: `param::${parameterId}`,
      label: group.parameter.name,
      track: isLab ? "lab" : "qc",
      startAt: endAt ? receivedAt : null,
      endAt,
    });
  });

  // QC ก่อน Lab (Array.prototype.sort เสถียร → ลำดับเดิมภายในกลุ่มคงอยู่)
  return rows.sort((left, right) => Number(left.track === "lab") - Number(right.track === "lab"));
}
```

ใน `buildTimelineDetailModel` เปลี่ยนบรรทัดที่ประกอบ `rows` เป็น:

```ts
  const rows = [
    ...buildMilestoneRows(input.petition),
    ...buildParameterRows(input.petition, input.parameters, input.auditLogs, input.qcResults ?? [], input.itemGroupIds, startAt),
    ...buildClosingRows(input.petition),
  ];
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/lib/petitionTimelineDetail.test.ts`
Expected: PASS ทุกตัว

- [ ] **Step 5: Commit**

```bash
git add src/lib/petitionTimelineDetail.ts src/lib/petitionTimelineDetail.test.ts
git commit -m "feat(timeline): เพิ่มแถว parameter รายตัวพร้อมช่วงเวลาจริง"
```

---

### Task 3: ตัดแถวเข้าหน้าต่างรายวัน (day clipping)

**Files:**
- Modify: `src/lib/petitionTimelineDetail.ts`
- Test: `src/lib/petitionTimelineDetail.test.ts`

**Interfaces:**
- Consumes: `TimelineDetailRow` (Task 1), `buildTimelineDays()` ที่มีอยู่แล้วในไฟล์
- Produces:
  - `type TimelineDetailDayRow = TimelineDetailRow & { visible: boolean; segmentStartAt: string | null; segmentEndAt: string | null; continuesBefore: boolean; continuesAfter: boolean }`
  - `TimelineDetailDay.stages` → เปลี่ยนชื่อเป็น `rows: TimelineDetailDayRow[]` — **ทุกวันมีครบทุกแถวเสมอ** (แถวที่ไม่มีอะไรวาดจะได้ `visible: false`)

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

แก้เทสต์ `"splits multi-day timelines into local day windows"` — 2 บรรทัดท้ายเปลี่ยนเป็น:

```ts
    expect(result.timeline.days[0]?.rows.find((row) => row.key === "received-qc")).toMatchObject({ visible: true });
    expect(result.timeline.days[1]?.rows.find((row) => row.key === "received-qc")).toMatchObject({ visible: false });
```

แล้วเพิ่มเทสต์ต่อท้าย `describe`:

```ts
  it("ทุกแท็บวันมีครบทุกแถว เพื่อให้ลำดับแถวไม่ขยับ", () => {
    const result = model(
      petition({ qcReceivedAt: at(12, 10), qcCompletedAt: at(13, 9) }),
      [requiredParameter],
      [],
      [resultAudit("audit-1", "parameter-1", 1, at(13, 11))],
      new Date(2026, 6, 13, 12),
    );

    const keysByDay = result.timeline.days.map((day) => day.rows.map((row) => row.key));
    expect(keysByDay[0]).toEqual(result.timeline.rows.map((row) => row.key));
    expect(keysByDay[1]).toEqual(result.timeline.rows.map((row) => row.key));
  });

  it("ตัดแท่งที่กินข้ามวันให้พอดีหน้าต่างของแต่ละวัน พร้อมบอกว่าต่อเนื่อง", () => {
    const result = model(
      petition({ qcReceivedAt: at(12, 10) }),
      [requiredParameter],
      [],
      [resultAudit("audit-1", "parameter-1", 1, at(13, 11))],
      new Date(2026, 6, 13, 12),
    );

    const firstDay = result.timeline.days[0]?.rows.find((row) => row.key === "param::parameter-1");
    expect(firstDay).toMatchObject({
      visible: true,
      segmentStartAt: at(12, 10),
      segmentEndAt: at(12, 17),
      continuesBefore: false,
      continuesAfter: true,
    });

    const secondDay = result.timeline.days[1]?.rows.find((row) => row.key === "param::parameter-1");
    expect(secondDay).toMatchObject({
      visible: true,
      segmentStartAt: at(13, 8),
      segmentEndAt: at(13, 11),
      continuesBefore: true,
      continuesAfter: false,
    });
  });

  it("แถวที่ไม่มีแท่งหรือจุดในวันนั้น ได้ visible = false", () => {
    const result = model(petition({ qcReceivedAt: at(13, 9) }), [requiredParameter], [], []);

    expect(result.timeline.days[0]?.rows.find((row) => row.key === "param::parameter-1")).toMatchObject({
      visible: false,
      segmentStartAt: null,
      segmentEndAt: null,
    });
  });
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run src/lib/petitionTimelineDetail.test.ts`
Expected: FAIL — `day.rows` เป็น `undefined`

- [ ] **Step 3: เขียน implementation**

เพิ่ม type + ฟังก์ชันตัดวัน แล้วแก้ `TimelineDetailDay`:

```ts
export type TimelineDetailDayRow = TimelineDetailRow & {
  visible: boolean;
  segmentStartAt: string | null;
  segmentEndAt: string | null;
  continuesBefore: boolean;
  continuesAfter: boolean;
};
export type TimelineDetailDay = {
  key: string;
  label: string;
  startAt: string;
  endAt: string;
  ticks: TimelineDetailTick[];
  rows: TimelineDetailDayRow[];
};
```

เพิ่มฟังก์ชัน (วางเหนือ `buildTimelineDays`):

```ts
function clipRowToDay(row: TimelineDetailRow, dayStartAt: string, dayEndAt: string): TimelineDetailDayRow {
  const dayStart = new Date(dayStartAt).getTime();
  const dayEnd = new Date(dayEndAt).getTime();
  const hidden: TimelineDetailDayRow = {
    ...row,
    visible: false,
    segmentStartAt: null,
    segmentEndAt: null,
    continuesBefore: false,
    continuesAfter: false,
  };

  if (row.kind === "milestone") {
    const at = validDate(row.at)?.getTime();
    if (at == null || at < dayStart || at > dayEnd) return hidden;
    return { ...hidden, visible: true };
  }

  const start = validDate(row.startAt)?.getTime();
  const end = validDate(row.endAt)?.getTime();
  if (start == null || end == null || end < dayStart || start > dayEnd) return hidden;

  return {
    ...row,
    visible: true,
    segmentStartAt: new Date(Math.max(start, dayStart)).toISOString(),
    segmentEndAt: new Date(Math.min(end, dayEnd)).toISOString(),
    continuesBefore: start < dayStart,
    continuesAfter: end > dayEnd,
  };
}
```

ใน `buildTimelineDays` เปลี่ยน parameter `stages: TimelineDetailRow[]` → `rows: TimelineDetailRow[]` แล้วแทนบล็อก `const visibleStages = stages.filter(...)` + `days.push({...})` ด้วย:

```ts
    days.push({
      key: localDayKey(cursor),
      label: formatDayLabel(cursor),
      startAt: dayStart.toISOString(),
      endAt: dayEnd.toISOString(),
      ticks: buildTicks(dayStart.toISOString(), dayEnd.toISOString()),
      rows: rows.map((row) => clipRowToDay(row, dayStart.toISOString(), dayEnd.toISOString())),
    });
```

และใน fallback `return days.length ? days : [{ ... stages: [] }]` เปลี่ยน `stages: []` เป็น:

```ts
    rows: rows.map((row) => clipRowToDay(
      row,
      atHour(start, WORK_START_HOUR).toISOString(),
      atHour(start, WORK_END_HOUR).toISOString(),
    )),
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/lib/petitionTimelineDetail.test.ts`
Expected: PASS ทุกตัว

- [ ] **Step 5: Commit**

```bash
git add src/lib/petitionTimelineDetail.ts src/lib/petitionTimelineDetail.test.ts
git commit -m "feat(timeline): ตัดแท่งข้ามวันให้พอดีหน้าต่างของแต่ละแท็บวัน"
```

---

### Task 4: หน้าเว็บ — วาดจุด/แท่ง + โหลด QCTestResult ตั้งแต่แรก

**Files:**
- Modify: `src/pages/PetitionTimelineDetailPage.tsx`
- Test: `src/pages/PetitionTimelineDetailPage.test.tsx`

**Interfaces:**
- Consumes: `model.timeline.rows`, `activeTimelineDay.rows` (`TimelineDetailDayRow[]`) จาก Task 1-3
- Produces: หน้าเว็บที่ compile ผ่าน + ยิง `api.getQCResults` ครั้งเดียวต่อคำร้อง (ใช้ทั้ง timeline และปุ่มพิมพ์)

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

ใน `src/pages/PetitionTimelineDetailPage.test.tsx` เทสต์แรก (`"renders one petition's header, required task progress, and same-day timeline"`) มีบรรทัด `expect(screen.getByText("Required checks")).toBeInTheDocument();` — ตอนนี้ชื่อ parameter จะโผล่ 2 ที่ (แถว timeline + การ์ด Tasks) ทำให้ `getByText` พัง เปลี่ยนเป็น:

```ts
    expect(screen.getAllByText("Required checks").length).toBeGreaterThanOrEqual(2);
```

แล้วเพิ่มเทสต์ต่อท้าย `describe`:

```ts
  it("แสดงจุดรับตัวอย่างแยก QC/Lab และไม่มีแถวสถานะเก่าอีกต่อไป", async () => {
    renderDetail();

    expect(await screen.findByRole("heading", { name: "P-2607-001" })).toBeInTheDocument();
    const timelineCard = screen.getByLabelText("Project Timeline");
    expect(timelineCard).toHaveTextContent("QC รับตัวอย่าง");
    expect(timelineCard).not.toHaveTextContent("QC ครบ");
    expect(timelineCard).not.toHaveTextContent("Lab ครบ");
    expect(timelineCard).not.toHaveTextContent("บันทึกผล");
  });

  it("วาดแท่ง parameter จากผลที่บันทึกไว้ใน QCTestResult ของคำร้องเก่า", async () => {
    mocks.getQCResults.mockResolvedValue([
      { petitionId: "petition-1", itemSeq: 1, parameterId: "parameter-1", values: {}, enteredAt: "2026-07-13T05:00:00.000Z" },
    ]);
    renderDetail();

    expect(await screen.findByLabelText("Required checks (ช่วงเวลา)")).toBeInTheDocument();
  });
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run src/pages/PetitionTimelineDetailPage.test.tsx`
Expected: FAIL — ไม่พบ element `aria-label="Required checks (ช่วงเวลา)"` และหน้ายัง render `model.timeline.stages` ที่ไม่มีแล้ว

- [ ] **Step 3: เขียน implementation**

**3a. โหลด qcResults ตั้งแต่แรก + dedupe request**

เปลี่ยน import React hooks บรรทัด 1 ให้มี `useCallback`:

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
```

แทน state `documentDataLoaded` ด้วย ref (ลบบรรทัด `const [documentDataLoaded, setDocumentDataLoaded] = useState(false);`) แล้วเพิ่มใต้ `const documentLoadVersion = useRef(0);`:

```ts
  const documentLoadState = useRef<{ loaded: boolean; promise: Promise<boolean> | null }>({ loaded: false, promise: null });
  const petitionId = petition?._id;
```

ย้าย `loadDocumentData` ขึ้นมาเป็น `useCallback` **เหนือ early return ทั้งหมด** (วางไว้ถัดจาก `const model = useMemo(...)`) และลบฟังก์ชัน `loadDocumentData` ตัวเดิมที่อยู่ล่างหน้า:

```ts
  const loadDocumentData = useCallback(async (): Promise<boolean> => {
    if (!petitionId) return false;
    if (documentLoadState.current.loaded) return true;
    if (documentLoadState.current.promise) return documentLoadState.current.promise;

    const loadVersion = documentLoadVersion.current;
    setDocumentLoading(true);
    setDocumentError(null);
    const promise = api.getQCResults(petitionId)
      .then((results) => {
        if (documentLoadVersion.current !== loadVersion) return false;
        documentLoadState.current.loaded = true;
        setQcResults(results);
        return true;
      })
      .catch((loadError: unknown) => {
        if (documentLoadVersion.current !== loadVersion) return false;
        setDocumentError(loadError instanceof Error ? loadError.message : "โหลดข้อมูลเอกสารไม่สำเร็จ");
        return false;
      })
      .finally(() => {
        documentLoadState.current.promise = null;
        if (documentLoadVersion.current === loadVersion) setDocumentLoading(false);
      });

    documentLoadState.current.promise = promise;
    return promise;
  }, [petitionId]);
```

ใน effect `[id]` (ตัวที่ reset dialog) **ลบ** `documentLoadVersion.current += 1;`, `setQcResults([]);`, `setDocumentLoading(false);`, `setDocumentError(null);`, `setDocumentDataLoaded(false);` ออก — ย้ายไปอยู่ใน effect ใหม่ที่วาง **ถัดจาก** effect `[id]` นั้น:

```ts
  useEffect(() => {
    documentLoadVersion.current += 1;
    documentLoadState.current = { loaded: false, promise: null };
    setQcResults([]);
    setDocumentLoading(false);
    setDocumentError(null);
    void loadDocumentData();
  }, [loadDocumentData, taskReloadKey]);
```

ลำดับสำคัญ: effect นี้ต้องอยู่**หลัง** effect `[id]` ไม่งั้น version จะถูกบวกทับแล้วผล fetch ถูกทิ้ง

`openDocument` เดิมใช้ได้เลย ไม่ต้องแก้ (`if (await loadDocumentData()) setOpen(true);`) — ตอนนี้มันจะ `await` request ที่ค้างอยู่แทนที่จะยิงซ้ำ

**3b. ส่ง qcResults เข้า model**

```ts
  const model = useMemo(
    () => petition && canViewPetition
      ? buildTimelineDetailModel({ petition, parameters: visibleParameters, progressEntries, auditLogs, qcResults, itemGroupIds: groupMembership })
      : null,
    [auditLogs, canViewPetition, groupMembership, petition, progressEntries, qcResults, visibleParameters],
  );
```

**3c. สีของแท่ง** — เพิ่มฟังก์ชันข้าง `taskStateClass`:

```ts
function barTrackClass(track: "qc" | "lab" | "stage", done: boolean) {
  if (!done) return "bg-grey-200";
  if (track === "lab") return "bg-amber-500";
  if (track === "qc") return "bg-primary-500";
  return "bg-grey-400";
}
```

**3d. fallback ของ `timelineDays`** — เปลี่ยน `stages: model.timeline.stages` เป็น `rows: []` (กรณีนี้เกิดไม่ได้จริงเพราะ `buildTimelineDays` คืนอย่างน้อย 1 วันเสมอ แต่ต้องให้ type ตรง):

```ts
  const timelineDays = model.timeline.days.length
    ? model.timeline.days
    : [{ key: "timeline", label: "Timeline", startAt: model.timeline.startAt, endAt: model.timeline.endAt, ticks: model.timeline.ticks, rows: [] }];
```

**3e. วาดแถว** — แทนบรรทัดที่ map `activeTimelineDay.stages` (บรรทัด 247) ด้วย:

```tsx
          {activeTimelineDay.rows.map((row) => {
            const startPercent = timelinePercent(row.kind === "milestone" ? row.at : row.segmentStartAt, activeTimelineDay.startAt, activeTimelineDay.endAt);
            const endPercent = timelinePercent(row.segmentEndAt, activeTimelineDay.startAt, activeTimelineDay.endAt);
            return <div key={row.key} className="grid grid-cols-[180px_minmax(0,1fr)] items-center gap-3">
              <span className="truncate text-sm text-grey-700" title={row.label}>{row.label}</span>
              <div className="relative h-6 rounded bg-grey-50">
                {row.visible && row.kind === "milestone" && startPercent != null && <span aria-label={`${row.label} (จุด)`} className={cn("absolute top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white", row.done ? "bg-primary-600" : "bg-grey-300")} style={{ left: `${startPercent}%` }} />}
                {row.visible && row.kind === "bar" && startPercent != null && endPercent != null && <div aria-label={`${row.label} (ช่วงเวลา)`} title={row.continuesBefore || row.continuesAfter ? "ต่อเนื่องข้ามวัน" : undefined} className={cn("absolute top-2 h-2 rounded-full", barTrackClass(row.track, row.done), row.continuesBefore && "rounded-l-none", row.continuesAfter && "rounded-r-none")} style={{ left: `${startPercent}%`, width: `${Math.max(endPercent - startPercent, 1)}%` }} />}
              </div>
            </div>;
          })}
```

หมายเหตุ: คอลัมน์ชื่อกว้าง 180px (เดิม 144px) และหัวตารางเวลาด้านบน (`className="relative ml-36 ..."`) ต้องขยับตาม → เปลี่ยน `ml-36` เป็น `ml-[192px]` (180px + gap 12px)

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/lib/petitionTimelineDetail.test.ts src/pages/PetitionTimelineDetailPage.test.tsx`
Expected: PASS ทุกตัว

- [ ] **Step 5: Commit**

```bash
git add src/pages/PetitionTimelineDetailPage.tsx src/pages/PetitionTimelineDetailPage.test.tsx
git commit -m "feat(timeline): วาดจุดรับตัวอย่างและแท่ง parameter ในหน้า timeline detail"
```

---

### Task 5: ตรวจงานรวม

**Files:** ไม่มีการแก้ไฟล์ใหม่ (ยกเว้นมี regression ต้องซ่อม)

- [ ] **Step 1: type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: error ที่เหลือต้องไม่มีตัวไหนชี้มาที่ `petitionTimelineDetail.ts` หรือ `PetitionTimelineDetailPage.tsx` (repo มี latent error เดิมอยู่ ~12 ตัวในไฟล์อื่น — ปล่อยไว้)

- [ ] **Step 2: รันเทสต์ทั้ง suite**

Run: `npx vitest run`
Expected: PASS ทั้งหมด — ถ้ามีไฟล์อื่นอ้าง `TimelineDetailStage` / `timeline.stages` ให้แก้ให้ตรง type ใหม่

- [ ] **Step 3: lint**

Run: `npm run lint`
Expected: ไม่มี error ใหม่ในสองไฟล์ที่แก้

- [ ] **Step 4: ตรวจของจริงในเบราว์เซอร์**

เปิดหน้า `/petition-timeline/:id` ของคำร้องที่ **มีทั้ง QC และ Lab และบันทึกผลไปแล้วบางส่วน** แล้วยืนยันด้วยตา:
- "QC รับตัวอย่าง" / "Lab รับตัวอย่าง" / "มอบหมายงาน Lab" เป็นจุดกลม ไม่มีเส้นลากยาว
- แถว parameter มีแท่งเริ่มที่จุดรับตัวอย่างฝั่งที่ถูกต้อง จบตรงเวลาที่ใส่ค่า
- parameter ที่ยังไม่ใส่ค่า → แถวว่าง
- คำร้องข้ามวัน → กดสลับแท็บวันแล้วแท่งตัดพอดีวัน ขอบตัดตรงเมื่อต่อเนื่อง
- ไม่มีแถว "บันทึกผล" / "QC ครบ" / "Lab ครบ" อีกแล้ว

- [ ] **Step 5: Commit (ถ้ามีการแก้)**

```bash
git add src/lib/petitionTimelineDetail.ts src/pages/PetitionTimelineDetailPage.tsx
git commit -m "fix(timeline): แก้ regression จากการเปลี่ยนโครง row"
```
