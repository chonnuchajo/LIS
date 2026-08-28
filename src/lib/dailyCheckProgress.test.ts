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
      total: 76,
      done: 5,
      pending: 71,
    });
  });

  it("requires morning and afternoon checks for each Daily Check item", () => {
    const progress = dailyCheckProgressFromSources(
      {
        scaleRecords: [
          { scaleId: "scale-1", checkedAt: "2026-08-28T08:30:00" },
          { scaleId: "scale-1", checkedAt: "2026-08-28T13:30:00" },
          { scaleId: "scale-1", checkedAt: "2026-08-28T14:30:00" },
        ],
        environmentRecords: [
          { room: "balance", checkedAt: "2026-08-28T11:59:00" },
          { room: "balance", checkedAt: "2026-08-28T17:00:00" },
        ],
        equipmentRecords: [
          { roomSlug: "analysis", instrumentId: "LD-001", checkedAt: "2026-08-28T09:00:00" },
          { roomSlug: "analysis", instrumentId: "LD-001", checkedAt: "2026-08-28T16:00:00" },
          { roomSlug: "analysis", instrumentId: "LD-001", checkedAt: "2026-08-28T16:30:00" },
        ],
      },
      { scales: 1, environment: 1, equipment: 1 },
    );

    expect(progress).toEqual({
      total: 6,
      done: 6,
      pending: 0,
    });
  });

  it("ignores Daily Check records outside the two allowed periods", () => {
    const progress = dailyCheckProgressFromSources(
      {
        scaleRecords: [
          { scaleId: "scale-1", checkedAt: "2026-08-28T07:59:00" },
          { scaleId: "scale-1", checkedAt: "2026-08-28T12:30:00" },
          { scaleId: "scale-1", checkedAt: "2026-08-28T17:30:00" },
          { scaleId: "scale-1", checkedAt: "2026-08-28T08:00:00" },
        ],
        environmentRecords: [
          { room: "balance", checkedAt: "2026-08-28T13:00:00" },
        ],
        equipmentRecords: [
          { roomSlug: "analysis", instrumentId: "LD-001", checkedAt: "2026-08-28T18:00:00" },
        ],
      },
      { scales: 1, environment: 1, equipment: 1 },
    );

    expect(progress).toEqual({
      total: 6,
      done: 2,
      pending: 4,
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
      total: 10,
      done: 8,
      pending: 2,
    });
  });
});
