# Petition Timeline — แยกแถว "ยื่นคำขอ" ออกจาก "ส่งตัวอย่าง" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่ม milestone `submitted` = "ยื่นคำขอ" (เวลากรอกฟอร์ม) และเปลี่ยน milestone "ส่งตัวอย่าง" ให้เป็น row ใหม่ `sample-sent` ที่อ่านเวลาส่งตัวอย่างจริงจาก `petition.sampleSentAt`

**Architecture:** แก้ฟังก์ชัน pure `buildMilestoneRows` ใน `src/lib/petitionTimelineDetail.ts` ให้คืน milestone 5 แถว (เดิม 4) หน้า `PetitionTimelineDetailPage.tsx` เรนเดอร์แถวจากโมเดลแบบ generic (ไม่ได้ hard-code key/label ใด ๆ) จึงไม่ต้องแก้ ไม่มีการเปลี่ยนแปลงฝั่ง backend หรือ schema — ฟิลด์ `sampleSentAt` มีอยู่แล้วใน `PetitionBase` และถูกเขียนโดย `PATCH /petitions/:id/deliver`

**Tech Stack:** TypeScript, Vitest

## Global Constraints

- แตะเฉพาะ `src/lib/petitionTimelineDetail.ts` และ `src/lib/petitionTimelineDetail.test.ts` — ห้ามแก้ `PetitionTimelineDetailPage.tsx`, backend, หรือ schema
- ลำดับ row ในโมเดลต้องเป็น: `submitted`, `sample-sent`, `received-qc`, `assigned`, `received-lab`, `qc-analyzing`, `lab-analyzing`, `pre-result`, `final`
- แถว `assigned` / `received-lab` / `lab-analyzing` / `pre-result` ยังคงโผล่เฉพาะคำร้องที่ `hasLabTrack(petition)` เป็น true เหมือนเดิม
- label ภาษาไทยตรงตัว: `submitted` → `"ยื่นคำขอ"`, `sample-sent` → `"ส่งตัวอย่าง"`
- ห้ามเปลี่ยน `header.startAt` / `header.startKind` / `timeline.startAt` — ยังคำนวณเหมือนเดิมทุกประการ

---

### Task 1: แยก milestone "ยื่นคำขอ" กับ "ส่งตัวอย่าง"

**Files:**
- Modify: `src/lib/petitionTimelineDetail.ts:398-413` (`buildMilestoneRows`)
- Test: `src/lib/petitionTimelineDetail.test.ts`

**Interfaces:**
- Consumes: helper ที่มีอยู่แล้วในไฟล์ — `firstValidDate(...values)` (คืน ISO string ของเวลาที่เร็วที่สุดที่ parse ได้ หรือ `null`), `validDate(value)`, `hasLabTrack(petition)`
- Produces: `buildMilestoneRows(petition: Petition): TimelineDetailRow[]` — signature เดิม แต่คืน 5 แถว (3 แถวสำหรับคำร้องที่ไม่มี Lab track)

- [ ] **Step 1: อัปเดตเทสต์เดิม 3 ตัวที่คาด row เก่า**

ไฟล์ `src/lib/petitionTimelineDetail.test.ts` — แก้ทั้ง 3 จุดนี้

จุดที่ 1 (ประมาณบรรทัด 165-179) เปลี่ยนชื่อ `it(...)` และ array ที่คาดไว้:

```ts
  it("แสดงจุด ยื่นคำขอ → ส่งตัวอย่าง → QC รับ → มอบหมาย → Lab รับ ตามลำดับงานจริง", () => {
    const result = model(petition({
      items: [{ seq: 1, sampleName: "Lab Sample", batchNo: "BATCH-001", sampleId: "sample-1" }],
      sampleSentAt: at(13, 8, 30),
      qcReceivedAt: at(13, 9),
      labReceivedAt: at(13, 10),
      assignedTo: { employeeId: "L001", name: "Lab Analyst", assignedAt: at(13, 11) },
    }));

    expect(result.timeline.rows.filter((row) => row.kind === "milestone")).toMatchObject([
      { key: "submitted", label: "ยื่นคำขอ", at: at(13, 9), startAt: null, endAt: null, done: true },
      { key: "sample-sent", label: "ส่งตัวอย่าง", at: at(13, 8, 30), startAt: null, endAt: null, done: true },
      { key: "received-qc", label: "QC รับตัวอย่าง", at: at(13, 9), startAt: null, endAt: null, done: true },
      { key: "assigned", label: "มอบหมายงาน Lab", at: at(13, 11), done: true },
      { key: "received-lab", label: "Lab รับตัวอย่าง", at: at(13, 10), done: true },
    ]);
  });
```

จุดที่ 2 (ประมาณบรรทัด 189-196) เพิ่ม `sample-sent` เข้าไปในลิสต์ key:

```ts
  it("ซ่อนแถวฝั่ง Lab ทั้งหมดสำหรับคำร้องที่ไม่มีงาน Lab", () => {
    const result = model(petition({
      qcReceivedAt: at(13, 9),
      assignedTo: { employeeId: "L001", name: "Stray Lab Analyst", assignedAt: at(13, 11) },
    }));

    expect(result.timeline.rows.map((row) => row.key)).toEqual(["submitted", "sample-sent", "received-qc", "qc-analyzing", "final"]);
  });
```

จุดที่ 3 (ประมาณบรรทัด 403-424) เพิ่ม `sample-sent` เข้าไปในลำดับแถว:

```ts
  it("เรียงแถว: ยื่นคำขอ → ส่งตัวอย่าง → QC รับ → มอบหมาย → Lab รับ → QC วิเคราะห์ → Lab วิเคราะห์ → Pre Result → Final Result", () => {
    const result = model(
      petition({
        items: [{ seq: 1, sampleName: "Lab Sample", batchNo: "BATCH-001", sampleId: "sample-1" }],
        qcReceivedAt: at(13, 9),
        labReceivedAt: at(13, 10),
      }),
      [],
      [],
    );

    expect(result.timeline.rows.map((row) => row.key)).toEqual([
      "submitted",
      "sample-sent",
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

จุดที่ 4 (ประมาณบรรทัด 572-581) — เทสต์ "แท็บรายตัวอย่างไม่ทำให้แถวขยับ" มี `expectedRows` แบบเต็ม แก้สองบรรทัดแรกของ array เป็น:

```ts
    const expectedRows = [
      { key: "submitted", label: "ยื่นคำขอ", kind: "milestone", track: "stage", at: at(13, 9), startAt: null, endAt: null, done: true },
      { key: "sample-sent", label: "ส่งตัวอย่าง", kind: "milestone", track: "stage", at: at(13, 9), startAt: null, endAt: null, done: true },
      { key: "received-qc", label: "QC รับตัวอย่าง", kind: "milestone", track: "stage", at: at(13, 9), startAt: null, endAt: null, done: true },
      { key: "assigned", label: "มอบหมายงาน Lab", kind: "milestone", track: "stage", at: at(13, 11), startAt: null, endAt: null, done: true },
      { key: "received-lab", label: "Lab รับตัวอย่าง", kind: "milestone", track: "stage", at: at(13, 10), startAt: null, endAt: null, done: true },
      { key: "qc-analyzing", label: "QC กำลังวิเคราะห์", kind: "bar", track: "qc", at: null, startAt: at(13, 9), endAt: at(13, 13), done: true },
      { key: "lab-analyzing", label: "Lab กำลังวิเคราะห์", kind: "bar", track: "lab", at: null, startAt: at(13, 10), endAt: at(13, 14), done: true },
      { key: "pre-result", label: "Pre Result", kind: "bar", track: "lab", at: null, startAt: at(13, 14), endAt: at(13, 15), done: true },
      { key: "final", label: "Final Result", kind: "bar", track: "stage", at: null, startAt: at(13, 15), endAt: at(13, 16), done: true },
    ];
```

(คำร้องในเทสต์นั้นไม่มี `sampleSentAt` จึง fallback ไปที่ `qcReceivedAt` = `at(13, 9)`)

- [ ] **Step 2: เขียนเทสต์ใหม่ 3 ตัวสำหรับ `sample-sent`**

แทรกต่อท้ายเทสต์ "แสดงจุด ยื่นคำขอ → ..." ในไฟล์เดิม:

```ts
  it("จุด ส่งตัวอย่าง ใช้เวลาสแกนส่งจริงจาก sampleSentAt", () => {
    const result = model(petition({ sampleSentAt: at(13, 8, 30), qcReceivedAt: at(13, 10) }));

    expect(result.timeline.rows.find((row) => row.key === "sample-sent")).toMatchObject({
      label: "ส่งตัวอย่าง",
      kind: "milestone",
      at: at(13, 8, 30),
      done: true,
    });
  });

  it("คำร้องที่ไม่ได้สแกนส่ง ให้จุด ส่งตัวอย่าง ตกไปที่เวลารับตัวอย่างที่เร็วสุด", () => {
    const result = model(petition({ labReceivedAt: at(13, 11), qcReceivedAt: at(13, 10) }));

    expect(result.timeline.rows.find((row) => row.key === "sample-sent")).toMatchObject({
      at: at(13, 10),
      done: true,
    });
  });

  it("ยังไม่ส่งและยังไม่มีใครรับ → จุด ส่งตัวอย่าง ว่างและยังไม่ done", () => {
    const result = model(petition());

    expect(result.timeline.rows.find((row) => row.key === "sample-sent")).toMatchObject({
      at: null,
      done: false,
    });
  });
```

- [ ] **Step 3: รันเทสต์ให้เห็นว่า fail**

Run: `npx vitest run src/lib/petitionTimelineDetail.test.ts`
Expected: FAIL — เทสต์ที่คาด key `sample-sent` ไม่เจอ row (ได้ `undefined`) และเทสต์ลำดับแถวได้ array ที่ไม่มี `sample-sent`

- [ ] **Step 4: แก้ `buildMilestoneRows`**

ไฟล์ `src/lib/petitionTimelineDetail.ts` แทนที่ฟังก์ชันเดิมทั้งก้อน (บรรทัด 398-413):

```ts
function buildMilestoneRows(petition: Petition): TimelineDetailRow[] {
  const hasLab = hasLabTrack(petition);
  const submittedAt = firstValidDate(petition.submittedBy?.submittedAt, petition.createdAt);
  const qcReceivedAt = petition.qcReceivedAt ?? petition.receivedAt ?? null;
  const labReceivedAt = petition.labReceivedAt ?? null;
  // คำร้องเก่า/เคสที่ข้ามการสแกนส่ง ยังต้องเห็นจุดส่ง — ถอยไปใช้เวลารับตัวอย่างที่เร็วสุดแทน
  const sampleSentAt = petition.sampleSentAt
    ?? firstValidDate(petition.qcReceivedAt, petition.receivedAt, petition.labReceivedAt);
  const assignedAt = petition.assignedTo?.assignedAt ?? null;
  const milestone = (key: string, label: string, at: string | null): TimelineDetailRow =>
    ({ key, label, kind: "milestone", track: "stage", at, startAt: null, endAt: null, done: !!validDate(at) });

  return [
    milestone("submitted", "ยื่นคำขอ", submittedAt),
    milestone("sample-sent", "ส่งตัวอย่าง", sampleSentAt),
    milestone("received-qc", "QC รับตัวอย่าง", qcReceivedAt),
    hasLab ? milestone("assigned", "มอบหมายงาน Lab", assignedAt) : null,
    hasLab ? milestone("received-lab", "Lab รับตัวอย่าง", labReceivedAt) : null,
  ].filter((row): row is TimelineDetailRow => row !== null);
}
```

- [ ] **Step 5: รันเทสต์ไฟล์นี้ให้ผ่าน**

Run: `npx vitest run src/lib/petitionTimelineDetail.test.ts`
Expected: PASS ทุกเคส

- [ ] **Step 6: รันเทสต์ทั้ง suite + type-check**

Run: `npx vitest run` แล้ว `npx tsc -p tsconfig.app.json --noEmit`
Expected: เทสต์ผ่านทั้งหมด (ถ้า `PetitionTimelineDetailPage.test.tsx` อ้าง label "ส่งตัวอย่าง" ผ่าน getByText แล้วเจอซ้ำสองจุด ให้แก้เทสต์นั้นให้เจาะจงขึ้น เช่นใช้ `getByLabelText("ส่งตัวอย่าง (จุด)")`) ส่วน `tsc` ต้องไม่มี error ใหม่จากสองไฟล์นี้ (repo มี latent error เดิมอยู่บ้าง — เทียบก่อน/หลังว่าไม่เพิ่ม)

- [ ] **Step 7: Commit**

```bash
git add src/lib/petitionTimelineDetail.ts src/lib/petitionTimelineDetail.test.ts
git commit -m "feat(timeline): แยกจุดยื่นคำขอ ออกจากจุดส่งตัวอย่าง"
```
