import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import type { MetricsCtx } from "@/lib/dashboardMetrics";
import AnalyticsSection from "./AnalyticsSection";

describe("AnalyticsSection", () => {
  it("shows the empty state for an all-zero weekday chart", () => {
    const { container } = render(
      <AnalyticsSection
        specs={[{ kind: "assignedWeekdayBar", title: "Weekly workload" }]}
        ctx={{ petitions: [], now: new Date(2026, 6, 13).getTime() } as MetricsCtx}
      />,
    );

    expect(container.querySelector(".recharts-responsive-container")).not.toBeInTheDocument();
  });
});
