import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import UserProfileMenu from "../UserProfileMenu";

vi.mock("@/context/AuthContext", () => ({
  useAuth: vi.fn(),
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
