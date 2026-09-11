import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import EnvironmentCheckPage from "../EnvironmentCheckPage";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const state = vi.hoisted(() => ({
  user: { name: "Dev Administrator", id: "dev", email: "dev@example.com" },
}));

const apiMock = vi.hoisted(() => ({
  getEnvChecks: vi.fn().mockResolvedValue([]),
  getLiveTempHum: vi.fn().mockResolvedValue([]),
  getEnvRoomConfigs: vi.fn().mockResolvedValue([]),
  createEnvCheck: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: apiMock,
}));

vi.mock("@/lib/dailyCheckPeriod", () => ({
  getCurrentDailyCheckPeriod: () => "morning",
  getDailyCheckPeriod: () => "morning",
  getDailyCheckPeriodLabel: (period: string | null | undefined) => (period === "morning" ? "เช้า" : "นอกเวลา"),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: state.user }),
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
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.getEnvChecks.mockResolvedValue([]);
    apiMock.getLiveTempHum.mockResolvedValue([]);
    apiMock.getEnvRoomConfigs.mockResolvedValue([]);
  });

  it("renders a card for each of the 3 env rooms", () => {
    renderPage();
    expect(screen.getByText("ห้องชั่งสาร")).toBeInTheDocument();
    expect(screen.getByText("ห้องเตรียมตัวอย่าง")).toBeInTheDocument();
    expect(screen.getByText("ห้องวิเคราะห์")).toBeInTheDocument();
  });

  it("does not show an inline records tab", () => {
    renderPage();
    expect(screen.queryByRole("tab", { name: /รายการบันทึก/ })).not.toBeInTheDocument();
  });

  it("shows the saved recorder when a room already has a record", async () => {
    apiMock.getEnvChecks.mockResolvedValue([
      {
        _id: "env-1",
        room: "sample-prep",
        roomName: "ห้องเตรียมตัวอย่าง",
        temperature: 22.9,
        humidity: 60.3,
        tempMin: 15,
        tempMax: 25,
        humidityMax: 70,
        tempStatus: "pass",
        humidityStatus: "pass",
        status: "pass",
        note: "",
        recorder: "นางสาวเกศนภา สิริเหล่าตระกูล",
        recorderId: "actual",
        recorderEmail: "actual@example.com",
        date: "2026-08-28",
        period: "morning",
        checkedAt: "2026-08-28T08:55:00",
      },
    ]);

    renderPage();

    expect(await screen.findByDisplayValue("นางสาวเกศนภา สิริเหล่าตระกูล")).toBeInTheDocument();
  });
});
