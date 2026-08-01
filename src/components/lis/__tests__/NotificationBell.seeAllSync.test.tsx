import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import NotificationBell from "../NotificationBell";
import { readSeeAll } from "@/lib/petitionAudience";

// AppLayout mounts NotificationBell twice at once (mobile header + desktop header,
// only CSS-toggled by breakpoint) — both instances are alive in the DOM
// simultaneously. This test renders two real instances side by side (no mocking
// of petitionAudience — it's real localStorage + a real window event) to prove
// that toggling the switch through one instance resyncs the other via
// SEE_ALL_EVENT, not just at mount time.

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { email: "admin@example.com", name: "Admin", roles: ["admin"] },
    logout: vi.fn(),
  }),
}));

vi.mock("@/context/NotificationContext", () => ({
  useNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    push: vi.fn(),
    dismiss: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    clearAll: vi.fn(),
  }),
}));

function renderTwoBells() {
  return render(
    <MemoryRouter>
      <NotificationBell />
      <NotificationBell />
    </MemoryRouter>,
  );
}

describe("NotificationBell see-all switch — cross-instance sync", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("toggling the switch on one mounted bell resyncs the still-mounted other bell", () => {
    renderTwoBells();

    const bellButtons = screen.getAllByRole("button", { name: "การแจ้งเตือน" });
    expect(bellButtons).toHaveLength(2);

    // เปิด bell แรก แล้วเปิดสวิตช์ "ดูแจ้งเตือนทั้งระบบ"
    fireEvent.click(bellButtons[0]);
    const firstSwitch = screen.getByRole("switch");
    expect(firstSwitch).toHaveAttribute("aria-checked", "false");

    fireEvent.click(firstSwitch);
    expect(firstSwitch).toHaveAttribute("aria-checked", "true");
    expect(readSeeAll()).toBe(true);

    // ปิด popover แรก แล้วเปิด bell ที่สอง — instance นี้ mount มาตั้งแต่ต้น
    // (ไม่ใช่เพิ่งสร้างใหม่) ดังนั้นถ้าไม่ฟัง SEE_ALL_EVENT จะยังโชว์ค่าตอน mount (false)
    fireEvent.click(bellButtons[0]);
    fireEvent.click(bellButtons[1]);

    const secondSwitch = screen.getByRole("switch");
    expect(secondSwitch).toHaveAttribute("aria-checked", "true");
  });
});
