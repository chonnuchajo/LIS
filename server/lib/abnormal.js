// Backend copy of the frontend src/lib/parameterValidation.ts abnormal logic.
// KEEP IN SYNC with that file if rules change.

function isEnumAbnormal(field, value) {
  if (field.type !== "enum") return false;
  if (value === null || value === undefined) return false;
  const str = String(value);
  if (str === "") return false;
  if (field.optionOutputs) {
    const entry =
      typeof field.optionOutputs.get === "function"
        ? field.optionOutputs.get(str)
        : field.optionOutputs[str];
    return entry != null && entry.kind === "abnormal";
  }
  const expected = field.expectedValues || [];
  if (expected.length === 0) return false;
  return !expected.includes(str);
}

function isNumericAbnormal(field, value) {
  if (field.type !== "number" && field.type !== "float") return false;
  if (!field.standardOperator) return false;
  if (field.standardValue == null) return false;
  if (value === null || value === undefined || value === "") return false;
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return false;
  const v1 = field.standardValue;
  const v2 = field.standardValue2;
  switch (field.standardOperator) {
    case "lt": return num >= v1;
    case "lte": return num > v1;
    case "eq": return num !== v1;
    case "gte": return num < v1;
    case "gt": return num <= v1;
    case "between":
      if (v2 == null) return false;
      return num < v1 || num > v2;
    case "tolerance":
      if (v2 == null || v2 <= 0) return false;
      return Math.abs(num - v1) > Math.abs(v1) * (v2 / 100);
    default:
      return false;
  }
}

function isFieldAbnormal(field, value) {
  return isEnumAbnormal(field, value) || isNumericAbnormal(field, value);
}

// mirror of src/lib/substances.ts parseLabelPercent — keep in sync
function parseLabelPercent(raw) {
  const m = String(raw == null ? "" : raw).match(/(\d+(?:\.\d+)?)\s*%/);
  return m ? Number(m[1]) : null;
}

// mirror of src/lib/parameterValidation.ts resolveLabelTolerance — keep in sync
function resolveLabelTolerance(std, rawSpec, value) {
  const center = parseLabelPercent(rawSpec);
  if (!std) {
    return { status: "none", center, autoRange: null, headRange: null };
  }
  const num = typeof value === "number" ? value : Number(value);
  const round = (n) => Number(n.toFixed(6));
  if ((std.mode || "percent") === "range") {
    const autoRange = std.passLow == null || std.passHigh == null ? null : [round(std.passLow), round(std.passHigh)];
    const headRange = std.failLow == null || std.failHigh == null ? null : [round(std.failLow), round(std.failHigh)];
    if (!autoRange || !headRange) return { status: "none", center, autoRange: null, headRange: null };
    if (value === null || value === undefined || value === "" || Number.isNaN(num)) {
      return { status: "none", center, autoRange, headRange };
    }
    let status;
    if (num >= autoRange[0] && num <= autoRange[1]) status = "pass";
    else if (num >= headRange[0] && num <= headRange[1]) status = "review";
    else status = "fail";
    return { status, center, autoRange, headRange };
  }
  // percent = ± เป็น % relative ของ center; abs = ± เป็นค่าจริงในหน่วยของ field
  const isAbs = (std.mode || "percent") === "abs";
  const autoAbs = isAbs
    ? std.autoAbs
    : (std.autoPct == null || center == null ? null : Math.abs(center) * (std.autoPct / 100));
  if (autoAbs == null || autoAbs <= 0 || center == null) {
    return { status: "none", center, autoRange: null, headRange: null };
  }
  const headSet = isAbs ? std.headAbs != null : std.headPct != null;
  const headAbs = headSet
    ? (isAbs ? std.headAbs : Math.abs(center) * (std.headPct / 100))
    : autoAbs;
  const autoRange = [round(center - autoAbs), round(center + autoAbs)];
  const headRange = headSet ? [round(center - headAbs), round(center + headAbs)] : null;
  if (value === null || value === undefined || value === "" || Number.isNaN(num)) {
    return { status: "none", center, autoRange, headRange };
  }
  // เทียบกับช่วงที่ round แล้ว (ไม่ใช่ dev ดิบ) — ช่วงที่โชว์ = ช่วงที่ตัดสิน, กันขอบพลาดเพราะ float
  let status;
  if (num >= autoRange[0] && num <= autoRange[1]) status = "pass";
  else if (headRange && num >= headRange[0] && num <= headRange[1]) status = "review";
  else status = "fail";
  return { status, center, autoRange, headRange };
}

function isLabelToleranceAbnormal(std, rawSpec, value) {
  const s = resolveLabelTolerance(std, rawSpec, value).status;
  return s === "review" || s === "fail";
}

module.exports = { isEnumAbnormal, isNumericAbnormal, isFieldAbnormal, parseLabelPercent, resolveLabelTolerance, isLabelToleranceAbnormal };
