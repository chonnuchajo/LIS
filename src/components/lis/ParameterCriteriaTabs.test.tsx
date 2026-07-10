import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ParameterItem } from "@/lib/api";
import { productTypeLabels } from "@/lib/productClassification";
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
        substanceStandards: [
          {
            substance: "ABAMECTIN",
            operator: "gte",
            value: 95,
            productTypes: ["water"],
            categories: ["RM"],
          } as any,
        ],
      },
      {
        label: "%AI",
        type: "number",
        labelToleranceMode: true,
        labelToleranceStandards: [{ substance: "ABAMECTIN", labelPercent: 1, autoPct: 25, headPct: 15 }],
      },
    ],
  },
  {
    _id: "p2",
    name: "Parameter B",
    scope: "qc",
    valueFields: [
      {
        label: "%AI B",
        type: "number",
        labelToleranceMode: true,
        labelToleranceStandards: [{ substance: "GLYPHOSATE", labelPercent: 5, autoPct: 20, headPct: 10 }],
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
    expect(screen.getByText(productTypeLabels.water)).toBeInTheDocument();
    expect(screen.getByText("RM")).toBeInTheDocument();
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
    expect(columnHeaders.map((header) => header.textContent)).toEqual([
      "Parameter",
      "% ยา",
      "เกณฑ์คลาดเคลื่อน%",
      "ค่าต่ำสุด",
      "25% ล่าง",
      "25% บน",
      "ค่าสูงสุด",
    ]);
    expect(within(table).getByRole("columnheader", { name: "Parameter" })).toBeInTheDocument();
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
    expect(bodyCells).toHaveLength(7);
    expect(within(bodyCells[0]).getByText("Parameter A / %AI")).toBeInTheDocument();
    expect(within(bodyCells[0]).getByText("ABAMECTIN / 1%")).toBeInTheDocument();
    expect(within(bodyCells[1]).getByText("1")).toBeInTheDocument();

    const editButton = within(screen.getByRole("table")).getAllByRole("button")[0];
    fireEvent.click(editButton);
    expect(onEditField).toHaveBeenCalledWith("labelTolerance", "p1", 1);
  });

  it("filters by parameter and sorts label tolerance rows by drug percent", () => {
    render(
      <ParameterCriteriaTabs
        value="labelTolerance"
        onValueChange={() => undefined}
        parameters={parameters}
        scope="qc"
        onEditField={() => undefined}
      >
        <div>original parameter list</div>
      </ParameterCriteriaTabs>,
    );

    fireEvent.change(screen.getByLabelText("เลือก Parameter"), { target: { value: "p2" } });

    expect(screen.queryByText("Parameter A / %AI")).not.toBeInTheDocument();
    expect(screen.getByText("Parameter B / %AI B")).toBeInTheDocument();
    expect(screen.getByText("GLYPHOSATE / 5%")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("เลือก Parameter"), { target: { value: "__all__" } });
    fireEvent.change(screen.getByLabelText("เรียงลำดับ"), { target: { value: "drugPercentDesc" } });

    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText("Parameter B / %AI B")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Parameter A / %AI")).toBeInTheDocument();
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
