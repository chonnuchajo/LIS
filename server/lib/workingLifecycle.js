// อายุ working ของ standard แยก 2 ค่า:
//  - exp (หมดอายุจริง)  = วันแบ่ง + openShelfLife ; shelf value<=0 → parentExp
//  - frequencyDue (ครบกำหนดความถี่) = วันแบ่ง + ช่วง frequency ; ไม่มี/parse ไม่ได้ → null
//  ทั้งคู่ cap ที่ EXP ขวดแม่. mirror ของ src/lib/stockUnit.ts (computeWorkingLifecycle)

const FREQ_RE = /^\s*\d+\s*\/\s*(\d+)\s*(day|week|month)s?\s*$/i;

function parseFrequencyInterval(str) {
  const m = FREQ_RE.exec(String(str == null ? '' : str));
  if (!m) return null;
  const count = Number(m[1]);
  if (!Number.isFinite(count) || count < 1) return null;
  return { count, unit: m[2].toLowerCase() };
}

function addInterval(from, count, unit) {
  const v = Math.max(0, Math.floor(Number(count) || 0));
  const d = new Date(from);
  if (unit === 'week') { d.setDate(d.getDate() + v * 7); return d; }
  if (unit === 'month') {
    const day = d.getDate();
    d.setDate(1);                              // avoid rollover while shifting month
    d.setMonth(d.getMonth() + v);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDay));         // clamp to end of target month (date-fns addMonths semantics)
    return d;
  }
  d.setDate(d.getDate() + v);
  return d;
}

function capAtParent(date, parentExp) {
  if (!date) return date;
  if (parentExp && date.getTime() > new Date(parentExp).getTime()) return new Date(parentExp);
  return date;
}

function computeWorkingLifecycle({ withdrawnAt, frequency, shelf, parentExp }) {
  const parent = parentExp ? new Date(parentExp) : null;
  const shelfVal = Math.max(0, Math.floor(Number(shelf && shelf.value) || 0));
  const exp = shelfVal <= 0
    ? parent
    : capAtParent(addInterval(withdrawnAt, shelfVal, (shelf && shelf.unit) || 'day'), parent);
  const fi = parseFrequencyInterval(frequency);
  const frequencyDue = fi ? capAtParent(addInterval(withdrawnAt, fi.count, fi.unit), parent) : null;
  return { exp, frequencyDue };
}

module.exports = { parseFrequencyInterval, addInterval, computeWorkingLifecycle };
