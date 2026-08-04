import type { CoaStatus } from "@/types/coa.types";

export const COA_STATUS_LABELS: Record<CoaStatus, string> = {
  draft: "เธฃเนเธฒเธ",
  pendingApproval: "เธฃเธญ QC Head เธญเธเธธเธกเธฑเธ•เธด",
  approved: "เธญเธเธธเธกเธฑเธ•เธดเนเธฅเนเธง",
  printed: "เธเธดเธกเธเนเนเธฅเนเธง",
  revisionDraft: "เธฃเนเธฒเธเนเธเนเนเธ",
  pendingRevisionApproval: "เธฃเธญเธญเธเธธเธกเธฑเธ•เธดเธเธเธฑเธเนเธเนเนเธ",
  reissued: "เธญเธญเธเนเธซเธกเนเนเธฅเนเธง",
  cancelled: "เธขเธเน€เธฅเธดเธ",
  superseded: "เธ–เธนเธเนเธ—เธเธ—เธตเน",
  rejected: "เนเธกเนเธญเธเธธเธกเธฑเธ•เธด",
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
