import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { api, type ParameterItem } from "@/lib/api";
import ParameterSettings from "../ParameterSettings";

vi.mock("@/components/lis/AppLayout", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/lis/PageHeader", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { role: "admin", roles: ["admin"] } }),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { role: "admin", roles: ["admin"] } }),
  AuthContext: {
    Provider: ({ children }: { children: ReactNode }) => <>{children}</>,
  },
}));

vi.mock("@/components/lis/SubstanceStandardsDialog", () => ({
  SubstanceStandardsDialog: ({ open, field, onSave, onClose }: any) =>
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
    api.get.mockResolvedValue({ data: { data: [] } });
    api.getParameters.mockResolvedValue(parameters);
    api.updateParameter.mockResolvedValue(undefined);
  });

  it("opens substance tab and saves substance criteria updates", async () => {
    renderPage();

    const criteriaTabList = screen.getAllByRole("tablist")[1];
    const criteriaTabs = within(criteriaTabList).getAllByRole("tab");
    expect(criteriaTabs).toHaveLength(4);

    const substancesTab = criteriaTabs[1];
    expect(substancesTab).toBeInTheDocument();
    fireEvent.mouseDown(substancesTab);
    fireEvent.click(substancesTab);

    expect(await screen.findByText("ABAMECTIN")).toBeInTheDocument();

    const table = screen.getByRole("table");
    const editButton = within(table).getByRole("button");
    fireEvent.click(editButton);

    fireEvent.click(screen.getByText("save substance dialog"));

    await waitFor(() => expect(api.updateParameter).toHaveBeenCalledTimes(1));

    const [, payload] = api.updateParameter.mock.calls[0] as [string, ParameterItem];
    expect(api.updateParameter).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({
        valueFields: expect.arrayContaining([
          expect.objectContaining({
            substanceStandards: expect.arrayContaining([
              expect.objectContaining({ substance: "ABAMECTIN" }),
              expect.objectContaining({ substance: "NEW" }),
            ]),
          }),
        ]),
      }),
    );
    expect(payload?.valueFields?.[0]?.substanceStandards).toHaveLength(2);
  });

  it("keeps substance dialog open when save fails", async () => {
    renderPage();

    const criteriaTabList = screen.getAllByRole("tablist")[1];
    const substancesTab = within(criteriaTabList).getAllByRole("tab")[1];
    fireEvent.mouseDown(substancesTab);
    fireEvent.click(substancesTab);

    expect(await screen.findByText("ABAMECTIN")).toBeInTheDocument();

    const table = screen.getByRole("table");
    const editButton = within(table).getByRole("button");
    fireEvent.click(editButton);

    api.updateParameter.mockRejectedValueOnce(new Error("save failed"));

    fireEvent.click(screen.getByText("save substance dialog"));

    await waitFor(() => expect(api.updateParameter).toHaveBeenCalledTimes(1));
    expect(screen.getByText("save substance dialog")).toBeInTheDocument();
  });
});
