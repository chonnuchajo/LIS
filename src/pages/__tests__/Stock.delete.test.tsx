import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import StockPage from "../Stock";

const apiMock = vi.hoisted(() => ({
  getStandards: vi.fn(),
  getStockUnits: vi.fn(),
  deleteStandard: vi.fn(),
  getSolvents: vi.fn(),
  getGlassware: vi.fn(),
  getStockTransactions: vi.fn(),
}));
const tabsMock = vi.hoisted(() => ({
  defaultKey: "standard",
}));
const authMock = vi.hoisted(() => ({
  user: {
    email: "tester@example.com",
    name: "Tester",
    role: "admin",
    roles: ["admin"],
  },
}));

vi.mock("@/lib/api", () => ({ api: apiMock }));

vi.mock("@/components/lis/AppLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/lis/PageHeader", () => ({
  default: ({ title }: { title: React.ReactNode }) => <header>{title}</header>,
}));

vi.mock("@/components/lis/StockQrScanner", () => ({
  default: () => null,
}));

vi.mock("@/components/lis/stock/StandardDetailDrawer", () => ({
  default: () => <div data-testid="standard-detail-drawer" />,
}));

vi.mock("@/components/lis/stock/StandardUnitsPanel", () => ({
  default: () => null,
}));

vi.mock("@/components/lis/stock/ReceiveBottlesDialog", () => ({
  default: () => null,
}));

vi.mock("@/components/lis/stock/ReceiveCart", () => ({
  default: () => null,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: authMock.user,
  }),
}));

vi.mock("@/hooks/useAccessibleTabs", () => ({
  useAccessibleTabs: () => ({
    defaultKey: tabsMock.defaultKey,
    tabs: [
      { key: "standard", label: "Standards" },
      { key: "solvent", label: "Solvents" },
      { key: "glassware", label: "Glassware" },
    ],
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function renderStock(defaultKey = "standard") {
  tabsMock.defaultKey = defaultKey;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <StockPage />
    </QueryClientProvider>,
  );
}

describe("StockPage delete actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tabsMock.defaultKey = "standard";
    authMock.user = {
      email: "tester@example.com",
      name: "Tester",
      role: "admin",
      roles: ["admin"],
    };
    apiMock.getStandards.mockResolvedValue([
      {
        _id: "std-1",
        code: "STD-001",
        name: "Pesticide Standard",
        primary: { qty: 0, ordered: 0, sizeMg: null, exp: "", usesPerBottle: null, pricePerUnit: 0, totalPrice: 0 },
        supplier: { qty: 0, sizeMg: null, exp: "" },
        working: { qty: 0, sizeMg: null, exp: "" },
        usagePerUseMg: null,
        frequency: "",
        storageTemp: "",
        status: "",
        expiryStatus: "",
      },
    ]);
    apiMock.getStockUnits.mockResolvedValue([]);
    apiMock.deleteStandard.mockResolvedValue({ success: true });
    apiMock.getSolvents.mockResolvedValue([
      {
        _id: "solvent-1",
        name: "Methanol",
        sizeLiter: 2.5,
        qty: 3,
        price: 1200,
        note: "HPLC grade",
      },
    ]);
    apiMock.getGlassware.mockResolvedValue([
      {
        _id: "glass-1",
        name: "Volumetric flask",
        qty: 12,
        pricePerPiece: 450,
        note: "Class A",
      },
    ]);
    apiMock.getStockTransactions.mockResolvedValue([]);
  });

  it("confirms and deletes a standard through the MongoDB-backed API", async () => {
    renderStock();

    expect(await screen.findByRole("cell", { name: "Pesticide Standard" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "ลบ Standard Pesticide Standard" }));
    expect(screen.queryByTestId("standard-detail-drawer")).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "ลบ" }));

    await waitFor(() => expect(apiMock.deleteStandard).toHaveBeenCalledWith("std-1"));
  });

  it.each([
    { defaultKey: "standard", cellName: "Pesticide Standard", deleteName: /Standard Pesticide Standard/ },
    { defaultKey: "solvent", cellName: "Methanol", deleteName: /Methanol/ },
    { defaultKey: "glassware", cellName: "Volumetric flask", deleteName: /Volumetric flask/ },
  ])("hides the $defaultKey delete button for Lab Inventory without admin", async ({ defaultKey, cellName, deleteName }) => {
    authMock.user = {
      email: "tester@example.com",
      name: "Tester",
      role: "lab-inventory",
      roles: ["lab-inventory", "lab-analyze"],
    };
    renderStock(defaultKey);

    expect(await screen.findByRole("cell", { name: cellName })).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: deleteName })).not.toBeInTheDocument();
  });

  it("keeps delete visible for admin even with Lab Inventory assigned", async () => {
    authMock.user = {
      email: "tester@example.com",
      name: "Tester",
      role: "admin",
      roles: ["admin", "lab-inventory"],
    };
    renderStock();

    expect(await screen.findByRole("cell", { name: "Pesticide Standard" })).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /Standard Pesticide Standard/ })).toBeInTheDocument();
  });

  it("opens the detail drawer when clicking a standard row", async () => {
    renderStock();

    fireEvent.click(await screen.findByRole("cell", { name: "Pesticide Standard" }));

    expect(await screen.findByTestId("standard-detail-drawer")).toBeInTheDocument();
  });

  it("opens the detail drawer when double-clicking a standard row", async () => {
    renderStock();

    fireEvent.doubleClick(await screen.findByRole("cell", { name: "Pesticide Standard" }));

    expect(await screen.findByTestId("standard-detail-drawer")).toBeInTheDocument();
  });

  it("opens solvent details when clicking or double-clicking a solvent row", async () => {
    renderStock("solvent");

    fireEvent.click(await screen.findByRole("cell", { name: "Methanol" }));

    const dialog = await screen.findByRole("dialog", { name: "Methanol" });
    expect(within(dialog).getByRole("heading", { name: "Methanol" })).toBeInTheDocument();
    expect(within(dialog).getByText("HPLC grade")).toBeInTheDocument();
  });

  it("opens solvent details when double-clicking a solvent row", async () => {
    renderStock("solvent");

    fireEvent.doubleClick(await screen.findByRole("cell", { name: "Methanol" }));

    const dialog = await screen.findByRole("dialog", { name: "Methanol" });
    expect(within(dialog).getByRole("heading", { name: "Methanol" })).toBeInTheDocument();
    expect(within(dialog).getByText("HPLC grade")).toBeInTheDocument();
  });

  it("opens glassware details when clicking a glassware row", async () => {
    renderStock("glassware");

    fireEvent.click(await screen.findByRole("cell", { name: "Volumetric flask" }));

    const dialog = await screen.findByRole("dialog", { name: "Volumetric flask" });
    expect(within(dialog).getByRole("heading", { name: "Volumetric flask" })).toBeInTheDocument();
    expect(within(dialog).getByText("Class A")).toBeInTheDocument();
  });

  it("opens glassware details when double-clicking a glassware row", async () => {
    renderStock("glassware");

    fireEvent.doubleClick(await screen.findByRole("cell", { name: "Volumetric flask" }));

    const dialog = await screen.findByRole("dialog", { name: "Volumetric flask" });
    expect(within(dialog).getByRole("heading", { name: "Volumetric flask" })).toBeInTheDocument();
    expect(within(dialog).getByText("Class A")).toBeInTheDocument();
  });
});
