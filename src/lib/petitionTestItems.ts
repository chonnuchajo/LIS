import type { ParameterItem, ParameterValueField } from '@/lib/api';
import type { PetitionItem, Petition } from '@/types/petition.types';
import { getClassification, getCommonName } from '@/lib/productClassification';
import { isLabBatch } from '@/types/productionPlan.types';

function extractItemNoPrefix(itemNo: string | undefined | null): string {
  const cleaned = String(itemNo ?? '').trim();
  if (!cleaned) return '';
  const dashIdx = cleaned.indexOf('-');
  return (dashIdx > 0 ? cleaned.slice(0, dashIdx) : cleaned).toUpperCase();
}

export function getItemProductType(item: PetitionItem): string {
  return (
    getClassification(item.sampleName)?.group ??
    getClassification(item.commonName)?.group ??
    ''
  );
}

export function getItemSubCategory(item: PetitionItem): string {
  return extractItemNoPrefix(item.sampleId);
}

// Returns true when the parameter's "ใช้กับ" criteria fit this petition item.
// applyAll → match unconditionally. Otherwise it's an OR across the five
// dimensions we can derive from a PetitionItem (itemName / commonName /
// productType / subCategory / itemGroups). Categories (RM/FG) aren't carried
// on the item so we can't enforce them from the petition side — use
// subCategories instead.
export function parameterAppliesToItem(
  param: ParameterItem,
  item: PetitionItem,
  itemGroupIds: string[] = [],
): boolean {
  if (param.applyAll) return true;

  const itemNames = param.itemNames ?? [];
  const commonNames = param.commonNames ?? [];
  const productTypes = param.productTypes ?? [];
  const subCategories = param.subCategories ?? [];
  const itemGroups = param.itemGroups ?? [];

  if (
    itemNames.length === 0 &&
    commonNames.length === 0 &&
    productTypes.length === 0 &&
    subCategories.length === 0 &&
    itemGroups.length === 0
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

  const productType = getItemProductType(item);
  if (productType && productTypes.includes(productType)) return true;

  const subCat = getItemSubCategory(item);
  if (subCat && subCategories.includes(subCat)) return true;

  if (itemGroups.length > 0 && itemGroups.some((g) => itemGroupIds.includes(g))) return true;

  return false;
}

export function matchParametersForItem(
  item: PetitionItem,
  params: ParameterItem[],
  itemGroupIds: string[] = [],
): ParameterItem[] {
  // Lab-scope parameters only apply to items actually sent to lab
  // (lab batch = batchNo ending in 1/6). This gate is independent of the
  // param's "ใช้กับ" classification — applyAll must not leak a lab param
  // onto non-lab items. QC params are unaffected.
  const itemIsLab = item.batchNo ? isLabBatch(item.batchNo) : false;
  const active = params.filter(
    (p) =>
      p.status !== 'inactive' &&
      ((p.scope ?? 'qc') !== 'lab' || itemIsLab),
  );

  if (!item.testItems) {
    return active.filter((p) => parameterAppliesToItem(p, item, itemGroupIds));
  }

  const names = item.testItems
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  return active.filter(
    (p) =>
      names.includes((p.name ?? '').toLowerCase()) &&
      parameterAppliesToItem(p, item, itemGroupIds),
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

// Filter enum options based on item's classification.
// option ที่ไม่มี entry ใน optionFilters = แสดงเสมอ (backward-compatible).
// option ที่มี entry แต่ทุกมิติว่าง = แสดงเสมอ.
// option ที่ตั้ง filter ≥ 1 มิติ — OR ข้ามมิติ (เหมือน parameterAppliesToItem).
// Categories (RM/FG) ไม่ enforce ที่ runtime เพราะ item ไม่พก context นี้.
export function visibleEnumOptions(
  field: ParameterValueField,
  item: PetitionItem,
  itemGroupIds: string[] = [],
): string[] {
  const options = field.options ?? [];
  const filters = field.optionFilters;
  if (!filters) return options;

  const sampleName = item.sampleName?.trim() ?? '';
  const itemCommonName = (
    item.commonName?.trim() || getCommonName(item.sampleName)
  ).toUpperCase();
  const itemProductType = getItemProductType(item);
  const itemSubCat = getItemSubCategory(item);

  return options.filter((opt) => {
    const f = filters[opt];
    if (!f) return true;
    const itemNames = f.itemNames ?? [];
    const commonNames = f.commonNames ?? [];
    const productTypes = f.productTypes ?? [];
    const subCategories = f.subCategories ?? [];
    const itemGroups = f.itemGroups ?? [];
    if (
      itemNames.length === 0 &&
      commonNames.length === 0 &&
      productTypes.length === 0 &&
      subCategories.length === 0 &&
      itemGroups.length === 0
    ) {
      return true;
    }
    if (sampleName && itemNames.some((n) => n.trim() === sampleName)) return true;
    if (
      itemCommonName &&
      commonNames.some((c) => c.toUpperCase() === itemCommonName)
    ) {
      return true;
    }
    if (itemProductType && productTypes.includes(itemProductType)) return true;
    if (itemSubCat && subCategories.includes(itemSubCat)) return true;
    if (itemGroups.length > 0 && itemGroups.some((gid) => itemGroupIds.includes(gid))) return true;
    return false;
  });
}
