import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import type { SampleItem } from "@/components/lis/SampleColumn";
import { api } from "@/lib/api";

export interface ApprovalInfo {
  labApproved: boolean;
  labApprovedAt?: Date;
  qcStatus?: "approved" | "rejected" | "pending";
  qcNote?: string;
}

export interface PendingItem {
  id: string;
  name: string;
  sender: string;
  date: string;
  time: string;
  batchNo: string;
  mfgDate: string;
  note: string;
  userEmail?: string;
}

export interface SentItem extends PendingItem {
  qrBarcodeDataUrl: string;
  status: "sending" | "sent";
}

export interface PhysicalResult {
  sampleId: string;
  density?: string;
  densityStatus?: "normal" | "abnormal";
  dissolutionValue?: string;
  dissolutionStatus?: "normal" | "abnormal";
  physicalStatus?: "normal" | "abnormal";
  colorMatch?: "match" | "mismatch";
  colorNote?: string;
  photoUrl?: string;
  status: "pending" | "completed";
  completedAt?: string;
}

export interface RealtimeDensity {
  sampleId: string;
  sampleName: string;
  density: number;
  sentAt: string;
}

interface SampleContextType {
  sentSamples: SampleItem[];
  physicalSamples: SampleItem[];
  testingSamples: SampleItem[];
  doneSamples: SampleItem[];
  approvals: Record<string, ApprovalInfo>;
  pendingItems: PendingItem[];
  sentItems: SentItem[];
  physicalResults: Record<string, PhysicalResult>;
  realtimeDensities: RealtimeDensity[];
  isLoading: boolean;
  pushDensityToHome: (entry: RealtimeDensity) => void;
  upsertPhysicalResult: (id: string, updates: Partial<PhysicalResult>) => void;
  receiveSample: (sample: SampleItem) => void;
  sendSample: (sample: SampleItem) => void;
  approveLab: (sampleId: string) => void;
  approveQC: (sampleId: string, status: "approved" | "rejected", note?: string) => void;
  addPendingItem: (item: PendingItem) => void;
  removePendingItem: (index: number) => void;
  markAsSending: (items: SentItem[]) => void;
  confirmSentByScan: (sampleId: string) => void;
  refetch: () => void;
  ensureLoaded: () => void;
}

const SampleContext = createContext<SampleContextType | null>(null);

export const useSamples = () => {
  const ctx = useContext(SampleContext);
  if (!ctx) throw new Error("useSamples must be inside SampleProvider");
  // Lazy-load on first consumer mount. The provider wraps every route, but only
  // a few pages read this legacy sample data — pages that never call useSamples
  // (e.g. QC testing) no longer pay for the samples/approvals/physical/density
  // fetch on load.
  useEffect(() => {
    ctx.ensureLoaded();
  }, [ctx]);
  return ctx;
};

export const SampleProvider = ({ children }: { children: ReactNode }) => {
  const [sent, setSent] = useState<SampleItem[]>([]);
  const [physical, setPhysical] = useState<SampleItem[]>([]);
  const [testing, setTesting] = useState<SampleItem[]>([]);
  const [done, setDone] = useState<SampleItem[]>([]);
  const [approvals, setApprovals] = useState<Record<string, ApprovalInfo>>({});
  const [physicalResults, setPhysicalResults] = useState<Record<string, PhysicalResult>>({});
  const [realtimeDensities, setRealtimeDensities] = useState<RealtimeDensity[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [sentItems, setSentItems] = useState<SentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [samples, approvalsData, physResultsData, densitiesData] = await Promise.all([
        api.getSamples(),
        api.getApprovals(),
        api.getPhysicalResults(),
        api.getDensities(),
      ]);
      setSent(samples.filter(s => s.status === "sent"));
      setPhysical(samples.filter(s => s.status === "physical"));
      setTesting(samples.filter(s => s.status === "testing"));
      setDone(samples.filter(s => s.status === "done"));
      setApprovals(approvalsData);
      setPhysicalResults(physResultsData);
      setRealtimeDensities(densitiesData);
    } catch (err) {
      console.error("Failed to load data from API:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch lazily: the first consumer that mounts (via useSamples) triggers the
  // load exactly once, instead of every app navigation paying for it on mount.
  const loadStartedRef = useRef(false);
  const ensureLoaded = useCallback(() => {
    if (loadStartedRef.current) return;
    loadStartedRef.current = true;
    fetchAll();
  }, [fetchAll]);

  const receiveSample = async (sample: SampleItem) => {
    setSent(prev => prev.filter(s => s.id !== sample.id));
    try {
      await api.updateSample(sample.id, { status: "physical" });
      await fetchAll();
    } catch (err) {
      console.error("receiveSample API error:", err);
    }
  };

  const sendSample = async (sample: SampleItem) => {
    setSent(prev => [...prev, sample]);
    try {
      await api.createSample(sample);
    } catch (err) {
      console.error("sendSample API error:", err);
    }
  };

  const addPendingItem = (item: PendingItem) => {
    setPendingItems(prev => [...prev, item]);
  };

  const removePendingItem = (index: number) => {
    setPendingItems(prev => prev.filter((_, i) => i !== index));
  };

  const markAsSending = (items: SentItem[]) => {
    setSentItems(prev => [...prev, ...items]);
    setPendingItems([]);
  };

  const confirmSentByScan = async (sampleId: string) => {
    setSentItems(prev =>
      prev.map(item => item.id === sampleId ? { ...item, status: "sent" as const } : item)
    );
    const found = sentItems.find(s => s.id === sampleId);
    if (found) {
      const newSample: SampleItem = {
        id: found.id,
        name: found.name,
        status: "sent",
        date: found.date,
        time: found.time,
        sender: found.sender,
      };
      setSent(prev => [...prev, newSample]);
      try {
        await api.createSample(newSample);
      } catch (err) {
        console.error("confirmSentByScan API error:", err);
      }
    }
  };

  const upsertPhysicalResult = async (id: string, updates: Partial<PhysicalResult>) => {
    const merged = { ...(physicalResults[id] || { sampleId: id, status: "pending" as const }), ...updates };
    setPhysicalResults(prev => ({ ...prev, [id]: merged }));
    try {
      await api.upsertPhysicalResult({ ...merged, sampleId: id });
    } catch (err) {
      console.error("upsertPhysicalResult API error:", err);
    }
  };

  const pushDensityToHome = async (entry: RealtimeDensity) => {
    setRealtimeDensities(prev => {
      const filtered = prev.filter(d => d.sampleId !== entry.sampleId);
      return [...filtered, entry];
    });
    try {
      await api.pushDensity(entry);
    } catch (err) {
      console.error("pushDensityToHome API error:", err);
    }
  };

  const approveLab = async (sampleId: string) => {
    setApprovals(prev => ({
      ...prev,
      [sampleId]: { ...prev[sampleId], labApproved: true, labApprovedAt: new Date() },
    }));
    const found = testing.find(s => s.id === sampleId);
    if (found) {
      setDone(prev => [...prev, { ...found, status: "done", aiPercent: 100 }]);
    }
    try {
      await api.approveLab(sampleId);
      await api.updateSample(sampleId, { status: "done", aiPercent: 100 });
      await fetchAll();
    } catch (err) {
      console.error("approveLab API error:", err);
    }
  };

  const approveQC = async (sampleId: string, status: "approved" | "rejected", note?: string) => {
    setApprovals(prev => ({
      ...prev,
      [sampleId]: { ...prev[sampleId], qcStatus: status, qcNote: note },
    }));
    try {
      await api.approveQC(sampleId, status, note);
    } catch (err) {
      console.error("approveQC API error:", err);
    }
  };

  return (
    <SampleContext.Provider value={{
      sentSamples: sent,
      physicalSamples: physical,
      testingSamples: testing,
      doneSamples: done,
      approvals,
      pendingItems,
      sentItems,
      physicalResults,
      realtimeDensities,
      isLoading,
      pushDensityToHome,
      upsertPhysicalResult,
      receiveSample,
      sendSample,
      approveLab,
      approveQC,
      addPendingItem,
      removePendingItem,
      markAsSending,
      confirmSentByScan,
      refetch: fetchAll,
      ensureLoaded,
    }}>
      {children}
    </SampleContext.Provider>
  );
};
