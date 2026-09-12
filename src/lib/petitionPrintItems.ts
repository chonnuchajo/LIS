import type { PetitionItem } from '@/types/petition.types';

function normalizePrintSampleQuantity(value: unknown): number {
  const parsed = Number(value ?? 1);
  if (!Number.isInteger(parsed) || parsed < 1) return 1;
  return parsed;
}

export function expandItemsBySampleQuantity(items: PetitionItem[]): Array<{
  item: PetitionItem;
  rowSeq: number;
  copyIndex: number;
}> {
  const rows: Array<{ item: PetitionItem; rowSeq: number; copyIndex: number }> = [];
  for (const item of items) {
    const quantity = normalizePrintSampleQuantity(item.sampleQuantity);
    for (let copyIndex = 0; copyIndex < quantity; copyIndex += 1) {
      rows.push({ item, rowSeq: rows.length + 1, copyIndex });
    }
  }
  return rows;
}
