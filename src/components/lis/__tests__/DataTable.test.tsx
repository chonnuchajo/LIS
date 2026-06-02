import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DataTable } from "../DataTable";

const columns = [{ key: "name", header: "Name", cell: (r: { name: string }) => r.name }];

describe("DataTable", () => {
  it("shows skeleton when loading", () => {
    render(<DataTable columns={columns} data={[]} isLoading rowKey={(r) => r.name} />);
    expect(screen.getByLabelText("กำลังโหลด")).toBeInTheDocument();
  });

  it("shows empty state when no data", () => {
    render(<DataTable columns={columns} data={[]} emptyTitle="ว่าง" rowKey={(r) => r.name} />);
    expect(screen.getByText("ว่าง")).toBeInTheDocument();
  });

  it("renders rows when data present", () => {
    render(<DataTable columns={columns} data={[{ name: "A" }]} rowKey={(r) => r.name} />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });
});
