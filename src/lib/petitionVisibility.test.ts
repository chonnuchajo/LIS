import { describe, expect, it } from 'vitest';
import { canSeePetition } from './petitionVisibility';
import type { Petition } from '@/types/petition.types';

function makePetition(batchNo: string): Petition {
  return {
    _id: 'petition-1',
    petitionNo: 'P-2607-0001',
    dept: 'production',
    status: 'sampleSent',
    submittedBy: {
      name: 'Requester',
      submittedAt: '2026-07-15T00:00:00.000Z',
    },
    items: [
      {
        seq: 1,
        sampleName: 'Sample',
        batchNo,
      },
    ],
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:00.000Z',
  };
}

describe('canSeePetition', () => {
  it('lets admin see a received petition even when a Lab role is also selected and the petition has no Lab item', () => {
    expect(canSeePetition(makePetition('BATCH-2'), { roles: ['lab-analyze', 'admin'] })).toBe(true);
  });

  it('keeps Lab-only users limited to petitions with Lab items', () => {
    expect(canSeePetition(makePetition('BATCH-2'), { roles: ['lab-analyze'] })).toBe(false);
    expect(canSeePetition(makePetition('BATCH-6'), { roles: ['lab-analyze'] })).toBe(true);
  });
});
