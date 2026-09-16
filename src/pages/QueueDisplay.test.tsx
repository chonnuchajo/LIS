import { act, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

function makeQueuePetition(index: number): Petition {
  return {
    ...petition,
    _id: `petition-${index}`,
    petitionNo: `P-2609-${String(index).padStart(4, "0")}`,
    status: "sampleSent",
    updatedAt: `2026-09-11T10:${String(60 - index).padStart(2, "0")}:10.866Z`,
  } as Petition;
}

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

  afterEach(() => {
    vi.useRealTimers();
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

  it("expands one active queue group across empty columns", async () => {
    const queueItems = Array.from({ length: 6 }, (_, index) => makeQueuePetition(index + 1));

    mockedUsePetitionList.mockImplementation((params) => {
      const statuses = params.status?.split(",") ?? [];
      const items = statuses.includes("sampleSent") ? queueItems : [];
      return {
        data: { items, total: items.length, page: 1, limit: 100 },
        loading: false,
        error: null,
        refresh: vi.fn(),
      };
    });

    render(<QueueDisplay mode="lab" />);

    expect(screen.getByRole("heading", { name: "ตัวอย่างใหม่" })).toBeInTheDocument();
    expect(screen.getByText("P-2609-0001")).toBeInTheDocument();
    expect(screen.getByText("P-2609-0006")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "กำลังดำเนินการ" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "เรียบร้อยแล้ว" })).not.toBeInTheDocument();
    await waitFor(() => expect(mockedApi.getReturnedFlags).toHaveBeenCalled());
  });

  it("cycles overflowing queue columns automatically so every petition is shown", async () => {
    vi.useFakeTimers();
    const queueItems = Array.from({ length: 10 }, (_, index) => makeQueuePetition(index + 1));

    mockedUsePetitionList.mockImplementation((params) => {
      const statuses = params.status?.split(",") ?? [];
      const items = statuses.includes("sampleSent") ? queueItems : [];
      return {
        data: { items, total: items.length, page: 1, limit: 100 },
        loading: false,
        error: null,
        refresh: vi.fn(),
      };
    });

    render(<QueueDisplay mode="lab" />);

    expect(screen.getByText("P-2609-0001")).toBeInTheDocument();
    expect(screen.queryByText("P-2609-0010")).not.toBeInTheDocument();
    expect(screen.getByText(/แสดง 1-9 จาก 10 รายการ • วนหน้า 1\/2 อัตโนมัติ/)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(8_000);
    });

    expect(screen.getByText("P-2609-0010")).toBeInTheDocument();
    expect(screen.queryByText("P-2609-0001")).not.toBeInTheDocument();
    expect(screen.getByText(/แสดง 10-10 จาก 10 รายการ • วนหน้า 2\/2 อัตโนมัติ/)).toBeInTheDocument();
  });
});
