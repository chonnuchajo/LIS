// ===== Petition status =====
export type PetitionStatus =
  | 'deliveringQC'
  | 'sampleSent'
  | 'pendingReview'
  | 'inProgress'
  | 'success'
  | 'approved'
  | 'rejected';

export const PETITION_STATUSES: PetitionStatus[] = [
  'deliveringQC',
  'sampleSent',
  'pendingReview',
  'inProgress',
  'success',
  'approved',
  'rejected',
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
  approved:      { label: 'อนุมัติแล้ว',        variant: 'green-soft' },
  rejected:      { label: 'ส่งกลับให้แก้ไข',    variant: 'red-soft' },
};

// ===== Department =====
export type PetitionDept = 'production' | 'rm' | 'fg';

export const PETITION_DEPT_LABELS: Record<PetitionDept, string> = {
  production: 'แผนกผลิต',
  rm: 'แผนก RM (วัตถุดิบ)',
  fg: 'แผนก FG (สินค้าสำเร็จรูป)',
};

// batch ที่ลงท้าย '1' หรือ '6' = lab batch (ต้องยื่นใบคำขอรับบริการ)
export function isLabBatch(batchNo: string): boolean {
  const last = batchNo.trim().slice(-1);
  return last === '1' || last === '6';
}

// ===== Items =====
export type ItemCondition = 'normal' | 'defective';

export interface PetitionItem {
  seq: number;
  sampleName: string;
  commonName?: string;
  batchNo: string;
  lotNo?: string;
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
  department?: string;
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

export interface PetitionAssignedMachine {
  machineId: string;
  code: string;
  name: string;
  location?: string;
  // Substance identity — when a petition has multiple substances, each substance
  // group (items sharing sampleName + commonName) gets its own machine assignment.
  sampleName?: string;
  commonName?: string;
}

// ===== Audit log =====
export type PetitionAuditEvent =
  | 'created'
  | 'statusChanged'
  | 'assigned'
  | 'reviewed'
  | 'updated'
  | 'deleted'
  | 'received'
  | 'resultEntered'
  | 'resultUpdated';

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
  received: 'รับตัวอย่าง',
  resultEntered: 'ใส่ค่า QC',
  resultUpdated: 'แก้ค่า QC',
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
  assignedMachines?: PetitionAssignedMachine[];
  prodOrderNos?: string[];
  sampleSentAt?: string | null;
  receivedAt?: string | null;
  receivedBy?: string;
  labReceivedAt?: string | null;
  labReceivedBy?: string;
  qcReceivedAt?: string | null;
  qcReceivedBy?: string;
  labCompletedAt?: string | null;
  labCompletedBy?: string;
  qcCompletedAt?: string | null;
  qcCompletedBy?: string;
  labApprovedAt?: string | null;
  labApprovedBy?: string;
  labReturnNote?: string;
  qcReturnNote?: string;
  labRedoExplanation?: string;
  qcRedoExplanation?: string;
  firstResultAt?: string | null;
  completedAt?: string | null;
  conclusion?: "pass" | "accepted-oos" | "returned-to-requester" | null;
  conclusionNote?: string;
  // 2-phase testing
  currentPhase?: PetitionPhase;
  phase2UnlockedAt?: string | null;
  phase2DueAt?: string | null;
  phase2TriggeredBy?: PhaseTriggerInfo | null;
  revisionOf?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionPetition extends PetitionBase {
  dept: 'production';
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
  // For multiEntry parameters — array of per-entry value-objects.
  entries?: Record<string, unknown>[];
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
  commonName?: string;
  parameterId: string;
  parameterName?: string;
  fieldLabel: string;
  value: unknown;
  // For multiEntry parameters — which entry row this field write targets.
  entryIndex?: number;
  enteredBy: { name: string; email: string };
  // 1 = Phase 1 (default, ค่าก่อน), 2 = Phase 2 (ค่าหลัง)
  phase?: PetitionPhase;
}
