import { describe, it, expect, beforeEach, vi } from "vitest";
import { getStoredActiveRole, setActiveRole, subscribeActiveRole } from "./activeRole";

beforeEach(() => localStorage.clear());

describe("activeRole store", () => {
  it("persists to localStorage and reads back", () => {
    expect(getStoredActiveRole()).toBeNull();
    setActiveRole("qc");
    expect(getStoredActiveRole()).toBe("qc");
    expect(localStorage.getItem("lis.activeRole")).toBe("qc");
  });
  it("notifies subscribers on change", () => {
    const cb = vi.fn();
    const unsub = subscribeActiveRole(cb);
    setActiveRole("lab");
    expect(cb).toHaveBeenCalledTimes(1);
    unsub();
    setActiveRole("admin");
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
