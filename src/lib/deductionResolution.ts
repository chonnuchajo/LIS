import type { DeductionResolutionReason } from "@/types/stock";

export const DEDUCTION_RESOLUTION_LABELS: Record<DeductionResolutionReason, string> = {
  empty: "หมด",
  ineffective: "ไม่มีประสิทธิภาพ",
  other: "อื่นๆ",
  expired: "รับทราบหมดอายุ",
};

export const DEDUCTION_RESOLUTION_OPTIONS: DeductionResolutionReason[] = [
  "empty",
  "ineffective",
  "other",
];

export function isDeductionResolutionReady(
  reason: DeductionResolutionReason | "",
  note: string,
): boolean {
  if (!reason) return false;
  if (reason === "ineffective" || reason === "other") return note.trim().length > 0;
  return true;
}
