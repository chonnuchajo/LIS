import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import ActionQueue from "./ActionQueue";
import type { ExecWorkUnit } from "@/lib/execSummary";

const unit = (over: Partial<ExecWorkUnit>): ExecWorkUnit => ({
  petitionId: "id", petitionNo: "P-1", dept: "fg", priority: 0, track: "lab",
  stage: "labTesting", stageLabel: "Lab กำลังทดสอบ", assigneeName: "สมชาย",
  elapsedMin: 300, baselineMin: 180, overdueMin: 120, state: "overdue", ...over,
});

describe("ActionQueue", () => {
  it("uses the executive queue column labels requested for the dashboard", () => {
    render(<MemoryRouter><ActionQueue units={[unit({})]} /></MemoryRouter>);
    expect(screen.queryByRole("columnheader", { name: "แผนก" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "สถานะ" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "เวลา" })).toBeInTheDocument();
  });

  it("renders the overdue amount in Thai duration form", () => {
    render(<MemoryRouter><ActionQueue units={[unit({})]} /></MemoryRouter>);
    expect(screen.getByText("เกิน 2 ชม.")).toBeInTheDocument();
  });

  it("explains why work with no baseline is listed instead of showing an overdue figure", () => {
    render(<MemoryRouter><ActionQueue units={[unit({
      petitionNo: "P-2", state: "unassigned", stage: "pendingAssign", stageLabel: "รอ assign",
      baselineMin: null, overdueMin: null, assigneeName: "", elapsedMin: 1860,
    })]} /></MemoryRouter>);
    expect(screen.getByText("ยังไม่ assign 1 วัน 7 ชม.")).toBeInTheDocument();
  });

  it("links each row to the petition list highlighting that petition", () => {
    render(<MemoryRouter><ActionQueue units={[unit({ petitionId: "x1" })]} /></MemoryRouter>);
    const row = screen.getByText("P-1").closest("tr")!;
    expect(within(row).getByRole("link")).toHaveAttribute("href", "/petition?highlight=x1");
  });

  it("navigates from a click anywhere on the row, not just the petition number", () => {
    function LocationProbe() {
      const location = useLocation();
      return <output data-testid="location">{location.pathname + location.search}</output>;
    }
    render(
      <MemoryRouter>
        <ActionQueue units={[unit({ petitionId: "x1", stageLabel: "Lab กำลังทดสอบ" })]} />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText("Lab กำลังทดสอบ"));

    expect(screen.getByTestId("location")).toHaveTextContent("/petition?highlight=x1");
  });

  it("drops the redundant view button now that the whole row is the link", () => {
    render(<MemoryRouter><ActionQueue units={[unit({})]} /></MemoryRouter>);
    expect(screen.queryByRole("button", { name: "ดู" })).not.toBeInTheDocument();
  });

  it("shows an empty state when nothing needs attention", () => {
    render(<MemoryRouter><ActionQueue units={[]} /></MemoryRouter>);
    expect(screen.getByText("ไม่มีงานค้างที่ต้องจัดการ")).toBeInTheDocument();
  });
});
