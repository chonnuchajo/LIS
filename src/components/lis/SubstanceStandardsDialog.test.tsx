import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type ParameterValueField, type SubstanceStandard } from "@/lib/api";
import { SubstanceStandardsDialog } from "./SubstanceStandardsDialog";

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
  label: "Active ingredient",
  type: "number",
  unit: "%",
  substanceMode: true,
  substanceStandards: [],
};

function renderDialog(onSave = vi.fn<(next: SubstanceStandard[]) => void>()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <SubstanceStandardsDialog
        open
        field={field}
        onClose={() => undefined}
        onSave={onSave}
      />
    </QueryClientProvider>,
  );

  return { onSave };
}

describe("SubstanceStandardsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation(async (path: string) => {
      if (path === "/master-items") {
        return {
          data: {
            data: [
              { common_name: "CYPERMETHRIN 25% W/V BIO EC(LIVE STOCK)", trade_name: "CYPER", inventory_posting_group: "RM" },
              { common_name: "CYPERMETHRIN 25% W/V EC(GMP)", trade_name: "CYPER", inventory_posting_group: "FG" },
              { common_name: "MANCOZEB 80% WP", trade_name: "OTHER", inventory_posting_group: "SPARE" },
            ],
          },
        } as any;
      }
      if (path === "/item-groups") return { data: { data: [] } } as any;
      return { data: { data: [] } } as any;
    });
  });

  it("saves each selected commonName as its full standard substance without Type controls", async () => {
    const { onSave } = renderDialog();

    fireEvent.click(await screen.findByRole("button", { name: /CYPERMETHRIN 25% W\/V BIO EC\(LIVE STOCK\)/ }));
    fireEvent.click(await screen.findByRole("button", { name: /CYPERMETHRIN 25% W\/V EC\(GMP\)/ }));

    expect(screen.queryByText("Type")).not.toBeInTheDocument();
    expect(screen.getByLabelText("หมวดหมู่สาร")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("ค้นหา...")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith([
      expect.objectContaining({ substance: "CYPERMETHRIN 25% W/V BIO EC(LIVE STOCK)" }),
      expect.objectContaining({ substance: "CYPERMETHRIN 25% W/V EC(GMP)" }),
    ]);
  });

  it("filters selectable commonNames by category dropdown and typed search", async () => {
    renderDialog();

    expect(await screen.findByText("CYPERMETHRIN 25% W/V BIO EC(LIVE STOCK)")).toBeInTheDocument();
    expect(screen.getByText("CYPERMETHRIN 25% W/V EC(GMP)")).toBeInTheDocument();
    expect(screen.getByText("MANCOZEB 80% WP")).toBeInTheDocument();

    const search = screen.getByPlaceholderText("ค้นหา...");
    fireEvent.change(search, { target: { value: "MAN" } });

    expect(screen.getByText("MANCOZEB 80% WP")).toBeInTheDocument();
    expect(screen.queryByText("CYPERMETHRIN 25% W/V BIO EC(LIVE STOCK)")).not.toBeInTheDocument();
    expect(screen.queryByText("CYPERMETHRIN 25% W/V EC(GMP)")).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("หมวดหมู่สาร"), { target: { value: "RM" } });

    expect(screen.getByText("CYPERMETHRIN 25% W/V BIO EC(LIVE STOCK)")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("CYPERMETHRIN 25% W/V EC(GMP)")).not.toBeInTheDocument();
      expect(screen.queryByText("MANCOZEB 80% WP")).not.toBeInTheDocument();
    });

    fireEvent.change(search, { target: { value: "GMP" } });

    expect(screen.queryByText("CYPERMETHRIN 25% W/V BIO EC(LIVE STOCK)")).not.toBeInTheDocument();
    expect(screen.queryByText("CYPERMETHRIN 25% W/V EC(GMP)")).not.toBeInTheDocument();
    expect(screen.queryByText("MANCOZEB 80% WP")).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("หมวดหมู่สาร"), { target: { value: "FG" } });

    expect(screen.getByText("CYPERMETHRIN 25% W/V EC(GMP)")).toBeInTheDocument();
    expect(screen.queryByText("CYPERMETHRIN 25% W/V BIO EC(LIVE STOCK)")).not.toBeInTheDocument();
    expect(screen.queryByText("MANCOZEB 80% WP")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("หมวดหมู่สาร"), { target: { value: "other" } });

    expect(screen.getByText("MANCOZEB 80% WP")).toBeInTheDocument();
    expect(screen.queryByText("CYPERMETHRIN 25% W/V BIO EC(LIVE STOCK)")).not.toBeInTheDocument();
    expect(screen.queryByText("CYPERMETHRIN 25% W/V EC(GMP)")).not.toBeInTheDocument();
  });
});
