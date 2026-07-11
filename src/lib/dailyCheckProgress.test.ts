import { describe, expect, it } from "vitest";
import {
  DAILY_CHECK_EXPECTED_TOTALS,
  dailyCheckProgressFromSources,
} from "./dailyCheckProgress";

describe("dailyCheckProgressFromSources", () => {
  it("uses the registered Daily Check totals", () => {
    expect(DAILY_CHECK_EXPECTED_TOTALS).toEqual({
      scales: 5,
      environment: 3,
      equipment: 30,
    });
  });

  it("counts done and pending items across scale, environment, and equipment checks", () => {
    const progress = dailyCheckProgressFromSources({
      scaleIds: ["scale-1", "scale-1", "scale-2"],
      environmentRooms: ["balance"],
      equipmentRecords: [
        { roomSlug: "sample-prep", instrumentId: "LD-007" },
        { roomSlug: "sample-prep", instrumentId: "LD-007" },
        { roomSlug: "analysis", instrumentId: "LD-003" },
      ],
    });

    expect(progress).toEqual({
      total: 38,
      done: 5,
      pending: 33,
    });
  });

  it("falls back to counts and clamps impossible values", () => {
    const progress = dailyCheckProgressFromSources(
      {
        scaleCount: 10,
        environmentCount: 10,
        equipmentRecords: [
          { roomSlug: "analysis", instrumentId: "LD-001" },
          { roomSlug: "analysis", instrumentId: "LD-002" },
          { roomSlug: "analysis", instrumentId: "LD-003" },
        ],
      },
      { scales: 2, environment: 1, equipment: 2 },
    );

    expect(progress).toEqual({
      total: 5,
      done: 5,
      pending: 0,
    });
  });
});
