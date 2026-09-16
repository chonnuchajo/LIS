import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PetitionFlowWatcher from "./PetitionFlowWatcher";
import { cursorKey } from "@/lib/petitionFlowWatcher";

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

const originalAudioContext = window.AudioContext;

function mockAudioContext() {
  const oscillator = {
    type: "sine",
    frequency: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null,
  } as unknown as OscillatorNode;
  const gain = {
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  } as unknown as GainNode;
  const audioContext = {
    currentTime: 0,
    destination: {},
    state: "running",
    createOscillator: vi.fn(() => oscillator),
    createGain: vi.fn(() => gain),
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as AudioContext;
  const AudioContextMock = vi.fn(() => audioContext);
  Object.defineProperty(window, "AudioContext", { configurable: true, writable: true, value: AudioContextMock });
  return { AudioContextMock, audioContext, oscillator, gain };
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
    Object.defineProperty(window, "AudioContext", { configurable: true, writable: true, value: originalAudioContext });
  });

  it("keeps final approval as a bell notification without fetching data for a QR popup", async () => {
    const audio = mockAudioContext();

    renderWatcher();

    await waitFor(() => expect(mocks.push).toHaveBeenCalledTimes(1));

    expect(mocks.getPetition).not.toHaveBeenCalled();
    expect(audio.AudioContextMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/QR Code พร้อมใช้งาน/)).not.toBeInTheDocument();
  });

  it("plays a sound once when a newly sent sample belongs to the current assignee", async () => {
    localStorage.setItem(cursorKey("E001"), "2026-09-05T03:59:00.000Z");
    mocks.getPetitionNotifications.mockResolvedValue({
      serverTime: "2026-09-05T04:00:00.000Z",
      items: [
        {
          id: "log-sample-sent",
          petitionId: "p1",
          petitionNo: "P-2609-0002",
          event: "statusChanged",
          toStatus: "sampleSent",
          title: "ส่งตัวอย่างแล้ว",
          level: "info",
          link: "/petition/p1",
          createdAt: "2026-09-05T04:00:00.000Z",
          playSound: true,
        },
      ],
    });
    const audio = mockAudioContext();

    renderWatcher();

    await waitFor(() => expect(mocks.push).toHaveBeenCalledTimes(1));

    expect(audio.AudioContextMock).toHaveBeenCalledTimes(1);
    expect(audio.audioContext.createOscillator).toHaveBeenCalledTimes(3);
    expect(audio.audioContext.createGain).toHaveBeenCalledTimes(3);
    expect(audio.gain.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.55, 0.03);
  });

  it("plays a sound for a newly sent sample on first live poll even before a cursor exists", async () => {
    mocks.getPetitionNotifications.mockResolvedValue({
      serverTime: "2026-09-05T04:00:00.000Z",
      items: [
        {
          id: "log-first-live-sample-sent",
          petitionId: "p1",
          petitionNo: "P-2609-0002",
          event: "statusChanged",
          toStatus: "sampleSent",
          title: "ส่งตัวอย่างแล้ว",
          level: "info",
          link: "/petition/p1",
          createdAt: "2026-09-05T04:00:00.000Z",
          playSound: true,
        },
      ],
    });
    const audio = mockAudioContext();

    renderWatcher();

    await waitFor(() => expect(mocks.push).toHaveBeenCalledTimes(1));

    expect(audio.AudioContextMock).toHaveBeenCalledTimes(1);
  });

  it("keeps old backfilled assigned samples silent when no cursor exists yet", async () => {
    mocks.getPetitionNotifications.mockResolvedValue({
      serverTime: "2026-09-05T04:00:00.000Z",
      items: [
        {
          id: "log-backfill-sample-sent",
          petitionId: "p1",
          petitionNo: "P-2609-0002",
          event: "statusChanged",
          toStatus: "sampleSent",
          title: "ส่งตัวอย่างแล้ว",
          level: "info",
          link: "/petition/p1",
          createdAt: "2026-09-05T03:00:00.000Z",
          playSound: true,
        },
      ],
    });
    const audio = mockAudioContext();

    renderWatcher();

    await waitFor(() => expect(mocks.push).toHaveBeenCalledTimes(1));

    expect(audio.AudioContextMock).not.toHaveBeenCalled();
  });
});
