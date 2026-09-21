export const DAILY_CHECK_PERIODS = ["morning", "afternoon"] as const;

export type DailyCheckPeriod = (typeof DAILY_CHECK_PERIODS)[number];

type DailyCheckPeriodWindow = {
  key: DailyCheckPeriod;
  label: string;
  startMinutes: number;
  endMinutes: number;
};

export const DAILY_CHECK_PERIOD_WINDOWS: readonly DailyCheckPeriodWindow[] = [
  { key: "morning", label: "เช้า", startMinutes: 8 * 60, endMinutes: 12 * 60 },
  { key: "afternoon", label: "บ่าย", startMinutes: 13 * 60, endMinutes: 17 * 60 },
];

export const DAILY_CHECK_PERIOD_COUNT = DAILY_CHECK_PERIODS.length;

export function isDailyCheckPeriod(value: unknown): value is DailyCheckPeriod {
  return value === "morning" || value === "afternoon";
}

export function getDailyCheckPeriod(value: Date | string | number = new Date()): DailyCheckPeriod | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const minutes = date.getHours() * 60 + date.getMinutes();
  const period = DAILY_CHECK_PERIOD_WINDOWS.find(
    (window) => minutes >= window.startMinutes && minutes <= window.endMinutes,
  );
  return period?.key ?? null;
}

export function getDailyCheckPeriodLabel(period: DailyCheckPeriod | null | undefined): string {
  return DAILY_CHECK_PERIOD_WINDOWS.find((window) => window.key === period)?.label ?? "นอกเวลา";
}

export function getCurrentDailyCheckPeriod(now: Date = new Date()): DailyCheckPeriod | null {
  return getDailyCheckPeriod(now);
}
