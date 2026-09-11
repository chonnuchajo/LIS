import type { Petition } from "@/types/petition.types";

export function isResearchAndDevelopmentDepartment(department: unknown): boolean {
  return String(department ?? "").replace(/\s+/g, "").toLowerCase() === "r&d";
}

export function isResearchAndDevelopmentPetition(petition: Pick<Petition, "submittedBy">): boolean {
  return isResearchAndDevelopmentDepartment(petition.submittedBy?.department);
}

export function isLabBatchNo(batchNo: unknown): boolean {
  return /[16]$/.test(String(batchNo ?? "").trim());
}

export type LabRouteItem = {
  seq?: number;
  sampleName?: string;
  batchNo?: unknown;
  sendToLab?: unknown;
  note?: unknown;
};

export function defaultSendItemToLab(item: Pick<LabRouteItem, "batchNo">): boolean {
  return isLabBatchNo(item.batchNo);
}

export function shouldSendItemToLab(item: LabRouteItem | null | undefined): boolean {
  if (!item) return false;
  return typeof item.sendToLab === "boolean" ? item.sendToLab : defaultSendItemToLab(item);
}

export function hasSendToLabOverride(item: LabRouteItem | null | undefined): boolean {
  if (!item || typeof item.sendToLab !== "boolean") return false;
  return item.sendToLab !== defaultSendItemToLab(item);
}

export function labSendOverrideNoteError(items: LabRouteItem[]): string | null {
  const missing = items.find((item) => hasSendToLabOverride(item) && !String(item.note ?? "").trim());
  if (!missing) return null;
  const label = missing.seq ? `ลำดับ ${missing.seq}` : missing.sampleName || String(missing.batchNo ?? "").trim() || "นี้";
  return `ตัวอย่าง${label}: โปรดระบุเหตุผล`;
}

export function hasLabTrack(
  petition: Pick<Petition, "submittedBy" | "items" | "labReceivedAt" | "labCompletedAt" | "labApprovedAt">,
): boolean {
  return Boolean(
    isResearchAndDevelopmentPetition(petition as Petition) ||
      petition.labReceivedAt ||
      petition.labCompletedAt ||
      petition.labApprovedAt ||
      petition.items?.some((item) => shouldSendItemToLab(item)),
  );
}

export function requiresQcTrack(petition: Pick<Petition, "submittedBy">): boolean {
  return !isResearchAndDevelopmentPetition(petition as Petition);
}
