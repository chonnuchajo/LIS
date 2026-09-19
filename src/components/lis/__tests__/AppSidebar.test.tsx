import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AppSidebar from "../AppSidebar";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";

const ADMIN_USER = {
  email: "admin@example.com",
  name: "Admin",
  roles: ["admin"],
  status: "active",
};

const DEFAULT_ACCESS_CONTROL = {
  data: {
    data: {
      roles: [{ id: "admin", name: "Admin" }],
      groups: [],
      permissions: {},
    },
  },
};

// useAuth/api.get เป็น vi.fn() (ไม่ใช่ arrow function เปล่า) เพื่อให้เทสต์รายตัว override ด้วย
// mockReturnValue/mockResolvedValue ได้ — จำเป็นสำหรับเคส non-admin ของ Fix 4
vi.mock("@/context/AuthContext", () => ({
  useAuth: vi.fn(() => ({ user: ADMIN_USER, logout: vi.fn() })),
}));

const getUserFavorites = vi.fn();

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    getUserFavorites: (...args: unknown[]) => getUserFavorites(...args),
    saveUserFavorites: vi.fn().mockResolvedValue({ email: "admin@example.com", paths: [] }),
  },
}));

function renderSidebar(props?: React.ComponentProps<typeof AppSidebar>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/home"]}>
        <AppSidebar {...props} />
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
    vi.mocked(useAuth).mockReturnValue({ user: ADMIN_USER, logout: vi.fn() });
    vi.mocked(api.get).mockResolvedValue(DEFAULT_ACCESS_CONTROL);
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

  it("does not clip the desktop collapse toggle where it overhangs the rail", () => {
    const { container } = renderSidebar();
    const aside = container.querySelector("aside");
    if (!aside) throw new Error("Sidebar aside not found");

    expect(aside).toHaveClass("overflow-visible");
    expect(aside).not.toHaveClass("overflow-hidden");
  });

  it("keeps the drawer sidebar clipped so mobile content cannot spill out", () => {
    const { container } = renderSidebar({ variant: "drawer" });
    const aside = container.querySelector("aside");
    if (!aside) throw new Error("Sidebar aside not found");

    expect(aside).toHaveClass("overflow-hidden");
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

  it("แสดง Assign Lab แค่ครั้งเดียวเมื่อกลุ่มมี /petition/:id และ /petition/assign", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        data: {
          roles: [{ id: "admin", name: "Admin" }],
          groups: [
            {
              id: "samples",
              name: "งานตัวอย่าง",
              paths: ["/petition", "/petition/:id"],
              sortOrder: 10,
            },
            {
              id: "lab",
              name: "LAB",
              paths: ["/petition/assign"],
              sortOrder: 20,
            },
          ],
          permissions: {},
        },
      },
    });
    const { container } = renderSidebar();

    await screen.findByText("LAB");

    const nav = getSidebarNav(container);
    expect(nav.querySelectorAll('a[href="/petition/assign"]')).toHaveLength(1);
  });

  it("รายการที่ถูกเพิ่มเป็นโปรดโผล่สองที่ — กลุ่มรายการโปรด และกลุ่มเดิม", async () => {
    getUserFavorites.mockResolvedValue({
      email: "admin@example.com",
      paths: ["/stock"],
    });
    const { container } = renderSidebar();

    await screen.findByText("รายการโปรด");

    const nav = getSidebarNav(container);
    const stockLinks = nav.querySelectorAll('a[href="/stock"]');
    expect(stockLinks).toHaveLength(2);
  });

  it("ไม่แสดงกลุ่มรายการโปรดเมื่อ user เสียสิทธิ์เข้าถึง path ที่บันทึกไว้เป็นรายการโปรด (non-admin)", async () => {
    // roles=["admin"] ข้ามทุก access check — ต้องใช้ fixture non-admin ที่ permissions
    // ไม่ครอบ path ที่เป็นรายการโปรด ถึงจะทดสอบเส้นทางนี้ได้จริง
    vi.mocked(useAuth).mockReturnValue({
      user: {
        email: "analyst@example.com",
        name: "Analyst",
        roles: ["lab-analyze"],
        status: "active",
      },
      logout: vi.fn(),
    });
    vi.mocked(api.get).mockResolvedValue({
      data: {
        data: {
          roles: [{ id: "lab-analyze", name: "Lab Analyst" }],
          groups: [],
          // ไม่มี /stock ในสิทธิ์ของ lab-analyze
          permissions: { "lab-analyze": ["/petition"] },
        },
      },
    });
    getUserFavorites.mockResolvedValue({
      email: "analyst@example.com",
      paths: ["/stock"],
    });

    renderSidebar();

    // sanity: หน้าเมนูโหลดสำเร็จและมีอย่างน้อยหนึ่งรายการที่มีสิทธิ์ขึ้นจริง
    await screen.findByText("รายการคำร้อง");
    expect(screen.queryByText("รายการโปรด")).not.toBeInTheDocument();
  });
});
