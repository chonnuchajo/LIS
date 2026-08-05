import type { CoaStatus } from "@/types/coa.types";

export const COA_STATUS_LABELS: Record<CoaStatus, string> = {
  requested: "ขอ COA",
  draft: "ร่าง",
  pendingApproval: "รอ QC Head อนุมัติ",
  approved: "อนุมัติแล้ว",
  printed: "พิมพ์แล้ว",
  revisionDraft: "ร่างฉบับแก้ไข",
  pendingRevisionApproval: "รออนุมัติฉบับแก้ไข",
  reissued: "ออกใหม่แล้ว",
  cancelled: "ยกเลิก",
  superseded: "ถูกแทนที่",
  rejected: "ไม่อนุมัติ",
};

export function coaStatusLabel(status: CoaStatus): string {
  return COA_STATUS_LABELS[status];
}

export function canPrintCoa(status: CoaStatus): boolean {
  return status === "approved" || status === "printed" || status === "reissued";
}

export function allowedCoaActions(status: CoaStatus, isQcHead: boolean): string[] {
  if (status === "draft" || status === "revisionDraft") return ["save", "submit"];
  if ((status === "pendingApproval" || status === "pendingRevisionApproval") && isQcHead) return ["approve", "reject"];
  if (status === "approved" || status === "printed" || status === "reissued") return ["print", "revise", "cancel"];
  return [];
}
