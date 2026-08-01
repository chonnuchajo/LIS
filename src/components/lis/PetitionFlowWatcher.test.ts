import { describe, it, expect } from "vitest";
import { nextCursor } from "./PetitionFlowWatcher";

describe("nextCursor", () => {
  it("no stored cursor (null) → takes the server time", () => {
    expect(nextCursor(null, "2026-08-01T10:00:00.000Z")).toBe("2026-08-01T10:00:00.000Z");
  });

  it("no stored cursor (undefined) → takes the server time", () => {
    expect(nextCursor(undefined, "2026-08-01T10:00:00.000Z")).toBe("2026-08-01T10:00:00.000Z");
  });

  it("no stored cursor (empty string) → takes the server time", () => {
    expect(nextCursor("", "2026-08-01T10:00:00.000Z")).toBe("2026-08-01T10:00:00.000Z");
  });

  it("stored older than server time → advances to server time", () => {
    const stored = "2026-08-01T09:00:00.000Z";
    const serverTime = "2026-08-01T10:00:00.000Z";
    expect(nextCursor(stored, serverTime)).toBe(serverTime);
  });

  it("stored newer than server time → keeps the stored value (regression guard)", () => {
    // This is the see-all toggle race: a stale poll response can arrive with an
    // older serverTime after a newer cursor has already been persisted. The
    // cursor must never move backwards, or dismissed notifications resurrect.
    const stored = "2026-08-01T12:00:00.000Z";
    const serverTime = "2026-08-01T10:00:00.000Z";
    expect(nextCursor(stored, serverTime)).toBe(stored);
  });

  it("stored equal to server time → keeps the stored value", () => {
    const same = "2026-08-01T10:00:00.000Z";
    expect(nextCursor(same, same)).toBe(same);
  });

  it("stored unparseable garbage → takes the server time", () => {
    const serverTime = "2026-08-01T10:00:00.000Z";
    expect(nextCursor("not-a-real-date", serverTime)).toBe(serverTime);
  });
});
