import type { ParameterItem } from '@/lib/api';
import type { PetitionItem, Petition } from '@/types/petition.types';
import { getClassification, getCommonName } from '@/lib/productClassification';

function extractItemNoPrefix(itemNo: string | undefined | null): string {
  const cleaned = String(itemNo ?? '').trim();
  if (!cleaned) return '';
  const dashIdx = cleaned.indexOf('-');
  return (dashIdx > 0 ? cleaned.slice(0, dashIdx) : cleaned).toUpperCase();
}

// Returns true when the parameter's "ใช้กับ" criteria fit this petition item.
// applyAll → match unconditionally. Otherwise it's an OR across the four
// dimensions we can derive from a PetitionItem (itemName / commonName /
// productType / subCategory). Categories (RM/FG) aren't carried on the item
// so we can't enforce them from the petition side — use subCategories instead.
export function parameterAppliesToItem(
  param: ParameterItem,
  item: PetitionItem,
): boolean {
  if (param.applyAll) return true;

  const itemNames = param.itemNames ?? [];
  const commonNames = param.commonNames ?? [];
  const productTypes = param.productTypes ?? [];
  const subCategories = param.subCategories ?? [];

  if (
    itemNames.length === 0 &&
    commonNames.length === 0 &&
    productTypes.length === 0 &&
    subCategories.length === 0
  ) {
    return false;
  }

  const sampleName = item.sampleName?.trim() ?? '';
  if (sampleName && itemNames.some((n) => n.trim() === sampleName)) return true;

  const itemCommonName = (
    item.commonName?.trim() || getCommonName(item.sampleName)
  ).toUpperCase();
  if (
    itemCommonName &&
    commonNames.some((c) => c.toUpperCase() === itemCommonName)
  ) {
    return true;
  }

  const productType =
    getClassification(item.sampleName)?.group ??
    getClassification(item.commonName)?.group ??
    '';
  if (productType && productTypes.includes(productType)) return true;

  const subCat = extractItemNoPrefix(item.sampleId);
  if (subCat && subCategories.includes(subCat)) return true;

  return false;
}

export function matchParametersForItem(
  item: PetitionItem,
  params: ParameterItem[],
): ParameterItem[] {
  const active = params.filter((p) => p.status !== 'inactive');

  if (!item.testItems) {
    return active.filter((p) => parameterAppliesToItem(p, item));
  }

  const names = item.testItems
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  return active.filter(
    (p) =>
      names.includes((p.name ?? '').toLowerCase()) &&
      parameterAppliesToItem(p, item),
  );
}

export function parameterNamesForPetition(
  petition: Petition,
  params: ParameterItem[],
): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const item of petition.items ?? []) {
    for (const p of matchParametersForItem(item, params)) {
      const name = p.name?.trim();
      if (name && !seen.has(name)) {
        seen.add(name);
        names.push(name);
      }
    }
  }
  return names;
}
