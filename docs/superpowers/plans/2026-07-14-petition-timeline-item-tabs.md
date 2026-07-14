# Petition Timeline — แท็บรายตัวอย่าง Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** แยกหน้า `/petition-timeline/:id` เป็นแท็บรายตัวอย่าง (1 item = 1 แท็บ) ให้การ์ดสรุป / Progress / Project Timeline / Tasks แสดงเฉพาะตัวอย่างที่เลือก

**Architecture:** ส่ง `itemSeq` ที่เลือกอยู่เข้า pure module `src/lib/petitionTimelineDetail.ts` แล้วให้มันกรอง tasks / parameter rows เฉพาะตัวอย่างนั้น พร้อมคืน `model.items` (รายการแท็บครบทุกตัวเสมอ) และ `model.overallProgress` (รวมทุกตัวอย่าง — ใช้ gate ปุ่ม Pre Report) หน้าเว็บเก็บ state ตัวที่เลือกแล้ว `useMemo` สร้าง model ใหม่ตอนสลับแท็บ ไม่แตะ backend

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind + Vitest + Testing Library

**Spec:** `docs/superpowers/specs/2026-07-14-petition-timeline-item-tabs-design.md`

## Global Constraints

- Test: `npx vitest run src/lib/petitionTimelineDetail.test.ts src/pages/PetitionTimelineDetailPage.test.tsx` — baseline ปัจจุบัน **44 tests ผ่านหมด** ห้ามทำตัวไหนพัง (นอกจากตัวที่แผนนี้สั่งแก้)
- Type-check: `npx tsc -p tsconfig.app.json --noEmit` — repo มี latent error ~12 ตัวอยู่แล้ว **ห้ามเพิ่มตัวใหม่ในไฟล์ที่แก้** (`npx tsc --noEmit` เฉย ๆ เป็น no-op — root tsconfig มี `files: []`)
- **ห้ามรัน `npm run build`** (postbuild เขียนทับ root files แล้ว dev server พัง)
- **อาจมี session อื่นแก้ไฟล์ค้างอยู่** — commit ด้วย explicit pathspec เท่านั้น ห้าม `git add -A` / `git commit -a`
- label ทั้งหมดเป็นภาษาไทย ตามข้อความในแผนนี้เป๊ะ ๆ (`"ตัวอย่างในคำขอ"`, `"ตัวอย่างที่ N"`)
- `tsconfig` ผ่อนปรน (`strictNullChecks: false`) — ไม่ต้องใส่ non-null assertion เกินจำเป็น

## File Structure

| ไฟล์ | หน้าที่ | การเปลี่ยนแปลง |
|---|---|---|
| `src/lib/petitionTimelineDetail.ts` | pure model builder | เพิ่ม `items` (แท็บ), รับ `itemSeq` แล้วกรอง tasks/parameter rows, เพิ่ม `overallProgress` |
| `src/lib/petitionTimelineDetail.test.ts` | Vitest ของ pure module | เพิ่มเคสแท็บ + เคสกรองรายตัวอย่าง |
| `src/pages/PetitionTimelineDetailPage.tsx` | หน้า React | แถบแท็บใต้ PageHeader, Metric รายตัวอย่าง, ลบ Metric "Lot", Pre Report ใช้ `overallProgress` |
| `src/pages/PetitionTimelineDetailPage.test.tsx` | Vitest ของหน้า | แก้เทสต์ที่อ้าง `LOT-88` + เพิ่มเคสแท็บ |

---

### Task 1: รายการแท็บตัวอย่าง (`model.items`)

เพิ่ม output `model.items` — รายการตัวอย่างครบทุกตัวของคำขอ ใช้วาดแท็บและเติมค่า Metric **ยังไม่กรองอะไร** (Task 2 ทำ)

**Files:**
- Modify: `src/lib/petitionTimelineDetail.ts`
- Test: `src/lib/petitionTimelineDetail.test.ts`

**Interfaces:**
- Consumes: `Petition` จาก `@/types/petition.types` (มี `items?: { seq: number; sampleName?: string; commonName?: string; batchNo?: string; lotNo?: string; sampleId?: string }[]`)
- Produces:
  - `export type TimelineDetailItemTab = { seq: number; label: string; commonName: string; batchNo: string; sampleName: string }`
  - `TimelineDetailModel.items: TimelineDetailItemTab[]`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

เพิ่มต่อท้าย `describe("buildTimelineDetailModel", ...)` ใน `src/lib/petitionTimelineDetail.test.ts`:

```ts
  it("คืนรายการแท็บครบทุกตัวอย่าง โดยใช้ commonName เป็นป้ายแท็บ", () => {
    const result = model(petition({
      qcReceivedAt: at(13, 9),
      items: [
        { seq: 1, sampleName: "Sample A", commonName: "ABAMECTIN 1.8% EC", batchNo: "BATCH-002", sampleId: "sample-1" },
        { seq: 2, sampleName: "Sample B", commonName: "EMAMECTIN 1.9% EC", batchNo: "BATCH-003", sampleId: "sample-2" },
      ],
    }));

    expect(result.items).toEqual([
      { seq: 1, label: "ABAMECTIN 1.8% EC", commonName: "ABAMECTIN 1.8% EC", batchNo: "BATCH-002", sampleName: "Sample A" },
      { seq: 2, label: "EMAMECTIN 1.9% EC", commonName: "EMAMECTIN 1.9% EC", batchNo: "BATCH-003", sampleName: "Sample B" },
    ]);
  });

  it("ป้ายแท็บถอยไปใช้ sampleName แล้วค่อย ตัวอย่างที่ N เมื่อไม่มี commonName", () => {
    const result = model(petition({
      qcReceivedAt: at(13, 9),
      items: [
        { seq: 1, sampleName: "Sample A", batchNo: "BATCH-002", sampleId: "sample-1" },
        { seq: 2, sampleId: "sample-2" },
      ],
    }));

    expect(result.items.map((item) => item.label)).toEqual(["Sample A", "ตัวอย่างที่ 2"]);
    expect(result.items[1]).toMatchObject({ commonName: "", batchNo: "", sampleName: "" });
  });

  it("คำขอที่ไม่มีตัวอย่างเลย คืนรายการแท็บว่าง", () => {
    const result = model(petition({ qcReceivedAt: at(13, 9), items: [] }));

    expect(result.items).toEqual([]);
  });
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run src/lib/petitionTimelineDetail.test.ts`
Expected: FAIL — `result.items` เป็น `undefined`

- [ ] **Step 3: เขียน implementation**

ใน `src/lib/petitionTimelineDetail.ts` เพิ่ม type ใต้ `TimelineDetailHeader` (บรรทัด ~52):

```ts
export type TimelineDetailItemTab = {
  seq: number;
  label: string;
  commonName: string;
  batchNo: string;
  sampleName: string;
};
```

เพิ่มฟิลด์ `items` เข้า `TimelineDetailModel`:

```ts
export type TimelineDetailModel = {
  header: TimelineDetailHeader;
  items: TimelineDetailItemTab[];
  progress: TimelineDetailProgress;
  tasks: TimelineDetailTask[];
  activities: TimelineDetailActivity[];
  timeline: { startAt: string; endAt: string; ticks: TimelineDetailTick[]; rows: TimelineDetailRow[]; days: TimelineDetailDay[] };
};
```

เพิ่มฟังก์ชัน (วางเหนือ `buildRequiredTasks`):

```ts
function buildItemTabs(petition: Petition): TimelineDetailItemTab[] {
  return (petition.items ?? []).map((item) => {
    const commonName = item.commonName?.trim() ?? "";
    const sampleName = item.sampleName?.trim() ?? "";
    return {
      seq: item.seq,
      label: commonName || sampleName || `ตัวอย่างที่ ${item.seq}`,
      commonName,
      batchNo: item.batchNo?.trim() ?? "",
      sampleName,
    };
  });
}
```

ใน `buildTimelineDetailModel` เพิ่ม `items` เข้า return object (วางถัดจาก `header`):

```ts
  return {
    header: { ...header, startKind: receivedAt ? "received" : "submitted" },
    items: buildItemTabs(input.petition),
    progress: buildRequiredProgress(tasks, input.petition.status === "approved"),
    // ...ที่เหลือเหมือนเดิม
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/lib/petitionTimelineDetail.test.ts`
Expected: PASS ทุกตัว (29 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/petitionTimelineDetail.ts src/lib/petitionTimelineDetail.test.ts
git commit -m "feat(timeline): เพิ่มรายการแท็บตัวอย่างใน timeline detail model"
```

---

### Task 2: กรอง model ตามตัวอย่างที่เลือก (`itemSeq` + `overallProgress`)

**Files:**
- Modify: `src/lib/petitionTimelineDetail.ts`
- Test: `src/lib/petitionTimelineDetail.test.ts`

**Interfaces:**
- Consumes: `buildItemTabs`, `TimelineDetailItemTab` จาก Task 1 · `buildRequiredTasks` / `buildRequiredProgress` / `buildParameterRows` ที่มีอยู่แล้วในไฟล์
- Produces:
  - `TimelineDetailInput` เพิ่ม `itemSeq?: number | null` — `null`/`undefined` = ทุกตัวอย่าง (พฤติกรรมเดิม)
  - `TimelineDetailModel` เพิ่ม `overallProgress: TimelineDetailProgress` (รวมทุกตัวอย่างเสมอ ไม่ขึ้นกับ `itemSeq`)
  - `buildParameterRows(...)` เพิ่ม parameter สุดท้าย `itemSeq: number | null | undefined`

**หมายเหตุ:** เทสต์เดิม `"รวมหลายตัวอย่างเป็นแถวเดียว และไม่วาดแท่งจนกว่าจะใส่ค่าครบทุกตัวอย่าง"` **คงไว้ตามเดิม ห้ามลบ** — มันคือเทสต์ backward-compat ของโหมด `itemSeq == null` (spec ข้อ 6)

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

แก้ helper `model()` ที่หัวไฟล์ `src/lib/petitionTimelineDetail.test.ts` (บรรทัด 36-45) ให้รับ `itemSeq`:

```ts
function model(
  petitionData: Petition,
  parameters: ParameterItem[] = [],
  progressEntries: QCProgressEntry[] = [],
  auditLogs: PetitionAuditLogEntry[] = [],
  now = new Date(2026, 6, 13, 12),
  qcResults: QCTestResult[] = [],
  itemSeq: number | null = null,
) {
  return buildTimelineDetailModel({ petition: petitionData, parameters, progressEntries, auditLogs, qcResults, itemSeq }, now);
}
```

เพิ่มเทสต์ต่อท้าย `describe`:

```ts
  const twoItemPetition = () => petition({
    qcReceivedAt: at(13, 9),
    items: [
      { seq: 1, sampleName: "Sample A", commonName: "ABAMECTIN 1.8% EC", batchNo: "BATCH-002", sampleId: "sample-1" },
      { seq: 2, sampleName: "Sample B", commonName: "EMAMECTIN 1.9% EC", batchNo: "BATCH-003", sampleId: "sample-2" },
    ],
  });

  it("กรอง tasks และแถว parameter เหลือเฉพาะตัวอย่างที่เลือก", () => {
    const result = model(
      twoItemPetition(),
      [requiredParameter],
      [{ itemSeq: 2, parameterId: "parameter-1", filledLabels: ["Viscosity"] }],
      [],
      new Date(2026, 6, 13, 12),
      [],
      2,
    );

    expect(result.tasks).toMatchObject([{ key: "2::parameter-1", itemSeq: 2, sampleName: "Sample B", filled: 1, total: 2 }]);
    expect(result.timeline.rows.filter((row) => row.key.startsWith("param::"))).toHaveLength(1);
  });

  it("วาดแท่ง parameter ของตัวอย่างที่เลือกทันที แม้ตัวอย่างอื่นยังไม่ได้กรอก", () => {
    const auditLogs = [resultAudit("audit-1", "parameter-1", 1, at(13, 11))];

    const first = model(twoItemPetition(), [requiredParameter], [], auditLogs, new Date(2026, 6, 13, 12), [], 1);
    expect(first.timeline.rows.find((row) => row.key === "param::parameter-1")).toMatchObject({
      startAt: at(13, 9),
      endAt: at(13, 11),
      done: true,
    });

    const second = model(twoItemPetition(), [requiredParameter], [], auditLogs, new Date(2026, 6, 13, 12), [], 2);
    expect(second.timeline.rows.find((row) => row.key === "param::parameter-1")).toMatchObject({
      startAt: null,
      endAt: null,
      done: false,
    });
  });

  it("progress เป็นของตัวอย่างที่เลือก ส่วน overallProgress รวมทุกตัวอย่าง", () => {
    const result = model(
      twoItemPetition(),
      [requiredParameter],
      [
        { itemSeq: 1, parameterId: "parameter-1", filledLabels: ["Viscosity", "Color"] },
        { itemSeq: 2, parameterId: "parameter-1", filledLabels: [] },
      ],
      [],
      new Date(2026, 6, 13, 12),
      [],
      1,
    );

    expect(result.progress).toEqual({ filled: 2, total: 2, percent: 99 });
    expect(result.overallProgress).toEqual({ filled: 2, total: 4, percent: 50 });
  });

  it("จุด milestone แท่งปิดงาน และแท็บวัน เหมือนกันทุกตัวอย่างที่เลือก", () => {
    const build = (itemSeq: number | null) => model(
      twoItemPetition(),
      [requiredParameter],
      [],
      [],
      new Date(2026, 6, 13, 12),
      [],
      itemSeq,
    );

    const stageKeys = (itemSeq: number | null) => build(itemSeq).timeline.rows
      .filter((row) => !row.key.startsWith("param::"))
      .map((row) => row.key);

    expect(stageKeys(1)).toEqual(stageKeys(2));
    expect(stageKeys(1)).toEqual(stageKeys(null));
    expect(build(1).timeline.days.map((day) => day.key)).toEqual(build(2).timeline.days.map((day) => day.key));
  });
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run src/lib/petitionTimelineDetail.test.ts`
Expected: FAIL — `itemSeq` ไม่มีใน `TimelineDetailInput` (type error) และ `result.overallProgress` เป็น `undefined`

- [ ] **Step 3: เขียน implementation**

**3a.** เพิ่ม `itemSeq` เข้า `TimelineDetailInput` และ `overallProgress` เข้า `TimelineDetailModel`:

```ts
export type TimelineDetailModel = {
  header: TimelineDetailHeader;
  items: TimelineDetailItemTab[];
  progress: TimelineDetailProgress;
  overallProgress: TimelineDetailProgress;
  tasks: TimelineDetailTask[];
  activities: TimelineDetailActivity[];
  timeline: { startAt: string; endAt: string; ticks: TimelineDetailTick[]; rows: TimelineDetailRow[]; days: TimelineDetailDay[] };
};
export type TimelineDetailInput = {
  petition: Petition;
  parameters: ParameterItem[];
  progressEntries: QCProgressEntry[];
  auditLogs: PetitionAuditLogEntry[];
  qcResults: QCTestResult[];
  itemGroupIds?: Map<string, string[]>;
  itemSeq?: number | null;
};
```

**3b.** `buildParameterRows` — เพิ่ม parameter สุดท้าย `itemSeq` แล้วข้ามตัวอย่างที่ไม่ได้เลือก (แก้เฉพาะ signature กับ `for` loop, ที่เหลือคงเดิม):

```ts
function buildParameterRows(
  petition: Petition,
  parameters: ParameterItem[],
  auditLogs: PetitionAuditLogEntry[],
  qcResults: QCTestResult[],
  itemGroupIds: Map<string, string[]> | undefined,
  fallbackStartAt: string,
  itemSeq: number | null | undefined,
): TimelineDetailRow[] {
  const touches = buildParameterTouches(auditLogs, qcResults);
  const groups = new Map<string, { parameter: ParameterItem; pairKeys: string[] }>();

  for (const item of petition.items ?? []) {
    if (itemSeq != null && item.seq !== itemSeq) continue;
    const groupIds = itemGroupIds?.get(String(item.sampleId ?? "").trim()) ?? [];
    for (const parameter of matchParametersForItem(item, parameters, groupIds)) {
      const parameterId = parameter._id;
      if (!parameterId) continue;
      const group = groups.get(parameterId) ?? { parameter, pairKeys: [] };
      group.pairKeys.push(`${item.seq}::${parameterId}`);
      groups.set(parameterId, group);
    }
  }

  // ...ส่วนที่เหลือของฟังก์ชันไม่เปลี่ยน
```

**3c.** ใน `buildTimelineDetailModel` แทนบล็อกที่คิด `tasks` + `rows` (บรรทัด ~496-501) ด้วย:

```ts
  const allTasks = buildRequiredTasks(input.petition, input.parameters, input.progressEntries, input.itemGroupIds);
  const tasks = input.itemSeq == null ? allTasks : allTasks.filter((task) => task.itemSeq === input.itemSeq);
  const rows = [
    ...buildMilestoneRows(input.petition),
    ...buildParameterRows(input.petition, input.parameters, input.auditLogs, input.qcResults ?? [], input.itemGroupIds, startAt, input.itemSeq),
    ...buildClosingRows(input.petition),
  ];
```

แล้วใน return object เพิ่ม `overallProgress` ถัดจาก `progress`:

```ts
    progress: buildRequiredProgress(tasks, input.petition.status === "approved"),
    overallProgress: buildRequiredProgress(allTasks, input.petition.status === "approved"),
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/lib/petitionTimelineDetail.test.ts`
Expected: PASS ทุกตัว (33 tests) — รวมเทสต์เดิม `"รวมหลายตัวอย่างเป็นแถวเดียว..."` ที่ยังต้องผ่าน

- [ ] **Step 5: Commit**

```bash
git add src/lib/petitionTimelineDetail.ts src/lib/petitionTimelineDetail.test.ts
git commit -m "feat(timeline): กรอง tasks/แถว parameter ตามตัวอย่างที่เลือก"
```

---

### Task 3: หน้าเว็บ — แถบแท็บตัวอย่าง + Metric รายตัวอย่าง

**Files:**
- Modify: `src/pages/PetitionTimelineDetailPage.tsx`
- Test: `src/pages/PetitionTimelineDetailPage.test.tsx`

**Interfaces:**
- Consumes: `model.items` (Task 1), `model.overallProgress` + `TimelineDetailInput.itemSeq` (Task 2)
- Produces: หน้าเว็บที่มี `role="tablist"` ชื่อ `"ตัวอย่างในคำขอ"` เมื่อคำขอมีมากกว่า 1 ตัวอย่าง

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

**1a.** เทสต์เดิม `"shows petition and item details instead of requester and assignee metrics"` อ้าง Metric "Lot" ที่กำลังจะถูกลบ — **ลบบรรทัด 143** ทิ้ง:

```ts
    expect(screen.getByText("LOT-88")).toBeInTheDocument();   // ← ลบบรรทัดนี้
```

แล้วเพิ่มบรรทัดยืนยันว่า Lot หายไปจริงต่อจาก `expect(screen.getByText("BATCH-002")).toBeInTheDocument();`:

```ts
    expect(screen.queryByText("Lot")).not.toBeInTheDocument();
    expect(screen.queryByText("LOT-88")).not.toBeInTheDocument();
```

**1b.** เพิ่มเทสต์ต่อท้าย `describe("PetitionTimelineDetailPage", ...)`:

```ts
  const twoItems = [
    { seq: 1, sampleName: "Sample A", commonName: "ABAMECTIN 1.8% W/V EC", batchNo: "BATCH-002", lotNo: "LOT-88", sampleId: "sample-1" },
    { seq: 2, sampleName: "Sample B", commonName: "EMAMECTIN 1.9% EC", batchNo: "BATCH-003", lotNo: "LOT-99", sampleId: "sample-2" },
  ];

  it("ไม่แสดงแถบแท็บตัวอย่างเมื่อคำขอมีตัวอย่างเดียว", async () => {
    renderDetail();

    expect(await screen.findByRole("heading", { name: "P-2607-001" })).toBeInTheDocument();
    expect(screen.queryByRole("tablist", { name: "ตัวอย่างในคำขอ" })).not.toBeInTheDocument();
  });

  it("แสดงแท็บตัวอย่างชื่อ commonName เมื่อคำขอมีหลายตัวอย่าง", async () => {
    Object.assign(mocks.petition, { items: twoItems });
    renderDetail();

    expect(await screen.findByRole("tab", { name: "ABAMECTIN 1.8% W/V EC" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "EMAMECTIN 1.9% EC" })).toHaveAttribute("aria-selected", "false");
  });

  it("สลับแท็บแล้ว Metric และการ์ด Tasks เปลี่ยนตามตัวอย่างที่เลือก", async () => {
    Object.assign(mocks.petition, { items: twoItems });
    mocks.getQCProgress.mockResolvedValue({
      "petition-1": [
        { itemSeq: 1, parameterId: "parameter-1", filledLabels: ["Viscosity"] },
        { itemSeq: 2, parameterId: "parameter-1", filledLabels: [] },
      ],
    });
    renderDetail();

    // อย่าใช้ getByText(commonName) — ชื่อสารโผล่ทั้งในปุ่มแท็บและใน Metric จะได้ 2 element
    expect(await screen.findByRole("tab", { name: "ABAMECTIN 1.8% W/V EC" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("BATCH-002")).toBeInTheDocument();
    expect(screen.getByLabelText("Tasks")).toHaveTextContent("Sample A");
    expect(screen.getByLabelText("Tasks")).not.toHaveTextContent("Sample B");

    fireEvent.click(screen.getByRole("tab", { name: "EMAMECTIN 1.9% EC" }));

    expect(screen.getByRole("tab", { name: "EMAMECTIN 1.9% EC" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("BATCH-003")).toBeInTheDocument();
    expect(screen.queryByText("BATCH-002")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Tasks")).toHaveTextContent("Sample B");
    expect(screen.getByLabelText("Tasks")).not.toHaveTextContent("Sample A");
  });

  it("ยังไม่ให้ปุ่ม Pre Report เมื่อตัวอย่างที่เลือกกรอกครบ แต่ตัวอย่างอื่นยังไม่ครบ", async () => {
    Object.assign(mocks.petition, { status: "success", items: twoItems });
    mocks.getQCProgress.mockResolvedValue({
      "petition-1": [
        { itemSeq: 1, parameterId: "parameter-1", filledLabels: ["Viscosity", "Color"] },
        { itemSeq: 2, parameterId: "parameter-1", filledLabels: [] },
      ],
    });
    renderDetail();

    expect(await screen.findByRole("tab", { name: "ABAMECTIN 1.8% W/V EC" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pre Report" })).not.toBeInTheDocument();
  });
```

หมายเหตุ: `beforeEach` เขียนทับ `mocks.petition.items` ให้เป็นตัวอย่างเดียวทุกครั้งอยู่แล้ว → เทสต์ที่ต้องการ 2 ตัวอย่างต้อง `Object.assign` เอง

- [ ] **Step 2: รันเทสต์ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run src/pages/PetitionTimelineDetailPage.test.tsx`
Expected: FAIL — ไม่พบ `role="tab"` ชื่อ `"ABAMECTIN 1.8% W/V EC"` และยังเจอข้อความ `"LOT-88"` ในหน้า

- [ ] **Step 3: เขียน implementation**

**3a. state ตัวอย่างที่เลือก** — เพิ่มใต้ `const [activeTimelineDayKey, setActiveTimelineDayKey] = useState<string | null>(null);` (บรรทัด 101):

```ts
  const [activeItemSeq, setActiveItemSeq] = useState<number | null>(null);
```

reset ตอนเปลี่ยนคำขอ — เพิ่มเข้า effect `[id]` ที่มีอยู่ (บรรทัด 142-145):

```ts
  useEffect(() => {
    setPdfLoadingDoc(null);
    setActiveTimelineDayKey(null);
    setActiveItemSeq(null);
  }, [id]);
```

**3b. resolve ตัวอย่างที่เลือก แล้วส่งเข้า model** — วาง 2 บล็อกนี้ **เหนือ** `const model = useMemo(...)` (บรรทัด 161) เพื่อให้ลำดับ hook คงที่:

```ts
  const itemSeqs = useMemo(() => (petition?.items ?? []).map((item) => item.seq), [petition]);
  // seq ที่ค้างอยู่อาจหายไปหลังรีเฟรช → ถอยไปตัวแรกเสมอ
  const selectedItemSeq = activeItemSeq != null && itemSeqs.includes(activeItemSeq) ? activeItemSeq : itemSeqs[0] ?? null;
```

แล้วแก้ `model` ให้ส่ง `itemSeq`:

```ts
  const model = useMemo(
    () => petition && canViewPetition
      ? buildTimelineDetailModel({ petition, parameters: visibleParameters, progressEntries, auditLogs, qcResults, itemGroupIds: groupMembership, itemSeq: selectedItemSeq })
      : null,
    [auditLogs, canViewPetition, groupMembership, petition, progressEntries, qcResults, selectedItemSeq, visibleParameters],
  );
```

**3c. ค่าที่ใช้วาดการ์ดสรุป** — แทนบรรทัด `commonNameSummary` / `batchSummary` / `lotSummary` (บรรทัด 225-227) ด้วย:

```ts
  const activeItem = model.items.find((item) => item.seq === selectedItemSeq) ?? null;
```

และเปลี่ยน `canShowPreReport` (บรรทัด 222-224) ให้ใช้ `overallProgress`:

```ts
  const canShowPreReport = canPrintPreReport(petition)
    && model.overallProgress.total > 0
    && model.overallProgress.filled >= model.overallProgress.total;
```

**ลบฟังก์ชัน `summarizeItemValues` ทั้งก้อน** (บรรทัด 72-79) — ไม่มีคนใช้แล้ว

**3d. แถบแท็บ** — แทรกระหว่าง `<PageHeader ... />` กับ `<Card className="border-black-50 shadow-none">` (หลังบรรทัด 276):

```tsx
    {model.items.length > 1 && <div role="tablist" aria-label="ตัวอย่างในคำขอ" className="flex flex-wrap gap-2">
      {model.items.map((item) => <button key={item.seq} type="button" role="tab" aria-selected={item.seq === selectedItemSeq} title={item.label} className={cn("max-w-[240px] truncate rounded-[8px] border px-3 py-1.5 text-xs font-medium transition-colors", item.seq === selectedItemSeq ? "border-primary-500 bg-primary-50 text-primary-600" : "border-black-50 bg-white text-grey-600 hover:bg-grey-50")} onClick={() => setActiveItemSeq(item.seq)}>{item.label}</button>)}
    </div>}
```

**3e. Metric ในการ์ดสรุป** — แทนบล็อก `<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">` (บรรทัด 290-297) ด้วย (**ลบ Metric "Lot" ออก** และเปลี่ยน `xl:grid-cols-6` → `xl:grid-cols-5`):

```tsx
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="Common name" value={activeItem?.commonName || "-"} />
          <Metric label="เลข Batch" value={activeItem?.batchNo || "-"} />
          <Metric label={model.header.startKind === "received" ? "Start time" : "เวลายื่นคำร้อง"} value={formatDateTime(model.header.startAt)} />
          <Metric label="End time" value={formatDateTime(model.header.endAt)} hint={model.header.endKind === "actual" ? "เวลาจริง" : model.header.endKind === "estimated" ? "ค่าประมาณ" : "กำลังดำเนินการ"} />
          <Metric label="Progress" value={progressLabel} hint={model.progress.total ? `${model.progress.filled}/${model.progress.total} required fields` : "ไม่มี required parameter"} />
        </div>
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/lib/petitionTimelineDetail.test.ts src/pages/PetitionTimelineDetailPage.test.tsx`
Expected: PASS ทุกตัว (33 + 22 = 55 tests)

- [ ] **Step 5: Commit**

```bash
git add src/pages/PetitionTimelineDetailPage.tsx src/pages/PetitionTimelineDetailPage.test.tsx
git commit -m "feat(timeline): แท็บรายตัวอย่างคุมทั้งหน้า timeline detail"
```

---

### Task 4: ตรวจงานรวม

**Files:** ไม่มีการแก้ไฟล์ใหม่ (ยกเว้นมี regression ต้องซ่อม)

- [ ] **Step 1: type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: error ที่เหลือต้องไม่มีตัวไหนชี้มาที่ `petitionTimelineDetail.ts` หรือ `PetitionTimelineDetailPage.tsx` (repo มี latent error เดิม ~12 ตัวในไฟล์อื่น — ปล่อยไว้)

- [ ] **Step 2: รันเทสต์ทั้ง suite**

Run: `npx vitest run`
Expected: PASS ทั้งหมด — ถ้าไฟล์อื่นเรียก `buildTimelineDetailModel` แล้วพังเพราะ type ใหม่ ให้แก้ให้ตรง (ทุกฟิลด์ใหม่เป็น optional input จึงไม่ควรมี)

- [ ] **Step 3: lint**

Run: `npm run lint`
Expected: ไม่มี error ใหม่ในสองไฟล์ที่แก้

- [ ] **Step 4: ตรวจของจริงในเบราว์เซอร์**

เปิด `/petition-timeline/:id` ของคำขอที่ **มีหลายตัวอย่าง และบันทึกผลไปแล้วบางส่วน** แล้วยืนยันด้วยตา:
- แถบแท็บชื่อ commonName โผล่ใต้ปุ่มย้อนกลับ เหนือการ์ดสรุป
- กดสลับแท็บ → Common name / เลข Batch / Progress / แถว parameter ใน Project Timeline / การ์ด Tasks เปลี่ยนตาม
- จุด milestone (QC/Lab รับตัวอย่าง, มอบหมาย) และแท่ง "ออกผล Lab" / "Final Result" **ไม่เปลี่ยน** เมื่อสลับแท็บ
- ไม่มี Metric "Lot" ในการ์ดสรุปแล้ว
- เปิดคำขอที่มีตัวอย่างเดียว → ไม่มีแถบแท็บ หน้าตาเหมือนเดิม
- คำขอข้ามวัน: เลือกแท็บวันที่ 2 แล้วสลับตัวอย่าง → ยังอยู่วันที่ 2

- [ ] **Step 5: Commit (ถ้ามีการแก้)**

```bash
git add src/lib/petitionTimelineDetail.ts src/pages/PetitionTimelineDetailPage.tsx
git commit -m "fix(timeline): แก้ regression จากแท็บรายตัวอย่าง"
```
