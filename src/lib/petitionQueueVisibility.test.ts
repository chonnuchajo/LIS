import { describe, expect, it } from 'vitest';
import type { Petition } from '@/types/petition.types';
import {
  isReceivedBeforeStatusAdvance,
  isVisibleInAssignQueue,
  isVisibleInQcTestingQueue,
  isWaitingForAssignment,
} from './petitionQueueVisibility';

const receivedStalePetition = {
  status: 'deliveringQC',
  submittedBy: { department: 'IT' },
  qcReceivedAt: '2026-09-03T06:05:34.767Z',
  items: [{ seq: 1, sampleName: 'Sample A', batchNo: 'B-6' }],
} as Petition;

describe('petitionQueueVisibility', () => {
  it('treats deliveringQC with a receive timestamp as already received', () => {
    expect(isReceivedBeforeStatusAdvance(receivedStalePetition)).toBe(true);
  });

  it('does not show untouched deliveringQC petitions in QC testing queue', () => {
    expect(isVisibleInQcTestingQueue({
      ...receivedStalePetition,
      qcReceivedAt: undefined,
    } as Petition)).toBe(false);
  });

  it('keeps stale received deliveringQC petitions visible in QC testing and Assign queues', () => {
    expect(isVisibleInQcTestingQueue(receivedStalePetition)).toBe(true);
    expect(isVisibleInAssignQueue(receivedStalePetition)).toBe(true);
    expect(isWaitingForAssignment(receivedStalePetition)).toBe(true);
  });
});
