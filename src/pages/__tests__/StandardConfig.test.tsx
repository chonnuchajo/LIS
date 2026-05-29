import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import StandardConfig from "../StandardConfig";

// Mock AppLayout to avoid router/auth/MSAL dependencies deep in the sidebar
vi.mock("@/components/lis/AppLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/api", () => ({
  api: {
    getStandardConfigs: vi.fn(),
    createStandardConfig: vi.fn(),
    updateStandardConfig: vi.fn(),
    deleteStandardConfig: vi.fn(),
    get: vi.fn(),
  },
}));

import { api } from "@/lib/api";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <StandardConfig />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // api.get is used for master-items; return empty payload
  (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: [] } });
});

describe("StandardConfig page", () => {
  it("renders existing rows", async () => {
    (api.getStandardConfigs as ReturnType<typeof vi.fn>).mockResolvedValue([
      { _id: "1", keyword: "ANILOFOS", keywordLower: "anilofos", gcTimes: 3, hplcTimes: null, note: "" },
    ]);
    renderPage();
    expect(await screen.findByText("ANILOFOS")).toBeInTheDocument();
    expect(screen.getByText("3 ครั้ง")).toBeInTheDocument();
  });

  it("creates a config from the add form", async () => {
    (api.getStandardConfigs as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (api.createStandardConfig as ReturnType<typeof vi.fn>).mockResolvedValue({});
    renderPage();

    fireEvent.click(await screen.findByText("เพิ่ม Standard"));
    fireEvent.change(
      screen.getByPlaceholderText(/match แบบมีคำนี้อยู่ในชื่อ/),
      { target: { value: "GLYPHOSATE" } },
    );
    fireEvent.change(screen.getByLabelText("GC — จำนวนครั้ง"), { target: { value: "2" } });
    fireEvent.click(screen.getByText("บันทึก"));

    await waitFor(() =>
      expect(api.createStandardConfig).toHaveBeenCalledWith({
        keyword: "GLYPHOSATE",
        gcTimes: 2,
        hplcTimes: null,
        note: "",
      }),
    );
  });

  it("blocks submit when neither instrument has times", async () => {
    (api.getStandardConfigs as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    renderPage();
    fireEvent.click(await screen.findByText("เพิ่ม Standard"));
    fireEvent.change(
      screen.getByPlaceholderText(/match แบบมีคำนี้อยู่ในชื่อ/),
      { target: { value: "ABC" } },
    );
    fireEvent.click(screen.getByText("บันทึก"));
    await screen.findByText(/อย่างน้อย 1 เครื่อง \(GC หรือ HPLC\)/);
    expect(api.createStandardConfig).not.toHaveBeenCalled();
  });
});
