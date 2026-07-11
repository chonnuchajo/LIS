import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ConfigCoveragePies from "./ConfigCoveragePies";

const chartBounds = {
  bottom: 220,
  height: 220,
  left: 0,
  right: 640,
  top: 0,
  width: 640,
  x: 0,
  y: 0,
  toJSON: () => ({}),
} as DOMRect;

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(chartBounds);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ConfigCoveragePies", () => {
  it("renders both pie cards and legend counts", () => {
    render(
      <ConfigCoveragePies
        simpleMethodData={[
          { key: "gc", label: "GC", value: 2, color: "hsl(217,91%,55%)" },
          { key: "both", label: "GC + HPLC", value: 1, color: "hsl(262,83%,58%)" },
        ]}
        standardTimeData={[
          { key: "instrument-GC7890A", label: "GC7890A", value: 3, color: "hsl(217,91%,55%)" },
          { key: "unassigned", label: "ยังไม่กำหนด", value: 2, color: "hsl(38,92%,50%)" },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Simple Method" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Standard Time" })).toBeInTheDocument();
    expect(screen.getByText("GC + HPLC")).toBeInTheDocument();
    expect(screen.getByText("GC7890A")).toBeInTheDocument();
    expect(screen.getAllByText("2 รายการ")).toHaveLength(2);
  });

  it("renders loading and empty states", () => {
    const { rerender } = render(
      <ConfigCoveragePies simpleMethodData={[]} standardTimeData={[]} loading />,
    );
    expect(screen.getAllByText("กำลังโหลด...")).toHaveLength(2);

    rerender(<ConfigCoveragePies simpleMethodData={[]} standardTimeData={[]} />);
    expect(screen.getAllByText("ไม่มีข้อมูล")).toHaveLength(2);
  });
});
