import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ThroughputChart from "./ThroughputChart";

// jsdom has no real layout engine, so getBoundingClientRect() defaults to all
// zeros — recharts' ResponsiveContainer would then warn that it measured a
// 0x0 container. Give it real numbers, matching ConfigCoveragePies.test.tsx.
const chartBounds = {
  bottom: 240,
  height: 240,
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

describe("ThroughputChart", () => {
  it("says so plainly when every day is empty", () => {
    render(
      <ThroughputChart
        rows={[
          { date: "2026-07-06", created: 0, completed: 0 },
          { date: "2026-07-07", created: 0, completed: 0 },
          { date: "2026-07-08", created: 0, completed: 0 },
        ]}
      />
    );
    expect(screen.getByText("ไม่มีข้อมูลในช่วงนี้")).toBeInTheDocument();
    expect(document.querySelector(".recharts-responsive-container")).not.toBeInTheDocument();
  });

  it("renders the chart when at least one day has activity", () => {
    render(
      <ThroughputChart
        rows={[
          { date: "2026-07-06", created: 0, completed: 0 },
          { date: "2026-07-07", created: 3, completed: 1 },
          { date: "2026-07-08", created: 0, completed: 0 },
        ]}
      />
    );
    expect(screen.queryByText("ไม่มีข้อมูลในช่วงนี้")).not.toBeInTheDocument();
    expect(document.querySelector(".recharts-responsive-container")).toBeInTheDocument();
    // A multi-day series draws real line segments, so the dots are noise — off.
    expect(document.querySelectorAll(".recharts-line-dot")).toHaveLength(0);
  });

  it("shows dots on a single-day range, where a line has nothing to connect", () => {
    // The 1-day range leaves one point per series. A <Line> through one point draws
    // no visible stroke, so without dots the chart renders blank — the day's numbers
    // would silently disappear.
    render(<ThroughputChart rows={[{ date: "2026-07-08", created: 3, completed: 1 }]} />);
    expect(document.querySelectorAll(".recharts-line-dot").length).toBeGreaterThan(0);
  });
});
