import { ENV_ROOMS } from "./dailyCheckEnv";
import { DAILY_CHECK_PERIOD_COUNT, getDailyCheckPeriod, isDailyCheckPeriod, type DailyCheckPeriod } from "./dailyCheckPeriod";
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
  scaleRecords?: Array<{
    scaleId?: string | null;
    checkedAt?: string | Date | null;
    period?: DailyCheckPeriod | string | null;
  }> | null;
  environmentRooms?: string[] | null;
  environmentCount?: number | null;
  environmentRecords?: Array<{
    room?: string | null;
    checkedAt?: string | Date | null;
    period?: DailyCheckPeriod | string | null;
  }> | null;
  equipmentRecords?: Array<{
    roomSlug?: string | null;
    instrumentId?: string | null;
    checkedAt?: string | Date | null;
    period?: DailyCheckPeriod | string | null;
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

function periodOf(record: { period?: DailyCheckPeriod | string | null; checkedAt?: string | Date | null }): DailyCheckPeriod | null {
  if (isDailyCheckPeriod(record.period)) return record.period;
  if (!record.checkedAt) return null;
  return getDailyCheckPeriod(record.checkedAt);
}

function countByItemPeriod<T>(
  records: T[] | null | undefined,
  itemKey: (record: T) => string | null,
  max: number,
  maxLegacyItems: number,
): number | null {
  if (!records) return null;
  const uniquePeriods = new Set<string>();
  const legacyItems = new Set<string>();
  for (const record of records) {
    const key = itemKey(record)?.trim();
    if (!key) continue;
    const timedRecord = record as T & { period?: DailyCheckPeriod | string | null; checkedAt?: string | Date | null };
    const period = periodOf(timedRecord);
    if (period) {
      uniquePeriods.add(`${key}:${period}`);
    } else if (!timedRecord.checkedAt) {
      legacyItems.add(key);
    }
  }
  return Math.min(uniquePeriods.size + Math.min(legacyItems.size, maxLegacyItems), max);
}

function countEquipment(records: DailyCheckProgressSources["equipmentRecords"], max: number): number {
  return countByItemPeriod(
    records,
    (record) => {
      const roomSlug = record.roomSlug?.trim();
      const instrumentId = record.instrumentId?.trim();
      return roomSlug && instrumentId ? `${roomSlug}:${instrumentId}` : null;
    },
    max,
    max / DAILY_CHECK_PERIOD_COUNT,
  ) ?? 0;
}

export function dailyCheckProgressFromSources(
  sources: DailyCheckProgressSources,
  totals: DailyCheckExpectedTotals = DAILY_CHECK_EXPECTED_TOTALS,
): DailyCheckProgress {
  const scaleTotal = totals.scales * DAILY_CHECK_PERIOD_COUNT;
  const environmentTotal = totals.environment * DAILY_CHECK_PERIOD_COUNT;
  const equipmentTotal = totals.equipment * DAILY_CHECK_PERIOD_COUNT;
  const total = scaleTotal + environmentTotal + equipmentTotal;
  const scaleDone = countBounded(
    countByItemPeriod(sources.scaleRecords, (record) => record.scaleId?.trim() || null, scaleTotal, totals.scales) ??
      countUnique(sources.scaleIds) ??
      sources.scaleCount,
    scaleTotal,
  );
  const environmentDone = countBounded(
    countByItemPeriod(sources.environmentRecords, (record) => record.room?.trim() || null, environmentTotal, totals.environment) ??
      countUnique(sources.environmentRooms) ??
      sources.environmentCount,
    environmentTotal,
  );
  const equipmentDone = countEquipment(sources.equipmentRecords, equipmentTotal);
  const done = Math.min(total, scaleDone + environmentDone + equipmentDone);

  return {
    total,
    done,
    pending: Math.max(0, total - done),
  };
}
