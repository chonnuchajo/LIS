import type { ParameterItem, QCProgressEntry } from "@/lib/api";
import { expandFieldForItem } from "@/lib/parameterValidation";
import { getPetitionCategory, matchParametersForItem } from "@/lib/petitionTestItems";
import { PETITION_STATUS_CONFIG, type Petition, type PetitionAuditLogEntry, type PetitionStatus } from "@/types/petition.types";

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
export type TimelineDetailStage = { key: string; label: string; at: string | null; done: boolean };
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
  timeline: { startAt: string; endAt: string; ticks: TimelineDetailTick[]; stages: TimelineDetailStage[] };
};
export type TimelineDetailInput = {
  petition: Petition;
  parameters: ParameterItem[];
  progressEntries: QCProgressEntry[];
  auditLogs: PetitionAuditLogEntry[];
  itemGroupIds?: Map<string, string[]>;
};

const WORK_START_HOUR = 8;
const WORK_END_HOUR = 20;
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
  return `${String(value.getHours()).padStart(2, "0")}:00`;
}

function formatDayBoundary(value: Date): string {
  return value.toLocaleDateString("th-TH", { day: "2-digit", month: "short" }) + " 08:00";
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
    return Array.from({ length: WORK_END_HOUR - WORK_START_HOUR + 1 }, (_, index) => {
      const at = new Date(dayStart);
      at.setHours(WORK_START_HOUR + index, 0, 0, 0);
      return { key: at.toISOString(), at: at.toISOString(), label: formatHour(at) };
    });
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

function buildStages(petition: Petition, startAt: string, actualEndAt: string | null): TimelineDetailStage[] {
  return [
    { key: "received", label: "รับตัวอย่าง", at: startAt, done: !!petition.qcReceivedAt || !!petition.labReceivedAt || !!petition.receivedAt },
    { key: "assigned", label: "มอบหมายงาน", at: petition.assignedTo?.assignedAt ?? null, done: !!petition.assignedTo?.assignedAt },
    { key: "results", label: "บันทึกผล", at: petition.firstResultAt ?? null, done: !!petition.firstResultAt },
    { key: "qc-completed", label: "QC ครบ", at: petition.qcCompletedAt ?? null, done: !!petition.qcCompletedAt },
    { key: "lab-completed", label: "Lab ครบ", at: petition.labCompletedAt ?? null, done: !!petition.labCompletedAt },
    { key: "lab-approved", label: "ออกผล Lab", at: petition.labApprovedAt ?? null, done: !!petition.labApprovedAt },
    { key: "final", label: petition.status === "rejected" ? "ส่งกลับแก้ไข" : "Final Result", at: actualEndAt, done: !!actualEndAt && FINISHED_STATUSES.has(petition.status) },
  ];
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

  return {
    header: { ...header, startKind: receivedAt ? "received" : "submitted" },
    progress: buildRequiredProgress(tasks, input.petition.status === "approved"),
    tasks,
    activities: normalizeTimelineActivities(input.auditLogs),
    timeline: {
      startAt: isSameLocalDay(new Date(startAt), new Date(header.endAt)) ? atHour(new Date(startAt), WORK_START_HOUR).toISOString() : atHour(new Date(startAt), WORK_START_HOUR).toISOString(),
      endAt: header.endAt,
      ticks: buildTicks(startAt, header.endAt),
      stages: buildStages(input.petition, startAt, actualEndAt),
    },
  };
}
