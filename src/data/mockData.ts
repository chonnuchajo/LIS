import type { SampleItem } from "@/components/lis/SampleColumn";

export const sentSamples: SampleItem[] = [
  { id: "LAB-2602-001", name: "ราเซอร์ (Razer)", date: "2026-02-07", time: "08:30", sender: "สมชาย แข่ตั้ง", status: "sent" },
  { id: "LAB-2602-004", name: "พาราเซตามอล 500mg", date: "2026-02-07", time: "09:15", sender: "วิภา สุขใจ", status: "sent" },
  { id: "LAB-2602-007", name: "แอมพิซิลลิน 250mg", date: "2026-02-07", time: "10:00", sender: "ธนา ชัยกุล", status: "sent" },
  { id: "LAB-2602-010", name: "ไอบูโพรเฟน 400mg", date: "2026-02-07", time: "10:45", sender: "ปราณี ดีมาก", status: "sent" },
  { id: "LAB-2602-012", name: "คลอเฟนิรามีน 4mg", date: "2026-02-07", time: "11:20", sender: "สุชาติ ก้าวหน้า", status: "sent" },
];

export const testingSamples: SampleItem[] = [
  { id: "LAB-2602-003", name: "พรีติคท์ 10%", date: "2026-02-06", time: "14:30", receiver: "ณรงค์เดช เก่งกล้า", instrument: "GC-01", aiPercent: 65, status: "testing" },
  { id: "LAB-2602-005", name: "เมทฟอร์มิน 500mg", date: "2026-02-06", time: "15:00", receiver: "สมศรี ใจดี", instrument: "HPLC-02", aiPercent: 42, status: "testing" },
  { id: "LAB-2602-008", name: "อะม็อกซิซิลลิน 500mg", date: "2026-02-06", time: "16:00", receiver: "ประภา ศรีสุข", instrument: "GC-02", aiPercent: 80, status: "testing" },
];

export const doneSamples: SampleItem[] = [
  { id: "LAB-2602-002", name: "โทมาฮอค (Tomahawk)", date: "2026-02-07", time: "07:45", receiver: "วิโลวรรณ รถเรียน", instrument: "HPLC-01", aiPercent: 100, preResult: 99.2, status: "done" },
  { id: "LAB-2602-006", name: "ซิโปรฟลอกซาซิน 250mg", date: "2026-02-06", time: "13:00", receiver: "อำนาจ พลศรี", instrument: "GC-01", aiPercent: 100, preResult: 98.7, status: "done" },
  { id: "LAB-2602-009", name: "ไดโคลฟีแนค 25mg", date: "2026-02-06", time: "11:30", receiver: "มาลี ดอกไม้", instrument: "HPLC-03", aiPercent: 100, preResult: 101.1, status: "done" },
  { id: "LAB-2602-011", name: "แอสไพริน 300mg", date: "2026-02-05", time: "09:00", receiver: "พิชัย บุญมี", instrument: "GC-03", aiPercent: 100, preResult: 97.5, status: "done" },
];
