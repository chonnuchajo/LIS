import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useState, type ComponentProps } from "react";
import type { ParameterItem } from "@/lib/api";
import { ParameterCriteriaTabs, type ParameterCriteriaTab } from "./ParameterCriteriaTabs";

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
            substance: "CYFLUTHRIN",
            operator: "between",
            value: 20,
            value2: 80,
            productTypes: ["water"],
            categories: ["RM"],
          } as any,
          {
            substance: "ABAMECTIN",
            operator: "between",
            value: 95,
            value2: 110,
            productTypes: ["water"],
            categories: ["RM"],
          } as any,
          {
            substance: "BIFENTHRIN",
            operator: "gte",
            value: 50,
            value2: null,
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

const metadataParameters: ParameterItem[] = [
  {
    _id: "p-meta",
    name: "Metadata Parameter",
    scope: "qc",
    status: "active",
    note: "Hidden owner note",
    itemNames: ["Trade Alpha"],
    commonNames: ["Hidden Common Name"],
    productTypes: ["water"],
    categories: ["FG"],
    subCategories: ["F"],
    itemGroups: ["group-hidden"],
    valueFields: [
      {
        label: "Hidden Field Label",
        type: "number",
        unit: "%",
        substanceMode: true,
        substanceStandards: [{ substance: "CYPERMETHRIN", operator: "gte", value: 90 }],
      },
    ],
  },
  {
    _id: "p-other",
    name: "Other Parameter",
    scope: "qc",
    valueFields: [
      {
        label: "Other Field",
        type: "number",
        substanceMode: true,
        substanceStandards: [{ substance: "ABAMECTIN", operator: "gte", value: 95 }],
      },
    ],
  },
];

const specificGravityParameters: ParameterItem[] = [
  {
    _id: "p-other-first",
    name: "ปริมาณสาร",
    scope: "qc",
    valueFields: [
      {
        label: "Active",
        type: "number",
        substanceMode: true,
        substanceStandards: [{ substance: "ABAMECTIN", operator: "gte", value: 90 }],
      },
    ],
  },
  {
    _id: "p-sg",
    name: "ค่า ถพ.",
    scope: "qc",
    valueFields: [
      {
        label: "ค่าถพ.",
        type: "number",
        substanceMode: true,
        substanceStandards: [{ substance: "SG", operator: "gte", value: 0.99 }],
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

function criteriaSearchInput() {
  return screen.getAllByRole("textbox")[0];
}

function bodyRows() {
  return within(screen.getByRole("table")).getAllByRole("row").slice(2);
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
    expect(headers).toHaveLength(8);
    expect(headers[0]).toBe("Parameter A");
    expect(headers).not.toContain("Parameter");
    expect(headers.some((text) => text.includes("Field"))).toBe(false);
    expect(headers.some((text) => text.includes("Type"))).toBe(false);
    expect(headers.some((text) => text.includes("หมวดหมู่"))).toBe(false);
    expect(headers.some((text) => text.includes("เงื่อนไข"))).toBe(false);
    expect(headers.some((text) => text.includes("เฉพาะหัวหน้าตรวจ"))).toBe(false);

    expect(within(table).getByText("ABAMECTIN")).toBeInTheDocument();
    expect(within(table).getByText("BIFENTHRIN")).toBeInTheDocument();
    expect(within(table).getByText("CYFLUTHRIN")).toBeInTheDocument();
    expect(within(table).queryByText("RM")).not.toBeInTheDocument();
    fireEvent.click(within(table).getAllByRole("button")[0]);
    expect(onEditField).toHaveBeenCalledTimes(1);
    expect(onEditField).toHaveBeenCalledWith("substance", "p1", 0, 1);
  });

  it("defaults the Parameter filter to ค่า ถพ. and removes the all option", () => {
    renderCriteriaTabs({ value: "substance", parameters: specificGravityParameters });

    const parameterSelect = screen.getByLabelText("เลือก Parameter") as HTMLSelectElement;
    const optionTexts = within(parameterSelect).getAllByRole("option").map((option) => option.textContent ?? "");

    expect(parameterSelect).toHaveValue("p-sg");
    expect(optionTexts).not.toContain("ทุก Parameter");
    expect(within(screen.getByRole("table")).getAllByRole("columnheader")[0]).toHaveTextContent("ค่า ถพ.");
    expect(within(bodyRows()[0]).getByText("SG")).toBeInTheDocument();
    expect(screen.queryByText("ABAMECTIN")).not.toBeInTheDocument();
  });

  it("opens the row's rule when clicking anywhere on a substance row", () => {
    const { onEditField } = renderCriteriaTabs({ value: "substance" });

    fireEvent.click(within(screen.getByRole("table")).getByText("BIFENTHRIN"));

    expect(onEditField).toHaveBeenCalledTimes(1);
    expect(onEditField).toHaveBeenCalledWith("substance", "p1", 0, 2);
  });

  it("passes a null rule index for the setup row of an unconfigured field", () => {
    const { onEditField } = renderCriteriaTabs({
      value: "substance",
      parameters: [
        {
          _id: "p-empty",
          name: "Parameter Empty",
          scope: "qc",
          valueFields: [
            { label: "Active", type: "number", substanceMode: true, substanceStandards: [] },
          ],
        },
      ],
    });

    fireEvent.click(within(screen.getByRole("table")).getByRole("button"));

    expect(onEditField).toHaveBeenCalledWith("substance", "p-empty", 0, null);
  });

  it("defaults the substance tab to substance A-Z and hides parameter order and percent sort options", () => {
    renderCriteriaTabs({ value: "substance" });

    const sortSelect = screen.getByLabelText("เรียงลำดับ");
    const optionTexts = within(sortSelect).getAllByRole("option").map((option) => option.textContent ?? "");

    expect(sortSelect).toHaveValue("substanceAsc");
    expect(optionTexts).toEqual([
      "ชื่อสาร A-Z",
      "ชื่อสาร Z-A",
      "ค่าต่ำสุด น้อยไปมาก",
      "ค่าต่ำสุด มากไปน้อย",
      "ค่าสูงสุด น้อยไปมาก",
      "ค่าสูงสุด มากไปน้อย",
    ]);
    expect(optionTexts.some((text) => text.includes("ตามลำดับ Parameter"))).toBe(false);
    expect(optionTexts.some((text) => text.includes("%สาร"))).toBe(false);

    const rows = bodyRows();
    expect(within(rows[0]).getByText("ABAMECTIN")).toBeInTheDocument();
    expect(within(rows[1]).getByText("BIFENTHRIN")).toBeInTheDocument();
    expect(within(rows[2]).getByText("CYFLUTHRIN")).toBeInTheDocument();
  });

  it("sorts substance rows by substance Z-A", () => {
    renderCriteriaTabs({ value: "substance" });

    fireEvent.change(screen.getByLabelText("เรียงลำดับ"), { target: { value: "substanceDesc" } });

    const rows = bodyRows();
    expect(within(rows[0]).getByText("CYFLUTHRIN")).toBeInTheDocument();
    expect(within(rows[1]).getByText("BIFENTHRIN")).toBeInTheDocument();
    expect(within(rows[2]).getByText("ABAMECTIN")).toBeInTheDocument();
  });

  it("sorts substance rows by minimum value in both directions", () => {
    renderCriteriaTabs({ value: "substance" });

    fireEvent.change(screen.getByLabelText("เรียงลำดับ"), { target: { value: "minValueAsc" } });
    let rows = bodyRows();
    expect(within(rows[0]).getByText("CYFLUTHRIN")).toBeInTheDocument();
    expect(within(rows[1]).getByText("BIFENTHRIN")).toBeInTheDocument();
    expect(within(rows[2]).getByText("ABAMECTIN")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("เรียงลำดับ"), { target: { value: "minValueDesc" } });
    rows = bodyRows();
    expect(within(rows[0]).getByText("ABAMECTIN")).toBeInTheDocument();
    expect(within(rows[1]).getByText("BIFENTHRIN")).toBeInTheDocument();
    expect(within(rows[2]).getByText("CYFLUTHRIN")).toBeInTheDocument();
  });

  it("sorts substance rows by maximum value in both directions with missing values last", () => {
    renderCriteriaTabs({ value: "substance" });

    fireEvent.change(screen.getByLabelText("เรียงลำดับ"), { target: { value: "maxValueAsc" } });
    let rows = bodyRows();
    expect(within(rows[0]).getByText("CYFLUTHRIN")).toBeInTheDocument();
    expect(within(rows[1]).getByText("ABAMECTIN")).toBeInTheDocument();
    expect(within(rows[2]).getByText("BIFENTHRIN")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("เรียงลำดับ"), { target: { value: "maxValueDesc" } });
    rows = bodyRows();
    expect(within(rows[0]).getByText("ABAMECTIN")).toBeInTheDocument();
    expect(within(rows[1]).getByText("CYFLUTHRIN")).toBeInTheDocument();
    expect(within(rows[2]).getByText("BIFENTHRIN")).toBeInTheDocument();
  });

  it("keeps percent sort options available on the label tolerance tab", () => {
    renderCriteriaTabs({ value: "labelTolerance", canViewHeadCriteriaColumns: true });

    const optionTexts = within(screen.getByLabelText("เรียงลำดับ"))
      .getAllByRole("option")
      .map((option) => option.textContent ?? "");

    expect(optionTexts).toContain("%สาร น้อยไปมาก");
    expect(optionTexts).toContain("%สาร มากไปน้อย");
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
    expect(headers[0]).toBe("Parameter Conditional");
    expect(headers).not.toContain("Parameter");
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
    expect(headerTexts[0]).toBe("Parameter A");
    expect(headerTexts).not.toContain("Parameter");
    expect(headerTexts).toContain("เกณฑ์กลาง");
    expect(headerTexts.some((text) => text.includes("(%,+-)"))).toBe(true);
    expect(headerTexts.filter((text) => text.includes("25%"))).toHaveLength(2);

    const bodyCells = within(bodyRows()[0]).getAllByRole("cell");
    expect(bodyCells).toHaveLength(7);
    expect(within(bodyCells[0]).queryByText("Parameter A / %AI")).not.toBeInTheDocument();
    expect(within(bodyCells[0]).getByText("ABAMECTIN / 1%")).toBeInTheDocument();
    expect(within(bodyCells[1]).getByText("25%")).toBeInTheDocument();
    expect(within(bodyCells[2]).getByText("15%")).toBeInTheDocument();

    fireEvent.click(within(table).getAllByRole("button")[0]);
    expect(onEditField).toHaveBeenCalledWith("labelTolerance", "p1", 1);
  });

  it("hides head-only label tolerance columns by default", () => {
    renderCriteriaTabs();

    const table = screen.getByRole("table");
    const headerTexts = within(table).getAllByRole("columnheader").map((header) => header.textContent ?? "");
    expect(headerTexts).toHaveLength(5);
    expect(headerTexts[0]).toBe("Parameter A");
    expect(headerTexts).not.toContain("Parameter");
    expect(headerTexts).toContain("เกณฑ์กลาง");
    expect(headerTexts.some((text) => text.includes("(%,+-)"))).toBe(false);
    expect(headerTexts.some((text) => text.includes("25%"))).toBe(false);

    const cells = within(bodyRows()[0]).getAllByRole("cell");
    expect(cells).toHaveLength(4);
    expect(within(cells[1]).getByText("15%")).toBeInTheDocument();
    expect(within(cells[2]).queryByText("25%")).not.toBeInTheDocument();
  });

  it("filters by parameter and sorts label tolerance rows by substance percent", () => {
    renderCriteriaTabs({ canViewHeadCriteriaColumns: true });

    fireEvent.change(screen.getByLabelText("เลือก Parameter"), { target: { value: "p2" } });

    expect(bodyRows()).toHaveLength(1);
    expect(within(screen.getByRole("table")).getAllByRole("columnheader")[0]).toHaveTextContent("Parameter B");
    expect(within(bodyRows()[0]).queryByText("Parameter A")).not.toBeInTheDocument();
    expect(within(bodyRows()[0]).getByText("GLYPHOSATE / 5%")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("เรียงลำดับ"), { target: { value: "drugPercentDesc" } });

    expect(within(bodyRows()[0]).getByText("GLYPHOSATE / 5%")).toBeInTheDocument();
  });

  it("resets the Parameter filter when switching criteria tabs", () => {
    function Wrapper() {
      const [tab, setTab] = useState<ParameterCriteriaTab>("labelTolerance");
      return (
        <ParameterCriteriaTabs
          value={tab}
          onValueChange={setTab}
          parameters={parameters}
          scope="qc"
          canViewHeadCriteriaColumns
          onEditField={vi.fn()}
        >
          <div>original parameter list</div>
        </ParameterCriteriaTabs>
      );
    }

    render(<Wrapper />);

    const parameterSelect = screen.getByLabelText("เลือก Parameter") as HTMLSelectElement;
    fireEvent.change(parameterSelect, { target: { value: "p2" } });
    expect(parameterSelect.value).toBe("p2");

    const substanceTab = screen.getByRole("tab", { name: "แยกตามสาร" });
    fireEvent.mouseDown(substanceTab);
    fireEvent.click(substanceTab);

    expect((screen.getByLabelText("เลือก Parameter") as HTMLSelectElement).value).toBe("p1");
    expect(within(screen.getByRole("table")).getAllByRole("columnheader")[0]).toHaveTextContent("Parameter A");
    expect(bodyRows()).toHaveLength(3);
  });

  it("filters criteria rows by hidden parameter metadata", () => {
    renderCriteriaTabs({
      value: "substance",
      parameters: metadataParameters,
    });

    fireEvent.change(criteriaSearchInput(), {
      target: { value: "hidden owner note" },
    });

    const rows = bodyRows();
    expect(rows).toHaveLength(1);
    expect(within(screen.getByRole("table")).getAllByRole("columnheader")[0]).toHaveTextContent("Metadata Parameter");
    expect(within(rows[0]).getByText("CYPERMETHRIN")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).queryByText("Other Parameter")).not.toBeInTheDocument();
  });

  it("filters criteria rows by apply-to metadata and hidden field label", () => {
    renderCriteriaTabs({
      value: "substance",
      parameters: metadataParameters,
    });

    fireEvent.change(criteriaSearchInput(), {
      target: { value: "Trade Alpha" },
    });

    expect(bodyRows()).toHaveLength(1);
    expect(within(screen.getByRole("table")).getAllByRole("columnheader")[0]).toHaveTextContent("Metadata Parameter");

    fireEvent.change(criteriaSearchInput(), {
      target: { value: "Hidden Field Label" },
    });
    const rows = bodyRows();
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText("CYPERMETHRIN")).toBeInTheDocument();
  });

  it("filters criteria rows by substance search text", () => {
    renderCriteriaTabs();

    fireEvent.change(screen.getByLabelText("เลือก Parameter"), { target: { value: "p2" } });
    fireEvent.change(screen.getByLabelText("ค้นหาเกณฑ์"), { target: { value: "glyph" } });

    const rows = bodyRows();
    expect(rows).toHaveLength(1);
    expect(within(screen.getByRole("table")).getAllByRole("columnheader")[0]).toHaveTextContent("Parameter B");
    expect(within(rows[0]).getByText("GLYPHOSATE / 5%")).toBeInTheDocument();
    expect(screen.queryByText("ABAMECTIN / 1%")).not.toBeInTheDocument();
  });

  it("matches substance search terms that exist only in indexed searchText", () => {
    renderCriteriaTabs({
      value: "substance",
      parameters: [
        {
          _id: "p-searchable",
          name: "Searchable Parameter",
          scope: "qc",
          status: "active",
          note: "hidden owner note for criteria search",
          itemNames: ["Trade Alpha"],
          commonNames: ["Hidden Common Name"],
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
                },
              ],
            },
          ],
        },
        {
          _id: "p-other",
          name: "Visible Field",
          scope: "qc",
          valueFields: [
            {
              label: "Active",
              type: "number",
              substanceMode: true,
              substanceStandards: [
                {
                  substance: "DIQUAT",
                  operator: "gte",
                  value: 40,
                  productTypes: ["powder"],
                },
              ],
            },
          ],
        },
      ],
    });

    fireEvent.change(screen.getByLabelText("ค้นหาเกณฑ์"), {
      target: { value: "trade alpha" },
    });

    const rows = bodyRows();
    expect(rows).toHaveLength(1);
    expect(within(screen.getByRole("table")).getAllByRole("columnheader")[0]).toHaveTextContent("Searchable Parameter");
    expect(within(rows[0]).getByText("ABAMECTIN")).toBeInTheDocument();
    expect(within(rows[0]).queryByText("Visible Field")).not.toBeInTheDocument();
  });

  it("renders an empty state for a tab with no rows", () => {
    renderCriteriaTabs({ value: "conditional" });

    expect(screen.getByText("ไม่มีรายการเกณฑ์ในแท็บนี้")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
