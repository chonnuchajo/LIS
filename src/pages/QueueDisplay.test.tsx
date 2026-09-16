import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import QueueDisplay from "./QueueDisplay";
import { usePetitionList } from "@/hooks/usePetition";
import { api } from "@/lib/api";
import type { Petition } from "@/types/petition.types";

vi.mock("@/hooks/usePetition", () => ({
  usePetitionList: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: {
    getParameters: vi.fn(),
    getQCProgress: vi.fn(),
    getReturnedFlags: vi.fn(),
  },
}));

const mockedUsePetitionList = vi.mocked(usePetitionList);
const mockedApi = vi.mocked(api);

const petition = {
  _id: "6aa25b630f8d55e75a609aa8",
  petitionNo: "P-2609-0004",
  dept: "production",
  status: "deliveringQC",
  submittedBy: { name: "ชนม์นุชา ภู่สุวรรณ", department: "LDI" },
  items: [
    {
      seq: 1,
      sampleName: "อัลแรม",
      commonName: "THIAMETHOXAM 25% WG",
      batchNo: "2025120701",
    },
  ],
  createdAt: "2026-09-10T07:25:23.316Z",
  updatedAt: "2026-09-11T10:04:10.866Z",
  qcReceivedAt: "2026-09-11T07:18:37.751Z",
  qcCompletedAt: "2026-09-11T10:04:10.860Z",
} as Petition;

describe("QueueDisplay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUsePetitionList.mockImplementation((params) => {
      const statuses = params.status?.split(",") ?? [];
      const items = statuses.includes(petition.status) ? [petition] : [];
      return {
        data: { items, total: items.length, page: 1, limit: 100 },
        loading: false,
        error: null,
        refresh: vi.fn(),
      };
    });
    mockedApi.getParameters.mockResolvedValue([
      {
        _id: "param-1",
        name: "สี",
        status: "active",
        scope: "qc",
        applyAll: true,
        valueFields: [{ label: "สี", type: "text" }],
      },
    ]);
    mockedApi.getQCProgress.mockResolvedValue({
      [petition._id]: [{ itemSeq: 1, parameterId: "param-1", filledLabels: ["สี"] }],
    });
    mockedApi.getReturnedFlags.mockResolvedValue({});
  });

  it("shows stale received deliveringQC petitions in the QC progress column", async () => {
    render(<QueueDisplay mode="qc" />);

    const progressHeading = screen.getByRole("heading", { name: "กำลังดำเนินการ" });
    const progressSection = progressHeading.closest("section");

    expect(progressSection).not.toBeNull();
    await waitFor(() => {
      expect(within(progressSection as HTMLElement).getByText("P-2609-0004")).toBeInTheDocument();
    });
  });

  it("loads progress for stale received deliveringQC petitions", async () => {
    render(<QueueDisplay mode="qc" />);

    await waitFor(() => {
      expect(mockedApi.getQCProgress).toHaveBeenCalledWith([petition._id]);
    });
    expect(await screen.findByText("100%")).toBeInTheDocument();
  });

  it("loads Lab waiting samples from the sampleSent queue directly", () => {
    render(<QueueDisplay mode="lab" />);

    expect(mockedUsePetitionList).toHaveBeenCalledWith({ page: 1, limit: 200, status: "sampleSent" });
  });
});
