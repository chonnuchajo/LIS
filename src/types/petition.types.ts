import type { ProductionPlan } from './productionPlan.types';

// ===== Petition status =====
export type PetitionStatus =
  | 'deliveringQC'
  | 'sampleSent'
  | 'pendingReview'
  | 'inProgress'
  | 'success';

export const PETITION_STATUSES: PetitionStatus[] = [
  'deliveringQC',
  'sampleSent',
  'pendingReview',
  'inProgress',
  'success',
];

export type StatusBadgeVariant =
  | 'primary' | 'primary-soft'
  | 'yellow' | 'yellow-soft'
  | 'green' | 'green-soft'
  | 'red' | 'red-soft'
  | 'blue' | 'blue-soft'
  | 'gray' | 'gray-soft';

export const PETITION_STATUS_CONFIG: Record<
  PetitionStatus,
  { label: string; variant: StatusBadgeVariant }
> = {
  deliveringQC:  { label: 'กำลังส่งตัวอย่าง', variant: 'gray-soft' },
  sampleSent:    { label: 'ส่งตัวอย่างแล้ว',  variant: 'primary-soft' },
  pendingReview: { label: 'รับตัวอย่างแล้ว',  variant: 'yellow-soft' },
  inProgress:    { label: 'QC กำลังตรวจ',     variant: 'blue-soft' },
  success:       { label: 'ทดสอบเสร็จสิ้น',  variant: 'green-soft' },
};

// ===== Department =====
export type PetitionDept = 'production' | 'rm' | 'fg';

export const PETITION_DEPT_LABELS: Record<PetitionDept, string> = {
  production: 'แผนกผลิต',
  rm: 'แผนก RM (วัตถุดิบ)',
  fg: 'แผนก FG (สินค้าสำเร็จรูป)',
};

// ===== Items =====
export type ItemCondition = 'normal' | 'defective';

export interface PetitionItem {
  seq: number;
  sampleName: string;
  commonName?: string;
  batchNo: string;
  productionDate?: string | null;
  submissionNo?: string;
  packageUnit?: string;
  testUnit?: string;
  testItems?: string;
  note?: string;
  labelManufacturer?: string;
  labelSeller?: string;
  labelQuantity?: string;
  labelSampledBy?: string;
  labelSampledDate?: string;
  labelRemark?: string;
  sampleId?: string;
  condition?: ItemCondition;
}

// ===== Submitter (ผู้ยื่นคำขอ) =====
export interface PetitionSubmitter {
  employeeId?: string;
  name: string;
  submittedAt: string;
}

// ===== Deliverer (ผู้นำส่ง) =====
export interface PetitionDeliverer {
  employeeId?: string;
  name: string;
}

// ===== Review history =====
export type ReviewAction = 'note' | 'approve' | 'reject' | 'startTesting';

export interface SpecificGravity {
  seq: number;
  sampleName: string;
  value?: string;
}

export interface ReviewEntry {
  action: ReviewAction;
  reviewedBy: string;
  reviewedAt: string;
  note?: string;
  specificGravities?: SpecificGravity[];
}

export interface PetitionAssignee {
  employeeId: string;
  name: string;
  department?: string;
  position?: string;
  assignedAt?: string;
  assignedBy?: string;
}

// ===== Audit log =====
export type PetitionAuditEvent =
  | 'created'
  | 'statusChanged'
  | 'assigned'
  | 'reviewed'
  | 'updated'
  | 'deleted';

export interface PetitionAuditLogEntry {
  _id: string;
  petitionId: string;
  petitionNo: string;
  event: PetitionAuditEvent;
  fromStatus?: PetitionStatus;
  toStatus?: PetitionStatus;
  actor?: string;
  note?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export const PETITION_AUDIT_EVENT_LABELS: Record<PetitionAuditEvent, string> = {
  created: 'สร้างคำร้อง',
  statusChanged: 'เปลี่ยนสถานะ',
  assigned: 'มอบหมาย',
  reviewed: 'พิจารณา',
  updated: 'แก้ไขข้อมูล',
  deleted: 'ลบคำร้อง',
};

// ===== Phase 2 tracking (for parameters with hasPhases=true) =====
export interface PhaseTriggerInfo {
  parameterId: string;
  parameterName?: string;
  fieldLabel: string;
  itemSeq: number;
  triggeredAt: string;
}

export type PetitionPhase = 1 | 2;

// ===== Petition (discriminated by dept) =====
interface PetitionBase {
  _id: string;
  petitionNo: string;
  dept: PetitionDept;
  status: PetitionStatus;
  submittedBy: PetitionSubmitter;
  deliveredBy?: PetitionDeliverer;
  items: PetitionItem[];
  cause?: string;
  reviewHistory?: ReviewEntry[];
  assignedTo?: PetitionAssignee | null;
  prodOrderNos?: string[];
  sampleSentAt?: string | null;
  receivedAt?: string | null;
  receivedBy?: string;
  firstResultAt?: string | null;
  completedAt?: string | null;
  // 2-phase testing
  currentPhase?: PetitionPhase;
  phase2UnlockedAt?: string | null;
  phase2DueAt?: string | null;
  phase2TriggeredBy?: PhaseTriggerInfo | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionPetition extends PetitionBase {
  dept: 'production';
  productionPlans: ProductionPlan[];
}

export interface RmPetition extends PetitionBase {
  dept: 'rm';
}

export interface FgPetition extends PetitionBase {
  dept: 'fg';
}

export type Petition = ProductionPetition | RmPetition | FgPetition;

// ===== QC Test Results =====
export interface QCTestResult {
  _id?: string;
  petitionId: string;
  petitionNo?: string;
  itemSeq: number;
  sampleId?: string;
  sampleName?: string;
  parameterId: string;
  parameterName?: string;
  values: Record<string, unknown>;
  // Phase 2 ("ค่าหลัง") values — only populated for parameters with hasPhases=true
  valuesPhase2?: Record<string, unknown>;
  enteredBy?: { name: string; email: string };
  enteredAt?: string;
  updatedBy?: { name: string; email: string };
  updatedAt?: string;
}

export interface SaveQCResultPayload {
  petitionId: string;
  petitionNo?: string;
  itemSeq: number;
  sampleId?: string;
  sampleName?: string;
  parameterId: string;
  parameterName?: string;
  fieldLabel: string;
  value: unknown;
  enteredBy: { name: string; email: string };
  // 1 = Phase 1 (default, ค่าก่อน), 2 = Phase 2 (ค่าหลัง)
  phase?: PetitionPhase;
}
