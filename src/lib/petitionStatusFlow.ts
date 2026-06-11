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

// แต่ละสเตปต้อง "เดินผ่าน endpoint จริง" ไม่ใช่ set status ดิบ ๆ — เพราะ:
//  - ปุ่ม "เข้าตรวจ" / dashboard ดูจากข้อมูลรอง (receive timestamp, assignee) ไม่ใช่ status
//  - backend บล็อก set success ตรง ๆ (ต้องผ่าน /complete ต่อ track)
// การเรียก endpoint จริงทำให้ได้ทั้งข้อมูลรอง + audit event ครบ และตามกฎ backend อัตโนมัติ
export type DevTransition =
  | { kind: 'deliver' }
  | { kind: 'receive'; side: 'qc' | 'lab' }
  | { kind: 'assign' }
  | { kind: 'complete'; side: 'qc' | 'lab' }
  | { kind: 'approve' }
  | { kind: 'reject' };

const PLAN: Record<PetitionStatus, DevTransition[]> = {
  deliveringQC: [], // เป็น start state — ไม่มีใครเปลี่ยน "ไป" deliveringQC
  sampleSent: [{ kind: 'deliver' }],
  // รับทั้งสอง track เพื่อให้ทั้งหน้า QC และ Lab testing เทสต์ได้
  pendingReview: [
    { kind: 'receive', side: 'qc' },
    { kind: 'receive', side: 'lab' },
  ],
  inProgress: [{ kind: 'assign' }],
  // complete ทั้งสอง track → ครบทุกส่วน → backend flip เป็น success ให้เอง
  success: [
    { kind: 'complete', side: 'qc' },
    { kind: 'complete', side: 'lab' },
  ],
  approved: [{ kind: 'approve' }],
  rejected: [{ kind: 'reject' }],
};

/** ลำดับการเรียก endpoint จริงเพื่อพา petition ไปสู่สถานะ `to` (dev-only) */
export function devTransitionPlan(to: PetitionStatus): DevTransition[] {
  return PLAN[to] ?? [];
}
