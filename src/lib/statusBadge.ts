import type { BadgeProps } from "@/components/ui/badge";
import { PETITION_STATUS_CONFIG, type Petition } from "@/types/petition.types";

export type BadgeVariant = NonNullable<BadgeProps["variant"]>;

export type StatusBadge = { label: string; variant: BadgeVariant };

/** Generic semantic tone → Badge soft variant, for statuses that are not petition statuses. */
const TONE_VARIANT = {
  neutral: "gray-soft",
  info: "blue-soft",
  success: "green-soft",
  warning: "yellow-soft",
  danger: "red-soft",
} satisfies Record<string, BadgeVariant>;

export type StatusTone = keyof typeof TONE_VARIANT;

export function toneBadge(tone: StatusTone, label: string): StatusBadge {
  return { label, variant: TONE_VARIANT[tone] };
}

/**
 * Resolve a status string to a badge label + Badge variant.
 * Seeded from PETITION_STATUS_CONFIG so petition statuses render identically everywhere;
 * unknown statuses fall back to a neutral gray badge using the raw status as the label.
 */
export function statusBadge(status: string, labelOverride?: string): StatusBadge {
  const cfg = (PETITION_STATUS_CONFIG as Record<string, { label: string; variant: BadgeVariant }>)[
    status
  ];
  return {
    label: labelOverride ?? cfg?.label ?? status,
    variant: cfg?.variant ?? "gray-soft",
  };
}

export function petitionStatusBadge(petition: Petition): StatusBadge {
  if (["success", "approved", "rejected"].includes(petition.status)) {
    return statusBadge(petition.status);
  }
  if (petition.qcCompletedAt) return toneBadge("warning", "QC ตรวจครบ · รอส่วนอื่น");
  if (petition.labApprovedAt) return toneBadge("warning", "Lab อนุมัติแล้ว · รอ QC");
  if (petition.labCompletedAt) return toneBadge("warning", "Lab ตรวจครบ · รออนุมัติ");
  return statusBadge(petition.status);
}
