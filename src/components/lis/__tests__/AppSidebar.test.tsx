import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AppSidebar from "../AppSidebar";

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      email: "admin@example.com",
      name: "Admin",
      roles: ["admin"],
      status: "active",
    },
    logout: vi.fn(),
  }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn().mockResolvedValue({
      data: {
        data: {
          roles: [{ id: "admin", name: "Admin" }],
          groups: [],
          permissions: {},
        },
      },
    }),
  },
}));

function renderSidebar() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/home"]}>
        <AppSidebar />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function getSidebarNav(container: HTMLElement) {
  const nav = container.querySelector("nav");
  if (!nav) throw new Error("Sidebar nav not found");
  return nav;
}

describe("AppSidebar", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("restores the desktop nav scroll position after remounting during route changes", () => {
    const first = renderSidebar();
    const firstNav = getSidebarNav(first.container);

    firstNav.scrollTop = 180;
    fireEvent.scroll(firstNav);
    first.unmount();

    const second = renderSidebar();
    const secondNav = getSidebarNav(second.container);

    expect(secondNav.scrollTop).toBe(180);
  });

  it("does not render the user profile in the sidebar footer", () => {
    renderSidebar();

    expect(screen.queryByText("admin@example.com")).not.toBeInTheDocument();
  });

  it("renders a larger icon in the desktop sidebar collapse toggle", () => {
    const { container } = renderSidebar();
    const toggle = container.querySelector("aside > button");
    if (!toggle) throw new Error("Sidebar collapse toggle not found");

    const icon = toggle.querySelector("svg");
    if (!icon) throw new Error("Sidebar collapse toggle icon not found");

    expect(icon).toHaveClass("w-5", "h-5");
  });

  it("keeps the desktop sidebar collapse toggle raised off the nav edge", () => {
    const { container } = renderSidebar();
    const toggle = container.querySelector("aside > button");
    if (!toggle) throw new Error("Sidebar collapse toggle not found");

    expect(toggle).toHaveClass("z-40", "w-8", "h-8", "-right-4", "ring-4", "ring-background", "shadow-md");
  });
});
