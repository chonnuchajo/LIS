import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import SettingsPage from "../SettingsPage";

vi.mock("@/components/lis/AppLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/api", () => ({
  api: {
    getEnvRoomConfigs: vi.fn().mockResolvedValue([]),
    getLiveTempHum: vi.fn().mockResolvedValue([]),
    updateEnvRoomConfig: vi.fn(),
    getPrintConfigs: vi.fn().mockResolvedValue([]),
    getPrinters: vi.fn().mockResolvedValue([]),
    updatePrintConfig: vi.fn(),
  },
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <SettingsPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("SettingsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a config card for each of the 3 env rooms", async () => {
    renderPage();
    expect(await screen.findByText("ห้องชั่งสาร")).toBeInTheDocument();
    expect(screen.getByText("ห้องเตรียมตัวอย่าง")).toBeInTheDocument();
    expect(screen.getByText("ห้องวิเคราะห์")).toBeInTheDocument();
  });

  it("shows a board selector and threshold inputs per room", async () => {
    renderPage();
    expect(await screen.findAllByText("เซนเซอร์ (board)")).toHaveLength(3);
    expect(screen.getAllByText("อุณหภูมิต่ำสุด (°C)")).toHaveLength(3);
    expect(screen.getAllByText("ความชื้นสูงสุด (%RH)")).toHaveLength(3);
  });
});
