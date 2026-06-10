// Derives a human-readable status_log ({ current, timeline }) for a petition.
// Pure functions — NO DB access. The route loads inputs and calls buildStatusLog.

// Lab batch rule (mirrors src/types/petition.types.ts isLabBatch):
// last char of trimmed batchNo is '1' or '6'.
function isLabBatch(batchNo) {
  const last = String(batchNo ?? '').trim().slice(-1);
  return last === '1' || last === '6';
}

// True if a QCTestResult.values object has at least one non-empty field value.
function hasFilledValue(values) {
  if (!values || typeof values !== 'object') return false;
  return Object.values(values).some((v) => v != null && String(v).trim() !== '');
}

// Lightweight QC-applicability check (heuristic — intentionally OMITS
// productType / subCategory / itemGroup / simple-method dimensions that the
// frontend matchParametersForItem uses).
function qcParamAppliesToItem(param, item) {
  if (param.applyAll) return true;
  const commonName = String(item.commonName ?? '').trim().toUpperCase();
  if (commonName && (param.commonNames ?? []).some((c) => String(c).trim().toUpperCase() === commonName)) {
    return true;
  }
  const sampleName = String(item.sampleName ?? '').trim();
  if (sampleName && (param.itemNames ?? []).some((n) => String(n).trim() === sampleName)) {
    return true;
  }
  const testNames = String(item.testItems ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (testNames.length && testNames.includes(String(param.name ?? '').trim().toLowerCase())) {
    return true;
  }
  return false;
}

// { filled, total, percent } at the (item × QC-param) granularity.
function computeQcHeuristic(petition, qcResults, parameters) {
  const items = petition.items ?? [];
  const qcParams = (parameters ?? []).filter(
    (p) => p.status === 'active' && (p.scope ?? 'qc') !== 'lab',
  );

  let total = 0;
  for (const item of items) {
    for (const p of qcParams) {
      if (qcParamAppliesToItem(p, item)) total += 1;
    }
  }

  const filledKeys = new Set();
  for (const r of qcResults ?? []) {
    if (hasFilledValue(r.values)) filledKeys.add(`${r.itemSeq}__${r.parameterId}`);
  }
  let filled = filledKeys.size;
  if (total > 0 && filled > total) filled = total; // cap so percent never exceeds 100
  const percent = total > 0 ? Math.round((filled / total) * 100) : 0;
  return { filled, total, percent };
}

// Distinct QC parameter names that have >=1 filled value, ordered by first enteredAt.
function enteredParamNames(qcResults) {
  const rows = (qcResults ?? [])
    .filter((r) => hasFilledValue(r.values))
    .slice()
    .sort((a, b) => new Date(a.enteredAt ?? 0) - new Date(b.enteredAt ?? 0));
  const seen = new Set();
  const names = [];
  for (const r of rows) {
    const name = String(r.parameterName ?? r.parameterId ?? '').trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

module.exports = {
  isLabBatch,
  hasFilledValue,
  qcParamAppliesToItem,
  computeQcHeuristic,
  enteredParamNames,
};
