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
  if (!std || std.autoPct == null || std.autoPct <= 0 || center == null) {
    return { status: "none", center, autoRange: null, headRange: null };
  }
  const autoAbs = Math.abs(center) * (std.autoPct / 100);
  const headAbs = std.headPct != null ? Math.abs(center) * (std.headPct / 100) : autoAbs;
  const round = (n) => Number(n.toFixed(6));
  const autoRange = [round(center - autoAbs), round(center + autoAbs)];
  const headRange = std.headPct != null ? [round(center - headAbs), round(center + headAbs)] : null;
  const num = typeof value === "number" ? value : Number(value);
  if (value === null || value === undefined || value === "" || Number.isNaN(num)) {
    return { status: "none", center, autoRange, headRange };
  }
  const dev = Math.abs(num - center);
  let status;
  if (dev <= autoAbs) status = "pass";
  else if (dev <= headAbs) status = "review";
  else status = "fail";
  return { status, center, autoRange, headRange };
}

function isLabelToleranceAbnormal(std, rawSpec, value) {
  const s = resolveLabelTolerance(std, rawSpec, value).status;
  return s === "review" || s === "fail";
}

module.exports = { isEnumAbnormal, isNumericAbnormal, isFieldAbnormal, parseLabelPercent, resolveLabelTolerance, isLabelToleranceAbnormal };
