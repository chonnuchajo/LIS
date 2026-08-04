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

  it("creates a label-percent rule from typed master item text with item context", async () => {
    const { onSave } = renderDialog();

    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/master-items"));
    fireEvent.click(screen.getAllByRole("button")[0]);

    const substanceInput = screen.getAllByRole("combobox")[0];
    fireEvent.change(substanceInput, { target: { value: "ABAMECTIN 1.8% EC" } });
    fireEvent.blur(substanceInput);

    await waitFor(() => expect(screen.getAllByRole("spinbutton")[0]).toHaveValue(1.8));
    const spinButtons = screen.getAllByRole("spinbutton");
    expect(spinButtons[0]).toHaveValue(1.8);
    fireEvent.change(spinButtons[1], { target: { value: "25" } });
    fireEvent.change(spinButtons[2], { target: { value: "30" } });

    fireEvent.click(screen.getAllByRole("button").at(-2)!);

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
    ]);
  });

  it("opens existing rules collapsed", async () => {
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

    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("opens and scrolls to a newly added rule at the top", async () => {
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

    fireEvent.click(screen.getAllByRole("button")[0]);

      expect(screen.getAllByRole("combobox")[0]).toHaveValue("");
      await waitFor(() => {
        expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", behavior: "smooth" });
      });
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    }
  });
});
