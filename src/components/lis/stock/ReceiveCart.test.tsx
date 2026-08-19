import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
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

  it("renders the receiving controls with readable Thai text", () => {
    renderReceiveCart();

    expect(screen.getByRole("heading", { name: "รับเข้า stock (หลายรายการ)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /เพิ่มแถว/ })).toBeInTheDocument();
    expect(screen.getByLabelText("สแกน Barcode รับเข้า")).toHaveAttribute(
      "placeholder",
      "สแกน/กรอก Barcode แล้วกด Enter",
    );
    expect(screen.getByRole("button", { name: "เพิ่มจาก Barcode" })).toBeInTheDocument();
    expect(screen.getByText("ปริ้นลาเบลหลังรับเข้า (standard + สารเคมี)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "รับเข้าทั้งหมด (0 รายการ)" })).toBeDisabled();
  });

  it("does not contain known Thai mojibake sequences", () => {
    const source = readFileSync(resolve("src/components/lis/stock/ReceiveCart.tsx"), "utf8");

    expect(source).not.toMatch(/เธ|เน[€-]|โ€”|ยท/);
  });
});


