import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import PrintPreviewDialog from "./PrintPreviewDialog";

const apiMock = vi.hoisted(() => ({
  getPrinterConfigs: vi.fn(),
}));
const printDocumentMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { department: "QC" } }) }));
vi.mock("@/lib/api", () => ({ api: apiMock }));
vi.mock("@/lib/print", () => ({ printDocument: printDocumentMock }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderDialog(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("PrintPreviewDialog auto print", () => {
  it("prints once when opened with autoPrint and a configured stock-label printer", async () => {
    apiMock.getPrinterConfigs.mockResolvedValue([
      {
        id: "printer-1",
        kind: "sticker",
        label: "Sticker",
        cupsPrinterUrl: "ipp://printer/sticker",
        isDefault: true,
        assignments: [{ department: "QC", docTypes: ["stock-label"], paperSize: "label-65x25" }],
      },
    ]);
    printDocumentMock.mockResolvedValue({ printer: "Sticker", copies: 1 });

    renderDialog(
      <PrintPreviewDialog
        open
        onOpenChange={vi.fn()}
        docType="stock-label"
        autoPrint
        autoPrintKey="receive-job-1"
      >
        <div>stock label html</div>
      </PrintPreviewDialog>,
    );

    await waitFor(() => expect(printDocumentMock).toHaveBeenCalledTimes(1));
    expect(printDocumentMock).toHaveBeenCalledWith(
      "stock-label",
      expect.any(HTMLDivElement),
      expect.objectContaining({
        outputMode: "server",
        printerConfigId: "printer-1",
        paperSize: "label-65x25",
      }),
    );
  });
});
