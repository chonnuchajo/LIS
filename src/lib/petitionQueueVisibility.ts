import type { Petition } from '@/types/petition.types';
import { labReceivedAt, qcReceivedAt } from './receiveStatus';
import { hasLabTrack, requiresQcTrack } from './petitionRouting';

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
  if (!hasLabTrack(petition)) return false;
  // Keep assigned work on board after Lab receives sample; otherwise refresh
  // makes successful assignments disappear immediately.
  if (petition.assignedTo) return OPEN_TESTING_STATUSES.includes(petition.status);
  if (labReceivedAt(petition)) return false;
  return OPEN_TESTING_STATUSES.includes(petition.status) || isReceivedBeforeStatusAdvance(petition);
}

export function isWaitingForAssignment(petition: Petition): boolean {
  return !labReceivedAt(petition) && !petition.assignedTo && (
    petition.status === 'sampleSent' ||
    petition.status === 'pendingReview' ||
    isReceivedBeforeStatusAdvance(petition)
  );
}
