import type { PetitionStatus } from '@/types/petition.types';

// Dev-only status flow: ลำดับการเลื่อน status ทีละสเตป (ห้ามข้าม)
// linear: deliveringQC → sampleSent → pendingReview → inProgress → success
// branch: success → approved | rejected
// terminal: approved, rejected → ไม่มีสเตปถัดไป
const NEXT: Record<PetitionStatus, PetitionStatus[]> = {
  deliveringQC: ['sampleSent'],
  sampleSent: ['pendingReview'],
  pendingReview: ['inProgress'],
  inProgress: ['success'],
  success: ['approved', 'rejected'],
  approved: [],
  rejected: [],
};

/** สถานะถัดไปที่อนุญาตจาก `status` (สเตปเดียว); ว่าง = terminal */
export function nextPetitionStatuses(status: PetitionStatus): PetitionStatus[] {
  return NEXT[status] ?? [];
}
