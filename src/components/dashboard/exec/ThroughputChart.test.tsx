import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ThroughputChart from "./ThroughputChart";

// ThroughputChart nests recharts' <ResponsiveContainer> inside <ChartContainer>
// (which already provides one) — a pre-existing quirk unrelated to this fix that
// makes recharts log a benign dev-mode size warning in jsdom. Silence console.warn
// here so the assertions below aren't drowned out by that unrelated noise.
beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
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
  });
});
