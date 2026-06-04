import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import EnvironmentCheckPage from "../EnvironmentCheckPage";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/api", () => ({
  api: {
    getEnvChecks: vi.fn().mockResolvedValue([]),
    getLiveTempHum: vi.fn().mockResolvedValue([]),
    createEnvCheck: vi.fn(),
  },
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { name: "Tester", id: "t1", email: "t@x.com" } }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderPage() {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <EnvironmentCheckPage />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("EnvironmentCheckPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a card for each of the 3 env rooms", () => {
    renderPage();
    expect(screen.getByText("ห้องชั่งสาร")).toBeInTheDocument();
    expect(screen.getByText("ห้องเตรียมตัวอย่าง")).toBeInTheDocument();
    expect(screen.getByText("ห้องวิเคราะห์")).toBeInTheDocument();
  });

  it("shows the record/history tabs", () => {
    renderPage();
    expect(screen.getByRole("tab", { name: /บันทึกผล/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /รายการบันทึก/ })).toBeInTheDocument();
  });
});
