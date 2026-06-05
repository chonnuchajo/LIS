// Catalog สำหรับ Daily Check ห้องวิเคราะห์ (analysis).
// GC 3 เครื่อง + HPLC 4 เครื่อง — ทุกเครื่องกรอกค่า (status + readings).
import type { RoomInstrument, RoomGroup } from "./roomEquipment";

export const ANALYSIS_ROOM_SLUG = "analysis";

const GC_READINGS = [
  { key: "pressure", label: "ความดันแก๊สพา", unit: "psi" },
  { key: "temp", label: "อุณหภูมิ oven", unit: "°C" },
  { key: "flow", label: "Flow rate", unit: "mL/min" },
];

const HPLC_READINGS = [
  { key: "pressure", label: "ความดันระบบ", unit: "bar" },
  { key: "flow", label: "Flow rate", unit: "mL/min" },
  { key: "temp", label: "อุณหภูมิ column", unit: "°C" },
];

export const ANALYSIS_INSTRUMENTS: RoomInstrument[] = [
  { id: "LD-003", name: "GC 7890A", brand: "Agilent", group: "gc", readings: GC_READINGS },
  { id: "LD-043", name: "GC 8850", brand: "Agilent", group: "gc", readings: GC_READINGS },
  { id: "LD-004", name: "GC 8890", brand: "Agilent", group: "gc", readings: GC_READINGS },
  { id: "LD-044", name: "HPLC 1260 Infinity III", brand: "Agilent", group: "hplc", readings: HPLC_READINGS },
  { id: "LD-001", name: "HPLC Agilent 1260", brand: "Agilent", group: "hplc", readings: HPLC_READINGS },
  { id: "LD-033", name: "HPLC Agilent 1260", brand: "Agilent", group: "hplc", readings: HPLC_READINGS },
  { id: "LD-034", name: "HPLC Agilent 1260", brand: "Agilent", group: "hplc", readings: HPLC_READINGS },
];

export const analysisGroups: RoomGroup[] = [
  { key: "gc", label: "GC" },
  { key: "hplc", label: "HPLC" },
];
