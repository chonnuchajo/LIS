import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ReceiveCart from "./ReceiveCart";

const apiMock = vi.hoisted(() => ({
  getStandards: vi.fn(),
  getSolvents: vi.fn(),
  getGlassware: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: apiMock }));

vi.mock("@/components/lis/StockQrScanner", () => ({
  default: () => null,
}));

vi.mock("@/components/lis/StockRawLabelPreviewDialog", () => ({
  default: () => null,
}));

vi.mock("@/components/lis/stock/StockPhotoUploader", () => ({
  default: ({ label }: { label: string }) => <div>{label}</div>,
}));

function renderReceiveCart() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <ReceiveCart />
    </QueryClientProvider>,
  );
}

describe("ReceiveCart Thai copy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.getStandards.mockResolvedValue([]);
    apiMock.getSolvents.mockResolvedValue([]);
    apiMock.getGlassware.mockResolvedValue([]);
  });

  it("renders the simplified receive flow copy", () => {
    renderReceiveCart();

    expect(screen.getByRole("heading", { name: "รับเข้า Stock" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /เพิ่มแถว/ })).not.toBeInTheDocument();
    expect(screen.getByText("เพิ่มรายการรับเข้า")).toBeInTheDocument();
    expect(screen.getByLabelText("ค้นหา / สแกน Barcode")).toHaveAttribute(
      "placeholder",
      "สแกน Barcode หรือพิมพ์ชื่อ/code แล้วกด Enter",
    );
    expect(screen.getByText("สามารถสแกน Barcode ต่อเนื่องได้เลย")).toBeInTheDocument();
    expect(screen.getByText("รายการที่จะรับเข้า")).toBeInTheDocument();
    expect(screen.getByText("0 รายการ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "รับเข้าทั้งหมด (0 รายการ)" })).toBeDisabled();
  });

  it("adds a scanned stock item directly to the receive list", async () => {
    apiMock.getStandards.mockResolvedValue([
      { _id: "std1", code: "STD-001", name: "ABAMECTIN", barcodes: [], primary: {}, supplier: {}, working: {} },
    ]);
    renderReceiveCart();

    fireEvent.change(await screen.findByLabelText("ค้นหา / สแกน Barcode"), { target: { value: "STD-001" } });
    fireEvent.click(screen.getByRole("button", { name: "เพิ่มรายการ" }));

    expect(await screen.findByRole("cell", { name: "ABAMECTIN" })).toBeInTheDocument();
    expect(screen.getByText("1 รายการ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /แก้ไข ABAMECTIN/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ลบ ABAMECTIN/ })).toBeInTheDocument();
  });

  it("does not contain known Thai mojibake sequences", () => {
    const source = readFileSync(resolve("src/components/lis/stock/ReceiveCart.tsx"), "utf8");

    expect(source).not.toMatch(/เธ|เน[€-]|โ€”|ยท/);
  });
});
