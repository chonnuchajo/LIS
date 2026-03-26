import type { SampleItem } from "@/components/lis/SampleColumn";

export const sentSamples: SampleItem[] = [
  { id: "LAB-2602-001", name: "Glyphosate 48% SL", date: "2026-02-07", time: "08:30", sender: "สมชาย แข่ตั้ง", status: "sent" },
  { id: "LAB-2602-004", name: "Paraquat 27.6% SL", date: "2026-02-07", time: "09:15", sender: "วิภา สุขใจ", status: "sent" },
  { id: "LAB-2602-007", name: "Chlorpyrifos 40% EC", date: "2026-02-07", time: "10:00", sender: "ธนา ชัยกุล", status: "sent" },
  { id: "LAB-2602-010", name: "Cypermethrin 10% EC", date: "2026-02-07", time: "10:45", sender: "ปราณี ดีมาก", status: "sent" },
  { id: "LAB-2602-012", name: "Atrazine 80% WP", date: "2026-02-07", time: "11:20", sender: "สุชาติ ก้าวหน้า", status: "sent" },
];

export const physicalSamples: SampleItem[] = [
  { id: "LAB-2602-003", name: "Abamectin 1.8% EC", date: "2026-02-06", time: "14:30", receiver: "ณรงค์เดช เก่งกล้า", density: 0.987, status: "physical" },
  { id: "LAB-2602-005", name: "Imidacloprid 70% WG", date: "2026-02-06", time: "15:00", receiver: "สมศรี ใจดี", density: 1.024, status: "physical" },
  { id: "LAB-2602-008", name: "Mancozeb 80% WP", date: "2026-02-06", time: "16:00", receiver: "ประภา ศรีสุข", density: 1.155, status: "physical" },
];

export const testingSamples: SampleItem[] = [
  { id: "LAB-2602-013", name: "Profenofos 50% EC", date: "2026-02-06", time: "13:00", receiver: "อำนาจ พลศรี", instrument: "GC-01", aiPercent: 65, status: "testing" },
  { id: "LAB-2602-014", name: "Carbendazim 50% SC", date: "2026-02-06", time: "14:00", receiver: "มาลี ดอกไม้", instrument: "HPLC-02", aiPercent: 42, status: "testing" },
  { id: "LAB-2602-015", name: "Fipronil 5% SC", date: "2026-02-06", time: "15:30", receiver: "พิชัย บุญมี", instrument: "GC-02", aiPercent: 80, status: "testing" },
];

export const doneSamples: SampleItem[] = [
  { id: "LAB-2602-002", name: "2,4-D Dimethylamine 72% SL", date: "2026-02-07", time: "07:45", receiver: "วิโลวรรณ รถเรียน", instrument: "HPLC-01", aiPercent: 100, preResult: 99.2, status: "done" },
  { id: "LAB-2602-006", name: "Metalaxyl 25% WP", date: "2026-02-06", time: "13:00", receiver: "อำนาจ พลศรี", instrument: "GC-01", aiPercent: 100, preResult: 98.7, status: "done" },
  { id: "LAB-2602-009", name: "Lambda-Cyhalothrin 2.5% EC", date: "2026-02-06", time: "11:30", receiver: "มาลี ดอกไม้", instrument: "HPLC-03", aiPercent: 100, preResult: 101.1, status: "done" },
  { id: "LAB-2602-011", name: "Propiconazole 25% EC", date: "2026-02-05", time: "09:00", receiver: "พิชัย บุญมี", instrument: "GC-03", aiPercent: 100, preResult: 97.5, status: "done" },
];
