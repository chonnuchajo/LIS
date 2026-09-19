import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PageAccessTab from "./PageAccessTab";
import UserRoleDrawer from "./UserRoleDrawer";
import UsersTab from "./UsersTab";
import type { AppUser } from "./types";

vi.mock("@/lib/navItems", () => {
  const items = [
    { path: "/target-more", label: "Prefix" },
    { path: "/detail", label: "/target" },
    { path: "/target", label: "Exact" },
    { path: "/unrelated", label: "Unrelated" },
  ];
  return { NAV_ITEMS: items, PAGE_ITEMS: items };
});

const user: AppUser = {
  id: "user", name: "User", email: "user@example.com", roleId: "viewer", roleIds: ["viewer"],
  department: "QC", position: "Analyst", employeeId: "", status: "active", lastActive: "",
};
const directory = [
  ...Array.from({ length: 50 }, (_, index) => ({
    employeeId: "X-" + index, name: "E1 Employee " + index, department: "QC", position: "Analyst", email: "",
  })),
  { employeeId: "E1", name: "Exact", department: "QC", position: "Analyst", email: "" },
];

describe("access search ranking", () => {
  it("ranks UsersTab before its 25-row pagination", () => {
    const { container } = render(
      <UsersTab
        users={directory.map((employee) => ({ ...user, ...employee, id: employee.employeeId }))}
        roles={[]} directory={directory} syncing={false}
        onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} onLinkEmployee={vi.fn()} onSync={vi.fn()}
      />,
    );
    expect(screen.queryByText("Exact")).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("ค้นหา ชื่อ/อีเมล/รหัสพนักงาน"), { target: { value: "E1" } });
    const rows = container.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(25);
    expect(rows[0]).toHaveTextContent("Exact");
  });

  it("ranks directory identifiers before the drawer's 50-item limit and keeps selection", () => {
    const onLinkEmployee = vi.fn();
    render(
      <UserRoleDrawer open mode="edit" user={user} roles={[]} directory={directory}
        onClose={vi.fn()} onCreate={vi.fn()} onUpdate={vi.fn()} onLinkEmployee={onLinkEmployee} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "ผูก" }));
    expect(screen.queryByText("Exact")).not.toBeInTheDocument();
    const input = screen.getByPlaceholderText("ค้นหาชื่อ / รหัส / แผนก...");
    fireEvent.change(input, { target: { value: "E1" } });
    const entries = screen.getAllByRole("button").filter((button) => button.textContent?.includes(" · QC"));
    expect(entries).toHaveLength(50);
    expect(entries[0]).toHaveTextContent("Exact");
    fireEvent.click(entries[0]);
    expect(onLinkEmployee).toHaveBeenCalledWith("user", "E1");
  });

  it("ranks exact URLs before prefix URLs and page labels without dropping matches", () => {
    const { container } = render(<PageAccessTab groups={[]} roles={[]} users={[]} permissions={{}} />);
    const rowPaths = () => Array.from(container.querySelectorAll("tbody .font-mono"), (element) => element.textContent);
    const original = rowPaths();
    const input = screen.getByPlaceholderText("ค้นหา URL / หน้า / role / ผู้ใช้");
    fireEvent.change(input, { target: { value: "/target" } });
    expect(rowPaths()).toEqual(["/target", "/target-more", "/detail"]);
    fireEvent.change(input, { target: { value: "   " } });
    expect(rowPaths()).toEqual(original);
  });
});
