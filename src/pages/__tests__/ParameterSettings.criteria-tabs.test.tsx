import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { api, type ParameterItem, type ParameterValueField, type SubstanceStandard } from "@/lib/api";
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

type SubstanceStandardsDialogMockProps = {
  open: boolean;
  field: ParameterValueField;
  onSave: (next: SubstanceStandard[]) => void;
  onClose: () => void;
};

vi.mock("@/components/lis/SubstanceStandardsDialog", () => ({
  SubstanceStandardsDialog: ({ open, field, onSave, onClose }: SubstanceStandardsDialogMockProps) =>
    open ? (
      <button
        type="button"
        onClick={() => {
          onSave([
            ...(field.substanceStandards ?? []),
            { substance: "NEW", operator: "gte", value: 1 },
          ]);
          onClose();
        }}
      >
        save substance dialog
      </button>
    ) : null,
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

describe("ParameterSettings criteria tabs", () => {
  const parameters: ParameterItem[] = [
    {
      _id: "p1",
      name: "เธชเธฒเธฃเธชเธณเธเธฑเธ",
      scope: "qc",
      status: "active",
      applyAll: true,
      valueFields: [
        {
          label: "เธเธฃเธดเธกเธฒเธ“",
          type: "number",
          substanceMode: true,
          substanceStandards: [{ substance: "ABAMECTIN", operator: "gte", value: 95 }],
        },
      ],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { role: "admin", roles: ["admin"] };
    api.get.mockResolvedValue({ data: { data: [] } });
    api.getParameters.mockResolvedValue(parameters);
    api.updateParameter.mockResolvedValue(undefined);
  });

  it("opens substance tab and saves a single-substance quick edit", async () => {
    renderPage();

    const criteriaTabList = screen.getAllByRole("tablist")[1];
    const criteriaTabs = within(criteriaTabList).getAllByRole("tab");
    expect(criteriaTabs).toHaveLength(4);

    const substancesTab = criteriaTabs[1];
    fireEvent.mouseDown(substancesTab);
    fireEvent.click(substancesTab);

    expect(await screen.findByText("ABAMECTIN")).toBeInTheDocument();

    const table = screen.getByRole("table");
    fireEvent.click(within(table).getByRole("button"));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("ABAMECTIN")).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("ค่า"), { target: { value: "97" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "บันทึก" }));

    await waitFor(() => expect(api.updateParameter).toHaveBeenCalledTimes(1));

    const [, payload] = api.updateParameter.mock.calls[0] as [string, ParameterItem];
    expect(api.updateParameter).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({
        valueFields: expect.arrayContaining([
          expect.objectContaining({
            substanceStandards: [
              expect.objectContaining({ substance: "ABAMECTIN", operator: "gte", value: 97 }),
            ],
          }),
        ]),
      }),
    );
    expect(payload?.valueFields?.[0]?.substanceStandards).toHaveLength(1);
  });

  it("keeps the quick-edit dialog open when save fails", async () => {
    renderPage();

    const criteriaTabList = screen.getAllByRole("tablist")[1];
    const substancesTab = within(criteriaTabList).getAllByRole("tab")[1];
    fireEvent.mouseDown(substancesTab);
    fireEvent.click(substancesTab);

    expect(await screen.findByText("ABAMECTIN")).toBeInTheDocument();

    const table = screen.getByRole("table");
    fireEvent.click(within(table).getByRole("button"));

    const dialog = await screen.findByRole("dialog");
    api.updateParameter.mockRejectedValueOnce(new Error("save failed"));

    fireEvent.click(within(dialog).getByRole("button", { name: "บันทึก" }));

    await waitFor(() => expect(api.updateParameter).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "บันทึก" })).toBeInTheDocument();
  });

  it("opens the full substance dialog from an unconfigured field's setup row", async () => {
    api.getParameters.mockResolvedValueOnce([
      {
        _id: "p-setup",
        name: "Setup Parameter",
        scope: "qc",
        status: "active",
        applyAll: true,
        valueFields: [
          { label: "ปริมาณ", type: "number", substanceMode: true, substanceStandards: [] },
        ],
      },
    ]);

    renderPage();

    const criteriaTabList = await waitFor(() => screen.getAllByRole("tablist")[1]);
    const substancesTab = within(criteriaTabList).getAllByRole("tab")[1];
    fireEvent.mouseDown(substancesTab);
    fireEvent.click(substancesTab);

    const table = await waitFor(() => screen.getByRole("table"));
    expect(within(table).getByText("Setup Parameter")).toBeInTheDocument();

    fireEvent.click(within(table).getByRole("button"));

    fireEvent.click(await screen.findByText("save substance dialog"));

    await waitFor(() => expect(api.updateParameter).toHaveBeenCalledTimes(1));
    const [, payload] = api.updateParameter.mock.calls[0] as [string, ParameterItem];
    expect(payload?.valueFields?.[0]?.substanceStandards).toHaveLength(1);
    expect(payload?.valueFields?.[0]?.substanceStandards?.[0]).toEqual(
      expect.objectContaining({ substance: "NEW" }),
    );
  });

  it("shows master item context in the substance criteria tab", async () => {
    api.getParameters.mockResolvedValueOnce([
      {
        _id: "p-item-context",
        name: "Item Context Parameter",
        scope: "qc",
        status: "active",
        applyAll: true,
        valueFields: [
          {
            label: "Purity",
            type: "number",
            unit: "%",
            substanceMode: true,
            substanceStandards: [
              {
                substance: "ABAMECTIN",
                operator: "gte",
                value: 95,
                itemNo: "RM-001",
                packSize: "100 ml",
                masterItemName: "ABAMECTIN A",
                masterCommonName: "ABAMECTIN 1.8 EC",
                masterRaw: { item_no: "RM-001", desc2: "100 ml" },
              },
            ],
          },
        ],
      },
    ]);

    renderPage();

    const criteriaTabList = await waitFor(() => screen.getAllByRole("tablist")[1]);
    const substancesTab = within(criteriaTabList).getAllByRole("tab")[1];
    fireEvent.mouseDown(substancesTab);
    fireEvent.click(substancesTab);

    expect(await screen.findByText("ABAMECTIN")).toBeInTheDocument();
    expect(screen.getByText("RM-001")).toBeInTheDocument();
    expect(screen.getByText("100 ml")).toBeInTheDocument();
    expect(screen.getByText("ABAMECTIN A")).toBeInTheDocument();
    expect(screen.getByText("item_no: RM-001 | desc2: 100 ml")).toBeInTheDocument();

    const searchBox = screen.getAllByRole("textbox")[0];
    fireEvent.change(searchBox, { target: { value: "RM-001" } });

    expect(screen.getByText("ABAMECTIN")).toBeInTheDocument();
    expect(screen.getByText("RM-001")).toBeInTheDocument();
  });

  it("filters the parameter list by substance names saved in criteria", async () => {
    api.getParameters.mockResolvedValueOnce([
      {
        _id: "p-label",
        name: "Label Criteria Parameter",
        scope: "qc",
        status: "active",
        applyAll: true,
        valueFields: [
          {
            label: "%AI",
            type: "number",
            labelToleranceMode: true,
            labelToleranceStandards: [
              { substance: "GLYPHOSATE", labelPercent: 1, autoPct: 25, headPct: 15 },
            ],
          },
        ],
      },
      {
        _id: "p-other",
        name: "Other Parameter",
        scope: "qc",
        status: "active",
        applyAll: true,
        valueFields: [
          {
            label: "Amount",
            type: "number",
            substanceMode: true,
            substanceStandards: [{ substance: "ABAMECTIN", operator: "gte", value: 95 }],
          },
        ],
      },
    ]);

    renderPage();

    expect(await screen.findByText("Label Criteria Parameter")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/ค้นหาชื่อ/), { target: { value: "glyph" } });

    expect(screen.getByText("Label Criteria Parameter")).toBeInTheDocument();
    expect(screen.queryByText("Other Parameter")).not.toBeInTheDocument();
  });

  it("does not show advanced criteria preview text under setup controls", async () => {
    const advancedParameters: ParameterItem[] = [
      {
        _id: "p-advanced",
        name: "Advanced Parameter",
        scope: "qc",
        status: "active",
        applyAll: true,
        valueFields: [
          {
            label: "Substance Field",
            type: "number",
            unit: "%",
            substanceMode: true,
            substanceStandards: [{ substance: "ABAMECTIN", operator: "gte", value: 95 }],
          },
          {
            label: "Conditional Field",
            type: "number",
            unit: "%",
            conditionalMode: true,
            conditionalStandards: [
              {
                label: "Rule A",
                conditions: [{ sourceFieldLabel: "Source", op: "gt", value: 10 }],
                operator: "gte",
                value: 20,
              },
            ],
          },
          {
            label: "Label Field",
            type: "number",
            unit: "%",
            labelToleranceMode: true,
            labelToleranceStandards: [
              { substance: "GLYPHOSATE", labelPercent: 1, autoPct: 25, headPct: 15 },
            ],
          },
        ],
      },
    ];
    api.getParameters.mockResolvedValueOnce(advancedParameters);

    renderPage();

    const parameterName = await screen.findByText("Advanced Parameter");
    const row = parameterName.closest("tr");
    expect(row).not.toBeNull();
    fireEvent.click(within(row as HTMLTableRowElement).getAllByRole("button")[0]);

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Substance Field/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: /Conditional Field/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: /Label Field/ }));

    expect(within(dialog).queryByText(/ABAMECTIN.*95%/)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/Rule A.*Source.*20%/)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/GLYPHOSATE.*25%/)).not.toBeInTheDocument();
  });

  it("shows head criteria columns for admin in label tolerance tab", async () => {
    api.getParameters.mockResolvedValueOnce([
      {
        _id: "p-label",
        name: "Label Parameter",
        scope: "qc",
        status: "active",
        applyAll: true,
        valueFields: [
          {
            label: "%AI",
            type: "number",
            labelToleranceMode: true,
            labelToleranceStandards: [{ substance: "ABAMECTIN", labelPercent: 1, autoPct: 25, headPct: 15 }],
          },
        ],
      },
    ]);

    renderPage();

    const criteriaTabList = await waitFor(() => screen.getAllByRole("tablist")[1]);
    const labelToleranceTab = within(criteriaTabList).getAllByRole("tab")[3];
    fireEvent.mouseDown(labelToleranceTab);
    fireEvent.click(labelToleranceTab);
    await screen.findByText("ABAMECTIN / 1%");

    const headerTexts = within(await screen.findByRole("table"))
      .getAllByRole("columnheader")
      .map((header) => header.textContent ?? "");
    expect(headerTexts).toContain("เกณฑ์กลาง");
    expect(headerTexts.some((text) => text.includes("(%,+-)"))).toBe(true);
    expect(headerTexts.filter((text) => text.includes("25%"))).toHaveLength(2);
  });

  it("hides head criteria columns for non-head roles in label tolerance tab", async () => {
    mockUser = { role: "viewer", roles: ["viewer"] };
    api.getParameters.mockResolvedValueOnce([
      {
        _id: "p-label",
        name: "Label Parameter",
        scope: "qc",
        status: "active",
        applyAll: true,
        valueFields: [
          {
            label: "%AI",
            type: "number",
            labelToleranceMode: true,
            labelToleranceStandards: [{ substance: "ABAMECTIN", labelPercent: 1, autoPct: 25, headPct: 15 }],
          },
        ],
      },
    ]);

    renderPage();

    const criteriaTabList = await waitFor(() => screen.getAllByRole("tablist")[1]);
    const labelToleranceTab = within(criteriaTabList).getAllByRole("tab")[3];
    fireEvent.mouseDown(labelToleranceTab);
    fireEvent.click(labelToleranceTab);
    await screen.findByText("ABAMECTIN / 1%");

    const headerTexts = within(await screen.findByRole("table"))
      .getAllByRole("columnheader")
      .map((header) => header.textContent ?? "");
    expect(headerTexts).toContain("เกณฑ์กลาง");
    expect(headerTexts.some((text) => text.includes("(%,+-)"))).toBe(false);
    expect(headerTexts.some((text) => text.includes("25%"))).toBe(false);
  });
});
