import { describe, expect, it } from 'vitest';
import { nextPetitionStatuses } from './petitionStatusFlow';

describe('nextPetitionStatuses', () => {
  it('advances one step along the linear flow', () => {
    expect(nextPetitionStatuses('deliveringQC')).toEqual(['sampleSent']);
    expect(nextPetitionStatuses('sampleSent')).toEqual(['pendingReview']);
    expect(nextPetitionStatuses('pendingReview')).toEqual(['inProgress']);
    expect(nextPetitionStatuses('inProgress')).toEqual(['success']);
  });

  it('branches into approved | rejected at success', () => {
    expect(nextPetitionStatuses('success')).toEqual(['approved', 'rejected']);
  });

  it('has no next step at terminal states', () => {
    expect(nextPetitionStatuses('approved')).toEqual([]);
    expect(nextPetitionStatuses('rejected')).toEqual([]);
  });
});
