# Petition Timeline — Stage Durations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เปลี่ยนกราฟ Petition Timeline ให้ทุกสถานะเป็น "ช่วงเวลา" ที่ลากจนถึงสถานะถัดไป ตัดแถว "QC/Lab รับตัวอย่าง" ออก เพิ่มแถว "ออกผล Lab" และนิยาม Pre Result / Final Result ใหม่

**Architecture:** งานทั้งหมดอยู่ฝั่ง frontend — `src/lib/petitionTimelineDetail.ts` (pure model builder, unit-tested), `src/lib/petitionTimelineColors.ts` (pure color map), และหน้า `src/pages/PetitionTimelineDetailPage.tsx` (render อย่างเดียว) ไม่แตะ backend ไม่มี field ใหม่ ทั้งสามไฟล์แก้ตามลำดับ: model → สี → หน้า

**Tech Stack:** React 18 + TypeScript + Vitest + Testing Library + Tailwind

**Spec:** `docs/superpowers/specs/2026-07-14-petition-timeline-stage-durations-design.md`

## Global Constraints

- ทดสอบด้วย `npx vitest run <path>` (repo ใช้ Vitest) — **ห้ามรัน `npm run build`** (postbuild เขียนทับไฟล์ root และทำ dev server พัง); type-check ด้วย `npx tsc -p tsconfig.app.json --noEmit`
- ชื่อ Tailwind class ต้องเขียนเป็น string literal เต็ม ๆ ห้ามประกอบด้วย template string (JIT scan จาก source)
- `tailwind.config.ts` override `red`/`green`/`yellow` ให้เหลือแค่เฉด `50`/`500` → **ห้ามใช้** `red-200` / `green-200` / `yellow-200`
- label ทุกอันเป็นภาษาไทยตามที่ระบุเป๊ะ ๆ: `ยื่นคำขอ`, `ส่งตัวอย่าง`, `มอบหมายงาน Lab`, `QC กำลังวิเคราะห์`, `Lab กำลังวิเคราะห์`, `ออกผล Lab`, `Pre Result`, `Final Result`, `ส่งกลับแก้ไข`
- คอมเมนต์ในโค้ดเขียนภาษาไทยตามสไตล์ไฟล์เดิม และเขียนเฉพาะที่อธิบาย "ทำไม" (เช่น เหตุผลของ fallback) ไม่ใช่ "โค้ดบรรทัดถัดไปทำอะไร"
- โครง `TimelineDetailRow` / `TimelineDetailDayRow` / `buildTimelineDays()` / `clipRowToDay()` **ไม่เปลี่ยน** — เปลี่ยนแค่ว่าใครสร้างแถวอะไร

---

## File Structure

| ไฟล์ | รับผิดชอบ | งานในแผนนี้ |
|------|-----------|-------------|
| `src/lib/petitionTimelineDetail.ts` | สร้าง model ของกราฟจาก Petition + audit log | ยุบ `buildMilestoneRows` + `buildAnalyzingRows` + `buildClosingRows` → `buildStageRows()` |
| `src/lib/petitionTimelineDetail.test.ts` | unit test ของ model | เขียนเทสต์แถวใหม่ทั้งหมด |
| `src/lib/petitionTimelineColors.ts` | map `row.key` → Tailwind class | ตัด 2 key เพิ่ม 1 key + รองรับ rejected ในจุด |
| `src/lib/petitionTimelineColors.test.ts` | unit test ของ color map | อัปเดต key set |
| `src/pages/PetitionTimelineDetailPage.tsx` | render กราฟ | ลบ `barTrackClass()` ใช้ helper สีแทน |
| `src/pages/PetitionTimelineDetailPage.test.tsx` | test หน้า | อัปเดตเทสต์ที่อ้าง label เก่า |

---

## Task 1: โมเดลแถวใหม่ — `buildStageRows()`

**Files:**
- Modify: `src/lib/petitionTimelineDetail.ts:403-477` (ลบ `buildMilestoneRows` / `buildAnalyzingRows` / `buildClosingRows` แทนด้วย `buildStageRows`) และ `:502-506` (จุดเรียกใช้ใน `buildTimelineDetailModel`)
- Test: `src/lib/petitionTimelineDetail.test.ts`

**Interfaces:**
- Consumes: `makeBarRow()`, `firstValidDate()`, `latestValidDate()`, `validDate()`, `hasLabTrack()` — มีอยู่แล้วในไฟล์ ไม่ต้องเขียนใหม่
- Produces: `buildStageRows(petition: Petition, now: Date, fallbackStartAt: string): TimelineDetailRow[]` — คืนแถวเรียงตามลำดับงาน; Task 2 และ 3 พึ่ง `row.key` ชุดนี้: `submitted`, `sample-sent`, `assigned`, `qc-analyzing`, `lab-analyzing`, `lab-approval`, `pre-result`, `final`

### บริบทที่ต้องรู้ก่อนเริ่ม

โครงเดิม (จะถูกลบ) แบ่งแถวเป็น 3 ก้อน: จุด milestone 5 จุด → แท่งวิเคราะห์ 2 แท่ง → แท่งปิดงาน 2 แท่ง โครงใหม่คือ **ลำดับต่อเนื่องก้อนเดียว**: end ของแถวหนึ่ง = start ของแถวถัดไป จึงยุบเหลือฟังก์ชันเดียว

ที่มาของเวลาแต่ละอัน (ทั้งหมดเป็น field บน `Petition`):
- `submittedBy.submittedAt` = ยื่นคำขอ (fallback `createdAt`)
- `sampleSentAt` = สแกนนำส่งตัวอย่าง
- `qcReceivedAt` / `receivedAt` = QC รับตัวอย่าง → **จุดเริ่มวิเคราะห์ของ QC**
- `assignedTo.assignedAt` = มอบหมายงานให้ผู้ทดสอบ Lab
- `labReceivedAt` = Lab รับตัวอย่าง → **จุดเริ่มวิเคราะห์ของ Lab**
- `qcCompletedAt` / `labCompletedAt` = ฝั่งนั้นกด "บันทึกผล"
- `labApprovedAt` = หัวหน้า Lab ออกผล
- `approvedAt` = หัวหน้า QC ออก Final Result / `rejectedAt` = ส่งกลับแก้ไข

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน — แถวหลัก 8 แถวของคำร้องที่มี Lab**

เปิด `src/lib/petitionTimelineDetail.test.ts` **ลบเทสต์เดิมเหล่านี้ทิ้ง** (ทั้งบล็อก `it(...)`) เพราะโมเดลเปลี่ยนนิยามไปแล้ว:

- `"แสดงจุด ยื่นคำขอ → ส่งตัวอย่าง → QC รับ → มอบหมาย → Lab รับ ตามลำดับงานจริง"` (~บรรทัด 175)
- `"จุด ส่งตัวอย่าง ใช้เวลาสแกนส่งจริงจาก sampleSentAt"` (~193)
- `"คำร้องที่ไม่ได้สแกนส่ง ให้จุด ส่งตัวอย่าง ตกไปที่เวลารับตัวอย่างที่เร็วสุด"` (~204)
- `"ยังไม่ส่งและยังไม่มีใครรับ → จุด ส่งตัวอย่าง ว่างและยังไม่ done"` (~213)
- `"ลากแท่ง Pre Result จาก Lab บันทึกครบ ถึง Lab อนุมัติ"` (~260)
- `"ไม่วาดแท่ง Pre Result เมื่อยังไม่อนุมัติ"` (~278)
- `"ลากแท่ง Final Result จาก QC ครบ + Lab ออกผล (เอาอันที่ช้ากว่า) ถึงอนุมัติ"` (~292)
- `"Final Result ของคำร้องที่ไม่มี Lab เริ่มที่ QC ครบ"` (~313)
- `"ลากแท่ง Final Result เริ่มที่ QC ครบ เมื่อ QC ครบทีหลัง Lab ออกผล (คำร้องมี Lab)"` (~327)
- `"คำร้องที่ถูกส่งกลับแก้ไข ใช้ชื่อแถวและเวลา rejected"` (~348)
- `"เรียงแถว: ยื่นคำขอ → ส่งตัวอย่าง → QC รับ → มอบหมาย → Lab รับ → QC วิเคราะห์ → Lab วิเคราะห์ → Pre Result → Final Result"` (~486)

แล้วเพิ่มเทสต์ชุดใหม่ (วางแทนที่ตำแหน่งเดิมได้เลย):

```ts
  it("ทุกสถานะเป็นช่วงเวลาที่ลากถึงสถานะถัดไป และปิดท้ายด้วยจุด Final Result", () => {
    const result = model(petition({
      status: "approved",
      items: [{ seq: 1, sampleName: "Lab Sample", batchNo: "BATCH-001", sampleId: "sample-1" }],
      submittedBy: { name: "Requester", submittedAt: at(13, 8) },
      createdAt: at(13, 8),
      sampleSentAt: at(13, 8, 30),
      qcReceivedAt: at(13, 9),
      assignedTo: { employeeId: "L001", name: "Lab Analyst", assignedAt: at(13, 9, 30) },
      labReceivedAt: at(13, 10),
      qcCompletedAt: at(13, 13),
      labCompletedAt: at(13, 14),
      labApprovedAt: at(13, 15),
      approvedAt: at(13, 16),
    }), [], [], [], new Date(2026, 6, 13, 17));

    expect(result.timeline.rows).toEqual([
      { key: "submitted", label: "ยื่นคำขอ", kind: "bar", track: "stage", at: null, startAt: at(13, 8), endAt: at(13, 8, 30), done: true },
      { key: "sample-sent", label: "ส่งตัวอย่าง", kind: "bar", track: "stage", at: null, startAt: at(13, 8, 30), endAt: at(13, 9), done: true },
      { key: "assigned", label: "มอบหมายงาน Lab", kind: "bar", track: "lab", at: null, startAt: at(13, 9, 30), endAt: at(13, 10), done: true },
      { key: "qc-analyzing", label: "QC กำลังวิเคราะห์", kind: "bar", track: "qc", at: null, startAt: at(13, 9), endAt: at(13, 13), done: true },
      { key: "lab-analyzing", label: "Lab กำลังวิเคราะห์", kind: "bar", track: "lab", at: null, startAt: at(13, 10), endAt: at(13, 14), done: true },
      { key: "lab-approval", label: "ออกผล Lab", kind: "bar", track: "lab", at: null, startAt: at(13, 14), endAt: at(13, 15), done: true },
      { key: "pre-result", label: "Pre Result", kind: "bar", track: "stage", at: null, startAt: at(13, 14), endAt: at(13, 16), done: true },
      { key: "final", label: "Final Result", kind: "milestone", track: "stage", at: at(13, 16), startAt: null, endAt: null, done: true },
    ]);
  });

  it("ไม่มีแถว QC/Lab รับตัวอย่าง ในกราฟอีกต่อไป", () => {
    const result = model(petition({
      items: [{ seq: 1, sampleName: "Lab Sample", batchNo: "BATCH-001", sampleId: "sample-1" }],
      qcReceivedAt: at(13, 9),
      labReceivedAt: at(13, 10),
    }));

    const keys = result.timeline.rows.map((row) => row.key);
    expect(keys).not.toContain("received-qc");
    expect(keys).not.toContain("received-lab");
  });

  it("แถว ส่งตัวอย่าง จบที่อันที่มาก่อนระหว่าง QC เริ่มวิเคราะห์ กับ มอบหมายงาน Lab", () => {
    const labItem = { seq: 1, sampleName: "Lab Sample", batchNo: "BATCH-001", sampleId: "sample-1" };

    const qcFirst = model(petition({
      items: [labItem],
      sampleSentAt: at(13, 8),
      qcReceivedAt: at(13, 9),
      assignedTo: { employeeId: "L001", name: "Lab Analyst", assignedAt: at(13, 11) },
    }));
    expect(qcFirst.timeline.rows.find((row) => row.key === "sample-sent")).toMatchObject({
      startAt: at(13, 8),
      endAt: at(13, 9),
      done: true,
    });

    const assignFirst = model(petition({
      items: [labItem],
      sampleSentAt: at(13, 8),
      assignedTo: { employeeId: "L001", name: "Lab Analyst", assignedAt: at(13, 8, 30) },
      qcReceivedAt: at(13, 11),
    }));
    expect(assignFirst.timeline.rows.find((row) => row.key === "sample-sent")).toMatchObject({
      startAt: at(13, 8),
      endAt: at(13, 8, 30),
      done: true,
    });
  });

  it("คำร้องที่ไม่ได้สแกนส่ง ให้แถว ส่งตัวอย่าง เริ่มที่เวลารับตัวอย่างที่เร็วสุด", () => {
    const result = model(petition({ labReceivedAt: at(13, 11), qcReceivedAt: at(13, 10) }));

    expect(result.timeline.rows.find((row) => row.key === "sample-sent")).toMatchObject({
      startAt: at(13, 10),
      done: true,
    });
  });

  it("ยังไม่ส่งและยังไม่มีใครรับ → แถว ส่งตัวอย่าง ไม่มีแท่ง", () => {
    const result = model(petition());

    expect(result.timeline.rows.find((row) => row.key === "sample-sent")).toMatchObject({
      startAt: null,
      endAt: null,
      done: false,
    });
  });

  it("แถวที่ยังไม่จบ ลากถึงเวลาปัจจุบันและยังไม่ done", () => {
    const result = model(
      petition({ submittedBy: { name: "Requester", submittedAt: at(13, 9) }, createdAt: at(13, 9) }),
      [], [], [],
      new Date(2026, 6, 13, 12),
    );

    expect(result.timeline.rows.find((row) => row.key === "submitted")).toMatchObject({
      startAt: at(13, 9),
      endAt: at(13, 12),
      done: false,
    });
  });

  it("Pre Result เริ่มเมื่อบันทึกผลครบทั้ง Lab และ QC (เอาอันที่ช้ากว่า)", () => {
    const labItem = { seq: 1, sampleName: "Lab Sample", batchNo: "BATCH-001", sampleId: "sample-1" };

    const labLast = model(petition({
      items: [labItem],
      qcReceivedAt: at(13, 9),
      labReceivedAt: at(13, 10),
      qcCompletedAt: at(13, 13),
      labCompletedAt: at(13, 14),
    }), [], [], [], new Date(2026, 6, 13, 16));
    expect(labLast.timeline.rows.find((row) => row.key === "pre-result")).toMatchObject({
      startAt: at(13, 14),
      endAt: at(13, 16),
      done: false,
    });

    const qcLast = model(petition({
      items: [labItem],
      qcReceivedAt: at(13, 9),
      labReceivedAt: at(13, 10),
      labCompletedAt: at(13, 12),
      qcCompletedAt: at(13, 15),
    }), [], [], [], new Date(2026, 6, 13, 16));
    expect(qcLast.timeline.rows.find((row) => row.key === "pre-result")).toMatchObject({
      startAt: at(13, 15),
      endAt: at(13, 16),
      done: false,
    });
  });

  it("Pre Result ยังไม่เริ่ม ถ้ามีแค่ฝั่งเดียวที่บันทึกผลครบ", () => {
    const result = model(petition({
      items: [{ seq: 1, sampleName: "Lab Sample", batchNo: "BATCH-001", sampleId: "sample-1" }],
      qcReceivedAt: at(13, 9),
      labReceivedAt: at(13, 10),
      labCompletedAt: at(13, 14),
    }), [], [], [], new Date(2026, 6, 13, 16));

    expect(result.timeline.rows.find((row) => row.key === "pre-result")).toMatchObject({
      startAt: null,
      endAt: null,
      done: false,
    });
  });

  it("คำร้องที่ไม่มี Lab: ตัดแถวฝั่ง Lab ทิ้ง และ Pre Result เริ่มที่ QC บันทึกผล", () => {
    const result = model(petition({
      status: "approved",
      qcReceivedAt: at(13, 9),
      assignedTo: { employeeId: "L001", name: "Stray Lab Analyst", assignedAt: at(13, 11) },
      qcCompletedAt: at(13, 13),
      approvedAt: at(13, 16),
    }), [], [], [], new Date(2026, 6, 13, 17));

    expect(result.timeline.rows.map((row) => row.key)).toEqual([
      "submitted",
      "sample-sent",
      "qc-analyzing",
      "pre-result",
      "final",
    ]);
    expect(result.timeline.rows.find((row) => row.key === "pre-result")).toMatchObject({
      startAt: at(13, 13),
      endAt: at(13, 16),
      done: true,
    });
  });

  it("แถว ออกผล Lab ลากจาก Lab บันทึกผล ถึง หัวหน้า Lab ออกผล", () => {
    const result = model(petition({
      items: [{ seq: 1, sampleName: "Lab Sample", batchNo: "BATCH-001", sampleId: "sample-1" }],
      qcReceivedAt: at(13, 9),
      labReceivedAt: at(13, 10),
      labCompletedAt: at(13, 14),
      labApprovedAt: at(13, 15),
    }), [], [], [], new Date(2026, 6, 13, 16));

    expect(result.timeline.rows.find((row) => row.key === "lab-approval")).toMatchObject({
      label: "ออกผล Lab",
      kind: "bar",
      track: "lab",
      startAt: at(13, 14),
      endAt: at(13, 15),
      done: true,
    });
  });

  it("จุด Final Result ยังไม่ done เมื่อหัวหน้า QC ยังไม่อนุมัติ", () => {
    const result = model(petition({ qcReceivedAt: at(13, 9), qcCompletedAt: at(13, 13) }));

    expect(result.timeline.rows.find((row) => row.key === "final")).toMatchObject({
      kind: "milestone",
      at: null,
      done: false,
    });
  });

  it("คำร้องที่ถูกส่งกลับแก้ไข: Pre Result จบที่ rejectedAt และจุดปิดท้ายเปลี่ยนชื่อ", () => {
    const result = model(petition({
      status: "rejected",
      qcReceivedAt: at(13, 9),
      qcCompletedAt: at(13, 13),
      rejectedAt: at(13, 14),
    }), [], [], [], new Date(2026, 6, 13, 16));

    expect(result.timeline.rows.find((row) => row.key === "pre-result")).toMatchObject({
      startAt: at(13, 13),
      endAt: at(13, 14),
      done: true,
    });
    expect(result.timeline.rows.find((row) => row.key === "final")).toMatchObject({
      label: "ส่งกลับแก้ไข",
      kind: "milestone",
      at: at(13, 14),
      done: true,
    });
  });
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าพัง**

Run: `npx vitest run src/lib/petitionTimelineDetail.test.ts`
Expected: FAIL — เทสต์ใหม่ล้มเพราะโมเดลยังคืน `kind: "milestone"` ให้ `submitted`/`sample-sent` และยังไม่มี key `lab-approval`

- [ ] **Step 3: เขียน `buildStageRows()` แทน 3 ฟังก์ชันเดิม**

ใน `src/lib/petitionTimelineDetail.ts` **ลบ** `buildMilestoneRows()`, `buildAnalyzingRows()`, `buildClosingRows()` (บรรทัด 403–477) แล้วใส่แทน:

```ts
// ทุกสถานะเป็นช่วงเวลาที่ลากไปจนสถานะถัดไปเริ่ม — end ของแถวหนึ่งคือ start ของแถวถัดไป
// ปิดท้ายด้วยจุดเดียว (Final Result) ที่หัวหน้า QC อนุมัติ
function buildStageRows(petition: Petition, now: Date, fallbackStartAt: string): TimelineDetailRow[] {
  const hasLab = hasLabTrack(petition);
  const nowAt = now.toISOString();

  const submittedAt = firstValidDate(petition.submittedBy?.submittedAt, petition.createdAt);
  // คำร้องเก่า/เคสที่ข้ามการสแกนส่ง ยังต้องเห็นช่วงส่งตัวอย่าง — ถอยไปใช้เวลารับตัวอย่างที่เร็วสุดแทน
  const sampleSentAt = petition.sampleSentAt
    ?? firstValidDate(petition.qcReceivedAt, petition.receivedAt, petition.labReceivedAt);
  const assignedAt = hasLab ? petition.assignedTo?.assignedAt ?? null : null;
  // ข้อมูลเก่าบางเคสมีรู timestamp: บันทึกผลแล้วแต่ไม่มีเวลารับตัวอย่าง — ถอยไปใช้จุดเริ่มกราฟ/เวลามอบหมาย
  // ไม่งั้นแท่งวิเคราะห์หายไปทั้งที่ทำจริง (ถ้ายังไม่บันทึกผลและยังไม่รับตัวอย่าง = ยังไม่เริ่มจริง ต้องไม่ fallback)
  const qcStartAt = petition.qcReceivedAt ?? petition.receivedAt ?? (petition.qcCompletedAt ? fallbackStartAt : null);
  const labStartAt = hasLab
    ? petition.labReceivedAt ?? (petition.labCompletedAt ? (assignedAt ?? fallbackStartAt) : null)
    : null;
  const qcCompletedAt = petition.qcCompletedAt ?? null;
  const labCompletedAt = hasLab ? petition.labCompletedAt ?? null : null;
  const labApprovedAt = hasLab ? petition.labApprovedAt ?? null : null;
  const closedAt = petition.approvedAt ?? petition.rejectedAt ?? null;
  // Pre Result เริ่มเมื่อ "บันทึกผลครบทั้งสองฝั่ง" — คำร้องที่มี Lab ต้องรอ Lab บันทึกผลด้วย
  const preResultStartAt = hasLab
    ? (qcCompletedAt && labCompletedAt ? latestValidDate(qcCompletedAt, labCompletedAt) : null)
    : qcCompletedAt;

  // แถวที่เริ่มแล้วแต่สถานะถัดไปยังไม่เกิด → ลากถึงตอนนี้ (done = false); ยังไม่เริ่ม → ไม่มีแท่ง
  const stage = (key: string, label: string, track: TimelineDetailRowTrack, startAt: string | null, endAt: string | null) =>
    makeBarRow({ key, label, track, startAt, endAt: startAt ? endAt ?? nowAt : null, done: !!startAt && !!endAt });

  const final: TimelineDetailRow = {
    key: "final",
    label: petition.status === "rejected" ? "ส่งกลับแก้ไข" : "Final Result",
    kind: "milestone",
    track: "stage",
    at: closedAt,
    startAt: null,
    endAt: null,
    done: !!validDate(closedAt),
  };

  return [
    stage("submitted", "ยื่นคำขอ", "stage", submittedAt, sampleSentAt),
    stage("sample-sent", "ส่งตัวอย่าง", "stage", sampleSentAt, firstValidDate(qcStartAt, assignedAt)),
    hasLab ? stage("assigned", "มอบหมายงาน Lab", "lab", assignedAt, labStartAt) : null,
    stage("qc-analyzing", "QC กำลังวิเคราะห์", "qc", qcStartAt, qcCompletedAt),
    hasLab ? stage("lab-analyzing", "Lab กำลังวิเคราะห์", "lab", labStartAt, labCompletedAt) : null,
    hasLab ? stage("lab-approval", "ออกผล Lab", "lab", labCompletedAt, labApprovedAt) : null,
    stage("pre-result", "Pre Result", "stage", preResultStartAt, closedAt),
    final,
  ].filter((row): row is TimelineDetailRow => row !== null);
}
```

แล้วแก้จุดเรียกใช้ใน `buildTimelineDetailModel()` (เดิมบรรทัด 502–506):

```ts
  const rows = buildStageRows(input.petition, now, timelineStartAt);
```

- [ ] **Step 4: รันเทสต์ทั้งไฟล์ — คาดว่ายังมีเทสต์เก่าพังอยู่**

Run: `npx vitest run src/lib/petitionTimelineDetail.test.ts`
Expected: เทสต์ใหม่ทั้งหมด PASS; เทสต์เก่าที่ยังอ้างโมเดลเดิมจะ FAIL — แก้ใน Step 5

- [ ] **Step 5: แก้เทสต์เก่าที่อ้างแถว/นิยามเดิม**

**5.1** เทสต์ `"splits multi-day timelines into local day windows"` (~บรรทัด 83) — เดิมเช็ค `received-qc` ที่ถูกลบไปแล้ว เปลี่ยนเป็นเช็คแท่ง `submitted` และตั้งเวลายื่นคำขอให้อยู่วันที่ 12 (ของเดิม default เป็นวันที่ 13 ซึ่งมาหลังเวลารับตัวอย่าง — ข้อมูลไม่สมเหตุผล):

```ts
  it("splits multi-day timelines into local day windows", () => {
    const result = model(
      petition({
        submittedBy: { name: "Requester", submittedAt: at(12, 9) },
        createdAt: at(12, 9),
        qcReceivedAt: at(12, 10),
        firstResultAt: at(13, 9),
      }),
      [],
      [],
      [],
      new Date(2026, 6, 13, 12),
    );

    expect(result.timeline.days.map((day) => day.label)).toEqual(["12 ก.ค.", "13 ก.ค."]);
    expect(result.timeline.days[0]).toMatchObject({ startAt: at(12, 8), endAt: at(12, 17) });
    expect(result.timeline.days[1]).toMatchObject({ startAt: at(13, 8), endAt: at(13, 17) });
    expect(result.timeline.days[0]?.rows.find((row) => row.key === "submitted")).toMatchObject({ visible: true });
    expect(result.timeline.days[1]?.rows.find((row) => row.key === "submitted")).toMatchObject({ visible: false });
  });
```

**5.2** เทสต์ `"ซ่อนแถวฝั่ง Lab ทั้งหมดสำหรับคำร้องที่ไม่มีงาน Lab"` (~230) — ซ้ำกับเทสต์ใหม่ `"คำร้องที่ไม่มี Lab: ..."` แล้ว **ลบทิ้ง**

**5.3** เทสต์ `"จุดยื่นคำขอขยายช่วง timeline ให้เริ่มก่อนวันรับตัวอย่าง แต่ header ยังนับจากเวลารับ"` (~239) — บรรทัดสุดท้ายเช็ค `{ at: at(12, 9), done: true }` ซึ่งเป็นนิยามจุด เปลี่ยนเป็นแท่ง:

```ts
    expect(result.timeline.rows.find((row) => row.key === "submitted")).toMatchObject({
      startAt: at(12, 9),
      endAt: at(13, 10),
      done: true,
    });
```

(บรรทัดอื่นในเทสต์นี้ — header, `timeline.startAt`, day labels, `days[0].submitted.visible` — ไม่ต้องแก้)

**5.4** เทสต์ `"จุด ยื่นคำขอ นอกเวลาทำการ (18:30) ยัง visible ในแท็บวันนั้น ส่วนวันอื่นยัง hidden"` (~563) — เปลี่ยนชื่อเทสต์เป็น `"แท่ง ยื่นคำขอ ที่เริ่มนอกเวลาทำการ (18:30) ยัง visible ในแท็บวันนั้น"` และ**ลบ assertion บรรทัดที่เช็ค `days[1] → visible: false` ทิ้ง** — โมเดลใหม่แท่ง `submitted` ลากจาก 13 น. 18:30 ถึง 14 น. 09:00 จึงกินสองวันจริง ๆ (มองเห็นทั้งสองแท็บ) เหลือแค่:

```ts
    expect(result.timeline.days.map((day) => day.label)).toEqual(["13 ก.ค.", "14 ก.ค."]);
    expect(result.timeline.days[0]?.rows.find((row) => row.key === "submitted")).toMatchObject({ visible: true });
```

**5.5** เทสต์ `"แถว timeline และแท็บวัน เหมือนกันทุกตัวอย่างที่เลือก"` (~646) — แก้ fixture ให้ `assignedTo.assignedAt` เป็น `at(13, 9, 30)` (ของเดิม `at(13, 11)` มาหลัง `labReceivedAt` ซึ่งเป็นไปไม่ได้ในงานจริง) แล้วแทน `expectedRows` ทั้งก้อนด้วย:

```ts
    const expectedRows = [
      { key: "submitted", label: "ยื่นคำขอ", kind: "bar", track: "stage", at: null, startAt: at(13, 9), endAt: at(13, 9), done: true },
      { key: "sample-sent", label: "ส่งตัวอย่าง", kind: "bar", track: "stage", at: null, startAt: at(13, 9), endAt: at(13, 9), done: true },
      { key: "assigned", label: "มอบหมายงาน Lab", kind: "bar", track: "lab", at: null, startAt: at(13, 9, 30), endAt: at(13, 10), done: true },
      { key: "qc-analyzing", label: "QC กำลังวิเคราะห์", kind: "bar", track: "qc", at: null, startAt: at(13, 9), endAt: at(13, 13), done: true },
      { key: "lab-analyzing", label: "Lab กำลังวิเคราะห์", kind: "bar", track: "lab", at: null, startAt: at(13, 10), endAt: at(13, 14), done: true },
      { key: "lab-approval", label: "ออกผล Lab", kind: "bar", track: "lab", at: null, startAt: at(13, 14), endAt: at(13, 15), done: true },
      { key: "pre-result", label: "Pre Result", kind: "bar", track: "stage", at: null, startAt: at(13, 14), endAt: at(13, 16), done: true },
      { key: "final", label: "Final Result", kind: "milestone", track: "stage", at: at(13, 16), startAt: null, endAt: null, done: true },
    ];
```

**5.6** เทสต์อื่นที่เหลือ (`"แท่ง QC กำลังวิเคราะห์ ..."`, `"ยังไม่รับตัวอย่าง → ไม่วาดแท่งวิเคราะห์ของฝั่งนั้น"`, fallback ข้อมูลเก่า 2 อัน, `"ไม่มีแถวราย parameter ..."`, `"ทุกแท็บวันมีครบทุกแถว ..."`, `"ตัดแท่งที่กินข้ามวัน ..."`, `"แถวที่ไม่มีแท่งหรือจุดในวันนั้น ..."`, progress/tasks/activities ทั้งหมด) — **ไม่ต้องแก้** ต้องผ่านตามเดิม ถ้าอันไหนพัง แปลว่าโมเดลใหม่ผิด ให้กลับไปแก้ที่ `buildStageRows()` ไม่ใช่แก้เทสต์

- [ ] **Step 6: รันเทสต์ทั้งไฟล์ให้ผ่านหมด**

Run: `npx vitest run src/lib/petitionTimelineDetail.test.ts`
Expected: PASS ทุกเคส

- [ ] **Step 7: type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่จาก 2 ไฟล์นี้ (repo มี latent error เดิมอยู่ ~12 จุด — ให้เทียบว่าไม่มีอันใหม่ที่ path `petitionTimelineDetail`)

- [ ] **Step 8: Commit**

```bash
git add src/lib/petitionTimelineDetail.ts src/lib/petitionTimelineDetail.test.ts
git commit -m "feat(timeline): ทุกสถานะเป็นช่วงเวลาลากถึงสถานะถัดไป + เพิ่มแถวออกผล Lab"
```

---

## Task 2: สีประจำแถวชุดใหม่

**Files:**
- Modify: `src/lib/petitionTimelineColors.ts`
- Test: `src/lib/petitionTimelineColors.test.ts`

**Interfaces:**
- Consumes: `row.key` 8 ตัวจาก Task 1
- Produces: `timelineDotClass(rowKey, { done, rejected? })` และ `timelineBarClass(rowKey, { done, rejected? })` — signature เดิม ไม่เปลี่ยน; Task 3 เรียกใช้ทั้งคู่

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

แทน `ROW_KEYS` เดิมใน `src/lib/petitionTimelineColors.test.ts` ด้วยชุดใหม่ (ตัด `received-qc` / `received-lab` เพิ่ม `lab-approval`):

```ts
const ROW_KEYS = [
  "submitted",
  "sample-sent",
  "assigned",
  "qc-analyzing",
  "lab-analyzing",
  "lab-approval",
  "pre-result",
  "final",
];
```

แทนเทสต์ `"จุด milestone ที่ถึงแล้วใช้สีประจำแถว"` ด้วย:

```ts
  it("จุด Final Result ที่ถึงแล้วใช้สีประจำแถว", () => {
    expect(timelineDotClass("final", { done: true })).toBe("bg-emerald-500");
  });

  it("จุด Final Result ของคำร้องที่ถูกส่งกลับแก้ไขเป็นสีแดง", () => {
    expect(timelineDotClass("final", { done: true, rejected: true })).toBe("bg-red-500");
  });
```

และเพิ่มเทสต์แถวใหม่ต่อท้ายเทสต์ `"แท่งที่เสร็จแล้วใช้เฉดเข้มของสีประจำแถว"`:

```ts
  it("ออกผล Lab ไม่ใช้สีเดียวกับ Lab กำลังวิเคราะห์", () => {
    expect(timelineBarClass("lab-approval", { done: true })).toBe("bg-lime-600");
    expect(timelineBarClass("lab-approval", { done: false })).toBe("bg-lime-200");
    expect(timelineBarClass("lab-approval", { done: true })).not.toBe(timelineBarClass("lab-analyzing", { done: true }));
  });
```

เทสต์ที่เหลือ (สีไม่ซ้ำ, จุดที่ยังไม่ถึงเป็นเทา, เฉดอ่อน/เข้มของแท่งวิเคราะห์, `final` + rejected ในแท่ง, rejected ไม่กระทบแถวอื่น, key ที่ไม่รู้จัก) ปล่อยไว้ตามเดิม

- [ ] **Step 2: รันเทสต์ให้เห็นว่าพัง**

Run: `npx vitest run src/lib/petitionTimelineColors.test.ts`
Expected: FAIL — `lab-approval` ยังไม่มีในแมป (คืน `bg-grey-400`) และ `timelineDotClass("final", { done: true, rejected: true })` ยังคืน `bg-emerald-500`

- [ ] **Step 3: แก้ color map**

ใน `src/lib/petitionTimelineColors.ts` แทน `ROW_COLORS` และ `timelineDotClass` ด้วย:

```ts
const ROW_COLORS: Record<string, RowColor> = {
  "submitted": { solid: "bg-violet-500", soft: "bg-violet-200" },
  "sample-sent": { solid: "bg-orange-500", soft: "bg-orange-200" },
  "assigned": { solid: "bg-rose-500", soft: "bg-rose-200" },
  "qc-analyzing": { solid: "bg-primary-500", soft: "bg-primary-200" },
  "lab-analyzing": { solid: "bg-amber-500", soft: "bg-amber-200" },
  "lab-approval": { solid: "bg-lime-600", soft: "bg-lime-200" },
  "pre-result": { solid: "bg-cyan-500", soft: "bg-cyan-200" },
  "final": { solid: "bg-emerald-500", soft: "bg-emerald-200" },
};
```

```ts
export function timelineDotClass(rowKey: string, state: TimelineRowColorState): string {
  if (!state.done) return PENDING_DOT;
  // คำร้องที่ถูกส่งกลับแก้ไข ปิดงานด้วยจุดแดง
  if (rowKey === "final" && state.rejected) return REJECTED_SOLID;
  return rowColor(rowKey).solid;
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npx vitest run src/lib/petitionTimelineColors.test.ts`
Expected: PASS ทุกเคส

- [ ] **Step 5: Commit**

```bash
git add src/lib/petitionTimelineColors.ts src/lib/petitionTimelineColors.test.ts
git commit -m "feat(timeline): สีประจำแถวชุดใหม่ ตัดแถวรับตัวอย่าง เพิ่มออกผล Lab"
```

---

## Task 3: ต่อสีเข้าหน้ากราฟ + อัปเดตเทสต์หน้า

**Files:**
- Modify: `src/pages/PetitionTimelineDetailPage.tsx:52-61` (ลบ `barTrackClass`) และบรรทัด ~344 (จุด render แถว)
- Test: `src/pages/PetitionTimelineDetailPage.test.tsx:419-453`

**Interfaces:**
- Consumes: `timelineDotClass` / `timelineBarClass` จาก Task 2, `row.key` / `row.kind` / `row.done` จาก Task 1
- Produces: — (แถวสุดท้ายของ chain)

### บริบท

หน้าเดิมระบายสีจาก `row.track` ผ่าน `barTrackClass()` ซึ่งให้ `lab-approval` กับ `lab-analyzing` สีเดียวกัน (ทั้งคู่ track `lab`) และจุด milestone เป็นน้ำเงินหมด — งานนี้เปลี่ยนไปใช้ helper สีที่ map จาก `row.key` (มีอยู่แล้วแต่ยังไม่เคยถูกเรียกใช้)

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

ใน `src/pages/PetitionTimelineDetailPage.test.tsx` แทนเทสต์ 2 อัน (`"แสดงจุดรับตัวอย่างแยก QC/Lab และไม่มีแถวสถานะเก่าอีกต่อไป"` บรรทัด ~419 และ `"จุด milestone ไม่ลากเส้นยาวมาจากขอบซ้ายของแถว"` ~430) ด้วย:

```ts
  it("ไม่มีแถวรับตัวอย่างในกราฟ แต่ยังมีแท่งวิเคราะห์และแถวสถานะใหม่", async () => {
    renderDetail();

    expect(await screen.findByRole("heading", { name: "P-2607-001" })).toBeInTheDocument();
    const timelineCard = screen.getByLabelText("petition timeline");
    expect(timelineCard).not.toHaveTextContent("QC รับตัวอย่าง");
    expect(timelineCard).not.toHaveTextContent("Lab รับตัวอย่าง");
    expect(timelineCard).toHaveTextContent("ยื่นคำขอ");
    expect(timelineCard).toHaveTextContent("QC กำลังวิเคราะห์");
    expect(timelineCard).toHaveTextContent("Pre Result");
    expect(timelineCard).toHaveTextContent("Final Result");
  });

  it("จุด Final Result ไม่ลากเส้นยาวมาจากขอบซ้ายของแถว และใช้สีประจำแถว", async () => {
    Object.assign(mocks.petition, {
      status: "approved",
      qcCompletedAt: "2026-07-13T06:00:00.000Z",
      approvedAt: "2026-07-13T07:00:00.000Z",
    });
    renderDetail();

    const dot = await screen.findByLabelText("Final Result (จุด)");
    expect(dot.parentElement?.children).toHaveLength(1);
    expect(dot).toHaveClass("bg-emerald-500");
  });

  it("แท่ง ยื่นคำขอ ใช้สีประจำแถวของตัวเอง ไม่ใช่สีตามสายงาน", async () => {
    renderDetail();

    const bar = await screen.findByLabelText("ยื่นคำขอ (ช่วงเวลา)");
    expect(bar).toHaveClass("bg-violet-200");
    expect(bar).not.toHaveClass("bg-grey-200");
  });
```

> **ระวัง:** `mocks.petition` เป็น object ที่ถูก mutate ข้ามเทสต์ — ทำตามแพตเทิร์นเดิมของไฟล์ (มี `beforeEach` รีเซ็ตค่ากลับอยู่แล้ว) ถ้าไม่มีการรีเซ็ต field ที่เพิ่งเพิ่ม (`status`, `approvedAt`, `qcCompletedAt`) ให้เพิ่มการรีเซ็ตใน `beforeEach` ที่มีอยู่

เทสต์ `"แท่งที่ยังทำไม่เสร็จใช้สีอ่อนและปลายขวาตรง"` และ `"แท่งที่ทำเสร็จแล้วใช้สีเข้มและปลายมน"` (~437, ~446) — **ไม่ต้องแก้** สี `qc-analyzing` ยังเป็น `bg-primary-200` / `bg-primary-500` เหมือนเดิม

- [ ] **Step 2: รันเทสต์ให้เห็นว่าพัง**

Run: `npx vitest run src/pages/PetitionTimelineDetailPage.test.tsx`
Expected: FAIL — `ยื่นคำขอ (ช่วงเวลา)` ได้ `bg-grey-200` (สีตาม track `stage`) ไม่ใช่ `bg-violet-200`

- [ ] **Step 3: ต่อ helper สีเข้าหน้า**

ใน `src/pages/PetitionTimelineDetailPage.tsx`:

3.1 **ลบ** ฟังก์ชัน `barTrackClass()` (บรรทัด 52–61) ทั้งก้อน

3.2 เพิ่ม import (วางใกล้ import อื่นจาก `@/lib`):

```ts
import { timelineBarClass, timelineDotClass } from "@/lib/petitionTimelineColors";
```

3.3 ในบรรทัด render แถว (~344) เปลี่ยน 2 จุด:

จุด milestone — จาก
```tsx
className={cn("absolute top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white", row.done ? "bg-primary-600" : "bg-grey-300")}
```
เป็น
```tsx
className={cn("absolute top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white", timelineDotClass(row.key, { done: row.done, rejected: petition.status === "rejected" }))}
```

แท่ง — จาก
```tsx
className={cn("absolute top-2 h-2 rounded-full", barTrackClass(row.track, row.done), row.continuesBefore && "rounded-l-none", !row.done && "rounded-r-none")}
```
เป็น
```tsx
className={cn("absolute top-2 h-2 rounded-full", timelineBarClass(row.key, { done: row.done, rejected: petition.status === "rejected" }), row.continuesBefore && "rounded-l-none", !row.done && "rounded-r-none")}
```

> ตัวแปร `petition` มีอยู่แล้วใน scope ของ component — `const { data: petition, ... } = usePetition(id);` (บรรทัด 106) และแถวกราฟ render อยู่หลัง early-return ตอน loading/error แล้ว จึงไม่ต้องกัน null

- [ ] **Step 4: รันเทสต์หน้าให้ผ่าน**

Run: `npx vitest run src/pages/PetitionTimelineDetailPage.test.tsx`
Expected: PASS ทุกเคส

- [ ] **Step 5: รันเทสต์ทั้ง suite + type-check**

Run: `npx vitest run`
Expected: PASS ทั้งหมด (ถ้ามีไฟล์อื่นอ้าง label "QC รับตัวอย่าง" ในกราฟ ให้แก้ที่นั่นด้วย — แต่ **ห้าม** แตะ audit log / activity feed ซึ่งยังใช้ label นี้อย่างถูกต้อง)

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่

- [ ] **Step 6: Commit**

```bash
git add src/pages/PetitionTimelineDetailPage.tsx src/pages/PetitionTimelineDetailPage.test.tsx
git commit -m "feat(timeline): ระบายสีแถวกราฟจาก row.key แทน track"
```

---

## Verification (ปิดงาน)

- [ ] เปิดหน้า `/petitions/:id/timeline` ของคำร้องที่มีงาน Lab จริง แล้วเช็คด้วยตา: 7 แท่ง + 1 จุด, ไม่มีแถว "QC/Lab รับตัวอย่าง", แต่ละแท่งสีต่างกัน, แท่งที่ยังทำอยู่เป็นสีอ่อนปลายขวาตรง
- [ ] เปิดคำร้อง QC-only: เห็น 4 แท่ง + 1 จุด ไม่มีแถวฝั่ง Lab
