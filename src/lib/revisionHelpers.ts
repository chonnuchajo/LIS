import type { PetitionItem, QCTestResult } from '@/types/petition.types';

export type PreviousValueLookup = Map<string, unknown>;

function makeKey(batchNo: string, sampleName: string, commonName: string, parameterId: string, fieldLabel: string): string {
  return `${batchNo}|${sampleName}|${commonName}|${parameterId}|${fieldLabel}`;
}

export function buildPreviousValueLookup(
  previousItems: PetitionItem[],
  previousResults: QCTestResult[],
): PreviousValueLookup {
  const itemBySeq = new Map<number, PetitionItem>();
  for (const item of previousItems) itemBySeq.set(item.seq, item);

  const lookup: PreviousValueLookup = new Map();
  for (const result of previousResults) {
    const item = itemBySeq.get(result.itemSeq);
    if (!item) continue;
    const batchNo = item.batchNo ?? '';
    const sampleName = item.sampleName ?? '';
    const commonName = item.commonName ?? '';
    for (const [fieldLabel, value] of Object.entries(result.values ?? {})) {
      lookup.set(makeKey(batchNo, sampleName, commonName, result.parameterId, fieldLabel), value);
    }
  }
  return lookup;
}

export function getPreviousValue(
  lookup: PreviousValueLookup,
  currentItem: PetitionItem,
  parameterId: string,
  fieldLabel: string,
): unknown {
  return lookup.get(
    makeKey(
      currentItem.batchNo ?? '',
      currentItem.sampleName ?? '',
      currentItem.commonName ?? '',
      parameterId,
      fieldLabel,
    ),
  );
}
