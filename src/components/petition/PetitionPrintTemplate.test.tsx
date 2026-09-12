import { describe, expect, it } from 'vitest';
import { expandItemsBySampleQuantity } from '@/lib/petitionPrintItems';
import type { PetitionItem } from '@/types/petition.types';

describe('expandItemsBySampleQuantity', () => {
  it('creates one print row per entered sample quantity', () => {
    const rows = expandItemsBySampleQuantity([
      { seq: 1, sampleName: 'Sample A', batchNo: 'B-001', sampleQuantity: 3 } as PetitionItem,
      { seq: 2, sampleName: 'Sample B', batchNo: 'B-002', sampleQuantity: 1 } as PetitionItem,
    ]);

    expect(rows.map((row) => row.rowSeq)).toEqual([1, 2, 3, 4]);
    expect(rows.map((row) => row.item.seq)).toEqual([1, 1, 1, 2]);
  });
});
