// Static catalog for the ห้องเตรียมตัวอย่าง (sample-prep) daily working-check.
// Single source of truth: which instruments render and what each one records.
// Phase 1 = the 13 "main group" instruments. milli-Q / Density / Hood are deferred
// (the EquipmentCheck.readings[] schema already accommodates them).

export type ReadingGroup = "basic" | "temp" | "ph";

export interface ReadingField {
  key: string; // "temp" | "ph"
  label: string; // "อุณหภูมิ" | "pH"
  unit: string; // "°C" | ""
}

export interface SamplePrepInstrument {
  id: string; // "LD-009"
  name: string; // "Hot Air Oven"
  brand: string; // "Memmert" ("" when unknown)
  group: ReadingGroup;
  readings: ReadingField[];
}

export const SAMPLE_PREP_ROOM_SLUG = "sample-prep";

const TEMP: ReadingField = { key: "temp", label: "อุณหภูมิ", unit: "°C" };
const PH: ReadingField = { key: "ph", label: "pH", unit: "" };

export const SAMPLE_PREP_INSTRUMENTS: SamplePrepInstrument[] = [
  // --- basic: status only ---
  { id: "LD-007", name: "Ultrasonic", brand: "NXPC", group: "basic", readings: [] },
  { id: "LD-008", name: "Ultrasonic", brand: "", group: "basic", readings: [] },
  { id: "LD-046", name: "Ultrasonic Cleaner", brand: "Daihan Scientific", group: "basic", readings: [] },
  { id: "LD-041", name: "Asirator pump 2", brand: "Lab companion", group: "basic", readings: [] },
  { id: "LD-025", name: "Hotplate", brand: "", group: "basic", readings: [] },
  { id: "LD-026", name: "Hotplate", brand: "", group: "basic", readings: [] },
  { id: "LD-012", name: "Magnetic stirrer 1", brand: "HL Instruments", group: "basic", readings: [] },
  { id: "LD-040", name: "Magnetic stirrer", brand: "", group: "basic", readings: [] },
  // --- temp: + temperature reading ---
  { id: "LD-009", name: "Hot Air Oven", brand: "Memmert", group: "temp", readings: [TEMP] },
  { id: "LD-010", name: "Oven", brand: "", group: "temp", readings: [TEMP] },
  { id: "LD-029", name: "Water bath", brand: "Memmert", group: "temp", readings: [TEMP] },
  { id: "LD-016", name: "Desiccator 1", brand: "", group: "temp", readings: [TEMP] },
  // --- ph: + pH reading ---
  { id: "LD-011", name: "pH Meter", brand: "Mettler Toledo", group: "ph", readings: [PH] },
];

export const samplePrepGroups: { key: ReadingGroup; label: string }[] = [
  { key: "basic", label: "เครื่องมือทั่วไป" },
  { key: "temp", label: "วัดอุณหภูมิ" },
  { key: "ph", label: "วัด pH" },
];

export const getSamplePrepInstrument = (id: string): SamplePrepInstrument | undefined =>
  SAMPLE_PREP_INSTRUMENTS.find((i) => i.id === id);
