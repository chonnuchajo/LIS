import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { preserveDevSwitcherAnchorPosition } from "./devRoleSwitcherPosition";
import { DevRoleSwitcher } from "./DevRoleSwitcher";

const authMocks = vi.hoisted(() => ({
  setDevDepartment: vi.fn(),
  toggleDevRole: vi.fn(),
}));

vi.mock("@/config/dev", () => ({
  DEV_DEPARTMENTS: ["ห้องปฏิบัติการ"],
  DEV_MODE: true,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    devDepartment: "",
    devRoleIds: ["admin"],
    devRoles: [{ id: "admin", name: "Admin" }],
    setDevDepartment: authMocks.setDevDepartment,
    toggleDevRole: authMocks.toggleDevRole,
  }),
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
  authMocks.setDevDepartment.mockClear();
  authMocks.toggleDevRole.mockClear();
});

describe("preserveDevSwitcherAnchorPosition", () => {
  it("keeps the DEV MODE badge in place when collapsing shrinks the switcher", () => {
    expect(
      preserveDevSwitcherAnchorPosition(
        { x: 8, y: 20 },
        { x: 40, y: 20 },
        { x: 8, y: 20 },
      ),
    ).toEqual({ x: 40, y: 20 });
  });

  it("keeps the default viewport-anchored position responsive", () => {
    expect(
      preserveDevSwitcherAnchorPosition(
        null,
        { x: 40, y: 20 },
        { x: 8, y: 20 },
      ),
    ).toBeNull();
  });
});

describe("DevRoleSwitcher", () => {
  it("opens expanded controls in a badge-anchored flyout", () => {
    localStorage.setItem("dev-role-switcher-collapsed", "1");

    render(<DevRoleSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "แสดงตัวสลับบทบาท" }));

    const flyout = screen.getByRole("button", { name: "Admin" }).closest("[data-dev-role-switcher-flyout]");
    expect(flyout).toBeInTheDocument();
    expect(flyout).toHaveClass("absolute", "right-0", "top-full");
  });
});
