import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ConfigCoveragePies from "./ConfigCoveragePies";

describe("ConfigCoveragePies", () => {
  it("renders both pie cards and legend counts", () => {
    render(
      <ConfigCoveragePies
        simpleMethodData={[
          { key: "gc", label: "GC", value: 2, color: "hsl(217,91%,55%)" },
          { key: "both", label: "GC + HPLC", value: 1, color: "hsl(262,83%,58%)" },
        ]}
        standardTimeData={[
          { key: "instrument-GC7890A", label: "GC7890A", value: 3, color: "hsl(217,91%,55%)" },
          { key: "unassigned", label: "เธขเธฑเธเนเธกเนเธเธณเธซเธเธ”", value: 2, color: "hsl(38,92%,50%)" },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Simple Method" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Standard Time" })).toBeInTheDocument();
    expect(screen.getByText("GC + HPLC")).toBeInTheDocument();
    expect(screen.getByText("GC7890A")).toBeInTheDocument();
    expect(screen.getAllByText("2 เธฃเธฒเธขเธเธฒเธฃ")).toHaveLength(2);
  });

  it("renders loading and empty states", () => {
    const { rerender } = render(
      <ConfigCoveragePies simpleMethodData={[]} standardTimeData={[]} loading />,
    );
    expect(screen.getAllByText("เธเธณเธฅเธฑเธเนเธซเธฅเธ”...")).toHaveLength(2);

    rerender(<ConfigCoveragePies simpleMethodData={[]} standardTimeData={[]} />);
    expect(screen.getAllByText("เนเธกเนเธกเธตเธเนเธญเธกเธนเธฅ")).toHaveLength(2);
  });
});
