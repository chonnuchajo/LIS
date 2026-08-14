import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import CoaCenterPage from "../CoaCenterPage";

vi.mock("@/components/lis/AppLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      name: "QC Head User",
      email: "qc-head@example.com",
      role: "qc-head",
      roles: ["qc-head"],
      permissions: ["coa.approve"],
    },
  }),
}));
vi.mock("@/lib/api", () => ({
  api: {
    getCoaDocuments: vi.fn().mockResolvedValue({
      items: [
        {
          _id: "c1",
          coaNo: "00012026",
          coaYear: new Date().getFullYear(),
          revision: 0,
          status: "draft",
          petitionId: "p1",
          petitionNoSnapshot: "P-2608-0001",
          customerSnapshot: { name: "Customer A" },
          selectedItemSeqs: [1],
          sampleSnapshots: [{ itemSeq: 1, sampleName: "Trade A", commonName: "Common A", batchNo: "B-001", lotNo: "L-001", productionDate: "2026-08-01" }],
          resultSnapshots: [],
          print: { printCount: 0 },
          createdAt: new Date().toISOString(),
        },
        {
          _id: "c2",
          coaNo: "00022026",
          coaYear: new Date().getFullYear(),
          revision: 0,
          status: "pendingApproval",
          petitionId: "p2",
          petitionNoSnapshot: "P-2608-0002",
          customerSnapshot: { company: "Customer B" },
          selectedItemSeqs: [1],
          sampleSnapshots: [{ itemSeq: 1, sampleName: "Trade B", commonName: "Common B", batchNo: "B-002", productionDate: "2026-07-30" }],
          resultSnapshots: [],
          print: { printCount: 0 },
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          _id: "c3",
          coaNo: "00012025",
          coaYear: new Date().getFullYear() - 1,
          revision: 0,
          status: "approved",
          petitionId: "p3",
          petitionNoSnapshot: "P-2508-0001",
          customerSnapshot: { name: "Customer C" },
          selectedItemSeqs: [1],
          sampleSnapshots: [{ itemSeq: 1, sampleName: "Trade C", commonName: "Common C", batchNo: "B-003", productionDate: "2025-08-01" }],
          resultSnapshots: [],
          print: { printCount: 0 },
          createdAt: new Date(new Date().getFullYear() - 1, 7, 1).toISOString(),
        },
        {
          _id: "c4",
          coaNo: "00032026",
          coaYear: new Date().getFullYear(),
          revision: 0,
          status: "approved",
          petitionId: "p4",
          petitionNoSnapshot: "P-2608-0003",
          customerSnapshot: { name: "Customer D" },
          selectedItemSeqs: [1],
          sampleSnapshots: [{ itemSeq: 1, sampleName: "Trade D", commonName: "Common D", batchNo: "B-004", productionDate: "2026-08-01" }],
          resultSnapshots: [],
          print: { printCount: 0 },
          createdAt: new Date().toISOString(),
        },
        {
          _id: "c5",
          coaNo: null,
          coaYear: new Date().getFullYear(),
          revision: 0,
          status: "requested",
          petitionId: "p5",
          petitionNoSnapshot: "P-2608-0004",
          customerSnapshot: { name: "Customer E" },
          selectedItemSeqs: [1],
          sampleSnapshots: [{ itemSeq: 1, sampleName: "Trade E", commonName: "Common E", batchNo: "B-005", productionDate: "2026-08-01" }],
          resultSnapshots: [],
          print: { printCount: 0 },
          createdAt: new Date().toISOString(),
        },
      ],
    }),
    getEligibleCoaPetitions: vi.fn().mockResolvedValue({ items: [] }),
    createCoaDocument: vi.fn().mockResolvedValue({}),
    reviseCoaDocument: vi.fn().mockResolvedValue({ _id: "c6" }),
    submitCoaDocument: vi.fn().mockResolvedValue({}),
    approveCoaDocument: vi.fn().mockResolvedValue({}),
    rejectCoaDocument: vi.fn().mockResolvedValue({}),
    getPrinterConfigs: vi.fn().mockResolvedValue({ items: [] }),
  },
}));

function renderPage(initialEntry = "/coa") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <CoaCenterPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CoaCenterPage", () => {
  it("renders COA list and create action", async () => {
    const { container } = renderPage();

    expect(await screen.findByText("ออกเอกสาร COA")).toBeInTheDocument();
    expect(await screen.findByText("00012026")).toBeInTheDocument();
    expect(container.querySelector(".bg-sky-50")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /สร้าง COA/ })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Document No" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "COA No" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "ชื่อลูกค้า" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "ชื่อการค้า" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "ชื่อสามัญ" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "LOT No. (แบช+วันที่ผลิต)" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "สถานะ" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "พิมพ์" })).not.toBeInTheDocument();
    expect(screen.getByText("Customer A")).toBeInTheDocument();
    expect(screen.getByText("Trade A")).toBeInTheDocument();
    expect(screen.getByText("Common A")).toBeInTheDocument();
    expect(screen.getByText("L-001 / B-001 / 01/08/2026")).toBeInTheDocument();
    expect(screen.getAllByText("ดำเนินการแล้ว").length).toBeGreaterThan(0);
  });

  it("defaults to today's COA requests and can switch to all requests", async () => {
    const { container } = renderPage();

    expect(await screen.findByText("00012026")).toBeInTheDocument();
    expect(screen.queryByText("00022026")).not.toBeInTheDocument();
    const tabButtons = Array.from(container.querySelectorAll("button[aria-pressed]:not([aria-label])"));
    expect(tabButtons).toHaveLength(2);
    expect(tabButtons[0]).toHaveClass("bg-sky-100");
    expect(tabButtons[1]).toHaveClass("bg-blue-100");
    expect(tabButtons[0]).toHaveAttribute("aria-pressed", "true");
    expect(tabButtons[1]).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: /คำขอ COA ทั้งหมด/ }));

    expect(await screen.findByRole("button", { name: /แฟ้มปี 2569/ })).toBeInTheDocument();
    expect(screen.queryByText("00022026")).not.toBeInTheDocument();
    expect(tabButtons[0]).toHaveAttribute("aria-pressed", "false");
    expect(tabButtons[1]).toHaveAttribute("aria-pressed", "true");
  });

  it("shows Buddhist-year folders in all requests before opening a COA list", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /คำขอ COA ทั้งหมด/ }));

    expect(screen.getByRole("button", { name: /แฟ้มปี 2569/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /แฟ้มปี 2568/ })).not.toBeInTheDocument();
    expect(screen.queryByText("00022026")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /แฟ้มปี 2569/ }));

    expect(await screen.findByText("00022026")).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "สถานะ" })).not.toBeInTheDocument();
    expect(screen.queryByText("00012025")).not.toBeInTheDocument();
  });

  it("indicates and filters COA workflow status", async () => {
    renderPage();

    expect(await screen.findByRole("button", { name: "สถานะ ขอ COA" })).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: "สถานะ ดำเนินการแล้ว" })).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: "สถานะ รออนุมัติ" })).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: "สถานะ อนุมัติแล้ว" })).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("button", { name: "สถานะ รออนุมัติ" }));

    expect(await screen.findByText("00022026")).toBeInTheDocument();
    expect(screen.queryByText("00012026")).not.toBeInTheDocument();
    expect(screen.queryByText("00032026")).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Document No" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "ชื่อลูกค้า" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "คำสั่ง" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "เปิดดูไฟล์ COA 00022026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "QC Head อนุมัติ COA 00022026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ไม่อนุมัติ COA 00022026" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "สถานะ อนุมัติแล้ว" }));

    expect(await screen.findByText("00032026")).toBeInTheDocument();
    expect(screen.queryByText("00022026")).not.toBeInTheDocument();
  });

  it("shows the create COA action in a command column for requested COAs", async () => {
    renderPage();

    expect(await screen.findByText("00012026")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /สร้าง COA/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "สถานะ ขอ COA" }));

    const requestedRow = await screen.findByRole("row", { name: /P-2608-0004/ });
    expect(screen.getByRole("columnheader", { name: "คำสั่ง" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "สถานะ" })).not.toBeInTheDocument();
    expect(within(requestedRow).queryByText("ขอ COA")).not.toBeInTheDocument();
    expect(within(requestedRow).getByRole("button", { name: /สร้าง COA/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "สถานะ ดำเนินการแล้ว" }));

    expect(screen.queryByRole("button", { name: /สร้าง COA/ })).not.toBeInTheDocument();
  });

  it("warns on repeated common name and batch then sends existing COA to approval", async () => {
    vi.mocked(api.getEligibleCoaPetitions).mockResolvedValueOnce({
      items: [
        {
          _id: "p-dup",
          petitionNo: "P-2608-DUP",
          items: [
            {
              seq: 1,
              sampleName: "Trade Duplicate",
              commonName: "BROMADIOLONE 0.005%",
              batchNo: "B-DUP-001",
              activeCoa: {
                coaId: "coa-old",
                coaNo: "00052026",
                revision: 0,
                petitionNo: "P-2608-OLD",
                commonName: "BROMADIOLONE 0.005%",
                batchNo: "B-DUP-001",
              },
            },
          ],
        },
      ],
    });
    vi.mocked(api.reviseCoaDocument).mockResolvedValueOnce({ _id: "coa-revision" } as never);
    vi.mocked(api.submitCoaDocument).mockResolvedValueOnce({
      _id: "coa-revision",
      coaNo: "00052026",
      coaYear: new Date().getFullYear(),
      revision: 1,
      status: "pendingRevisionApproval",
      petitionId: "p-dup",
      petitionNoSnapshot: "P-2608-DUP",
      customerSnapshot: { name: "Customer Duplicate" },
      selectedItemSeqs: [1],
      sampleSnapshots: [{ itemSeq: 1, sampleName: "Trade Duplicate", commonName: "BROMADIOLONE 0.005%", batchNo: "B-DUP-001" }],
      resultSnapshots: [],
      print: { printCount: 0 },
      createdAt: new Date().toISOString(),
    } as never);

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "สถานะ ขอ COA" }));
    fireEvent.click(await screen.findByRole("button", { name: /สร้าง COA P-2608-0004/ }));
    fireEvent.click(await screen.findByText("P-2608-DUP"));
    fireEvent.click(screen.getByText("Trade Duplicate"));

    expect(await screen.findByText("พบประวัติการทำ COA แล้ว")).toBeInTheDocument();
    expect(screen.getAllByText(/00052026/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "ส่งใบเดิมไปรออนุมัติ" }));

    expect(await screen.findByRole("button", { name: "สถานะ รออนุมัติ" })).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByRole("row", { name: /00052026/ })).toBeInTheDocument();
    expect(api.reviseCoaDocument).toHaveBeenCalledWith("coa-old", expect.any(Object));
    expect(api.submitCoaDocument).toHaveBeenCalledWith("coa-revision", expect.any(Object));
  });

  it("shows an admin edit action and focused COA columns for in-progress COAs", async () => {
    renderPage();

    expect(await screen.findByText("00012026")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "สถานะ ดำเนินการแล้ว" }));

    expect(await screen.findByText("00012026")).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Document No" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "COA No" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "ชื่อลูกค้า" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "ชื่อการค้า" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "ชื่อสามัญ" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "LOT No. (แบช+วันที่ผลิต)" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "สถานะ" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "คำสั่ง" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "เปิดดูไฟล์ COA 00012026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "แก้ไข COA 00012026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "เสร็จสิ้น COA 00012026" })).toBeInTheDocument();
  });

  it("simulates a BROMADIOLONE 0.005% COA through QC Head approval", async () => {
    renderPage("/coa?demoCoa=bromadiolone");

    expect(await screen.findByText("โหมดจำลอง")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "สถานะ ขอ COA" })).toHaveAttribute("aria-pressed", "true");

    const requestedRow = await screen.findByRole("row", { name: /P-2608-DEMO-001/ });
    expect(within(requestedRow).getByText("Red Wax Block")).toBeInTheDocument();
    expect(within(requestedRow).getByText("BROMADIOLONE 0.005%")).toBeInTheDocument();
    expect(within(requestedRow).getByText("LOT-DEMO-001 / B-DEMO-001 / 08/08/2026")).toBeInTheDocument();

    fireEvent.click(within(requestedRow).getByRole("button", { name: "สร้าง COA P-2608-DEMO-001" }));

    expect(screen.getByRole("button", { name: "สถานะ ดำเนินการแล้ว" })).toHaveAttribute("aria-pressed", "true");
    const inProgressRow = await screen.findByRole("row", { name: /00042026/ });
    expect(within(inProgressRow).getByRole("button", { name: "เปิดดูไฟล์ COA 00042026" })).toBeInTheDocument();
    expect(within(inProgressRow).getByRole("button", { name: "แก้ไข COA 00042026" })).toBeInTheDocument();
    expect(within(inProgressRow).getByRole("button", { name: "เสร็จสิ้น COA 00042026" })).toBeInTheDocument();

    fireEvent.click(within(inProgressRow).getByRole("button", { name: "เสร็จสิ้น COA 00042026" }));

    expect(screen.getByRole("button", { name: "สถานะ รออนุมัติ" })).toHaveAttribute("aria-pressed", "true");
    const pendingApprovalRow = await screen.findByRole("row", { name: /00042026/ });
    expect(within(pendingApprovalRow).getByRole("button", { name: "เปิดดูไฟล์ COA 00042026" })).toBeInTheDocument();
    expect(within(pendingApprovalRow).getByRole("button", { name: "QC Head อนุมัติ COA 00042026" })).toBeInTheDocument();
    expect(within(pendingApprovalRow).getByRole("button", { name: "ไม่อนุมัติ COA 00042026" })).toBeInTheDocument();

    fireEvent.click(within(pendingApprovalRow).getByRole("button", { name: "QC Head อนุมัติ COA 00042026" }));

    expect(screen.getByRole("button", { name: "สถานะ อนุมัติแล้ว" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("coa-center-page")).toHaveClass("bg-sky-50");
    const approvedRow = await screen.findByRole("row", { name: /00042026/ });
    expect(within(approvedRow).getByText("Red Wax Block")).toBeInTheDocument();
    expect(within(approvedRow).getByRole("button", { name: "พิมพ์ COA 00042026" })).toBeEnabled();
  });

  it("shows print and PDF commands with focused COA columns in the approved workflow tab", async () => {
    renderPage();

    expect(await screen.findByText("00012026")).toBeInTheDocument();
    expect(screen.getByTestId("coa-center-page")).toHaveClass("bg-sky-50");
    expect(screen.queryByRole("columnheader", { name: "พิมพ์" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "พิมพ์ COA 00032026" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "สถานะ อนุมัติแล้ว" }));

    expect(await screen.findByText("00032026")).toBeInTheDocument();
    expect(screen.getByTestId("coa-center-page")).toHaveClass("bg-sky-50");
    expect(screen.getByTestId("coa-center-page")).not.toHaveClass("bg-green-50");
    expect(screen.queryByRole("columnheader", { name: "Document No" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "COA No" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "ชื่อการค้า" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "ชื่อลูกค้า" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "ชื่อบริษัท" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "ชื่อสามัญ" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "LOT No. (แบช+วันที่ผลิต)" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "สถานะ" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "พิมพ์" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "คำสั่ง" })).toBeInTheDocument();
    expect(screen.getByText("Customer D")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "พิมพ์ COA 00032026" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "บันทึกไฟล์ PDF COA 00032026" })).toBeEnabled();
  });
});
