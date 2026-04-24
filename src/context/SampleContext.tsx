import { createContext, useContext, useState, type ReactNode } from "react";
import type { SampleItem } from "@/components/lis/SampleColumn";
import { sentSamples as initialSent, physicalSamples as initialPhysical, testingSamples as initialTesting, doneSamples as initialDone } from "@/data/mockData";

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

interface SampleContextType {
  sentSamples: SampleItem[];
  physicalSamples: SampleItem[];
  testingSamples: SampleItem[];
  doneSamples: SampleItem[];
  approvals: Record<string, ApprovalInfo>;
  pendingItems: PendingItem[];
  sentItems: SentItem[];
  physicalResults: Record<string, PhysicalResult>;
  upsertPhysicalResult: (id: string, updates: Partial<PhysicalResult>) => void;
  receiveSample: (sample: SampleItem) => void;
  sendSample: (sample: SampleItem) => void;
  approveLab: (sampleId: string) => void;
  approveQC: (sampleId: string, status: "approved" | "rejected", note?: string) => void;
  addPendingItem: (item: PendingItem) => void;
  removePendingItem: (index: number) => void;
  markAsSending: (items: SentItem[]) => void;
  confirmSentByScan: (sampleId: string) => void;
}

const SampleContext = createContext<SampleContextType | null>(null);

export const useSamples = () => {
  const ctx = useContext(SampleContext);
  if (!ctx) throw new Error("useSamples must be inside SampleProvider");
  return ctx;
};

export const SampleProvider = ({ children }: { children: ReactNode }) => {
  const [sent, setSent] = useState<SampleItem[]>(initialSent);
  const [physical] = useState<SampleItem[]>(initialPhysical);
  const [testing] = useState<SampleItem[]>(initialTesting);
  const [done, setDone] = useState<SampleItem[]>(initialDone);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [sentItems, setSentItems] = useState<SentItem[]>([]);
  const [physicalResults, setPhysicalResults] = useState<Record<string, PhysicalResult>>({});
  const [approvals, setApprovals] = useState<Record<string, ApprovalInfo>>(() => {
    const init: Record<string, ApprovalInfo> = {};
    init[initialDone[0].id] = { labApproved: true, labApprovedAt: new Date(Date.now() - 3600000), qcStatus: "approved" };
    init[initialDone[1].id] = { labApproved: true, labApprovedAt: new Date(Date.now() - 3600000), qcStatus: "rejected", qcNote: "ปรับปรุงสูตร" };
    init[initialDone[2].id] = { labApproved: true, labApprovedAt: new Date(Date.now() - 7200000), qcStatus: "pending" };
    init[initialDone[3].id] = { labApproved: true, labApprovedAt: new Date(Date.now() - 1800000), qcStatus: "pending" };
    return init;
  });

  const receiveSample = (sample: SampleItem) => {
    setSent(prev => prev.filter(s => s.id !== sample.id));
  };

  const sendSample = (sample: SampleItem) => {
    setSent(prev => [...prev, sample]);
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

  const confirmSentByScan = (sampleId: string) => {
    setSentItems(prev => {
      const updated = prev.map(item =>
        item.id === sampleId ? { ...item, status: "sent" as const } : item
      );
      // Add to sentSamples for receiving page
      const found = prev.find(s => s.id === sampleId);
      if (found) {
        setSent(prevSent => [...prevSent, {
          id: found.id,
          name: found.name,
          status: "sent",
          date: found.date,
          time: found.time,
          sender: found.sender,
        }]);
      }
      return updated;
    });
  };

  const upsertPhysicalResult = (id: string, updates: Partial<PhysicalResult>) => {
    setPhysicalResults(prev => ({
      ...prev,
      [id]: { ...(prev[id] || { sampleId: id, status: "pending" }), ...updates },
    }));
  };

  const approveLab = (sampleId: string) => {
    setApprovals(prev => ({
      ...prev,
      [sampleId]: { ...prev[sampleId], labApproved: true, labApprovedAt: new Date() },
    }));
    const found = testing.find(s => s.id === sampleId);
    if (found) {
      setDone(prev => [...prev, { ...found, status: "done", aiPercent: 100 }]);
    }
  };

  const approveQC = (sampleId: string, status: "approved" | "rejected", note?: string) => {
    setApprovals(prev => ({
      ...prev,
      [sampleId]: { ...prev[sampleId], qcStatus: status, qcNote: note },
    }));
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
      upsertPhysicalResult,
      receiveSample,
      sendSample,
      approveLab,
      approveQC,
      addPendingItem,
      removePendingItem,
      markAsSending,
      confirmSentByScan,
    }}>
      {children}
    </SampleContext.Provider>
  );
};
