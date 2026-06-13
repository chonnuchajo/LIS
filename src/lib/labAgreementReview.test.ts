import { describe, it, expect } from 'vitest';
import {
  isReviewFilled,
  WORKLOAD_LABELS,
  PERSONNEL_ABLE_REASON_LABELS,
  EQUIP_NOT_READY_REASON_LABELS,
} from './labAgreementReview';
import type { LabAgreementReview } from '@/types/labRequest.types';

describe('isReviewFilled', () => {
  it('is false for null/undefined', () => {
    expect(isReviewFilled(undefined)).toBe(false);
    expect(isReviewFilled(null)).toBe(false);
  });

  it('is false when reviewedBy or reviewedAt missing', () => {
    expect(isReviewFilled({ reviewedBy: '', reviewedAt: '' } as LabAgreementReview)).toBe(false);
    expect(isReviewFilled({ reviewedBy: 'somchai', reviewedAt: '' } as LabAgreementReview)).toBe(false);
  });

  it('is true when both reviewedBy and reviewedAt present', () => {
    expect(
      isReviewFilled({ reviewedBy: 'somchai', reviewedAt: '2026-06-13T00:00:00Z' } as LabAgreementReview),
    ).toBe(true);
  });
});

describe('label maps', () => {
  it('cover every enum value', () => {
    expect(Object.keys(WORKLOAD_LABELS)).toEqual(['normal', 'slower', 'cannot']);
    expect(Object.keys(PERSONNEL_ABLE_REASON_LABELS)).toEqual(['trained', 'assigned']);
    expect(Object.keys(EQUIP_NOT_READY_REASON_LABELS)).toEqual([
      'noInstrument', 'notCalibrated', 'outOfRange', 'broken',
    ]);
  });
});
