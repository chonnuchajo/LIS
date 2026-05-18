import type { Petition } from "@/types/petition.types";

const LAB_BATCH_LAST_DIGITS = new Set(["1", "6"]);

export type PetitionWorkSection = "Lab" | "QC";

export function isLabBatchNo(batchNo?: string | null) {
  const trimmed = String(batchNo ?? "").trim();
  return trimmed.length > 0 && LAB_BATCH_LAST_DIGITS.has(trimmed.slice(-1));
}

export function petitionHasLabItems(petition: Petition) {
  return petition.items.some((item) => isLabBatchNo(item.batchNo));
}

export function getPetitionWorkSections(petition: Petition): PetitionWorkSection[] {
  return petitionHasLabItems(petition) ? ["Lab", "QC"] : ["QC"];
}

export function formatPetitionWorkSections(petition: Petition) {
  return getPetitionWorkSections(petition).join(" + ");
}
