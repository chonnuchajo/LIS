import { ENV_ROOMS } from "./dailyCheckEnv";
import { ROOM_CATALOGS } from "./roomEquipment";

export const DAILY_CHECK_SCALE_TOTAL = 5;

export interface DailyCheckExpectedTotals {
  scales: number;
  environment: number;
  equipment: number;
}

export const DAILY_CHECK_EXPECTED_TOTALS: DailyCheckExpectedTotals = {
  scales: DAILY_CHECK_SCALE_TOTAL,
  environment: ENV_ROOMS.length,
  equipment: Object.values(ROOM_CATALOGS).reduce(
    (sum, catalog) => sum + catalog.instruments.length,
    0,
  ),
};

export interface DailyCheckProgressSources {
  scaleIds?: string[] | null;
  scaleCount?: number | null;
  environmentRooms?: string[] | null;
  environmentCount?: number | null;
  equipmentRecords?: Array<{
    roomSlug?: string | null;
    instrumentId?: string | null;
  }> | null;
}

export interface DailyCheckProgress {
  total: number;
  done: number;
  pending: number;
}

function countUnique(values: Array<string | null | undefined> | null | undefined): number | null {
  if (!values) return null;
  const unique = new Set(values.map((value) => value?.trim()).filter(Boolean));
  return unique.size;
}

function countBounded(value: number | null | undefined, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(Math.max(0, Math.floor(value)), max);
}

function countEquipment(records: DailyCheckProgressSources["equipmentRecords"], max: number): number {
  if (!records) return 0;
  const unique = new Set<string>();
  for (const record of records) {
    const roomSlug = record.roomSlug?.trim();
    const instrumentId = record.instrumentId?.trim();
    if (!roomSlug || !instrumentId) continue;
    unique.add(`${roomSlug}:${instrumentId}`);
  }
  return Math.min(unique.size, max);
}

export function dailyCheckProgressFromSources(
  sources: DailyCheckProgressSources,
  totals: DailyCheckExpectedTotals = DAILY_CHECK_EXPECTED_TOTALS,
): DailyCheckProgress {
  const total = totals.scales + totals.environment + totals.equipment;
  const scaleDone = countBounded(
    countUnique(sources.scaleIds) ?? sources.scaleCount,
    totals.scales,
  );
  const environmentDone = countBounded(
    countUnique(sources.environmentRooms) ?? sources.environmentCount,
    totals.environment,
  );
  const equipmentDone = countEquipment(sources.equipmentRecords, totals.equipment);
  const done = Math.min(total, scaleDone + environmentDone + equipmentDone);

  return {
    total,
    done,
    pending: Math.max(0, total - done),
  };
}
