import { describe, it, expect } from "vitest";
import { petitionStatusBadge, statusBadge, toneBadge } from "./statusBadge";
import type { Petition } from "@/types/petition.types";

describe("statusBadge", () => {
  it("returns label + variant for a known petition status", () => {
    const b = statusBadge("success");
    expect(b.label.length).toBeGreaterThan(0);
    expect(b.variant).toBe("green-soft");
  });

  it("falls back to a neutral gray badge for unknown status", () => {
    const b = statusBadge("totally-unknown-xyz");
    expect(b.label).toBe("totally-unknown-xyz");
    expect(b.variant).toBe("gray-soft");
  });

  it("uses the provided label override when given", () => {
    const b = statusBadge("success", "เสร็จแล้ว");
    expect(b.label).toBe("เสร็จแล้ว");
    expect(b.variant).toBe("green-soft");
  });
});

describe("toneBadge", () => {
  it("maps a semantic tone to a soft Badge variant", () => {
    expect(toneBadge("danger", "ผิดพลาด")).toEqual({ label: "ผิดพลาด", variant: "red-soft" });
    expect(toneBadge("info", "ข้อมูล").variant).toBe("blue-soft");
  });
});

describe("petitionStatusBadge", () => {
  it("shows QC completed instead of raw inProgress", () => {
    const b = petitionStatusBadge({ status: "inProgress", qcCompletedAt: "2026-07-02" } as Petition);
    expect(b.label).toBe("QC ตรวจครบ · รอส่วนอื่น");
    expect(b.variant).toBe("yellow-soft");
  });
});
