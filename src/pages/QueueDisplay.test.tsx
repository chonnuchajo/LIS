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
    mockedUsePetitionList.mockReturnValue({
      data: { items: [petition], total: 1, page: 1, limit: 100 },
      loading: false,
      error: null,
      refresh: vi.fn(),
    });
    mockedApi.getParameters.mockResolvedValue([]);
    mockedApi.getQCProgress.mockResolvedValue({});
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
});
