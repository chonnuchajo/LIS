import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
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

function renderCriteriaTabs(
  props: Partial<ComponentProps<typeof ParameterCriteriaTabs>> = {},
) {
  const onEditField = props.onEditField ?? vi.fn();
  render(
    <ParameterCriteriaTabs
      value={props.value ?? "labelTolerance"}
      onValueChange={props.onValueChange ?? (() => undefined)}
      parameters={props.parameters ?? parameters}
      scope={props.scope ?? "qc"}
      canViewHeadCriteriaColumns={props.canViewHeadCriteriaColumns}
      onEditField={onEditField}
    >
      <div>original parameter list</div>
    </ParameterCriteriaTabs>,
  );
  return { onEditField };
}

describe("ParameterCriteriaTabs", () => {
  it("renders the existing list content in the list tab", () => {
    renderCriteriaTabs({ value: "list" });

    expect(screen.getByText("original parameter list")).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(4);
  });

  it("renders substance table rows without field, type, category, condition, or head-only columns", () => {
    const { onEditField } = renderCriteriaTabs({ value: "substance" });

    const table = screen.getByRole("table");
    const headers = within(table).getAllByRole("columnheader").map((header) => header.textContent ?? "");
    expect(headers).toHaveLength(5);
    expect(headers).toContain("Parameter");
    expect(headers.some((text) => text.includes("Field"))).toBe(false);
    expect(headers.some((text) => text.includes("Type"))).toBe(false);
    expect(headers.some((text) => text.includes("หมวดหมู่"))).toBe(false);
    expect(headers.some((text) => text.includes("เงื่อนไข"))).toBe(false);
    expect(headers.some((text) => text.includes("เฉพาะหัวหน้าตรวจ"))).toBe(false);

    expect(within(table).getByText("ABAMECTIN")).toBeInTheDocument();
    expect(within(table).queryByText("RM")).not.toBeInTheDocument();
    fireEvent.click(within(table).getByRole("button"));
    expect(onEditField).toHaveBeenCalledWith("substance", "p1", 0);
  });

  it("renders conditional table without a Field column", () => {
    const onEditField = vi.fn();
    renderCriteriaTabs({
      value: "conditional",
      onEditField,
      parameters: [
        {
          _id: "p-conditional",
          name: "Parameter Conditional",
          scope: "qc",
          valueFields: [
            {
              label: "Decision",
              type: "number",
              conditionalMode: true,
              conditionalStandards: [
                {
                  label: "Rule A",
                  conditions: [{ sourceFieldLabel: "Source", op: "eq", value: "A" }],
                  operator: "gte",
                  value: 10,
                },
              ],
            },
          ],
        },
      ],
    });

    const table = screen.getByRole("table");
    const headers = within(table).getAllByRole("columnheader").map((header) => header.textContent ?? "");
    expect(headers).toHaveLength(6);
    expect(headers).toContain("Parameter");
    expect(headers.some((text) => text.includes("Field"))).toBe(false);
    expect(within(table).getByText("Parameter Conditional")).toBeInTheDocument();
    expect(within(table).queryByText("Decision")).not.toBeInTheDocument();
    fireEvent.click(within(table).getByRole("button"));
    expect(onEditField).toHaveBeenCalledWith("conditional", "p-conditional", 0);
  });

  it("renders all label tolerance columns for admin and QC head access", () => {
    const { onEditField } = renderCriteriaTabs({ canViewHeadCriteriaColumns: true });

    const table = screen.getByRole("table");
    const headerTexts = within(table).getAllByRole("columnheader").map((header) => header.textContent ?? "");
    expect(headerTexts).toHaveLength(8);
    expect(headerTexts).toContain("Parameter");
    expect(headerTexts).toContain("เกณฑ์กลาง");
    expect(headerTexts.some((text) => text.includes("(%,+-)"))).toBe(true);
    expect(headerTexts.filter((text) => text.includes("25%"))).toHaveLength(2);

    const bodyCells = within(within(table).getAllByRole("row")[1]).getAllByRole("cell");
    expect(bodyCells).toHaveLength(8);
    expect(within(bodyCells[0]).getByText("Parameter A")).toBeInTheDocument();
    expect(within(bodyCells[0]).queryByText("Parameter A / %AI")).not.toBeInTheDocument();
    expect(within(bodyCells[0]).getByText("ABAMECTIN / 1%")).toBeInTheDocument();
    expect(within(bodyCells[1]).getByText("1")).toBeInTheDocument();
    expect(within(bodyCells[2]).getByText("25%")).toBeInTheDocument();
    expect(within(bodyCells[3]).getByText("15%")).toBeInTheDocument();

    fireEvent.click(within(table).getAllByRole("button")[0]);
    expect(onEditField).toHaveBeenCalledWith("labelTolerance", "p1", 1);
  });

  it("hides head-only label tolerance columns by default", () => {
    renderCriteriaTabs();

    const table = screen.getByRole("table");
    const headerTexts = within(table).getAllByRole("columnheader").map((header) => header.textContent ?? "");
    expect(headerTexts).toHaveLength(5);
    expect(headerTexts).toContain("Parameter");
    expect(headerTexts).toContain("เกณฑ์กลาง");
    expect(headerTexts.some((text) => text.includes("(%,+-)"))).toBe(false);
    expect(headerTexts.some((text) => text.includes("25%"))).toBe(false);

    const cells = within(within(table).getAllByRole("row")[1]).getAllByRole("cell");
    expect(cells).toHaveLength(5);
    expect(within(cells[2]).getByText("15%")).toBeInTheDocument();
    expect(within(cells[3]).queryByText("25%")).not.toBeInTheDocument();
  });

  it("filters by parameter and sorts label tolerance rows by substance percent", () => {
    renderCriteriaTabs({ canViewHeadCriteriaColumns: true });

    fireEvent.change(screen.getByLabelText("เลือก Parameter"), { target: { value: "p2" } });

    const filteredRows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(filteredRows).toHaveLength(1);
    expect(within(filteredRows[0]).queryByText("Parameter A")).not.toBeInTheDocument();
    expect(within(filteredRows[0]).getByText("Parameter B")).toBeInTheDocument();
    expect(within(filteredRows[0]).getByText("GLYPHOSATE / 5%")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("เลือก Parameter"), { target: { value: "__all__" } });
    fireEvent.change(screen.getByLabelText("เรียงลำดับ"), { target: { value: "drugPercentDesc" } });

    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText("Parameter B")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Parameter A")).toBeInTheDocument();
  });

  it("filters criteria rows by substance search text", () => {
    renderCriteriaTabs();

    fireEvent.change(screen.getByLabelText("ค้นหาเกณฑ์"), { target: { value: "glyph" } });

    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText("Parameter B")).toBeInTheDocument();
    expect(within(rows[0]).getByText("GLYPHOSATE / 5%")).toBeInTheDocument();
    expect(screen.queryByText("ABAMECTIN / 1%")).not.toBeInTheDocument();
  });

  it("renders an empty state for a tab with no rows", () => {
    renderCriteriaTabs({ value: "conditional" });

    expect(screen.getByText("ไม่มีรายการเกณฑ์ในแท็บนี้")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
