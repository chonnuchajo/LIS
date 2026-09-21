import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminData from "../AdminData";

const tab = vi.hoisted(() => ({ defaultKey: "database" }));
vi.mock("@/components/lis/AppLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/hooks/useAccessibleTabs", () => ({ useAccessibleTabs: () => ({
  defaultKey: tab.defaultKey,
  tabs: [{ key: "database", label: "Database" }, { key: "activelog", label: "Active Log" }],
}) }));
vi.mock("@/context/SampleContext", () => ({ useSamples: () => ({
  approvals: Object.fromEntries(["Z", "XXAB", "XAB", "AB1", "AB"].map((id) => [id, { qcStatus: "approved" }])),
}) }));
vi.mock("@/data/mockData", () => ({ doneSamples: [
  { id: "Z", name: "AB", receiver: "Analyst" },
  { id: "XXAB", name: "Later", receiver: "Analyst" },
  { id: "XAB", name: "Earlier", receiver: "Analyst" },
  { id: "AB1", name: "Prefix", receiver: "Analyst" },
  { id: "AB", name: "Exact", receiver: "Analyst" },
  { id: "AB2", name: "Not approved", receiver: "Analyst" },
] }));
vi.mock("@/hooks/usePetition", () => ({ usePetitionAuditLogList: () => ({ data: { items: [] }, loading: false, error: null }) }));

describe("AdminData search ranking", () => {
  beforeEach(() => { tab.defaultKey = "database"; });

  it("ranks approved sample identifiers before names and restores original order for blank queries", () => {
    const { container } = render(<MemoryRouter><AdminData /></MemoryRouter>);
    const rowIds = () => Array.from(container.querySelectorAll("tbody tr"), (row) => row.querySelector("td")?.textContent);
    const original = ["Z", "XXAB", "XAB", "AB1", "AB"];
    expect(rowIds()).toEqual(original);
    fireEvent.change(screen.getByPlaceholderText("ค้นหา..."), { target: { value: "ab" } });
    expect(rowIds()).toEqual(["AB", "AB1", "XAB", "XXAB", "Z"]);
    expect(screen.queryByText("Not approved")).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("ค้นหา..."), { target: { value: "" } });
    expect(rowIds()).toEqual(original);
  });

  it("ranks log instrument/sample identifiers by their earliest matching position", () => {
    tab.defaultKey = "activelog";
    const { container } = render(<MemoryRouter><AdminData /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText("ค้นหา..."), { target: { value: "01" } });
    expect(Array.from(container.querySelectorAll("tbody tr"), (row) => row.querySelector("td")?.textContent))
      .toEqual(["LOG-002", "LOG-001", "LOG-004"]);
  });
});
