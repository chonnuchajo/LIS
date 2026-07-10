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
});
