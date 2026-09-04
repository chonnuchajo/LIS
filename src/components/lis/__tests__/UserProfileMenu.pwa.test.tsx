import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import UserProfileMenu from "../UserProfileMenu";

const { toastError } = vi.hoisted(() => ({
  toastError: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
    success: vi.fn(),
  },
}));

function renderMenu() {
  return render(
    <MemoryRouter initialEntries={["/home"]}>
      <UserProfileMenu />
    </MemoryRouter>,
  );
}

describe("UserProfileMenu PWA accounts", () => {
  const logout = vi.fn();
  const addAccount = vi.fn();
  const switchAccount = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: {
        email: "first@example.com",
        name: "First User",
        roles: ["admin"],
        department: "IT",
        position: "Developer",
        status: "active",
      },
      logout,
      isPwa: true,
      activeAccountId: "home-1",
      accounts: [
        { id: "home-1", email: "first@example.com", name: "First User" },
        { id: "home-2", email: "second@example.com", name: "Second User" },
      ],
      switchAccount,
      addAccount,
    } as never);
  });

  it("shows PWA-only account switching actions", async () => {
    renderMenu();

    fireEvent.click(screen.getByRole("button", { name: "User profile" }));

    expect(await screen.findByText("Switch account")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Second User/ }));

    expect(switchAccount).toHaveBeenCalledWith("home-2");
  });

  it("hides account switching outside PWA standalone mode", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        email: "first@example.com",
        name: "First User",
        roles: ["admin"],
        department: "IT",
        position: "Developer",
        status: "active",
      },
      logout,
      isPwa: false,
      activeAccountId: "home-1",
      accounts: [
        { id: "home-1", email: "first@example.com", name: "First User" },
        { id: "home-2", email: "second@example.com", name: "Second User" },
      ],
      switchAccount,
      addAccount,
    } as never);

    renderMenu();

    fireEvent.click(screen.getByRole("button", { name: "User profile" }));

    expect(screen.queryByText("Switch account")).not.toBeInTheDocument();
  });
});

describe("UserProfileMenu signature entry", () => {
  const logout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
    Object.defineProperty(navigator, "maxTouchPoints", {
      configurable: true,
      value: 0,
    });
    vi.mocked(useAuth).mockReturnValue({
      user: {
        email: "head@example.com",
        name: "Head User",
        roles: ["lab-head"],
        department: "Lab",
        position: "Head",
        status: "active",
      },
      logout,
      isPwa: false,
      activeAccountId: "",
      accounts: [],
      switchAccount: vi.fn(),
      addAccount: vi.fn(),
    } as never);
  });

  it.each(["admin", "lab-head", "qc-head"])("shows signature action for %s", (role) => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        email: `${role}@example.com`,
        name: "Approver",
        roles: [role],
        department: "Lab",
        position: "Head",
        status: "active",
      },
      logout,
      isPwa: false,
      activeAccountId: "",
      accounts: [],
      switchAccount: vi.fn(),
      addAccount: vi.fn(),
    } as never);

    renderMenu();

    fireEvent.click(screen.getByRole("button", { name: "User profile" }));

    expect(screen.getByRole("button", { name: "เพิ่มลายเซ็น" })).toBeInTheDocument();
  });

  it("hides signature action for roles outside admin and heads", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        email: "viewer@example.com",
        name: "Viewer User",
        roles: ["viewer"],
        department: "Lab",
        position: "Staff",
        status: "active",
      },
      logout,
      isPwa: false,
      activeAccountId: "",
      accounts: [],
      switchAccount: vi.fn(),
      addAccount: vi.fn(),
    } as never);

    renderMenu();

    fireEvent.click(screen.getByRole("button", { name: "User profile" }));

    expect(screen.queryByRole("button", { name: "เพิ่มลายเซ็น" })).not.toBeInTheDocument();
  });

  it("warns desktop users that signature capture needs tablet or phone", () => {
    renderMenu();

    fireEvent.click(screen.getByRole("button", { name: "User profile" }));
    fireEvent.click(screen.getByRole("button", { name: "เพิ่มลายเซ็น" }));

    expect(toastError).toHaveBeenCalledWith("โปรดเข้าใน Tablet, iPad หรือโทรศัพท์ของคุณ อุปกรณ์นี้ไม่รองรับ");
  });
});
