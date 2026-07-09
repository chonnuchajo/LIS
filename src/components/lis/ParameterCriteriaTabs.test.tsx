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
    expect(screen.getByRole("tab", { name: "\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "\u0E41\u0E22\u0E01\u0E15\u0E32\u0E21\u0E2A\u0E32\u0E23" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "\u0E40\u0E07\u0E37\u0E48\u0E2D\u0E19\u0E44\u0E02\u0E1E\u0E34\u0E40\u0E28\u0E29" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "\u0E15\u0E32\u0E21 \u0025\u0E2A\u0E32\u0E23" })).toBeInTheDocument();
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
    expect(within(table).getByRole("columnheader", { name: "\u0025 \u0E22\u0E32" })).toBeInTheDocument();

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

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
