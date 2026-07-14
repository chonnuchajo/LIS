import { getItemNo, getPackSize, getRawCommonName, getSampleName } from './masterItemFields';

export type MasterItemRaw = Record<string, unknown>;

export interface PetitionMasterItemOption {
  itemNo: string;
  sampleName: string;
  commonName: string;
  packageUnit: string;
}

export interface PetitionMasterItemSelection {
  sampleName?: string;
  commonName?: string;
  packageUnit?: string;
}

export function normalizeMasterItemPayload(payload: unknown): MasterItemRaw[] {
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (isRecord(payload)) {
    const nested = [payload.data, payload.items, payload.result, payload.rows].find(Array.isArray);
    if (Array.isArray(nested)) return nested.filter(isRecord);
  }
  return [];
}

function isRecord(value: unknown): value is MasterItemRaw {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalized(value?: string | null): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function sameText(left?: string, right?: string): boolean {
  return normalized(left) === normalized(right);
}

export function buildPetitionMasterItemOptions(items: MasterItemRaw[]): PetitionMasterItemOption[] {
  const seen = new Set<string>();
  const options: PetitionMasterItemOption[] = [];

  for (const item of items) {
    const option = {
      itemNo: getItemNo(item),
      sampleName: getSampleName(item),
      commonName: getRawCommonName(item),
      packageUnit: getPackSize(item),
    };
    if (!option.sampleName) continue;

    const key = [
      normalized(option.itemNo),
      normalized(option.sampleName),
      normalized(option.commonName),
      normalized(option.packageUnit),
    ].join('|');
    if (seen.has(key)) continue;

    seen.add(key);
    options.push(option);
  }

  return options.sort((a, b) => a.sampleName.localeCompare(b.sampleName, 'th'));
}

export function findMatchingPetitionMasterItem(
  options: PetitionMasterItemOption[],
  selection: PetitionMasterItemSelection,
): PetitionMasterItemOption | null {
  const sampleName = selection.sampleName?.trim();
  if (!sampleName) return null;

  const exactRows = options.filter((option) => sameText(option.sampleName, sampleName));
  if (exactRows.length === 0) return null;

  const commonName = selection.commonName?.trim();
  const packageUnit = selection.packageUnit?.trim();
  if (commonName || packageUnit) {
    const fullMatch = exactRows.find((option) => (
      (!commonName || sameText(option.commonName, commonName)) &&
      (!packageUnit || sameText(option.packageUnit, packageUnit))
    ));
    if (fullMatch) return fullMatch;
  }

  return exactRows.length === 1 ? exactRows[0] : null;
}
