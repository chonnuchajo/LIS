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

function SeededNotificationBell() {
  const { push } = useNotifications();

  useEffect(() => {
    push({ id: "unread-one", title: "แจ้งเตือนที่หนึ่ง", level: "info" });
    push({ id: "unread-two", title: "แจ้งเตือนที่สอง", level: "warning" });
  }, [push]);

  return <NotificationBell />;
}

function renderBell() {
  return render(
    <MemoryRouter>
      <NotificationProvider>
        <SeededNotificationBell />
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
});
