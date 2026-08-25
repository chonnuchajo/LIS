import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { api } from "@/lib/api";
import SettingsPage from "../SettingsPage";

const accessibleTabsMock = vi.hoisted(() => ({ defaultKey: "environment" }));

vi.mock("@/components/lis/AppLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/api", () => ({
  api: {
    getEnvRoomConfigs: vi.fn().mockResolvedValue([]),
    getLiveTempHum: vi.fn().mockResolvedValue([]),
    updateEnvRoomConfig: vi.fn(),
    getPrinterConfigs: vi.fn().mockResolvedValue([]),
    createPrinterConfig: vi.fn().mockResolvedValue({}),
    updatePrinterConfig: vi.fn().mockResolvedValue({}),
    deletePrinterConfig: vi.fn(),
    setDefaultPrinterConfig: vi.fn(),
    testPrinterConfig: vi.fn(),
    getDocumentNumberConfigs: vi.fn().mockResolvedValue([]),
    updateDocumentNumberConfig: vi.fn(),
    get: vi.fn().mockResolvedValue({ data: { data: { roles: [], users: [] } } }),
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { role: "admin", roles: ["admin"] } }),
}));

vi.mock("@/hooks/useAccessibleTabs", () => ({
  useAccessibleTabs: () => ({
    tabs: [
      { key: "environment", label: "ห้องตรวจสภาพแวดล้อม" },
      { key: "printers", label: "เครื่องพิมพ์เอกสาร" },
      { key: "doc-numbers", label: "รหัสเอกสาร" },
      { key: "instruments", label: "เครื่องมือ/API" },
      { key: "dashboard", label: "แดชบอร์ด" },
    ],
    isVisible: () => true,
    defaultKey: accessibleTabsMock.defaultKey,
  }),
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
  beforeEach(() => {
    vi.clearAllMocks();
    accessibleTabsMock.defaultKey = "environment";
  });

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

  it("groups the settings into an environment tab and a printer tab", async () => {
    renderPage();
    expect(
      await screen.findByRole("tab", { name: "ห้องตรวจสภาพแวดล้อม" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "เครื่องพิมพ์เอกสาร" }),
    ).toBeInTheDocument();
  });

  it("sends a test print for a configured printer", async () => {
    vi.mocked(api.getPrinterConfigs).mockResolvedValueOnce([
      {
        id: "printer-1",
        kind: "sticker",
        label: "Zebra Sticker",
        cupsPrinterUrl: "192.168.1.50",
        isDefault: true,
      },
    ]);
    vi.mocked(api.testPrinterConfig).mockResolvedValueOnce({ printer: "Zebra Sticker", copies: 1 });
    accessibleTabsMock.defaultKey = "printers";

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "พิมพ์ทดสอบ" }));

    await waitFor(() => expect(api.testPrinterConfig).toHaveBeenCalledWith("printer-1"));
  });

  it("shows printer IP copy when editing a printer", async () => {
    vi.mocked(api.getPrinterConfigs).mockResolvedValueOnce([
      {
        id: "printer-1",
        kind: "a4",
        label: "Office A4",
        cupsPrinterUrl: "http://192.168.1.10:631/printers/A4",
        isDefault: true,
      },
    ]);
    accessibleTabsMock.defaultKey = "printers";

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "แก้ไข" }));

    expect(screen.getByText("Printer IP / URL")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("192.168.1.50 หรือ http://192.168.1.10:631/printers/Zebra")).toBeInTheDocument();
    expect(
      screen.getByText("ใส่ IP เครื่องปริ้นโดยตรงได้ถ้าเครื่องรองรับ IPP หรือใส่ CUPS URL เต็มได้เหมือนเดิม"),
    ).toBeInTheDocument();
  });

  it("shows which documents use each printer group with department and paper size", async () => {
    vi.mocked(api.getPrinterConfigs).mockResolvedValueOnce([
      {
        id: "printer-a4",
        kind: "a4",
        label: "Office A4",
        cupsPrinterUrl: "http://192.168.1.10:631/printers/A4",
        isDefault: true,
        assignments: [
          { department: "QC", docTypes: ["coa", "service-request"], paperSize: "A4" },
        ],
      },
      {
        id: "printer-sticker",
        kind: "sticker",
        label: "Zebra Sticker",
        cupsPrinterUrl: "192.168.1.50",
        isDefault: true,
        assignments: [
          { department: "ทุกแผนก", docTypes: ["sample-label", "stock-label"], paperSize: "label-65x25" },
        ],
      },
    ]);
    accessibleTabsMock.defaultKey = "printers";

    renderPage();

    expect(await screen.findByRole("heading", { name: "A4" })).toBeInTheDocument();
    expect(screen.getByText("แผนก: QC")).toBeInTheDocument();
    expect(screen.getByText("แผนก: ทุกแผนก")).toBeInTheDocument();
    expect(screen.getByText("ใบรายงานผล (COA)")).toBeInTheDocument();
    expect(screen.getByText("ใบคำขอ (Petition)")).toBeInTheDocument();
    expect(screen.getByText("ป้ายนำส่งตัวอย่าง")).toBeInTheDocument();
    expect(screen.getByText("ฉลากขวด Stock")).toBeInTheDocument();
    expect(screen.getAllByText("A4").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("label-65x25").length).toBeGreaterThanOrEqual(1);
  });

  it("creates a printer with department, paper size, and more than one document assignment", async () => {
    vi.mocked(api.getPrinterConfigs).mockResolvedValueOnce([]);
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { data: { roles: [], users: [{ id: "u1", department: "QC" }, { id: "u2", department: "Lab/วิเคราะห์" }] } },
    });
    accessibleTabsMock.defaultKey = "printers";

    renderPage();

    fireEvent.click(await screen.findAllByRole("button", { name: /เพิ่มเครื่องพิมพ์/ }).then((buttons) => buttons[1]));
    fireEvent.change(screen.getByLabelText("ชื่อเรียก"), { target: { value: "Zebra QC" } });
    fireEvent.change(screen.getByLabelText("Printer IP / URL"), { target: { value: "192.168.1.51" } });
    expect(screen.getByRole("combobox", { name: "แผนกประจำเครื่อง" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "QC" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Lab/วิเคราะห์" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("แผนกประจำเครื่อง"), { target: { value: "QC" } });
    fireEvent.change(screen.getByLabelText("ขนาดกระดาษ"), { target: { value: "label-65x25" } });
    fireEvent.click(screen.getByLabelText("ป้ายนำส่งตัวอย่าง"));
    fireEvent.click(screen.getByLabelText("ฉลากขวด Stock"));
    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));

    await waitFor(() => expect(api.createPrinterConfig).toHaveBeenCalledWith({
      kind: "sticker",
      label: "Zebra QC",
      cupsPrinterUrl: "192.168.1.51",
      assignments: [
        {
          department: "QC",
          paperSize: "label-65x25",
          docTypes: ["sample-label", "stock-label"],
        },
      ],
    }));
  });

  it("edits printer department, paper size, and document assignment", async () => {
    vi.mocked(api.getPrinterConfigs).mockResolvedValueOnce([
      {
        id: "printer-sticker",
        kind: "sticker",
        label: "Zebra Main",
        cupsPrinterUrl: "192.168.1.50",
        isDefault: true,
        assignments: [
          { department: "", docTypes: ["sample-label"], paperSize: "label-100x50" },
        ],
      },
    ]);
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { data: { roles: [], users: [{ id: "u1", department: "Lab/วิเคราะห์" }] } },
    });
    accessibleTabsMock.defaultKey = "printers";

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "แก้ไข" }));
    fireEvent.change(screen.getByLabelText("แผนกประจำเครื่อง"), { target: { value: "Lab/วิเคราะห์" } });
    fireEvent.change(screen.getByLabelText("ขนาดกระดาษ"), {
      target: { value: "label-65x25" },
    });
    fireEvent.click(screen.getByLabelText("ฉลากขวด Stock"));
    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));

    await waitFor(() => expect(api.updatePrinterConfig).toHaveBeenCalledWith("printer-sticker", {
      label: "Zebra Main",
      cupsPrinterUrl: "192.168.1.50",
      assignments: [
        {
          department: "Lab/วิเคราะห์",
          paperSize: "label-65x25",
          docTypes: ["sample-label", "stock-label"],
        },
      ],
    }));
  });
});
