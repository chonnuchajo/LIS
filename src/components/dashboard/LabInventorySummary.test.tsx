import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import LabInventorySummaryCard from "./LabInventorySummary";
import type { LabInventorySummary } from "@/lib/dashboardMetrics";

vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");

  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) =>
      React.cloneElement(children, { width: 260, height: 220 }),
  };
});

function summary(over: Partial<LabInventorySummary> = {}): LabInventorySummary {
  const base = {
    nearEmpty: 2,
    outOfStock: 3,
    nearExpiry: 1,
    todayDeductions: 4,
  };
  const counts = { ...base, ...over };
  return {
    ...counts,
    rows: [
      { key: "nearEmpty", label: "ใกล้หมด", value: counts.nearEmpty, color: "hsl(38,92%,50%)" },
      { key: "outOfStock", label: "หมดสต็อก", value: counts.outOfStock, color: "hsl(0,72%,51%)" },
      { key: "nearExpiry", label: "ใกล้หมดอายุ", value: counts.nearExpiry, color: "hsl(262,83%,58%)" },
      { key: "todayDeductions", label: "เบิกวันนี้", value: counts.todayDeductions, color: "hsl(217,91%,55%)" },
    ],
  };
}

describe("LabInventorySummaryCard", () => {
  it("renders the donut summary labels and visible counts", () => {
    render(<LabInventorySummaryCard summary={summary()} />);

    expect(screen.getByRole("heading", { name: "สรุป Lab Inventory" })).toBeInTheDocument();
    expect(screen.getByText("ใกล้หมด")).toBeInTheDocument();
    expect(screen.getByText("หมดสต็อก")).toBeInTheDocument();
    expect(screen.getByText("ใกล้หมดอายุ")).toBeInTheDocument();
    expect(screen.getByText("เบิกวันนี้")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("รายการทั้งหมด")).toBeInTheDocument();
    expect(screen.getByText("2 รายการ")).toBeInTheDocument();
    expect(screen.getByText("3 รายการ")).toBeInTheDocument();
    expect(screen.getByText("1 รายการ")).toBeInTheDocument();
    expect(screen.getByText("4 รายการ")).toBeInTheDocument();
  });

  it("renders loading and empty states", () => {
    const empty = summary({ nearEmpty: 0, outOfStock: 0, nearExpiry: 0, todayDeductions: 0 });
    const { rerender } = render(<LabInventorySummaryCard summary={empty} loading />);

    expect(screen.getByText("กำลังโหลด...")).toBeInTheDocument();

    rerender(<LabInventorySummaryCard summary={empty} />);
    expect(screen.getByText("ไม่มีรายการแจ้งเตือน")).toBeInTheDocument();
  });
});
