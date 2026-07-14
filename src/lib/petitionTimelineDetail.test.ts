import { describe, expect, it } from "vitest";
import type { ParameterItem, QCProgressEntry } from "@/lib/api";
import type { Petition, PetitionAuditLogEntry } from "@/types/petition.types";
import { buildTimelineDetailModel } from "./petitionTimelineDetail";

const at = (day: number, hour: number, minute = 0) => new Date(2026, 6, day, hour, minute).toISOString();

function petition(overrides: Partial<Petition> = {}): Petition {
  return {
    _id: "petition-1",
    petitionNo: "P-2607-001",
    dept: "production",
    status: "inProgress",
    submittedBy: { name: "Requester", submittedAt: at(13, 9) },
    items: [{ seq: 1, sampleName: "Sample A", batchNo: "BATCH-002", sampleId: "sample-1" }],
    createdAt: at(13, 9),
    updatedAt: at(13, 9),
    ...overrides,
  } as Petition;
}

const requiredParameter: ParameterItem = {
  _id: "parameter-1",
  name: "Required checks",
  scope: "qc",
  status: "active",
  applyAll: true,
  valueFields: [
    { label: "Viscosity", type: "number", required: true },
    { label: "Color", type: "text", required: true },
    { label: "Evidence", type: "photo", required: true },
    { label: "Optional note", type: "text", required: false },
  ],
};

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

describe("buildTimelineDetailModel", () => {
  it("uses the first received timestamp and a same-day 17:00 estimate for open work", () => {
    const result = model(petition({ qcReceivedAt: at(13, 10, 15) }), [], [], [], new Date(2026, 6, 13, 12));

    expect(result.header.startAt).toBe(at(13, 10, 15));
    expect(result.header.endAt).toBe(at(13, 17));
    expect(result.header.endKind).toBe("estimated");
    expect(result.timeline.ticks.map((tick) => tick.label)).toContain("08:00");
    expect(result.timeline.ticks.map((tick) => tick.label)).toContain("17:00");
    expect(result.timeline.ticks.map((tick) => tick.label)).not.toContain("20:00");
    expect(result.timeline.days).toHaveLength(1);
    expect(result.timeline.days[0]).toMatchObject({ startAt: at(13, 8), endAt: at(13, 17) });
  });

  it("uses the current time and daily boundaries for open work that crosses dates", () => {
    const now = new Date(2026, 6, 13, 12, 30);
    const result = model(petition({ qcReceivedAt: at(12, 10, 15) }), [], [], [], now);

    expect(result.timeline.startAt).toBe(at(12, 8));
    expect(result.timeline.endAt).toBe(now.toISOString());
    expect(result.timeline.ticks.some((tick) => tick.at === at(13, 8))).toBe(true);
  });

  it("expands a same-day completed timeline after 17:00 when actual data is later", () => {
    const result = model(petition({
      status: "approved",
      qcReceivedAt: at(13, 10),
      approvedAt: at(13, 18, 30),
    }));

    expect(result.header.endAt).toBe(at(13, 18, 30));
    expect(result.timeline.endAt).toBe(at(13, 18, 30));
    expect(result.timeline.ticks.at(-1)).toMatchObject({ at: at(13, 18, 30), label: "18:30" });
    expect(result.timeline.days[0]).toMatchObject({ startAt: at(13, 8), endAt: at(13, 18, 30) });
  });

  it("splits multi-day timelines into local day windows", () => {
    const result = model(
      petition({
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
    expect(result.timeline.days[0]?.rows.find((row) => row.key === "received-qc")).toMatchObject({ visible: true });
    expect(result.timeline.days[1]?.rows.find((row) => row.key === "received-qc")).toMatchObject({ visible: false });
  });

  it("counts only applicable required non-photo fields and caps unapproved completion at 99 percent", () => {
    const result = model(
      petition({ status: "success", qcReceivedAt: at(13, 10) }),
      [requiredParameter],
      [{ itemSeq: 1, parameterId: "parameter-1", filledLabels: ["Viscosity", "Color"] }],
    );

    expect(result.tasks).toMatchObject([{ parameterName: "Required checks", total: 2, filled: 2, state: "recorded" }]);
    expect(result.progress).toEqual({ filled: 2, total: 2, percent: 99 });
  });

  it("reports 100 percent after approval and formats parameter result activity", () => {
    const result = model(
      petition({ status: "approved", qcReceivedAt: at(13, 10), approvedAt: at(13, 15) }),
      [requiredParameter],
      [{ itemSeq: 1, parameterId: "parameter-1", filledLabels: ["Viscosity", "Color"] }],
      [{
        _id: "audit-1",
        petitionId: "petition-1",
        petitionNo: "P-2607-001",
        event: "resultEntered",
        actor: "Analyst",
        metadata: { parameterName: "Required checks" },
        createdAt: at(13, 11),
      }],
    );

    expect(result.progress).toEqual({ filled: 2, total: 2, percent: 100 });
    expect(result.activities[0]).toMatchObject({ actor: "Analyst", label: expect.stringContaining("Required checks") });
  });

  it("keeps structured assignment and field-level result details in activities", () => {
    const result = model(
      petition(),
      [],
      [],
      [
        {
          _id: "assigned-1",
          petitionId: "petition-1",
          petitionNo: "P-2607-001",
          event: "assigned",
          actor: "QC Lead",
          metadata: { assignee: { name: "Analyst" } },
          createdAt: at(13, 10),
        },
        {
          _id: "result-1",
          petitionId: "petition-1",
          petitionNo: "P-2607-001",
          event: "resultUpdated",
          actor: "Analyst",
          metadata: { parameterName: "Required checks", fieldLabel: "Viscosity", sampleName: "Sample A" },
          createdAt: at(13, 11),
        },
      ],
    );

    expect(result.activities[0]?.label).toContain("Viscosity");
    expect(result.activities[0]?.label).toContain("Sample A");
    expect(result.activities[1]?.label).toContain("Analyst");
  });

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

    expect(result.timeline.rows.map((row) => row.key)).toEqual(["submitted", "sample-sent", "received-qc", "qc-analyzing", "final"]);
  });

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

  it("ลากแท่ง Final Result เริ่มที่ QC ครบ เมื่อ QC ครบทีหลัง Lab ออกผล (คำร้องมี Lab)", () => {
    const result = model(petition({
      status: "approved",
      items: [{ seq: 1, sampleName: "Lab Sample", batchNo: "BATCH-001", sampleId: "sample-1" }],
      qcReceivedAt: at(13, 9),
      labCompletedAt: at(13, 12),
      labApprovedAt: at(13, 13),
      qcCompletedAt: at(13, 15),
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

  const twoItemPetition = () => petition({
    qcReceivedAt: at(13, 9),
    items: [
      { seq: 1, sampleName: "Sample A", commonName: "ABAMECTIN 1.8% EC", batchNo: "BATCH-002", sampleId: "sample-1" },
      { seq: 2, sampleName: "Sample B", commonName: "EMAMECTIN 1.9% EC", batchNo: "BATCH-003", sampleId: "sample-2" },
    ],
  });

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
      1,
    );

    expect(result.progress).toEqual({ filled: 2, total: 2, percent: 99 });
    expect(result.overallProgress).toEqual({ filled: 2, total: 4, percent: 50 });
  });

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

    expect(build(1).timeline.rows).toEqual(expectedRows);
    expect(build(2).timeline.rows).toEqual(expectedRows);
    expect(build(null).timeline.rows).toEqual(expectedRows);
    expect(build(1).timeline.days.map((day) => day.key)).toEqual(build(2).timeline.days.map((day) => day.key));
  });

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
        { seq: 2, sampleName: "", batchNo: "", sampleId: "sample-2" },
      ],
    }));

    expect(result.items.map((item) => item.label)).toEqual(["Sample A", "ตัวอย่างที่ 2"]);
    expect(result.items[1]).toMatchObject({ commonName: "", batchNo: "", sampleName: "" });
  });

  it("คำขอที่ไม่มีตัวอย่างเลย คืนรายการแท็บว่าง", () => {
    const result = model(petition({ qcReceivedAt: at(13, 9), items: [] }));

    expect(result.items).toEqual([]);
  });
});
