import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { RouteLoading } from "./RouteLoading";

const loadingLabel = "กำลังเตรียมสาร…";

const cssPath = resolve(process.cwd(), "src/components/RouteLoading.css");

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
  it("uses a white page background", () => {
    const css = readFileSync(cssPath, "utf8");

    expect(css).toContain("background: #ffffff;");
  });

  it("animates the SVG artwork motion", () => {
    const css = readFileSync(cssPath, "utf8");

    expect(css).toContain("route-loading-svg-motion");
    expect(css).toContain("@keyframes route-loading-svg-motion");
  });
});
