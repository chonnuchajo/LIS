import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { buildSimpleMethodRows, ExclusionManager, matchesExclusion } from "@/pages/MasterItems";
import { buildOverrideMap } from "@/lib/commonNameOverride";

const apiMock = vi.hoisted(() => ({
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: apiMock }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildSimpleMethodRows with common-name overrides", () => {
  it("merges malformed + well-formed variants into one canonical row", () => {
    const items = [
      { item_no: "A1", common_name: "DIURON + HEXAZINONE 46.8% + 13.2% WG" },
      { item_no: "A2", common_name: "DIURON 46.8%+HEXAZINONE 13.2% WG" },
    ];
    const cnMap = buildOverrideMap([
      { raw: "DIURON + HEXAZINONE 46.8% + 13.2% WG", canonical: "DIURON 13.2% + HEXAZINONE 46.8% WG" },
      { raw: "DIURON 46.8%+HEXAZINONE 13.2% WG", canonical: "DIURON 13.2% + HEXAZINONE 46.8% WG" },
    ]);
    const rows = buildSimpleMethodRows(items, {}, cnMap);
    expect(rows).toHaveLength(1);
    expect(rows[0].commonName).toBe("DIURON 13.2% + HEXAZINONE 46.8% WG");
    expect(rows[0].substances).toEqual(["DIURON 13.2%", "HEXAZINONE 46.8% WG"]);
    expect([...rows[0].itemNos].sort()).toEqual(["A1", "A2"]);
    expect([...rows[0].rawCommonNames].sort()).toEqual([
      "DIURON + HEXAZINONE 46.8% + 13.2% WG",
      "DIURON 46.8%+HEXAZINONE 13.2% WG",
    ]);
  });

  it("leaves unmapped names unchanged", () => {
    const items = [{ item_no: "B1", common_name: "GLYPHOSATE 48% SL" }];
    const rows = buildSimpleMethodRows(items, {}, new Map());
    expect(rows[0].commonName).toBe("GLYPHOSATE 48% SL");
    expect(rows[0].rawCommonNames).toEqual(["GLYPHOSATE 48% SL"]);
  });
});

describe("matchesExclusion", () => {
  it("matches exact rules only when the whole common name is equal", () => {
    const rule = { _id: "exact-seaweed", pattern: "SEAWEED", matchType: "exact" as const };

    expect(matchesExclusion("SEAWEED", rule)).toBe(true);
    expect(matchesExclusion("SEAWEED EXTRACT", rule)).toBe(false);
  });
});

describe("ExclusionManager", () => {
  it("updates an existing exclusion instead of adding a new rule", async () => {
    apiMock.put.mockResolvedValue({ data: { _id: "rule1", pattern: "SEAWEED EXTRACT", matchType: "exact" } });
    const onChanged = vi.fn();

    render(createElement(ExclusionManager, {
      exclusions: [{ _id: "rule1", pattern: "SEAWEED", matchType: "exact" }],
      onChanged,
    }));

    fireEvent.click(screen.getByRole("button", { name: /สารที่ไม่ตรวจ/ }));
    fireEvent.click(screen.getByLabelText("แก้ไข SEAWEED"));
    fireEvent.change(screen.getByDisplayValue("SEAWEED"), { target: { value: "SEAWEED EXTRACT" } });
    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));

    await waitFor(() => expect(apiMock.put).toHaveBeenCalledWith("/simple-method-exclusions/rule1", {
      pattern: "SEAWEED EXTRACT",
      matchType: "exact",
    }));
    expect(apiMock.post).not.toHaveBeenCalled();
    expect(onChanged).toHaveBeenCalled();
  });
});
