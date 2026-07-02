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

module.exports = { isEnumAbnormal, isNumericAbnormal, isFieldAbnormal };
