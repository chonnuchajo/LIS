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

const getUserFavorites = vi.fn();

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
    getUserFavorites: (...args: unknown[]) => getUserFavorites(...args),
    saveUserFavorites: vi.fn().mockResolvedValue({ email: "admin@example.com", paths: [] }),
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
    getUserFavorites.mockResolvedValue({ email: "admin@example.com", paths: [] });
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

  it("ไม่แสดงกลุ่มรายการโปรดเมื่อยังไม่มีรายการโปรด", async () => {
    renderSidebar();

    await screen.findByPlaceholderText("ค้นหาเมนู...");
    expect(screen.queryByText("รายการโปรด")).not.toBeInTheDocument();
  });

  it("แสดงกลุ่มรายการโปรดบนสุดตามลำดับที่เก็บไว้", async () => {
    getUserFavorites.mockResolvedValue({
      email: "admin@example.com",
      paths: ["/stock", "/petition"],
    });
    const { container } = renderSidebar();

    await screen.findByText("รายการโปรด");

    const nav = getSidebarNav(container);
    const headings = Array.from(nav.querySelectorAll("button > span.truncate")).map(
      (el) => el.textContent,
    );
    expect(headings[0]).toBe("รายการโปรด");

    const links = Array.from(nav.querySelectorAll("a")).map((el) => el.getAttribute("href"));
    expect(links.slice(0, 2)).toEqual(["/stock", "/petition"]);
  });

  it("ไม่แสดงรายการโปรดที่ชี้ path ซึ่งไม่มีใน NAV_ITEMS", async () => {
    getUserFavorites.mockResolvedValue({
      email: "admin@example.com",
      paths: ["/ไม่มีหน้านี้แล้ว"],
    });
    renderSidebar();

    await screen.findByPlaceholderText("ค้นหาเมนู...");
    expect(screen.queryByText("รายการโปรด")).not.toBeInTheDocument();
  });
});
