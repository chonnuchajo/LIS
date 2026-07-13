import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import AlertStrip from "./AlertStrip";

const counts = { urgent: 3, overdue: 7, atRisk: 5, unassigned: 2, waitingHead: 4, abnormal: 1 };

describe("AlertStrip", () => {
  it("shows every headline count", () => {
    render(<MemoryRouter><AlertStrip counts={counts} overdueIds={[]} /></MemoryRouter>);
    expect(screen.getByText("เกินเวลา").closest("a")).toHaveTextContent("7");
    expect(screen.getByText("รอมือหัวหน้า").closest("a")).toHaveTextContent("4");
  });

  it("links the overdue tile to the petition list with those ids highlighted", () => {
    render(<MemoryRouter><AlertStrip counts={counts} overdueIds={["a", "b"]} /></MemoryRouter>);
    expect(screen.getByText("เกินเวลา").closest("a")).toHaveAttribute("href", "/petitions?highlight=a,b");
  });
});
