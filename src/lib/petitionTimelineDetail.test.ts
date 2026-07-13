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
) {
  return buildTimelineDetailModel({ petition: petitionData, parameters, progressEntries, auditLogs }, now);
}

describe("buildTimelineDetailModel", () => {
  it("uses the first received timestamp and a same-day 20:00 estimate for open work", () => {
    const result = model(petition({ qcReceivedAt: at(13, 10, 15) }), [], [], [], new Date(2026, 6, 13, 12));

    expect(result.header.startAt).toBe(at(13, 10, 15));
    expect(result.header.endAt).toBe(at(13, 20));
    expect(result.header.endKind).toBe("estimated");
    expect(result.timeline.ticks.map((tick) => tick.label)).toContain("08:00");
    expect(result.timeline.ticks.map((tick) => tick.label)).toContain("20:00");
  });

  it("uses the current time and daily boundaries for open work that crosses dates", () => {
    const now = new Date(2026, 6, 13, 12, 30);
    const result = model(petition({ qcReceivedAt: at(12, 10, 15) }), [], [], [], now);

    expect(result.timeline.startAt).toBe(at(12, 8));
    expect(result.timeline.endAt).toBe(now.toISOString());
    expect(result.timeline.ticks.some((tick) => tick.at === at(13, 8))).toBe(true);
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
});
