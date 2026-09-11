import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PetitionFlowWatcher from "./PetitionFlowWatcher";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  getPetition: vi.fn(),
  getPetitionNotifications: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { employeeId: "E001", name: "QC User", roles: ["qc-staff"] } }),
}));

vi.mock("@/context/NotificationContext", () => ({
  useNotifications: () => ({ push: mocks.push }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    getPetition: mocks.getPetition,
    getPetitionNotifications: mocks.getPetitionNotifications,
  },
}));

function renderWatcher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PetitionFlowWatcher />
    </QueryClientProvider>,
  );
}

describe("PetitionFlowWatcher approval notifications", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mocks.getPetition.mockResolvedValue({
      _id: "p1",
      petitionNo: "P-2609-0002",
      status: "approved",
      items: [{ seq: 1, sampleName: "ตัวอย่าง 1", batchNo: "26S-PCB25-376", sampleId: "1" }],
    });
    mocks.getPetitionNotifications.mockResolvedValue({
      serverTime: "2026-09-05T04:00:00.000Z",
      items: [
        {
          id: "log-approved",
          petitionId: "p1",
          petitionNo: "P-2609-0002",
          event: "statusChanged",
          toStatus: "approved",
          title: "อนุมัติแล้ว",
          message: "P-2609-0002",
          level: "success",
          link: "/petition/p1",
          createdAt: new Date().toISOString(),
        },
      ],
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("keeps final approval as a bell notification without fetching data for a QR popup", async () => {
    renderWatcher();

    await waitFor(() => expect(mocks.push).toHaveBeenCalledTimes(1));

    expect(mocks.getPetition).not.toHaveBeenCalled();
    expect(screen.queryByText(/QR Code พร้อมใช้งาน/)).not.toBeInTheDocument();
  });
});
