import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DailyCheckLayout from "../DailyCheckLayout";

// ── Minimal provider stubs ────────────────────────────────────────────────────
// AppLayout → AppSidebar calls useAuth() and useQuery(); NotificationBell calls
// useNotifications(). These three mocks satisfy all three requirements without
// wiring up MSAL, a real backend, or the full notification system.

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: null, login: vi.fn(), logout: vi.fn() }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
  NotificationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderAt(path: string) {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/daily-check" element={<DailyCheckLayout />}>
            <Route index element={<div>summary-body</div>} />
            <Route path="analysis" element={<div>analysis-body</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("DailyCheckLayout", () => {
  it("renders the four-room tab strip", () => {
    renderAt("/daily-check/analysis");
    const tablist = screen.getByRole("tablist", { name: "ห้องปฏิบัติการ" });
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs.map((t) => t.textContent?.trim())).toEqual([
      "ห้องเครื่องชั่ง",
      "ห้องเตรียมตัวอย่าง",
      "ห้องวิเคราะห์",
      "ห้องสกัด",
    ]);
  });

  it("marks the matching room tab active on a sub-route", () => {
    renderAt("/daily-check/analysis");
    expect(screen.getByRole("tab", { name: "ห้องวิเคราะห์" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("analysis-body")).toBeInTheDocument();
  });
});
