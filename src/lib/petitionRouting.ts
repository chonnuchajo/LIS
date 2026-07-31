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

export function hasLabTrack(
  petition: Pick<Petition, "submittedBy" | "items" | "labReceivedAt" | "labCompletedAt" | "labApprovedAt">,
): boolean {
  return Boolean(
    isResearchAndDevelopmentPetition(petition as Petition) ||
      petition.labReceivedAt ||
      petition.labCompletedAt ||
      petition.labApprovedAt ||
      petition.items?.some((item) => isLabBatchNo(item.batchNo)),
  );
}

export function requiresQcTrack(petition: Pick<Petition, "submittedBy">): boolean {
  return !isResearchAndDevelopmentPetition(petition as Petition);
}
