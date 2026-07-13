import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ParameterItem } from "@/lib/api";
import type { Petition, QCTestResult } from "@/types/petition.types";
import LabTestingDetailPage from "./LabTestingDetailPage";

const mockNavigate = vi.hoisted(() => vi.fn());

const fixtures = vi.hoisted(() => {
  const petition: Petition = {
    _id: "petition-1",
    petitionNo: "LIS-001",
    dept: "rm",
    status: "inProgress",
    submittedBy: {
      name: "ผู้ส่งตัวอย่าง",
      submittedAt: "2026-07-13T01:00:00.000Z",
    },
    assignedTo: {
      employeeId: "11650",
      name: "พรหมพิริยะ ทองรุ่งรัตนกุล",
    },
    labReceivedAt: "2026-07-13T01:30:00.000Z",
    labReceivedBy: "พรหมพิริยะ ทองรุ่งรัตนกุล",
    items: [
      {
        seq: 1,
        sampleName: "ABAMECTIN 1.8% W/V EC",
        commonName: "ABAMECTIN 1.8% W/V EC",
        batchNo: "A1",
        testItems: "Active Ingredient",
      },
    ],
    createdAt: "2026-07-13T01:00:00.000Z",
    updatedAt: "2026-07-13T02:42:00.000Z",
  };

  const parameters: ParameterItem[] = [
    {
      _id: "param-1",
      name: "Active Ingredient",
      scope: "lab",
      applyAll: true,
      valueFields: [
        {
          label: "%AI",
          type: "number",
          unit: "%",
          labelToleranceMode: true,
          labelToleranceStandards: [
            { substance: "ABAMECTIN", autoPct: 2.5, headPct: 5 },
          ],
        },
      ],
    },
  ];

  const results: QCTestResult[] = [
    {
      petitionId: "petition-1",
      petitionNo: "LIS-001",
      itemSeq: 1,
      parameterId: "param-1",
      parameterName: "Active Ingredient",
      values: { "%AI::abamectin": "1.8" },
      updatedAt: "2026-07-13T02:42:00.000Z",
      updatedBy: { name: "พรหมพิริยะ ทองรุ่งรัตนกุล", email: "prompiriya.t@example.com" },
    },
  ];

  return { petition, parameters, results };
});

vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: "petition-1" }),
  useNavigate: () => mockNavigate,
}));

vi.mock("@/components/lis/AppLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/lis/PageHeader", () => ({
  default: ({ title, actions }: { title: React.ReactNode; actions?: React.ReactNode }) => (
    <header>
      <div>{title}</div>
      {actions}
    </header>
  ),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      name: "พรหมพิริยะ ทองรุ่งรัตนกุล",
      email: "prompiriya.t@example.com",
      roles: ["admin"],
    },
  }),
}));

vi.mock("@/hooks/useArrivalFlash", () => ({
  useArrivalFlash: () => "",
}));

vi.mock("@/context/ConfirmDialog", () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}));

vi.mock("@/hooks/useItemGroupMembership", () => ({
  useItemGroupMembership: () => ({
    get: () => [],
  }),
}));

vi.mock("@/hooks/usePetition", () => ({
  usePetition: () => ({ data: fixtures.petition, loading: false, error: null }),
  usePetitionList: () => ({ data: { items: [] }, loading: false, error: null }),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      getParameters: vi.fn().mockResolvedValue(fixtures.parameters),
      getInstrumentSources: vi.fn().mockResolvedValue([]),
      getQCResults: vi.fn().mockResolvedValue(fixtures.results),
      getReturnedFlags: vi.fn().mockResolvedValue({}),
      patch: vi.fn().mockResolvedValue({ data: { data: fixtures.petition } }),
    },
  };
});

describe("LabTestingDetailPage", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it("shows label-tolerance criteria and saved-by metadata beside the parameter field name", async () => {
    render(<LabTestingDetailPage />);

    const fieldName = await screen.findByText(/%AI — ABAMECTIN/);

    await waitFor(() => {
      expect(screen.getByText(/เกณฑ์กลาง 1\.7100–1\.8900 %/)).toBeInTheDocument();
    });

    const headerRow = fieldName.closest("div");
    expect(headerRow).not.toBeNull();
    expect(within(headerRow as HTMLElement).getByText(/เกณฑ์กลาง 1\.7100–1\.8900 %/)).toBeInTheDocument();
    expect(within(headerRow as HTMLElement).getByText(/กรอกโดย พรหมพิริยะ ทองรุ่งรัตนกุล เมื่อ/)).toBeInTheDocument();
    expect(screen.queryByText(/หัวหน้าตรวจสอบ 1\.7100–1\.8900 %/)).not.toBeInTheDocument();
  });
});
