import { describe, it, expect } from "vitest";
import { ENV_ROOMS, evaluateEnv, getEnvRoom, isReadingStale, STALE_AFTER_MS, validateEnvRoomConfig, mergeEnvRooms, type EnvRoomConfig } from "./dailyCheckEnv";

const room = ENV_ROOMS[0]; // tempMin 15, tempMax 25, humidityMax 70

describe("evaluateEnv", () => {
  it("passes when temp within range and humidity at/under max", () => {
    expect(evaluateEnv(22, 55, room)).toEqual({
      tempStatus: "pass",
      humidityStatus: "pass",
      status: "pass",
    });
  });

  it("treats range bounds as inclusive", () => {
    expect(evaluateEnv(15, 70, room).status).toBe("pass");
    expect(evaluateEnv(25, 70, room).status).toBe("pass");
  });

  it("fails temperature below min", () => {
    const r = evaluateEnv(14.9, 50, room);
    expect(r.tempStatus).toBe("fail");
    expect(r.status).toBe("fail");
  });

  it("fails temperature above max", () => {
    const r = evaluateEnv(25.1, 50, room);
    expect(r.tempStatus).toBe("fail");
    expect(r.status).toBe("fail");
  });

  it("fails humidity above max", () => {
    const r = evaluateEnv(22, 70.1, room);
    expect(r.humidityStatus).toBe("fail");
    expect(r.status).toBe("fail");
  });
});

describe("getEnvRoom", () => {
  it("returns the room config by slug", () => {
    expect(getEnvRoom("analysis")?.label).toBe("ห้องวิเคราะห์");
  });
  it("returns undefined for unknown slug", () => {
    expect(getEnvRoom("nope")).toBeUndefined();
  });
});

describe("ENV_ROOMS", () => {
  it("covers exactly the 3 rooms with a temp/humidity form", () => {
    expect(ENV_ROOMS.map((r) => r.slug)).toEqual(["balance", "sample-prep", "analysis"]);
  });
});

describe("isReadingStale", () => {
  const now = new Date("2026-06-04T10:00:00Z").getTime();

  it("is fresh when received just now", () => {
    expect(isReadingStale(new Date(now).toISOString(), now)).toBe(false);
  });

  it("is fresh right at the threshold boundary", () => {
    const at = new Date(now - STALE_AFTER_MS).toISOString();
    expect(isReadingStale(at, now)).toBe(false);
  });

  it("is stale once older than the threshold", () => {
    const at = new Date(now - STALE_AFTER_MS - 1000).toISOString();
    expect(isReadingStale(at, now)).toBe(true);
  });

  it("treats missing/invalid timestamp as stale", () => {
    expect(isReadingStale(undefined, now)).toBe(true);
    expect(isReadingStale("", now)).toBe(true);
    expect(isReadingStale("not-a-date", now)).toBe(true);
  });
});

describe("validateEnvRoomConfig", () => {
  const good = { boardId: "b", tempMin: 15, tempMax: 25, humidityMax: 70 };

  it("returns null for a valid config", () => {
    expect(validateEnvRoomConfig(good)).toBeNull();
  });

  it("rejects non-numeric thresholds", () => {
    expect(validateEnvRoomConfig({ ...good, tempMin: NaN })?.field).toBe("tempMin");
    expect(validateEnvRoomConfig({ ...good, humidityMax: undefined as unknown as number })?.field).toBe("humidityMax");
  });

  it("rejects tempMin greater than tempMax", () => {
    expect(validateEnvRoomConfig({ ...good, tempMin: 30, tempMax: 25 })?.field).toBe("tempMin");
  });

  it("rejects humidityMax of zero or less", () => {
    expect(validateEnvRoomConfig({ ...good, humidityMax: 0 })?.field).toBe("humidityMax");
  });

  it("allows an empty boardId (manual entry)", () => {
    expect(validateEnvRoomConfig({ ...good, boardId: "" })).toBeNull();
  });
});

describe("mergeEnvRooms", () => {
  const configs: EnvRoomConfig[] = [
    { slug: "balance", boardId: "BAL-1", tempMin: 18, tempMax: 24, humidityMax: 60 },
  ];

  it("overlays DB values onto defaults, preserving label", () => {
    const merged = mergeEnvRooms(ENV_ROOMS, configs);
    const bal = merged.find((r) => r.slug === "balance")!;
    expect(bal.boardId).toBe("BAL-1");
    expect(bal.tempMin).toBe(18);
    expect(bal.humidityMax).toBe(60);
    expect(bal.label).toBe("ห้องชั่งสาร"); // label still from code default
  });

  it("falls back to the code default for rooms with no DB doc", () => {
    const merged = mergeEnvRooms(ENV_ROOMS, configs);
    const ana = merged.find((r) => r.slug === "analysis")!;
    expect(ana).toEqual(ENV_ROOMS.find((r) => r.slug === "analysis"));
  });

  it("returns one entry per default room in default order", () => {
    expect(mergeEnvRooms(ENV_ROOMS, []).map((r) => r.slug)).toEqual(
      ENV_ROOMS.map((r) => r.slug),
    );
  });
});
