import { describe, expect, it } from 'vitest';
import { devTransitionPlan, nextPetitionStatuses } from './petitionStatusFlow';

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

describe('devTransitionPlan', () => {
  it('drives the real transition endpoint(s) for each target status', () => {
    expect(devTransitionPlan('sampleSent')).toEqual([{ kind: 'deliver' }]);
    expect(devTransitionPlan('pendingReview')).toEqual([
      { kind: 'receive', side: 'qc' },
      { kind: 'receive', side: 'lab' },
    ]);
    expect(devTransitionPlan('inProgress')).toEqual([{ kind: 'assign' }]);
    expect(devTransitionPlan('success')).toEqual([
      { kind: 'complete', side: 'qc' },
      { kind: 'complete', side: 'lab' },
    ]);
    expect(devTransitionPlan('approved')).toEqual([{ kind: 'approve' }]);
    expect(devTransitionPlan('rejected')).toEqual([{ kind: 'reject' }]);
  });

  it('has no plan for the start state (deliveringQC is never a target)', () => {
    expect(devTransitionPlan('deliveringQC')).toEqual([]);
  });
});
