import type { Petition } from '@/types/petition.types';
import { labReceivedAt, qcReceivedAt } from './receiveStatus';
import { requiresQcTrack } from './petitionRouting';

const OPEN_TESTING_STATUSES: readonly Petition['status'][] = ['sampleSent', 'pendingReview', 'inProgress'];

export function isReceivedBeforeStatusAdvance(petition: Petition): boolean {
  return petition.status === 'deliveringQC' && Boolean(qcReceivedAt(petition) || labReceivedAt(petition));
}

export function isVisibleInQcTestingQueue(petition: Petition): boolean {
  if (!requiresQcTrack(petition)) return false;
  if (petition.status === 'deliveringQC') return Boolean(qcReceivedAt(petition));
  return OPEN_TESTING_STATUSES.includes(petition.status);
}

export function isVisibleInAssignQueue(petition: Petition): boolean {
  return OPEN_TESTING_STATUSES.includes(petition.status) || isReceivedBeforeStatusAdvance(petition);
}

export function isWaitingForAssignment(petition: Petition): boolean {
  return !petition.assignedTo && (
    petition.status === 'sampleSent' ||
    petition.status === 'pendingReview' ||
    isReceivedBeforeStatusAdvance(petition)
  );
}
