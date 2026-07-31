import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type LabelToleranceRule, type ParameterValueField } from "@/lib/api";
import { LabelToleranceDialog } from "./LabelToleranceDialog";

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { role: "admin", roles: ["admin"] } }),
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: {
      ...actual.api,
      get: vi.fn(),
    },
  };
});

const field: ParameterValueField = {
  label: "%AI",
  type: "number",
  unit: "%",
  labelToleranceMode: true,
  labelToleranceStandards: [],
};

function renderDialog(
  onSave = vi.fn<(next: LabelToleranceRule[]) => void>(),
  labelToleranceStandards: LabelToleranceRule[] = [],
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <LabelToleranceDialog
        open
        field={{ ...field, labelToleranceStandards }}
        onClose={() => undefined}
        onSave={onSave}
      />
    </QueryClientProvider>,
  );

  return { onSave };
}

describe("LabelToleranceDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation(async (path: string) => {
      if (path === "/master-items") {
        return {
          data: {
            data: [
              {
                item_no: "RM-001",
                common_name: "ABAMECTIN 1.8% EC",
                trade_name: "ABAMECTIN A",
                desc2: "100 ml",
                inventory_posting_group: "RM",
              },
              {
                item_no: "RM-002",
                common_name: "ABAMECTIN 1.8% EC",
                trade_name: "ABAMECTIN B",
                desc2: "500 ml",
                inventory_posting_group: "RM",
              },
            ],
          },
        } as any;
      }
      return { data: { data: [] } } as any;
    });
  });

  it("creates label-percent rules from selected master items with item context", async () => {
    const { onSave } = renderDialog();

    const options = await screen.findAllByRole("button", { name: /ABAMECTIN 1\.8% EC/ });
    fireEvent.click(options[0]);
    fireEvent.click(options[1]);

    const spinButtons = screen.getAllByRole("spinbutton");
    expect(spinButtons[0]).toHaveValue(1.8);
    expect(spinButtons[3]).toHaveValue(1.8);
    fireEvent.change(spinButtons[1], { target: { value: "25" } });
    fireEvent.change(spinButtons[2], { target: { value: "30" } });
    fireEvent.change(spinButtons[4], { target: { value: "25" } });
    fireEvent.change(spinButtons[5], { target: { value: "30" } });

    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith([
      expect.objectContaining({
        substance: "ABAMECTIN 1.8% EC",
        labelPercent: 1.8,
        itemNo: "RM-001",
        packSize: "100 ml",
        masterItemName: "ABAMECTIN A",
        masterCommonName: "ABAMECTIN 1.8% EC",
        masterRaw: expect.objectContaining({ item_no: "RM-001", desc2: "100 ml" }),
      }),
      expect.objectContaining({
        substance: "ABAMECTIN 1.8% EC",
        labelPercent: 1.8,
        itemNo: "RM-002",
        packSize: "500 ml",
        masterItemName: "ABAMECTIN B",
        masterCommonName: "ABAMECTIN 1.8% EC",
        masterRaw: expect.objectContaining({ item_no: "RM-002", desc2: "500 ml" }),
      }),
    ]);
  });

  it("does not add an existing master item rule twice", async () => {
    renderDialog(undefined, [
      {
        substance: "ABAMECTIN 1.8% EC",
        labelPercent: 1.8,
        autoPct: 25,
        headPct: 30,
        itemNo: "RM-001",
        packSize: "100 ml",
      } as LabelToleranceRule,
    ]);

    const pickedOption = await screen.findByTitle("ABAMECTIN 1.8% EC · RM-001 · 100 ml · ABAMECTIN A");
    expect(pickedOption).toBeDisabled();
  });

  it("scrolls to a newly added rule so users can continue editing at the bottom", async () => {
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    try {
      renderDialog(undefined, [
        {
          substance: "ABAMECTIN",
          labelPercent: 1.8,
          productTypes: [],
          autoMode: "percent",
          headMode: "percent",
          autoPct: 80,
          headPct: 15,
        } as LabelToleranceRule,
      ]);

      fireEvent.click(screen.getByRole("button", { name: /เพิ่มกฎ/ }));

      await screen.findByText("กฎที่ 2");
      await waitFor(() => {
        expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", behavior: "smooth" });
      });
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    }
  });
});
