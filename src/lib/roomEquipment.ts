// Shared catalog types + registry สำหรับหน้า Daily Check แบบเช็กเครื่องมือ (EquipmentCheck).
// แต่ละห้องลงทะเบียน catalog (เครื่องมือ + กลุ่ม) ที่นี่; หน้าเพจกลางดึงผ่าน getRoomCatalog.
// หมายเหตุ: import จาก ./samplePrepInstruments เป็น value import ได้ เพราะไฟล์นั้นไม่
// import กลับมาที่นี่ (ไม่มี circular). analysis/extraction import เฉพาะ type (erased).
import {
  SAMPLE_PREP_INSTRUMENTS,
  SAMPLE_PREP_ROOM_SLUG,
  samplePrepGroups,
} from "./samplePrepInstruments";
import {
  ANALYSIS_INSTRUMENTS,
  ANALYSIS_ROOM_SLUG,
  analysisGroups,
} from "./analysisInstruments";
import {
  EXTRACTION_INSTRUMENTS,
  EXTRACTION_ROOM_SLUG,
  extractionGroups,
} from "./extractionInstruments";

export interface ReadingField {
  key: string;
  label: string;
  unit: string;
}

export interface RoomInstrument {
  id: string;
  name: string;
  brand: string;
  group: string;
  readings: ReadingField[];
}

export interface RoomGroup {
  key: string;
  label: string;
}

export interface RoomCatalog {
  slug: string;
  instruments: RoomInstrument[];
  groups: RoomGroup[];
}

export const ROOM_CATALOGS: Record<string, RoomCatalog> = {
  [SAMPLE_PREP_ROOM_SLUG]: {
    slug: SAMPLE_PREP_ROOM_SLUG,
    instruments: SAMPLE_PREP_INSTRUMENTS,
    groups: samplePrepGroups,
  },
  [ANALYSIS_ROOM_SLUG]: {
    slug: ANALYSIS_ROOM_SLUG,
    instruments: ANALYSIS_INSTRUMENTS,
    groups: analysisGroups,
  },
  [EXTRACTION_ROOM_SLUG]: {
    slug: EXTRACTION_ROOM_SLUG,
    instruments: EXTRACTION_INSTRUMENTS,
    groups: extractionGroups,
  },
};

export const getRoomCatalog = (slug: string): RoomCatalog | undefined =>
  ROOM_CATALOGS[slug];
