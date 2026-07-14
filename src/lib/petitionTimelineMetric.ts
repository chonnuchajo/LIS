import type { TimelineDetailModel } from "@/lib/petitionTimelineDetail";

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

export function estimateMetric(header: TimelineDetailModel["header"]): { label: string; value: string; hint: string } {
  if (header.endKind === "actual") {
    return { label: "End time", value: formatDateTime(header.endAt), hint: "เวลาจริง" };
  }
  if (header.endKind === "unreceived") {
    return { label: "Estimate Time", value: "คาดว่าผลจะออก 1-2 วัน", hint: "ยังไม่รับงาน" };
  }
  return {
    label: "Estimate Time",
    value: formatDateTime(header.endAt),
    hint: header.overdue ? "เลยกำหนด" : "ค่าประมาณ",
  };
}
