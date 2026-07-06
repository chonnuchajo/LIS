import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ActiveRoleSwitcher from "./ActiveRoleSwitcher";

describe("ActiveRoleSwitcher", () => {
  it("shows a static chip for a single role", () => {
    render(
      <MemoryRouter>
        <ActiveRoleSwitcher roles={["qc"]} activeRole="qc" onChange={vi.fn()} roleNames={{ qc: "QC Reviewer" }} />
      </MemoryRouter>,
    );
    expect(screen.getByText("QC Reviewer")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
  it("renders a dropdown when the user holds multiple roles", () => {
    render(
      <MemoryRouter>
        <ActiveRoleSwitcher roles={["lab", "qc"]} activeRole="qc" onChange={vi.fn()} roleNames={{ lab: "Lab", qc: "QC" }} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });
});
