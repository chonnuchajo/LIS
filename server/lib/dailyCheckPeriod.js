const DAILY_CHECK_PERIODS = Object.freeze(['morning', 'afternoon']);

const DAILY_CHECK_PERIOD_WINDOWS = Object.freeze([
  Object.freeze({ key: 'morning', label: 'เช้า', startMinutes: 8 * 60, endMinutes: 12 * 60 }),
  Object.freeze({ key: 'afternoon', label: 'บ่าย', startMinutes: 13 * 60, endMinutes: 17 * 60 }),
]);

function isDailyCheckPeriod(value) {
  return value === 'morning' || value === 'afternoon';
}

function getDailyCheckPeriod(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const minutes = date.getHours() * 60 + date.getMinutes();
  const period = DAILY_CHECK_PERIOD_WINDOWS.find(
    (window) => minutes >= window.startMinutes && minutes <= window.endMinutes,
  );
  return period ? period.key : null;
}

function getDailyCheckPeriodLabel(period) {
  const found = DAILY_CHECK_PERIOD_WINDOWS.find((window) => window.key === period);
  return found ? found.label : 'นอกเวลา';
}

module.exports = {
  DAILY_CHECK_PERIODS,
  DAILY_CHECK_PERIOD_WINDOWS,
  isDailyCheckPeriod,
  getDailyCheckPeriod,
  getDailyCheckPeriodLabel,
};
