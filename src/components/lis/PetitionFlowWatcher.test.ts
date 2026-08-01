import { describe, it, expect } from "vitest";
import { effectiveSeeAll, nextCursor } from "./PetitionFlowWatcher";

describe("effectiveSeeAll", () => {
  // Finding 2: the "ดูทั้งระบบ" switch only renders for admins (NotificationBell), but its
  // localStorage flag is global and never cleared. The watcher must gate it independently
  // or a user who was ever admin on this browser (DevRoleSwitcher, or a past role change)
  // keeps seeing every department's notifications with no visible way to turn it off.
  it("admin with the switch on → true", () => {
    expect(effectiveSeeAll({ roles: ["admin"] }, true)).toBe(true);
  });

  it("admin with the switch off → false", () => {
    expect(effectiveSeeAll({ roles: ["admin"] }, false)).toBe(false);
  });

  it("non-admin with a leftover switch-on flag → false (the bug this fixes)", () => {
    expect(effectiveSeeAll({ roles: ["qc-staff"] }, true)).toBe(false);
  });

  it("non-admin with the switch off → false", () => {
    expect(effectiveSeeAll({ roles: ["qc-staff"] }, false)).toBe(false);
  });

  it("legacy single-role admin (no roles[]) with the switch on → true", () => {
    expect(effectiveSeeAll({ role: "admin" }, true)).toBe(true);
  });

  it("no user → false even with the switch on", () => {
    expect(effectiveSeeAll(null, true)).toBe(false);
  });
});

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
