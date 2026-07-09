import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ParameterItem } from "@/lib/api";
import { ParameterCriteriaTabs } from "./ParameterCriteriaTabs";

const parameters: ParameterItem[] = [
  {
    _id: "p1",
    name: "Parameter A",
    scope: "qc",
    valueFields: [
      {
        label: "Active",
        type: "number",
        substanceMode: true,
        substanceStandards: [{ substance: "ABAMECTIN", operator: "gte", value: 95 }],
      },
      {
        label: "%AI",
        type: "number",
        labelToleranceMode: true,
        labelToleranceStandards: [{ substance: "ABAMECTIN", labelPercent: 1, autoPct: 25, headPct: 15 }],
      },
    ],
  },
];

describe("ParameterCriteriaTabs", () => {
  it("renders the existing list content in the list tab", () => {
    render(
      <ParameterCriteriaTabs
        value="list"
        onValueChange={() => undefined}
        parameters={parameters}
        scope="qc"
        onEditField={() => undefined}
      >
        <div>original parameter list</div>
      </ParameterCriteriaTabs>,
    );

    expect(screen.getByText("original parameter list")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "ทั้งหมด" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "แยกตามสาร" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "เงื่อนไขพิเศษ" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "ตาม %สาร" })).toBeInTheDocument();
  });

  it("renders substance table rows and calls edit callback", () => {
    const onEditField = vi.fn();
    render(
      <ParameterCriteriaTabs
        value="substance"
        onValueChange={() => undefined}
        parameters={parameters}
        scope="qc"
        onEditField={onEditField}
      >
        <div>original parameter list</div>
      </ParameterCriteriaTabs>,
    );

    expect(screen.getByText("ABAMECTIN")).toBeInTheDocument();
    const editButton = within(screen.getByRole("table")).getByRole("button");
    fireEvent.click(editButton);
    expect(onEditField).toHaveBeenCalledWith("substance", "p1", 0);
  });

  it("renders label tolerance headers, row shape, and calls edit callback", () => {
    const onEditField = vi.fn();
    render(
      <ParameterCriteriaTabs
        value="labelTolerance"
        onValueChange={() => undefined}
        parameters={parameters}
        scope="qc"
        onEditField={onEditField}
      >
        <div>original parameter list</div>
      </ParameterCriteriaTabs>,
    );

    const table = screen.getByRole("table");
    const columnHeaders = within(table).getAllByRole("columnheader");
    expect(columnHeaders).toHaveLength(6);
    expect(within(table).getByRole("columnheader", { name: "% ยา" })).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: "เกณฑ์คลาดเคลื่อน%" }),
    ).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "ค่าต่ำสุด" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "25% ล่าง" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "25% บน" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "ค่าสูงสุด" })).toBeInTheDocument();

    const rows = within(table).getAllByRole("row");
    const bodyCells = within(rows[1]).getAllByRole("cell");
    expect(bodyCells).toHaveLength(6);

    const editButton = within(screen.getByRole("table")).getByRole("button");
    fireEvent.click(editButton);
    expect(onEditField).toHaveBeenCalledWith("labelTolerance", "p1", 1);
  });

  it("renders an empty state for a tab with no rows", () => {
    render(
      <ParameterCriteriaTabs
        value="conditional"
        onValueChange={() => undefined}
        parameters={parameters}
        scope="qc"
        onEditField={() => undefined}
      >
        <div>original parameter list</div>
      </ParameterCriteriaTabs>,
    );

    expect(screen.getByText("ไม่มีรายการเกณฑ์ในแท็บนี้")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
