import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import WorkflowSummary from "./WorkflowSummary";

const NOW = new Date("2026-07-13T09:00:00").getTime(); // Monday

describe("WorkflowSummary title", () => {
  it("names the weekday bar as weekly work", () => {
    render(<WorkflowSummary kind="assignedWeekdayBar" petitions={[]} now={NOW} weekdayBasis="qcSampleSent" />);
    expect(screen.getByText("งานรายสัปดาห์")).toBeInTheDocument();
  });
  it("keeps the workflow title for the status donut", () => {
    render(<WorkflowSummary kind="statusDonut" petitions={[]} now={NOW} />);
    expect(screen.getByText("สรุป Workflow")).toBeInTheDocument();
  });
  it("keeps the workflow title for the pipeline", () => {
    render(<WorkflowSummary kind="pipeline" petitions={[]} now={NOW} />);
    expect(screen.getByText("สรุป Workflow")).toBeInTheDocument();
  });
});
