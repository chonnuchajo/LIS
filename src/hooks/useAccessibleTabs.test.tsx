import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAccessibleTabs } from "./useAccessibleTabs";

// canAccess(path): true for everything except the restricted dashboard tab.
vi.mock("./useCanAccessPath", () => ({
  useCanAccessPath: () => (path: string) => path !== "/settings/dashboard",
}));

describe("useAccessibleTabs", () => {
  const keys = ["environment", "printers", "dashboard"];

  it("hides a restricted tab the user cannot access", () => {
    const { result } = renderHook(() => useAccessibleTabs("/settings", keys));
    expect(result.current.isVisible("dashboard")).toBe(false);
    expect(result.current.isVisible("environment")).toBe(true);
    expect(result.current.visibleKeys).toEqual(["environment", "printers"]);
  });

  it("keeps unregistered tabs visible regardless of canAccess", () => {
    const { result } = renderHook(() => useAccessibleTabs("/settings", ["printers"]));
    // "printers" is not in RESTRICTED_TABS, so it is always visible.
    expect(result.current.isVisible("printers")).toBe(true);
  });

  it("defaultKey is the first visible key", () => {
    const { result } = renderHook(() => useAccessibleTabs("/settings", keys));
    expect(result.current.defaultKey).toBe("environment");
  });
});
