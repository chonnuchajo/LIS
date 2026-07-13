import type { ParameterItem, QCProgressEntry } from "@/lib/api";
import { expandFieldForItem } from "@/lib/parameterValidation";
import { getPetitionCategory, matchParametersForItem } from "@/lib/petitionTestItems";
import { hasLabTrack } from "@/lib/statusBadge";
import { PETITION_STATUS_CONFIG, type Petition, type PetitionAuditLogEntry, type PetitionStatus, type QCTestResult } from "@/types/petition.types";

export type TimelineDetailTaskState = "pending" | "inProgress" | "recorded" | "approved";
export type TimelineDetailTask = {
  key: string;
  parameterName: string;
  sampleName: string;
  itemSeq: number;
  filled: number;
  total: number;
  state: TimelineDetailTaskState;
};
export type TimelineDetailProgress = { filled: number; total: number; percent: number | null };
export type TimelineDetailActivity = { key: string; at: string; actor: string | null; label: string };
export type TimelineDetailTick = { key: string; at: string; label: string };
export type TimelineDetailRowKind = "milestone" | "bar";
export type TimelineDetailRowTrack = "qc" | "lab" | "stage";
export type TimelineDetailRow = {
  key: string;
  label: string;
  kind: TimelineDetailRowKind;
  track: TimelineDetailRowTrack;
  at: string | null;
  startAt: string | null;
  endAt: string | null;
  done: boolean;
};
export type TimelineDetailDay = {
  key: string;
  label: string;
  startAt: string;
  endAt: string;
  ticks: TimelineDetailTick[];
  stages: TimelineDetailRow[];
};
export type TimelineDetailHeader = {
  startAt: string;
  startKind: "received" | "submitted";
  endAt: string;
  endKind: "actual" | "estimated" | "ongoing";
};
export type TimelineDetailModel = {
  header: TimelineDetailHeader;
  progress: TimelineDetailProgress;
  tasks: TimelineDetailTask[];
  activities: TimelineDetailActivity[];
  timeline: { startAt: string; endAt: string; ticks: TimelineDetailTick[]; rows: TimelineDetailRow[]; days: TimelineDetailDay[] };
};
export type TimelineDetailInput = {
  petition: Petition;
  parameters: ParameterItem[];
  progressEntries: QCProgressEntry[];
  auditLogs: PetitionAuditLogEntry[];
  qcResults: QCTestResult[];
  itemGroupIds?: Map<string, string[]>;
};

const WORK_START_HOUR = 8;
const WORK_END_HOUR = 17;
const FINISHED_STATUSES = new Set<PetitionStatus>(["success", "approved", "rejected"]);

function validDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function firstValidDate(...values: Array<string | null | undefined>): string | null {
  const dates = values.map(validDate).filter((date): date is Date => !!date);
  return dates.length === 0 ? null : new Date(Math.min(...dates.map((date) => date.getTime()))).toISOString();
}

function latestValidDate(...values: Array<string | null | undefined>): string | null {
  const dates = values.map(validDate).filter((date): date is Date => !!date);
  return dates.length === 0 ? null : new Date(Math.max(...dates.map((date) => date.getTime()))).toISOString();
}

function atHour(value: Date, hour: number): Date {
  const result = new Date(value);
  result.setHours(hour, 0, 0, 0);
  return result;
}

function isSameLocalDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function formatHour(value: Date): string {
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}

function formatDayBoundary(value: Date): string {
  return value.toLocaleDateString("th-TH", { day: "2-digit", month: "short" }) + " 08:00";
}

function formatDayLabel(value: Date): string {
  return value.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

function localDayKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildHeaderTiming(startAt: string, actualEndAt: string | null, status: PetitionStatus, now: Date): TimelineDetailHeader {
  const start = new Date(startAt);
  if (actualEndAt && FINISHED_STATUSES.has(status)) {
    return { startAt, startKind: "received", endAt: actualEndAt, endKind: "actual" };
  }
  if (isSameLocalDay(start, now)) {
    return { startAt, startKind: "received", endAt: atHour(start, WORK_END_HOUR).toISOString(), endKind: "estimated" };
  }
  return { startAt, startKind: "received", endAt: now.toISOString(), endKind: "ongoing" };
}

function buildTicks(startAt: string, endAt: string): TimelineDetailTick[] {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (isSameLocalDay(start, end)) {
    const dayStart = atHour(start, WORK_START_HOUR);
    const finalHour = Math.max(WORK_END_HOUR, end.getHours());
    const ticks = Array.from({ length: finalHour - WORK_START_HOUR + 1 }, (_, index) => {
      const at = new Date(dayStart);
      at.setHours(WORK_START_HOUR + index, 0, 0, 0);
      return { key: at.toISOString(), at: at.toISOString(), label: formatHour(at) };
    });
    if (ticks[ticks.length - 1]?.at !== endAt && end.getMinutes() !== 0) {
      ticks.push({ key: endAt, at: endAt, label: formatHour(end) });
    }
    return ticks;
  }

  const ticks: TimelineDetailTick[] = [];
  for (let cursor = atHour(start, WORK_START_HOUR); cursor.getTime() <= end.getTime(); cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1, WORK_START_HOUR)) {
    ticks.push({ key: cursor.toISOString(), at: cursor.toISOString(), label: formatDayBoundary(cursor) });
    const workEnd = atHour(cursor, WORK_END_HOUR);
    if (workEnd.getTime() <= end.getTime()) {
      ticks.push({ key: workEnd.toISOString(), at: workEnd.toISOString(), label: "20:00" });
    }
  }
  if (ticks[ticks.length - 1]?.at !== endAt) {
    ticks.push({ key: endAt, at: endAt, label: formatHour(end) });
  }
  return ticks;
}

function buildTimelineDays(startAt: string, endAt: string, rows: TimelineDetailRow[]): TimelineDetailDay[] {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const days: TimelineDetailDay[] = [];

  for (
    let cursor = atHour(start, WORK_START_HOUR);
    cursor.getTime() <= end.getTime();
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1, WORK_START_HOUR)
  ) {
    const dayStart = atHour(cursor, WORK_START_HOUR);
    const defaultDayEnd = atHour(cursor, WORK_END_HOUR);
    const dayEnd = isSameLocalDay(cursor, end) && end.getTime() > defaultDayEnd.getTime()
      ? end
      : defaultDayEnd;
    const visibleStages = rows.filter((row) => {
      const rowAt = validDate(row.at);
      return !!rowAt && rowAt.getTime() >= dayStart.getTime() && rowAt.getTime() <= dayEnd.getTime();
    });

    days.push({
      key: localDayKey(cursor),
      label: formatDayLabel(cursor),
      startAt: dayStart.toISOString(),
      endAt: dayEnd.toISOString(),
      ticks: buildTicks(dayStart.toISOString(), dayEnd.toISOString()),
      stages: visibleStages,
    });
  }

  return days.length ? days : [{
    key: localDayKey(start),
    label: formatDayLabel(start),
    startAt: atHour(start, WORK_START_HOUR).toISOString(),
    endAt: atHour(start, WORK_END_HOUR).toISOString(),
    ticks: buildTicks(atHour(start, WORK_START_HOUR).toISOString(), atHour(start, WORK_END_HOUR).toISOString()),
    stages: [],
  }];
}

function buildRequiredTasks(
  petition: Petition,
  parameters: ParameterItem[],
  progressEntries: QCProgressEntry[],
  itemGroupIds?: Map<string, string[]>,
): TimelineDetailTask[] {
  const filledByResult = new Map(progressEntries.map((entry) => [`${entry.itemSeq}::${entry.parameterId}`, new Set(entry.filledLabels)]));
  const category = getPetitionCategory(petition);
  const finalApproved = petition.status === "approved";
  const tasks: TimelineDetailTask[] = [];

  for (const item of petition.items ?? []) {
    const groupIds = itemGroupIds?.get(String(item.sampleId ?? "").trim()) ?? [];
    for (const parameter of matchParametersForItem(item, parameters, groupIds)) {
      const parameterId = parameter._id;
      if (!parameterId) continue;
      const requiredFields = (parameter.valueFields ?? []).filter((field) => field.required === true && field.type !== "photo");
      const requiredKeys = requiredFields.flatMap((field) => expandFieldForItem(field, item.commonName, { category }).map((unit) => unit.key));
      if (requiredKeys.length === 0) continue;
      const filledLabels = filledByResult.get(`${item.seq}::${parameterId}`) ?? new Set<string>();
      const filled = requiredKeys.filter((key) => filledLabels.has(key)).length;
      const state: TimelineDetailTaskState = finalApproved
        ? "approved"
        : filled === 0
          ? "pending"
          : filled === requiredKeys.length
            ? "recorded"
            : "inProgress";
      tasks.push({
        key: `${item.seq}::${parameterId}`,
        parameterName: parameter.name,
        sampleName: item.sampleName || "-",
        itemSeq: item.seq,
        filled,
        total: requiredKeys.length,
        state,
      });
    }
  }
  return tasks;
}

function buildRequiredProgress(tasks: TimelineDetailTask[], isApproved: boolean): TimelineDetailProgress {
  const total = tasks.reduce((sum, task) => sum + task.total, 0);
  const filled = tasks.reduce((sum, task) => sum + task.filled, 0);
  if (total === 0) return { filled: 0, total: 0, percent: null };
  const rawPercent = Math.round((filled / total) * 100);
  return { filled, total, percent: isApproved ? 100 : Math.min(rawPercent, 99) };
}

function statusLabel(status?: PetitionStatus): string {
  return status ? PETITION_STATUS_CONFIG[status]?.label ?? status : "เปลี่ยนสถานะ";
}

function metadataString(metadata: Record<string, unknown> | undefined, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function metadataNumber(metadata: Record<string, unknown> | undefined, key: string): number | null {
  const value = metadata?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function metadataObjectName(metadata: Record<string, unknown> | undefined, key: string): string | null {
  const value = metadata?.[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  for (const property of ["name", "email", "employeeId"]) {
    const text = candidate[property];
    if (typeof text === "string" && text.trim()) return text.trim();
  }
  return null;
}

function resultActivityTarget(entry: PetitionAuditLogEntry): string | null {
  const parameterName = metadataString(entry.metadata, "parameterName");
  const fieldLabel = metadataString(entry.metadata, "fieldLabel");
  const sampleName = metadataString(entry.metadata, "sampleName");
  const parameterAndField = [parameterName, fieldLabel].filter(Boolean).join(" · ");
  if (parameterAndField) return sampleName ? `${parameterAndField} (${sampleName})` : parameterAndField;
  return entry.note?.trim() || null;
}

function activityLabel(entry: PetitionAuditLogEntry): string {
  switch (entry.event) {
    case "created": return "สร้างคำร้อง";
    case "received": return metadataString(entry.metadata, "side") === "lab" ? "Lab รับตัวอย่าง" : "QC รับตัวอย่าง";
    case "assigned": {
      const assignee = metadataString(entry.metadata, "assignee") ?? metadataObjectName(entry.metadata, "assignee");
      return `มอบหมาย${assignee ? `ให้ ${assignee}` : "งาน"}`;
    }
    case "resultEntered": {
      const target = resultActivityTarget(entry);
      return `บันทึกผล${target ? `: ${target}` : ""}`;
    }
    case "resultUpdated": {
      const target = resultActivityTarget(entry);
      return `แก้ไขผล${target ? `: ${target}` : ""}`;
    }
    case "statusChanged": return entry.note?.trim() || `เปลี่ยนสถานะเป็น ${statusLabel(entry.toStatus)}`;
    case "reviewed": return entry.note?.trim() || "พิจารณาคำร้อง";
    case "updated": return entry.note?.trim() || "แก้ไขข้อมูลคำร้อง";
    case "deleted": return "ลบคำร้อง";
  }
}

function normalizeTimelineActivities(entries: PetitionAuditLogEntry[]): TimelineDetailActivity[] {
  return entries
    .filter((entry) => !!validDate(entry.createdAt))
    .map((entry) => ({ key: entry._id, at: entry.createdAt, actor: entry.actor?.trim() || null, label: activityLabel(entry) }))
    .sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime());
}

function makeBarRow(input: {
  key: string;
  label: string;
  track: TimelineDetailRowTrack;
  startAt: string | null;
  endAt: string | null;
}): TimelineDetailRow {
  const start = validDate(input.startAt);
  const end = validDate(input.endAt);
  const complete = !!start && !!end;
  // กันข้อมูลเพี้ยน: ถ้า start มาหลัง end ให้ยุบเป็นแท่งสั้น ๆ ที่ end
  const orderedStart = complete && start.getTime() > end.getTime() ? end : start;
  return {
    key: input.key,
    label: input.label,
    kind: "bar",
    track: input.track,
    at: null,
    startAt: complete ? orderedStart.toISOString() : null,
    endAt: complete ? end.toISOString() : null,
    done: complete,
  };
}

function buildMilestoneRows(petition: Petition): TimelineDetailRow[] {
  const hasLab = hasLabTrack(petition);
  const qcReceivedAt = petition.qcReceivedAt ?? petition.receivedAt ?? null;
  const labReceivedAt = petition.labReceivedAt ?? null;
  const assignedAt = petition.assignedTo?.assignedAt ?? null;
  const milestone = (key: string, label: string, at: string | null): TimelineDetailRow =>
    ({ key, label, kind: "milestone", track: "stage", at, startAt: null, endAt: null, done: !!validDate(at) });

  return [
    milestone("received-qc", "QC รับตัวอย่าง", qcReceivedAt),
    hasLab ? milestone("received-lab", "Lab รับตัวอย่าง", labReceivedAt) : null,
    hasLab ? milestone("assigned", "มอบหมายงาน Lab", assignedAt) : null,
  ].filter((row): row is TimelineDetailRow => row !== null);
}

// เวลาล่าสุดที่มีคน "แตะ" แต่ละคู่ (itemSeq, parameterId) — audit log เป็นหลัก, QCTestResult เป็น fallback ของคำร้องเก่า
function buildParameterTouches(auditLogs: PetitionAuditLogEntry[], qcResults: QCTestResult[]): Map<string, string> {
  const latest = new Map<string, number>();

  for (const entry of auditLogs) {
    if (entry.event !== "resultEntered" && entry.event !== "resultUpdated") continue;
    const parameterId = metadataString(entry.metadata, "parameterId");
    const itemSeq = metadataNumber(entry.metadata, "itemSeq");
    const touchedAt = validDate(entry.createdAt);
    if (!parameterId || itemSeq == null || !touchedAt) continue;
    const key = `${itemSeq}::${parameterId}`;
    latest.set(key, Math.max(latest.get(key) ?? 0, touchedAt.getTime()));
  }

  for (const result of qcResults) {
    const key = `${result.itemSeq}::${result.parameterId}`;
    if (latest.has(key)) continue;
    const touchedAt = validDate(result.updatedAt ?? result.enteredAt);
    if (touchedAt) latest.set(key, touchedAt.getTime());
  }

  return new Map(Array.from(latest, ([key, time]) => [key, new Date(time).toISOString()]));
}

function buildParameterRows(
  petition: Petition,
  parameters: ParameterItem[],
  auditLogs: PetitionAuditLogEntry[],
  qcResults: QCTestResult[],
  itemGroupIds: Map<string, string[]> | undefined,
  fallbackStartAt: string,
): TimelineDetailRow[] {
  const touches = buildParameterTouches(auditLogs, qcResults);
  const groups = new Map<string, { parameter: ParameterItem; pairKeys: string[] }>();

  for (const item of petition.items ?? []) {
    const groupIds = itemGroupIds?.get(String(item.sampleId ?? "").trim()) ?? [];
    for (const parameter of matchParametersForItem(item, parameters, groupIds)) {
      const parameterId = parameter._id;
      if (!parameterId) continue;
      const group = groups.get(parameterId) ?? { parameter, pairKeys: [] };
      group.pairKeys.push(`${item.seq}::${parameterId}`);
      groups.set(parameterId, group);
    }
  }

  const rows = Array.from(groups, ([parameterId, group]) => {
    const isLab = group.parameter.scope === "lab";
    const receivedAt = (isLab ? petition.labReceivedAt : petition.qcReceivedAt) ?? fallbackStartAt;
    const touchedAts = group.pairKeys.map((key) => touches.get(key) ?? null);
    // ยังแตะไม่ครบทุกตัวอย่าง → ไม่วาดแท่ง
    const endAt = touchedAts.every((touchedAt) => !!touchedAt) ? latestValidDate(...touchedAts) : null;
    return makeBarRow({
      key: `param::${parameterId}`,
      label: group.parameter.name,
      track: isLab ? "lab" : "qc",
      startAt: endAt ? receivedAt : null,
      endAt,
    });
  });

  // QC ก่อน Lab (Array.prototype.sort เสถียร → ลำดับเดิมภายในกลุ่มคงอยู่)
  return rows.sort((left, right) => Number(left.track === "lab") - Number(right.track === "lab"));
}

function buildClosingRows(petition: Petition): TimelineDetailRow[] {
  const hasLab = hasLabTrack(petition);
  const labApprovedAt = petition.labApprovedAt ?? null;
  const qcCompletedAt = petition.qcCompletedAt ?? null;
  // Final เริ่มเมื่อ "ทั้งสองฝั่งจบ" — คำร้องที่มี Lab ต้องรอ Lab ออกผลด้วย
  const finalStartAt = hasLab
    ? (qcCompletedAt && labApprovedAt ? latestValidDate(qcCompletedAt, labApprovedAt) : null)
    : qcCompletedAt;
  const finalEndAt = petition.status === "rejected"
    ? petition.rejectedAt ?? null
    : petition.approvedAt ?? null;

  return [
    hasLab ? makeBarRow({
      key: "lab-approved",
      label: "ออกผล Lab",
      track: "lab",
      startAt: petition.labCompletedAt ?? null,
      endAt: labApprovedAt,
    }) : null,
    makeBarRow({
      key: "final",
      label: petition.status === "rejected" ? "ส่งกลับแก้ไข" : "Final Result",
      track: "stage",
      startAt: finalStartAt,
      endAt: finalEndAt,
    }),
  ].filter((row): row is TimelineDetailRow => row !== null);
}

export function buildTimelineDetailModel(input: TimelineDetailInput, now = new Date()): TimelineDetailModel {
  const submittedAt = firstValidDate(input.petition.submittedBy?.submittedAt, input.petition.createdAt) ?? now.toISOString();
  const receivedAt = firstValidDate(input.petition.qcReceivedAt, input.petition.labReceivedAt, input.petition.receivedAt);
  const startAt = receivedAt ?? submittedAt;
  const actualEndAt = latestValidDate(
    input.petition.approvedAt,
    input.petition.rejectedAt,
    input.petition.completedAt,
    input.petition.labApprovedAt,
    input.petition.labCompletedAt,
    input.petition.qcCompletedAt,
  );
  const header = buildHeaderTiming(startAt, actualEndAt, input.petition.status, now);
  const tasks = buildRequiredTasks(input.petition, input.parameters, input.progressEntries, input.itemGroupIds);
  const rows = [
    ...buildMilestoneRows(input.petition),
    ...buildParameterRows(input.petition, input.parameters, input.auditLogs, input.qcResults ?? [], input.itemGroupIds, startAt),
    ...buildClosingRows(input.petition),
  ];

  return {
    header: { ...header, startKind: receivedAt ? "received" : "submitted" },
    progress: buildRequiredProgress(tasks, input.petition.status === "approved"),
    tasks,
    activities: normalizeTimelineActivities(input.auditLogs),
    timeline: {
      startAt: atHour(new Date(startAt), WORK_START_HOUR).toISOString(),
      endAt: header.endAt,
      ticks: buildTicks(startAt, header.endAt),
      rows,
      days: buildTimelineDays(startAt, header.endAt, rows),
    },
  };
}
