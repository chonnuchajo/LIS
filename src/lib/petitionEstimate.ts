export const WORK_START_HOUR = 8;
export const WORK_END_HOUR = 17;

// วันอาทิตย์ (getDay() === 0) เป็นวันหยุดวันเดียว — เสาร์ทำงานปกติ
function isWorkingDay(value: Date): boolean {
  return value.getDay() !== 0;
}

function atHour(value: Date, hour: number): Date {
  const result = new Date(value);
  result.setHours(hour, 0, 0, 0);
  return result;
}

function startOfNextWorkingDay(value: Date): Date {
  const result = atHour(value, WORK_START_HOUR);
  do {
    result.setDate(result.getDate() + 1);
  } while (!isWorkingDay(result));
  return result;
}

// ดันเวลาเข้าหน้าต่างทำงาน 08:00-17:00 ของวันทำการ (ไม่ขยับถ้าอยู่ในช่วงอยู่แล้ว)
function clampToWorkingWindow(value: Date): Date {
  if (!isWorkingDay(value)) return startOfNextWorkingDay(value);
  const dayStart = atHour(value, WORK_START_HOUR);
  const dayEnd = atHour(value, WORK_END_HOUR);
  if (value.getTime() < dayStart.getTime()) return dayStart;
  if (value.getTime() >= dayEnd.getTime()) return startOfNextWorkingDay(value);
  return new Date(value);
}

export function addWorkingMinutes(from: Date, minutes: number): Date {
  let cursor = clampToWorkingWindow(from);
  let remaining = Math.max(0, Math.round(minutes));
  while (remaining > 0) {
    const dayEnd = atHour(cursor, WORK_END_HOUR);
    const availableMinutes = Math.round((dayEnd.getTime() - cursor.getTime()) / 60000);
    if (remaining <= availableMinutes) {
      cursor = new Date(cursor.getTime() + remaining * 60000);
      remaining = 0;
    } else {
      remaining -= availableMinutes;
      cursor = startOfNextWorkingDay(cursor);
    }
  }
  return cursor;
}

export function endOfNextWorkingDay(from: Date): Date {
  return atHour(startOfNextWorkingDay(from), WORK_END_HOUR);
}
