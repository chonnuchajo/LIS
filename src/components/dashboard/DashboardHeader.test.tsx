import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DashboardHeader from "./DashboardHeader";
import { NAV_ITEMS } from "@/lib/navItems";

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      department: "QC",
      roles: ["lab", "qc"],
      status: "active",
    },
  }),
}));

describe("DashboardHeader", () => {
  it("renders role-matrix nav instead of a role selector", () => {
    render(
      <MemoryRouter>
        <DashboardHeader
          titleEn="QC Dashboard"
          subtitleTh=""
          range="today"
          onRangeChange={vi.fn()}
          onRefresh={vi.fn()}
          onExport={vi.fn()}
          navItems={NAV_ITEMS.filter((item) => ["/petitions", "/qc-testing"].includes(item.path))}
        />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    expect(screen.getByRole("navigation", { name: "เมนูหน้าแรก" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /เมนู/ })).toBeInTheDocument();
  });
});
