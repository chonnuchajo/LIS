// Helpers for parsing a raw instrument API payload into a normalized reading.
// Pure functions only (no I/O), so they are unit-testable; the HTTP fetch lives
// in routes/instrument-readings.js.

// Pure: read a dotted path (supports array indices) out of a nested object.
// Returns undefined for any missing/typeless segment instead of throwing.
// Empty path returns the object itself.
function getByPath(obj, path) {
  if (!path) return obj;
  const segments = String(path).split('.');
  let cur = obj;
  for (const seg of segments) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[seg];
  }
  return cur;
}

// Pure: turn a raw payload + InstrumentSource config into a normalized reading.
// Returns { ok:true, value, readingAt } or { ok:false, error }.
//   - value is coerced to a finite number (string numerics allowed)
//   - decimals (if set) rounds the value
//   - readingAtPath (optional) pulls the device timestamp from the payload
function extractReading(raw, source) {
  const { responsePath, decimals, readingAtPath } = source || {};
  const picked = getByPath(raw, responsePath);
  if (picked === undefined || picked === null || picked === '') {
    return { ok: false, error: `ไม่พบค่าตาม responsePath "${responsePath}"` };
  }
  const num = Number(picked);
  if (!Number.isFinite(num)) {
    return { ok: false, error: `ค่าที่ได้ไม่ใช่ตัวเลข: "${picked}"` };
  }
  const value =
    typeof decimals === 'number' && Number.isFinite(decimals)
      ? Number(num.toFixed(decimals))
      : num;

  const out = { ok: true, value };
  if (readingAtPath) {
    const ts = getByPath(raw, readingAtPath);
    if (ts != null) out.readingAt = String(ts);
  }
  return out;
}

module.exports = { getByPath, extractReading };
