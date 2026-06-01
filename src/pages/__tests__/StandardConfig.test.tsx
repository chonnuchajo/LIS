import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import StandardConfig from "../StandardConfig";

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

const defaultRows = [
  { _id: "d1", instrument: "GC", scope: "all", commonName: null, commonNameLower: null, times: 3, isDefault: true, note: "" },
  { _id: "d2", instrument: "HPLC", scope: "all", commonName: null, commonNameLower: null, times: 1, isDefault: true, note: "" },
];

beforeEach(() => {
  vi.clearAllMocks();
  (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: [] } });
});

describe("StandardConfig page", () => {
  it("renders default rows with a non-deletable badge", async () => {
    (api.getStandardConfigs as ReturnType<typeof vi.fn>).mockResolvedValue(defaultRows);
    renderPage();
    expect(await screen.findAllByText("ค่าตั้งต้น")).toHaveLength(2);
    expect(screen.getByText("3 ครั้ง")).toBeInTheDocument();
    expect(screen.getByText("1 ครั้ง")).toBeInTheDocument();
    // defaults have no delete button
    expect(screen.queryByLabelText("ลบ")).not.toBeInTheDocument();
  });

  it("creates a substance row from the add form", async () => {
    (api.getStandardConfigs as ReturnType<typeof vi.fn>).mockResolvedValue(defaultRows);
    (api.createStandardConfig as ReturnType<typeof vi.fn>).mockResolvedValue({});
    renderPage();

    fireEvent.click(await screen.findByText("เพิ่มสาร"));
    fireEvent.change(screen.getByPlaceholderText("เลือกชื่อสารจากรายการ"), {
      target: { value: "GLYPHOSATE" },
    });
    fireEvent.change(screen.getByLabelText("จำนวนครั้ง *"), { target: { value: "4" } });
    fireEvent.click(screen.getByText("บันทึก"));

    await waitFor(() =>
      expect(api.createStandardConfig).toHaveBeenCalledWith({
        instrument: "GC",
        scope: "substance",
        commonName: "GLYPHOSATE",
        times: 4,
        note: "",
      }),
    );
  });

  it("blocks submit when commonName is empty for a substance", async () => {
    (api.getStandardConfigs as ReturnType<typeof vi.fn>).mockResolvedValue(defaultRows);
    renderPage();
    fireEvent.click(await screen.findByText("เพิ่มสาร"));
    fireEvent.change(screen.getByLabelText("จำนวนครั้ง *"), { target: { value: "2" } });
    fireEvent.click(screen.getByText("บันทึก"));
    await screen.findByText(/กรุณาเลือกสาร/);
    expect(api.createStandardConfig).not.toHaveBeenCalled();
  });

  it("locks instrument + target when editing a default row", async () => {
    (api.getStandardConfigs as ReturnType<typeof vi.fn>).mockResolvedValue(defaultRows);
    (api.updateStandardConfig as ReturnType<typeof vi.fn>).mockResolvedValue({});
    renderPage();

    // first edit button = GC default (rows are sorted defaults-first)
    const editButtons = await screen.findAllByLabelText("แก้ไข");
    fireEvent.click(editButtons[0]);

    expect(await screen.findByText(/แก้ค่าตั้งต้น/)).toBeInTheDocument();
    expect(screen.getByDisplayValue("ทั้งหมด (ค่าตั้งต้น)")).toBeDisabled();

    fireEvent.change(screen.getByLabelText("จำนวนครั้ง *"), { target: { value: "5" } });
    fireEvent.click(screen.getByText("บันทึก"));
    await waitFor(() =>
      expect(api.updateStandardConfig).toHaveBeenCalledWith("d1", { times: 5, note: "" }),
    );
  });
});
