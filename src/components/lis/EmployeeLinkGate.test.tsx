import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import EmployeeLinkGate from "./EmployeeLinkGate";

vi.mock("@/context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { get: vi.fn() } }));

describe("EmployeeLinkGate search ranking", () => {
  it("ranks before the 50-row limit while preserving totals and employee linking", async () => {
    const linkSelfEmployee = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "unlinked", employeeId: "", email: "employee@example.com", roles: ["viewer"] },
      linkSelfEmployee,
    } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(api.get).mockResolvedValue({ data: { data: [
      ...Array.from({ length: 50 }, (_, index) => ({
        employeeId: "X-" + index, name: "E1 Employee " + index, department: "QC", position: "Analyst",
      })),
      { employeeId: "E1", name: "Exact", department: "QC", position: "Analyst" },
    ] } });
    render(<EmployeeLinkGate />);
    await screen.findByRole("button", { name: /E1 Employee 0/ });
    expect(screen.queryByText("Exact")).not.toBeInTheDocument();
    const input = screen.getByPlaceholderText("ค้นหาชื่อ, รหัสพนักงาน, แผนก...");
    fireEvent.change(input, { target: { value: " e1 " } });
    expect(screen.getAllByRole("button")).toHaveLength(50);
    expect(screen.getAllByRole("button")[0]).toHaveTextContent("Exact");
    expect(screen.getByText(/แสดง 50 จาก 51 รายการ/)).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "" } });
    expect(screen.getAllByRole("button")[0]).toHaveTextContent("E1 Employee 0");
    fireEvent.change(input, { target: { value: "e1" } });
    fireEvent.click(screen.getAllByRole("button")[0]);
    await waitFor(() => expect(linkSelfEmployee).toHaveBeenCalledWith("E1"));
  });
});
