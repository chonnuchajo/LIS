import { describe, it, expect } from "vitest";
import { ENV_ROOMS, evaluateEnv, getEnvRoom } from "./dailyCheckEnv";

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
