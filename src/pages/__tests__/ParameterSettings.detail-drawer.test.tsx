import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { api, type ParameterItem } from "@/lib/api";
import ParameterSettings from "../ParameterSettings";

let mockUser: { role: string; roles: string[] } | null = { role: "admin", roles: ["admin"] };

vi.mock("@/components/lis/AppLayout", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/lis/PageHeader", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: mockUser }),
  AuthContext: {
    Provider: ({ children }: { children: ReactNode }) => <>{children}</>,
  },
}));

vi.mock("@/components/lis/SubstanceStandardsDialog", () => ({
  SubstanceStandardsDialog: ({ open }: { open: boolean }) => (open ? <div>substance dialog</div> : null),
}));

vi.mock("@/components/lis/ConditionalStandardsDialog", () => ({
  ConditionalStandardsDialog: ({ open }: { open: boolean }) => (open ? <div>conditional dialog</div> : null),
}));

vi.mock("@/components/lis/LabelToleranceDialog", () => ({
  LabelToleranceDialog: ({ open }: { open: boolean }) => (open ? <div>label tolerance dialog</div> : null),
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: {
      ...actual.api,
      getParameters: vi.fn(),
      updateParameter: vi.fn(),
      createParameter: vi.fn(),
      deleteParameter: vi.fn(),
      get: vi.fn(),
    },
  };
});

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ParameterSettings />
      </QueryClientProvider>
    </MemoryRouter>,
  );
};

describe("ParameterSettings row click/double-click opens detail drawer", () => {
  const parameters: ParameterItem[] = [
    {
      _id: "p1",
      name: "ความหนืดทดสอบ",
      scope: "qc",
      status: "active",
      applyAll: true,
      valueFields: [
        { label: "ค่าความหนืด", type: "number", unit: "cP", standardOperator: "gte", standardValue: 10 },
      ],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { role: "admin", roles: ["admin"] };
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
    vi.mocked(api.getParameters).mockResolvedValue(parameters);
    vi.mocked(api.updateParameter).mockResolvedValue(undefined);
  });

  it("opens the read-only detail drawer on a single click of the row", async () => {
    renderPage();

    const nameCell = await screen.findByText("ความหนืดทดสอบ");
    const row = nameCell.closest("tr");
    expect(row).not.toBeNull();

    fireEvent.click(row as HTMLTableRowElement);

    expect(await screen.findByText("ช่องค่า (1)")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("opens the read-only detail drawer on a double click of the row", async () => {
    renderPage();

    const nameCell = await screen.findByText("ความหนืดทดสอบ");
    const row = nameCell.closest("tr");
    expect(row).not.toBeNull();

    fireEvent.doubleClick(row as HTMLTableRowElement);

    expect(await screen.findByText("ช่องค่า (1)")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("clicking the edit (แก้ไข) button opens the edit dialog, not the detail drawer", async () => {
    renderPage();

    const nameCell = await screen.findByText("ความหนืดทดสอบ");
    const row = nameCell.closest("tr") as HTMLTableRowElement;
    const editButton = row.querySelector('button[title="แก้ไข"]');
    expect(editButton).not.toBeNull();

    fireEvent.click(editButton as HTMLButtonElement);

    expect(await screen.findByText("แก้ไขพารามิเตอร์")).toBeInTheDocument();
    expect(screen.queryByText(/ช่องค่า \(/)).not.toBeInTheDocument();
  });

  it("double-clicking the edit (แก้ไข) button opens the edit dialog, not the detail drawer", async () => {
    renderPage();

    const nameCell = await screen.findByText("ความหนืดทดสอบ");
    const row = nameCell.closest("tr") as HTMLTableRowElement;
    const editButton = row.querySelector('button[title="แก้ไข"]') as HTMLButtonElement;
    expect(editButton).not.toBeNull();

    // A real browser double-click dispatches click, click, then dblclick (in
    // that order) on the same element; fireEvent.doubleClick alone only
    // dispatches the dblclick event, so drive the full sequence to reproduce
    // the native behavior the bug depends on.
    fireEvent.click(editButton);
    fireEvent.click(editButton);
    fireEvent.doubleClick(editButton);

    expect(await screen.findByText("แก้ไขพารามิเตอร์")).toBeInTheDocument();
    expect(screen.queryByText(/ช่องค่า \(/)).not.toBeInTheDocument();
  });

  it("clicking the delete (ลบ) button opens the delete confirm dialog, not the detail drawer", async () => {
    renderPage();

    const nameCell = await screen.findByText("ความหนืดทดสอบ");
    const row = nameCell.closest("tr") as HTMLTableRowElement;
    const deleteButton = row.querySelector('button[title="ลบ"]');
    expect(deleteButton).not.toBeNull();

    fireEvent.click(deleteButton as HTMLButtonElement);

    expect(await screen.findByText("ยืนยันการลบ")).toBeInTheDocument();
    expect(screen.queryByText(/ช่องค่า \(/)).not.toBeInTheDocument();
  });

  it("clears the Parameter list search when switching between QC and Lab", async () => {
    vi.mocked(api.getParameters).mockResolvedValueOnce([
      {
        _id: "p-sg",
        name: "ค่า ถพ.",
        scope: "qc",
        status: "active",
        applyAll: true,
        valueFields: [{ label: "ค่าถพ.", type: "number", unit: "", standardOperator: "gte", standardValue: 0 }],
      },
      {
        _id: "p-lab",
        name: "ปริมาณสาร Lab",
        scope: "lab",
        status: "active",
        applyAll: true,
        valueFields: [{ label: "%AI", type: "number", unit: "%", standardOperator: "gte", standardValue: 0 }],
      },
    ]);

    renderPage();

    expect(await screen.findByText("ค่า ถพ.")).toBeInTheDocument();

    const search = screen.getByPlaceholderText("ค้นหาชื่อ / สาร / ใช้กับ / ช่อง...") as HTMLInputElement;
    fireEvent.change(search, { target: { value: "ถพ." } });
    expect(search.value).toBe("ถพ.");

    const scopeTabs = screen.getAllByRole("tablist")[0];
    const labTab = within(scopeTabs).getByRole("tab", { name: /Lab/ });
    fireEvent.mouseDown(labTab);
    fireEvent.click(labTab);

    expect(search.value).toBe("");
    expect(await screen.findByText("ปริมาณสาร Lab")).toBeInTheDocument();
  });

  it("keeps the criteria tab and resets the Parameter filter when switching scope", async () => {
    vi.mocked(api.getParameters).mockResolvedValueOnce([
      {
        _id: "p-sg",
        name: "ค่า ถพ.",
        scope: "qc",
        status: "active",
        applyAll: true,
        valueFields: [
          {
            label: "ค่าถพ.",
            type: "number",
            substanceMode: true,
            substanceStandards: [{ substance: "SG", operator: "gte", value: 0 }],
          },
        ],
      },
      {
        _id: "p-lab",
        name: "ปริมาณสาร Lab",
        scope: "lab",
        status: "active",
        applyAll: true,
        valueFields: [
          {
            label: "%AI",
            type: "number",
            unit: "%",
            substanceMode: true,
            substanceStandards: [{ substance: "LAB", operator: "gte", value: 0 }],
          },
        ],
      },
    ]);

    renderPage();
    expect(await screen.findByText("ค่า ถพ.")).toBeInTheDocument();

    const criteriaTab = screen.getByRole("tab", { name: "แยกตามสาร" });
    fireEvent.mouseDown(criteriaTab);
    fireEvent.click(criteriaTab);
    expect(await screen.findByLabelText("ค้นหาเกณฑ์")).toBeInTheDocument();

    const scopeTabs = screen.getAllByRole("tablist")[0];
    const labTab = within(scopeTabs).getByRole("tab", { name: /Lab/ });
    fireEvent.mouseDown(labTab);
    fireEvent.click(labTab);

    expect(await screen.findByLabelText("ค้นหาเกณฑ์")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "แยกตามสาร" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("เลือก Parameter")).toHaveValue("p-lab");
    expect(within(screen.getByRole("table")).getAllByRole("columnheader")[0]).toHaveTextContent("ปริมาณสาร Lab");
    expect(await screen.findByText("LAB")).toBeInTheDocument();
  });
});
