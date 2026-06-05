// Catalog สำหรับ Daily Check ห้องสกัด (extraction).
// 4 เครื่องสถานะอย่างเดียว + 6 เครื่องกรอกอุณหภูมิ (Cooling x2, Heating mantle x4).
import type { RoomInstrument, RoomGroup } from "./roomEquipment";

export const EXTRACTION_ROOM_SLUG = "extraction";

const TEMP = { key: "temp", label: "อุณหภูมิ", unit: "°C" };

export const EXTRACTION_INSTRUMENTS: RoomInstrument[] = [
  { id: "LD-022", name: "Aspirator pump", brand: "", group: "basic", readings: [] },
  { id: "LD-045", name: "Aspirator pump", brand: "", group: "basic", readings: [] },
  { id: "LD-042", name: "Desiccator", brand: "", group: "basic", readings: [] },
  { id: "LD-039", name: "Magnetic stirrer", brand: "", group: "basic", readings: [] },
  { id: "LD-020", name: "Cooling", brand: "", group: "temp", readings: [TEMP] },
  { id: "LD-030", name: "Cooling", brand: "", group: "temp", readings: [TEMP] },
  { id: "LD-017", name: "Heating mantle", brand: "", group: "temp", readings: [TEMP] },
  { id: "LD-018", name: "Heating mantle", brand: "", group: "temp", readings: [TEMP] },
  { id: "LD-036", name: "Heating mantle", brand: "", group: "temp", readings: [TEMP] },
  { id: "LD-037", name: "Heating mantle", brand: "", group: "temp", readings: [TEMP] },
];

export const extractionGroups: RoomGroup[] = [
  { key: "basic", label: "เครื่องมือทั่วไป" },
  { key: "temp", label: "วัดอุณหภูมิ" },
];
