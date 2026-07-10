import { commonNameKeys, tradeNameKeys } from "./masterItemFields";

export type RegulatoryType = "GMP" | "BIO" | "LS";

const frontNameKeys = ["item_name1", "itemName", "item_name", "Name", "ITEM_NAME"];
const regulatoryTypeKeys = [
  ...frontNameKeys,
  ...commonNameKeys,
  ...tradeNameKeys,
];
const bioTypeKeys = [
  ...commonNameKeys,
  ...tradeNameKeys,
];

function collectText(item: Record<string, unknown>, keys: string[]) {
  return keys
    .map((key) => item[key])
    .filter((value) => value !== undefined && value !== null && value !== "")
    .join(" ");
}

export function getMasterItemRegulatoryTypes(item: Record<string, unknown>): RegulatoryType[] {
  const source = collectText(item, regulatoryTypeKeys);
  const bioSource = collectText(item, bioTypeKeys);
  const labels: RegulatoryType[] = [];
  if (/ปศุสัตว์|livestock/i.test(source)) labels.push("LS");
  if (/ไบโอ|\bbio\b/i.test(bioSource)) labels.push("BIO");
  if (/อ\s*\.?\s*ย\s*\.|fda|gmp/i.test(source)) labels.push("GMP");
  return labels;
}

export function getMasterItemRegulatoryType(item: Record<string, unknown>): string {
  return getMasterItemRegulatoryTypes(item).join(", ");
}
