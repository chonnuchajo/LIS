import { describe, it, expect } from "vitest";
import { ENV_ROOMS, evaluateEnv, getEnvRoom, isReadingStale, STALE_AFTER_MS } from "./dailyCheckEnv";

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
