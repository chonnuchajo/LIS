import { describe, expect, it } from "vitest";
import {
  buildPetitionTimelineRow,
  buildTimelineSummary,
  buildTimelineTicks,
  buildTimelineWindow,
  timelinePercent,
} from "./petitionTimeline";
import type { Petition } from "@/types/petition.types";

function petition(overrides: Partial<Petition> = {}): Petition {
  return {
    _id: "p1",
    petitionNo: "P-2607-0001",
    dept: "production",
    status: "inProgress",
    submittedBy: {
      name: "Requester",
      department: "Production",
      submittedAt: "2026-07-01T01:00:00.000Z",
    },
    items: [{ seq: 1, sampleName: "Sample A", batchNo: "B-001" }],
    createdAt: "2026-07-01T01:00:00.000Z",
    updatedAt: "2026-07-03T04:00:00.000Z",
    ...overrides,
  } as Petition;
}

describe("buildPetitionTimelineRow", () => {
  it("builds ordered milestones and active segments from petition timestamps", () => {
    const row = buildPetitionTimelineRow(
      petition({
        sampleSentAt: "2026-07-01T02:00:00.000Z",
        qcReceivedAt: "2026-07-01T03:00:00.000Z",
        assignedTo: {
          employeeId: "E1",
          name: "Analyst",
          assignedAt: "2026-07-01T04:00:00.000Z",
        },
        firstResultAt: "2026-07-01T05:00:00.000Z",
        qcCompletedAt: "2026-07-01T06:00:00.000Z",
      }),
      new Date("2026-07-02T00:00:00.000Z"),
    );

    expect(row.startAt).toBe("2026-07-01T01:00:00.000Z");
    expect(row.lastAt).toBe("2026-07-01T06:00:00.000Z");
    expect(row.milestones.map((item) => item.key)).toEqual([
      "submitted",
      "sample-sent",
      "qc-received",
      "assigned",
      "first-result",
      "qc-completed",
    ]);
    expect(row.segments.map((item) => item.key)).toEqual([
      "intake",
      "receive-assign",
      "testing",
      "final",
    ]);
  });

  it("includes lab milestones only when the petition has a lab track", () => {
    const row = buildPetitionTimelineRow(
      petition({
        items: [{ seq: 1, sampleName: "Lab Sample", batchNo: "LAB-016" }],
        labReceivedAt: "2026-07-01T03:30:00.000Z",
        labCompletedAt: "2026-07-02T03:30:00.000Z",
        labApprovedAt: "2026-07-02T07:30:00.000Z",
      }),
      new Date("2026-07-03T00:00:00.000Z"),
    );

    expect(row.hasLabTrack).toBe(true);
    expect(row.milestones.map((item) => item.key)).toContain("lab-received");
    expect(row.milestones.map((item) => item.key)).toContain("lab-approved");
    expect(row.segments.map((item) => item.key)).toContain("lab-approval");
  });

  it("keeps rows with only a submitted date readable", () => {
    const row = buildPetitionTimelineRow(
      petition({ status: "deliveringQC", updatedAt: "2026-07-01T01:30:00.000Z" }),
      new Date("2026-07-01T12:00:00.000Z"),
    );

    expect(row.startAt).toBe("2026-07-01T01:00:00.000Z");
    expect(row.segments.length).toBeGreaterThanOrEqual(1);
    expect(row.milestones[0]).toMatchObject({ key: "submitted", done: true });
  });

  it("marks final result rows as closed", () => {
    const row = buildPetitionTimelineRow(
      petition({
        status: "approved",
        completedAt: "2026-07-02T01:00:00.000Z",
        approvedAt: "2026-07-02T04:00:00.000Z",
      }),
      new Date("2026-07-03T00:00:00.000Z"),
    );

    expect(row.isClosed).toBe(true);
    expect(row.milestones.at(-1)).toMatchObject({ key: "final-result", done: true });
  });
});

describe("timeline scale helpers", () => {
  it("pads a single-date window so percentages are usable", () => {
    const row = buildPetitionTimelineRow(petition(), new Date("2026-07-01T12:00:00.000Z"));
    const window = buildTimelineWindow([row], new Date("2026-07-01T12:00:00.000Z"));

    expect(new Date(window.endAt).getTime()).toBeGreaterThan(new Date(window.startAt).getTime());
    expect(timelinePercent(row.startAt, window)).not.toBeNull();
  });

  it("creates readable ticks for the computed window", () => {
    const row = buildPetitionTimelineRow(
      petition({ approvedAt: "2026-07-10T00:00:00.000Z", status: "approved" }),
      new Date("2026-07-10T12:00:00.000Z"),
    );
    const ticks = buildTimelineTicks(buildTimelineWindow([row], new Date("2026-07-10T12:00:00.000Z")));

    expect(ticks.length).toBeGreaterThan(1);
    expect(ticks.some((tick) => tick.major)).toBe(true);
  });

  it("summarizes visible petition rows", () => {
    const rows = [
      buildPetitionTimelineRow(petition({ status: "inProgress" }), new Date("2026-07-04T00:00:00.000Z")),
      buildPetitionTimelineRow(petition({ _id: "p2", status: "approved", approvedAt: "2026-07-02T00:00:00.000Z" }), new Date("2026-07-04T00:00:00.000Z")),
    ];

    expect(buildTimelineSummary(rows, new Date("2026-07-04T00:00:00.000Z"))).toMatchObject({
      total: 2,
      inProgress: 1,
      closed: 1,
    });
  });
});
