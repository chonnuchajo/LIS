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

// Countable value-fields of a parameter (mirrors the frontend `isCountableField`:
// everything except photo). substanceMode fields are NOT unit-expanded here — that
// is the documented heuristic approximation vs the QC page's per-substance bar.
function countableFields(param) {
  return (param.valueFields ?? []).filter((f) => f && f.type !== 'photo');
}

// Number of non-empty entries in a QCTestResult.values object.
function countFilledFields(values) {
  if (!values || typeof values !== 'object') return 0;
  return Object.values(values).filter((v) => v != null && String(v).trim() !== '').length;
}

// { filled, total, percent } at FIELD granularity — total counts every countable
// value-field of every matched QC param (so entering one field of many is < 100%).
function computeQcHeuristic(petition, qcResults, parameters) {
  const items = (petition ?? {}).items ?? [];
  const qcParams = (parameters ?? []).filter(
    (p) => p.status === 'active' && (p.scope ?? 'qc') !== 'lab',
  );

  let total = 0;
  for (const item of items) {
    for (const p of qcParams) {
      if (qcParamAppliesToItem(p, item)) total += countableFields(p).length;
    }
  }

  let filled = 0;
  for (const r of qcResults ?? []) filled += countFilledFields(r.values);
  if (total > 0 && filled > total) filled = total; // cap so percent never exceeds 100
  const percent = total > 0 ? Math.round((filled / total) * 100) : 0;
  return { filled, total, percent };
}

// Distinct "param › field" labels for each filled field, ordered by the result's
// enteredAt then key order. e.g. กายภาพ with values { สี: 'แดง' } → "กายภาพ › สี".
function enteredFieldLabels(qcResults) {
  const rows = (qcResults ?? [])
    .filter((r) => hasFilledValue(r.values))
    .slice()
    .sort((a, b) => new Date(a.enteredAt ?? 0) - new Date(b.enteredAt ?? 0));
  const seen = new Set();
  const labels = [];
  for (const r of rows) {
    const param = String(r.parameterName ?? r.parameterId ?? '').trim();
    for (const [key, val] of Object.entries(r.values ?? {})) {
      if (val == null || String(val).trim() === '') continue;
      const field = String(key).replace('::', ' — '); // substance keys are label::สาร
      const label = param ? `${param} › ${field}` : field;
      if (!seen.has(label)) {
        seen.add(label);
        labels.push(label);
      }
    }
  }
  return labels;
}

// Current detailed status. First matching rule wins (see spec table).
// qc = output of computeQcHeuristic; fieldLabels = enteredFieldLabels(...) ("param › field");
// labDone = every lab sampleId has a completed PhysicalResult (route-computed).
function buildCurrent(petition, qc, fieldLabels, labDone) {
  const status = petition.status;

  // --- terminal / pre-receive states: single label, no tracks ---
  if (status === 'approved') return { label: 'หัวหน้า QC อนุมัติ — ปิดงาน' };
  if (status === 'rejected') return { label: 'ส่งกลับให้แก้ไข' };
  if (status === 'success') return { label: 'เสร็จสิ้น — รอหัวหน้า QC ยืนยัน', side: 'qc' };

  const qcReceived = !!petition.qcReceivedAt;
  const labReceived = !!petition.labReceivedAt;
  if (!qcReceived && !labReceived) {
    if (status === 'sampleSent') return { label: 'ส่งตัวอย่างแล้ว — รอรับ' };
    return { label: 'กำลังนำส่ง QC' };
  }

  // --- dual-track: QC and Lab advance independently ---
  const hasLabItem = (petition.items ?? []).some((it) => isLabBatch(it.batchNo ?? ''));
  const assignee = petition.assignedTo;
  const assigneeSide = assigneeSideOf(assignee); // 'lab' | 'qc' | null — assignment belongs to ONE side
  // "รับงาน" (job accepted) signal — single, per-petition (model has no per-side accept):
  // explicit startTesting review, OR first result recorded, OR QC already has values.
  const started =
    (petition.reviewHistory ?? []).some((r) => r.action === 'startTesting') ||
    !!petition.firstResultAt ||
    qc.filled > 0;

  const qcTrack = buildQcTrack({
    qcReceived, isAssignee: assigneeSide === 'qc', assignee, started, qc, fieldLabels,
  });
  const labTrack = hasLabItem
    ? buildLabTrack({ labReceived, isAssignee: assigneeSide === 'lab', assignee, started, labDone })
    : null;

  const tracks = {};
  if (qcTrack) tracks.qc = { side: 'qc', ...qcTrack };
  if (labTrack) tracks.lab = { side: 'lab', ...labTrack };
  const label = [qcTrack?.label, labTrack?.label].filter(Boolean).join(' | ');
  return { label, tracks };
}

// Which side a (single) assignee belongs to, from HR department/position — the
// petition has one assignedTo with no explicit side, so the assignment line shows
// only on this track. Lab if dept/position mentions "lab"/"วิเคราะห์"; else QC.
function assigneeSideOf(assignee) {
  if (!assignee) return null;
  const hay = `${assignee.department || ''} ${assignee.position || ''}`.toLowerCase();
  if (hay.includes('lab') || hay.includes('วิเคราะห์')) return 'lab';
  return 'qc';
}

// QC side of `current`. Returns { label, percent? }. `isAssignee` = the single
// petition assignee belongs to QC (only then does the assign/accept line show here).
function buildQcTrack({ qcReceived, isAssignee, assignee, started, qc, fieldLabels }) {
  if (!qcReceived) return { label: 'QC รอรับ' };
  if (qc.total > 0 && qc.filled >= qc.total) return { label: 'QC ตรวจครบ — รอยืนยัน' };
  if (qc.filled > 0) {
    const names = (fieldLabels ?? []).length ? ` — ${fieldLabels.join(', ')}` : '';
    return { label: `QC กำลังตรวจ${names} (${qc.percent}%)`, percent: qc.percent };
  }
  if (isAssignee) {
    return started
      ? { label: `QC ${assignee.name} รับงานแล้ว · กำลังตรวจ` }
      : { label: 'QC มอบหมายงานแล้ว รอเจ้าหน้าที่รับงาน' };
  }
  return { label: 'QC รับแล้ว' };
}

// Lab side of `current`. Returns { label } or null (omitted when lab is done).
// `isAssignee` = the single petition assignee belongs to Lab.
function buildLabTrack({ labReceived, isAssignee, assignee, started, labDone }) {
  if (labDone) return null; // lab finished → drop track, QC drives from here
  if (!labReceived) return { label: 'Lab รอรับ' };
  if (isAssignee) {
    return started
      ? { label: `Lab ${assignee.name} รับงานแล้ว · กำลังตรวจ` }
      : { label: 'Lab มอบหมายงานแล้ว รอเจ้าหน้าที่รับงาน' };
  }
  return { label: 'Lab รับแล้ว' };
}

// Maps one audit-log row to a Thai milestone label, or null to skip it.
function timelineLabel(log, petition) {
  const md = log.metadata || {};
  switch (log.event) {
    case 'created':
      return 'ยื่นคำขอ';
    case 'received':
      return md.side === 'lab' ? 'Lab รับตัวอย่าง' : 'QC รับตัวอย่าง';
    case 'assigned':
      return petition?.assignedTo?.name
        ? `มอบหมายให้ ${petition.assignedTo.name}`
        : (log.note || 'มอบหมาย');
    case 'resultEntered': {
      const p = md.parameterName || md.parameterId || '';
      return p ? `QC บันทึกผล — ${p}` : 'QC บันทึกผล';
    }
    case 'resultUpdated': {
      const p = md.parameterName || md.parameterId || '';
      return p ? `QC แก้ไขผล — ${p}` : 'QC แก้ไขผล';
    }
    case 'statusChanged':
      if (log.toStatus === 'sampleSent') return 'ส่งตัวอย่าง';
      if (log.toStatus === 'success') return 'เสร็จสิ้น — รอหัวหน้า QC ยืนยัน';
      if (log.toStatus === 'approved') return 'หัวหน้า QC อนุมัติ — ปิดงาน';
      if (log.toStatus === 'rejected') return 'ส่งกลับให้แก้ไข';
      return null; // other status transitions are not milestones
    default:
      return null; // reviewed / updated / deleted → skipped
  }
}

// Builds the milestone timeline from audit logs (assumed already ascending by createdAt).
function buildTimeline(auditLogs, petition) {
  const out = [];
  for (const log of auditLogs ?? []) {
    const label = timelineLabel(log, petition);
    if (!label) continue;
    const entry = { label, at: log.createdAt, actor: log.actor };
    if (log.event === 'received' && log.metadata?.side) entry.side = log.metadata.side;
    out.push(entry);
  }
  return out;
}

// Success gate — true when every REQUIRED track has recorded completion.
// QC is required on EVERY petition; Lab is required only when the petition has a
// lab-batch item. A petition may transition to `success` only when this holds —
// so a single track finishing (Lab OR QC) never completes the petition alone.
function isPetitionComplete(petition) {
  const items = (petition ?? {}).items ?? [];
  const hasLabItem = items.some((it) => isLabBatch(it.batchNo ?? ''));
  const qcDone = !!(petition ?? {}).qcCompletedAt;
  const labDone = !hasLabItem || !!(petition ?? {}).labCompletedAt;
  return qcDone && labDone;
}

// Top-level: assemble { current, timeline } from route-loaded inputs.
function buildStatusLog(petition, auditLogs, qcResults, parameters, labDone) {
  const qc = computeQcHeuristic(petition, qcResults, parameters);
  const fieldLabels = enteredFieldLabels(qcResults);
  const current = buildCurrent(petition, qc, fieldLabels, !!labDone);
  const timeline = buildTimeline(auditLogs, petition);
  return { current, timeline };
}

module.exports = {
  isLabBatch,
  hasFilledValue,
  qcParamAppliesToItem,
  countableFields,
  countFilledFields,
  computeQcHeuristic,
  enteredFieldLabels,
  buildCurrent,
  timelineLabel,
  buildTimeline,
  buildStatusLog,
  isPetitionComplete,
};
