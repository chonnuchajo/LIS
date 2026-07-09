import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ParameterItem } from "@/lib/api";
import { ParameterCriteriaTabs } from "./ParameterCriteriaTabs";

const parameters: ParameterItem[] = [
  {
    _id: "p1",
    name: "เธชเธฒเธขเธชเธณเธเธฑเธ",
    scope: "qc",
    valueFields: [
      {
        label: "เธเธฃเธดเธกเธฒเธ“",
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
    expect(screen.getByRole("tab", { name: /เนเธขเธเธ•เธฒเธกเธชเธฒเธฃ/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /เธ•เธฒเธก %เธชเธฒเธฃ/ })).toBeInTheDocument();
  });

  it("renders substance table rows and calls edit callback", () => {
    const onEditField = vi.fn();
    const onValueChange = vi.fn();
    render(
      <ParameterCriteriaTabs
        value="substance"
        onValueChange={onValueChange}
        parameters={parameters}
        scope="qc"
        onEditField={onEditField}
      >
        <div>original parameter list</div>
      </ParameterCriteriaTabs>,
    );

    expect(screen.getByText("ABAMECTIN")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "เนเธเนเนเธ เนเธขเธเธ•เธฒเธกเธชเธฒเธฃ เธเธฃเธดเธกเธฒเธ“" }));
    expect(onEditField).toHaveBeenCalledWith("substance", "p1", 0);
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

    expect(screen.getByText("เธขเธฑเธเนเธกเนเธกเธตเธเนเธญเธกเธนเธฅเนเธเธกเธธเธกเธกเธญเธเธเธตเน")).toBeInTheDocument();
  });
});
