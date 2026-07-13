import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RouteLoading } from "./RouteLoading";

const loadingLabel = "กำลังเตรียมสาร…";

describe("RouteLoading", () => {
  it("renders the route loading status", () => {
    render(<RouteLoading />);

    expect(screen.getByRole("status", { name: loadingLabel })).toBeInTheDocument();
    expect(screen.getByText(loadingLabel)).toHaveTextContent(loadingLabel);
    expect(screen.getByTestId("route-loading-artwork")).toHaveAttribute(
      "src",
      expect.stringContaining("route-loading-lab.svg"),
    );
    expect(screen.getByTestId("route-loading-scan")).toBeInTheDocument();
  });
});
