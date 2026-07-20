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

function renderDialog(
  onSave = vi.fn<(next: SubstanceStandard[]) => void>(),
  substanceStandards: SubstanceStandard[] = [],
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <SubstanceStandardsDialog
        open
        field={{ ...field, substanceStandards }}
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

  it("adds same-substance master items separately when item code or pack size differs", async () => {
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
      if (path === "/item-groups") return { data: { data: [] } } as any;
      return { data: { data: [] } } as any;
    });
    const { onSave } = renderDialog();

    const abamectinOptions = await screen.findAllByRole("button", { name: /ABAMECTIN 1\.8% EC/ });
    expect(abamectinOptions).toHaveLength(2);
    fireEvent.click(abamectinOptions[0]);
    fireEvent.click(abamectinOptions[1]);

    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith([
      expect.objectContaining({
        substance: "ABAMECTIN 1.8% EC",
        itemNo: "RM-001",
        packSize: "100 ml",
        masterItemName: "ABAMECTIN A",
        masterCommonName: "ABAMECTIN 1.8% EC",
        masterRaw: expect.objectContaining({ item_no: "RM-001", desc2: "100 ml" }),
      }),
      expect.objectContaining({
        substance: "ABAMECTIN 1.8% EC",
        itemNo: "RM-002",
        packSize: "500 ml",
        masterItemName: "ABAMECTIN B",
        masterCommonName: "ABAMECTIN 1.8% EC",
        masterRaw: expect.objectContaining({ item_no: "RM-002", desc2: "500 ml" }),
      }),
    ]);
  });

  it("dedupes selected standards by substance item code and pack size together", async () => {
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
            ],
          },
        } as any;
      }
      if (path === "/item-groups") return { data: { data: [] } } as any;
      return { data: { data: [] } } as any;
    });
    const { onSave } = renderDialog(undefined, [
      {
        substance: "ABAMECTIN 1.8% EC",
        operator: "gte",
        value: 95,
        itemNo: "RM-001",
        packSize: "100 ml",
      },
    ]);

    const pickedOption = await screen.findByTitle("ABAMECTIN 1.8% EC · RM-001 · 100 ml · ABAMECTIN A");
    expect(pickedOption).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toHaveLength(1);
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

  const compactStandards: SubstanceStandard[] = [
    { substance: "ABAMECTIN", operator: "gte", value: 95, value2: null },
    { substance: "DIQUAT", operator: "between", value: 78, value2: 82 },
  ];

  it("renders selected standards as compact single rows with inline controls", async () => {
    renderDialog(undefined, compactStandards);

    await screen.findByText("ABAMECTIN");

    expect(screen.getByLabelText("เงื่อนไข ABAMECTIN")).toHaveValue("gte");
    expect(screen.getByLabelText("ค่า ABAMECTIN")).toHaveValue(95);
    expect(screen.queryByLabelText("ค่าที่สอง ABAMECTIN")).not.toBeInTheDocument();

    expect(screen.getByLabelText("เงื่อนไข DIQUAT")).toHaveValue("between");
    expect(screen.getByLabelText("ค่าที่สอง DIQUAT")).toHaveValue(82);
    expect(screen.getByLabelText("หน.QC DIQUAT")).not.toBeChecked();

    // หน่วยขึ้นหัวลิสต์ครั้งเดียว และไม่มีข้อความสรุปสีเขียวรายแถวแล้ว
    expect(screen.getByText(/หน่วย: %/)).toBeInTheDocument();
    expect(screen.queryByText("≥ 95%")).not.toBeInTheDocument();
  });

  it("reveals the second value input when operator becomes tolerance", async () => {
    renderDialog(undefined, compactStandards);

    const op = await screen.findByLabelText("เงื่อนไข ABAMECTIN");
    fireEvent.change(op, { target: { value: "tolerance" } });

    expect(screen.getByLabelText("ค่าที่สอง ABAMECTIN")).toBeInTheDocument();
  });

  it("toggles head-only on the right row and saves it", async () => {
    const { onSave } = renderDialog(undefined, compactStandards);

    fireEvent.click(await screen.findByLabelText("หน.QC DIQUAT"));
    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const saved = onSave.mock.calls[0][0];
    expect(saved.find((s) => s.substance === "DIQUAT")).toMatchObject({ headOnly: true });
    expect(saved.find((s) => s.substance === "ABAMECTIN")).not.toMatchObject({ headOnly: true });
  });

  it("filters the selected list with its own search box", async () => {
    renderDialog(undefined, [
      { substance: "ABAMECTIN", operator: "gte", value: 95, value2: null },
      { substance: "ACETAMIPRID", operator: "gte", value: 97, value2: null },
      { substance: "DIQUAT", operator: "between", value: 78, value2: 82 },
    ]);

    const listSearch = await screen.findByPlaceholderText("ค้นหาสารที่เลือก...");
    fireEvent.change(listSearch, { target: { value: "diquat" } }); // case-insensitive

    expect(screen.getByLabelText("ค่า DIQUAT")).toBeInTheDocument();
    expect(screen.queryByLabelText("ค่า ABAMECTIN")).not.toBeInTheDocument();
    expect(screen.getByText("แสดง 1/3")).toBeInTheDocument();

    fireEvent.change(listSearch, { target: { value: "ไม่มีสารนี้" } });
    expect(screen.getByText("ไม่พบสารที่ค้นหา")).toBeInTheDocument();
  });

  it("edits and removes the correct item while the list is filtered", async () => {
    const { onSave } = renderDialog(undefined, [
      { substance: "ABAMECTIN", operator: "gte", value: 95, value2: null },
      { substance: "DIQUAT", operator: "gte", value: 40, value2: null },
    ]);

    const listSearch = await screen.findByPlaceholderText("ค้นหาสารที่เลือก...");
    fireEvent.change(listSearch, { target: { value: "DIQUAT" } });
    fireEvent.change(screen.getByLabelText("ค่า DIQUAT"), { target: { value: "50" } });

    fireEvent.change(listSearch, { target: { value: "ABAMECTIN" } });
    fireEvent.click(screen.getByLabelText("ลบ ABAMECTIN"));

    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith([
      expect.objectContaining({ substance: "DIQUAT", value: 50 }),
    ]);
  });

  it("clones the correct item while the list is filtered", async () => {
    renderDialog(undefined, [
      { substance: "ABAMECTIN", operator: "gte", value: 95, value2: null },
      { substance: "DIQUAT", operator: "gte", value: 40, value2: null },
    ]);

    const listSearch = await screen.findByPlaceholderText("ค้นหาสารที่เลือก...");
    fireEvent.change(listSearch, { target: { value: "DIQUAT" } });
    fireEvent.click(screen.getByLabelText("คัดลอก DIQUAT"));

    // clone แทรกถัดจากตัวเดิมในลิสต์เต็ม และชื่อเดียวกันย่อม match filter → เห็น 2 แถว
    expect(screen.getAllByLabelText(/^ค่า DIQUAT$/)).toHaveLength(2);
    expect(screen.getByText("แสดง 2/3")).toBeInTheDocument();
  });
});
