// Pure client-side filter for EquipmentCheck history rows (used by the
// consolidated Daily Check records tab). Value "all" or undefined = no filter.
import type { EquipmentCheckRecord } from "./api";

export interface RecordFilter {
  room?: string;         // "all" | roomSlug
  instrumentId?: string; // "all" | instrument id
  status?: string;       // "all" | "normal" | "abnormal"
}

export function filterEquipmentRecords(
  records: EquipmentCheckRecord[],
  { room, instrumentId, status }: RecordFilter,
): EquipmentCheckRecord[] {
  return records.filter((r) => {
    if (room && room !== "all" && r.roomSlug !== room) return false;
    if (instrumentId && instrumentId !== "all" && r.instrumentId !== instrumentId) return false;
    if (status && status !== "all" && r.status !== status) return false;
    return true;
  });
}
