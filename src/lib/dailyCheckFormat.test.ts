import { describe, it, expect } from "vitest";
import {
  fmtDate,
  roomFilterLabel,
  statusFilterLabel,
  dateFilterLabel,
} from "./dailyCheckFormat";

describe("dailyCheckFormat", () => {
  it("fmtDate: YYYY-MM-DD → DD/MM/YYYY", () => {
    expect(fmtDate("2026-07-02")).toBe("02/07/2026");
  });
  it("fmtDate: empty → em dash", () => {
    expect(fmtDate("")).toBe("—");
  });
  it("roomFilterLabel: all → ทุกห้อง", () => {
    expect(roomFilterLabel("all")).toBe("ทุกห้อง");
  });
  it("statusFilterLabel maps all/normal/abnormal", () => {
    expect(statusFilterLabel("all")).toBe("ทั้งหมด");
    expect(statusFilterLabel("normal")).toBe("ปกติ");
    expect(statusFilterLabel("abnormal")).toBe("ผิดปกติ");
  });
  it("dateFilterLabel: empty → ทุกวัน, else formatted", () => {
    expect(dateFilterLabel("")).toBe("ทุกวัน");
    expect(dateFilterLabel("2026-07-02")).toBe("02/07/2026");
  });
});
