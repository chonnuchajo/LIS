import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ParameterItem } from "@/lib/api";
import { ParameterCriteriaTabs } from "./ParameterCriteriaTabs";

const parameters: ParameterItem[] = [
  {
    _id: "p1",
    name: "พารามิเตอร์ตัวอย่าง",
    scope: "qc",
    valueFields: [
      {
        label: "ค่าความบริสุทธิ์",
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
    expect(screen.getByRole("tab", { name: "เกณฑ์ %ยา" })).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: "แก้ไขเกณฑ์สาร ค่าความบริสุทธิ์" }));
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

    const expectedHeaders = ["% ยา", "เกณฑ์คลาดเคลื่อน%", "ค่าต่ำสุด", "25% ล่าง", "25% บน", "ค่าสูงสุด"];
    const table = screen.getByRole("table");
    for (const header of expectedHeaders) {
      expect(within(table).getByRole("columnheader", { name: header })).toBeInTheDocument();
    }

    const rows = within(table).getAllByRole("row");
    const bodyCells = within(rows[1]).getAllByRole("cell");
    expect(bodyCells).toHaveLength(6);

    fireEvent.click(screen.getByRole("button", { name: "แก้ไขเกณฑ์ %ยา %AI" }));
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
  });
});
