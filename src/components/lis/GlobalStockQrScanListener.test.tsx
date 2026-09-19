import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import GlobalStockQrScanListener from "./GlobalStockQrScanListener";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function renderWithRoutes(initialEntry = "/report") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <GlobalStockQrScanListener />
      <Routes>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

function scanText(text: string) {
  Array.from(text).forEach((key) => fireEvent.keyDown(window, { key }));
  fireEvent.keyDown(window, { key: "Enter" });
}

describe("GlobalStockQrScanListener", () => {
  it("opens stock deduction when a stock bottle QR is scanned anywhere", async () => {
    renderWithRoutes("/report");

    scanText("https://app-plant.icpladda.com/LIS/stock/view?qrId=u_scan");

    expect(screen.getByTestId("location")).toHaveTextContent("/stock-deduction?qrId=u_scan");
  });

  it("ignores non-stock QR input", async () => {
    renderWithRoutes("/report");

    scanText("P-2609-0001");

    expect(screen.getByTestId("location")).toHaveTextContent("/report");
  });
});
