import { useEffect } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { NotificationProvider, useNotifications } from "@/context/NotificationContext";
import NotificationBell from "../NotificationBell";

let authUser = { employeeId: "E001", email: "admin@example.com", name: "Admin", roles: ["admin"] };

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: authUser,
    logout: vi.fn(),
  }),
}));

function SeededNotificationBell({ count = 2 }: { count?: number }) {
  const { push } = useNotifications();

  useEffect(() => {
    for (let index = 1; index <= count; index += 1) {
      push({ id: `unread-${index}`, title: `แจ้งเตือนที่ ${index}`, level: index === 1 ? "info" : "warning" });
    }
  }, [count, push]);

  return <NotificationBell />;
}

function renderBell(count?: number) {
  return render(
    <MemoryRouter>
      <NotificationProvider>
        <SeededNotificationBell count={count} />
      </NotificationProvider>
    </MemoryRouter>,
  );
}

describe("NotificationBell open behavior", () => {
  beforeEach(() => {
    localStorage.clear();
    authUser = { employeeId: "E001", email: "admin@example.com", name: "Admin", roles: ["admin"] };
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("hides the unread badge when the bell is clicked", async () => {
    renderBell();

    expect(await screen.findByText("2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "การแจ้งเตือน" }));

    await waitFor(() => {
      expect(screen.queryByText("2")).not.toBeInTheDocument();
    });
  });

  it("blurs the page behind the notification panel while open", async () => {
    renderBell();

    expect(await screen.findByText("2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "การแจ้งเตือน" }));

    expect(screen.getByTestId("notification-blur-backdrop")).toHaveClass(
      "fixed",
      "inset-0",
      "bg-background/60",
      "backdrop-blur-sm",
    );
  });

  it("loads persisted notifications only for the current employee", async () => {
    localStorage.setItem(
      "lis.notifications.v1",
      JSON.stringify([
        {
          id: "other-user",
          title: "แจ้งเตือนของคนอื่น",
          level: "info",
          createdAt: 1,
          read: false,
          persistent: true,
        },
      ]),
    );

    render(
      <MemoryRouter>
        <NotificationProvider>
          <NotificationBell />
        </NotificationProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "การแจ้งเตือน" }));

    expect(screen.queryByText("แจ้งเตือนของคนอื่น")).not.toBeInTheDocument();
    expect(screen.getByText("ยังไม่มีการแจ้งเตือน")).toBeInTheDocument();
  });

  it("keeps long notification history in a scrollable list", async () => {
    renderBell(12);

    expect(await screen.findByText("9+")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "การแจ้งเตือน" }));

    const list = screen.getByTestId("notification-scroll-list");
    expect(list).toHaveClass("overflow-y-auto", "max-h-[calc(100vh-12rem)]", "md:max-h-[400px]");
    expect(screen.getByText("แจ้งเตือนที่ 1")).toBeInTheDocument();
    expect(screen.getByText("แจ้งเตือนที่ 12")).toBeInTheDocument();
  });
});
