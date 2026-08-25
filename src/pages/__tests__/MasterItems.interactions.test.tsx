import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MasterItems from "../MasterItems";
import { api, uploadQcPhoto } from "@/lib/api";

vi.mock("@/components/lis/AppLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/lis/ItemGroupManagerDialog", () => ({
  default: () => null,
}));

vi.mock("@/hooks/useItemGroupMembership", () => ({
  useItemGroupMembership: () => new Map<string, string[]>(),
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    getParameters: vi.fn(),
    exportMasterItems: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
  },
  uploadQcPhoto: vi.fn(),
  deleteQcPhoto: vi.fn(),
}));

const masterItem = {
  item_no: "FG-001",
  item_name1: "Test Product",
  common_name: "Cypermethrin",
  inventory_posting_group: "FINISHED",
  base_unit_of_mea: "BTL",
  kg_per_carton: 12,
  unitsPerCarton: 24,
  measureSize: 1,
  measureUnit: "L",
};

function renderMasterItems() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MasterItems />
    </QueryClientProvider>,
  );
}

describe("MasterItems interactions", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation(async (path: string) => {
      if (path === "/master-items") return { data: { data: [masterItem] } };
      if (path === "/master-item-meta") return { data: { data: [] } };
      if (path === "/common-name-overrides") return { data: { data: [] } };
      if (path === "/item-groups") return { data: { data: [] } };
      return { data: { data: [] } };
    });
    vi.mocked(api.getParameters).mockResolvedValue([]);
    vi.mocked(uploadQcPhoto).mockResolvedValue({ url: "/LIS/uploads/qc-photos/master-item.webp" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens item details on row single click", async () => {
    renderMasterItems();

    const codeCell = await screen.findByText("FG-001");
    const row = codeCell.closest("tr");
    expect(row).not.toBeNull();

    vi.useFakeTimers();
    fireEvent.click(row!);
    expect(screen.queryByText("Kg/Unit")).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.getByText("Kg/Unit")).toBeInTheDocument();
  });

  it("opens item details after a real double-click sequence", async () => {
    renderMasterItems();

    const codeCell = await screen.findByText("FG-001");
    const row = codeCell.closest("tr");
    expect(row).not.toBeNull();

    vi.useFakeTimers();
    fireEvent.click(row!, { detail: 1 });
    expect(screen.queryByText("Kg/Unit")).not.toBeInTheDocument();

    fireEvent.click(row!, { detail: 2 });
    fireEvent.doubleClick(row!);
    expect(screen.getByText("Kg/Unit")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.getByText("Kg/Unit")).toBeInTheDocument();
  });

  it("opens the edit form from the detail header pencil action", async () => {
    renderMasterItems();

    const row = (await screen.findByText("FG-001")).closest("tr");
    expect(row).not.toBeNull();

    fireEvent.doubleClick(row!);
    const editButton = await screen.findByLabelText("แก้ไข item จากแถบรายละเอียด");
    fireEvent.click(editButton);

    expect(await screen.findByDisplayValue("FG-001")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Cypermethrin")).toBeDisabled();
  });

  it("calculates gross kg per unit from kg and units per carton", async () => {
    renderMasterItems();

    await screen.findByText("FG-001");
    const addButton = screen.getAllByRole("button").find((button) => button.querySelector(".lucide-plus"));
    expect(addButton).toBeDefined();
    fireEvent.click(addButton!);

    fireEvent.change(await screen.findByLabelText("Kg/Carton"), { target: { value: "18" } });
    fireEvent.change(await screen.findByLabelText("Units/Carton"), { target: { value: "12" } });

    expect(screen.getByLabelText("Gross Kg/Unit")).toHaveValue(1.5);
  });

  it("saves uploaded product image URLs with the master item metadata", async () => {
    vi.mocked(uploadQcPhoto)
      .mockResolvedValueOnce({ url: "/LIS/uploads/qc-photos/master-item-1.webp" })
      .mockResolvedValueOnce({ url: "/LIS/uploads/qc-photos/master-item-2.webp" });

    renderMasterItems();

    await screen.findByText("FG-001");
    fireEvent.click(screen.getByRole("button", { name: /เพิ่มสินค้า/ }));

    fireEvent.change(await screen.findByLabelText("Code"), { target: { value: "FG-002" } });
    fireEvent.change(screen.getByLabelText("ชื่อ Item"), { target: { value: "Product With Photo" } });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    fireEvent.change(input!, {
      target: {
        files: [
          new File(["photo-1"], "product-1.webp", { type: "image/webp" }),
          new File(["photo-2"], "product-2.webp", { type: "image/webp" }),
        ],
      },
    });

    await waitFor(() => expect(uploadQcPhoto).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith(
        "/master-item-meta/FG-002",
        expect.objectContaining({
          imageUrl: "/LIS/uploads/qc-photos/master-item-1.webp",
          imageUrls: [
            "/LIS/uploads/qc-photos/master-item-1.webp",
            "/LIS/uploads/qc-photos/master-item-2.webp",
          ],
        }),
      );
    });
  });
});
