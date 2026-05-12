// ===== Petition status =====
export type PetitionStatus =
  | 'deliveringQC'   // กำลังส่งตัวอย่าง (ยื่นคำร้อง)
  | 'sampleSent'     // ส่งตัวอย่างแล้ว (สแกนส่ง)
  | 'pendingReview'  // รับตัวอย่างแล้ว (สแกนรับ)
  | 'inProgress'     // QC กำลังตรวจ
  | 'normal'         // ตรวจแล้ว: ปกติ
  | 'defective';     // ตรวจแล้ว: ไม่ปกติ

export const PETITION_STATUSES: PetitionStatus[] = [
  'deliveringQC',
  'sampleSent',
  'pendingReview',
  'inProgress',
  'normal',
  'defective',
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
  normal:        { label: 'ปกติ',           variant: 'green-soft' },
  defective:     { label: 'ไม่ปกติ',        variant: 'red-soft' },
};

// ===== Sample return =====
export type SampleReturn = 'return' | 'discard' | 'keep';

export const SAMPLE_RETURN_LABELS: Record<SampleReturn, string> = {
  return:  'คืนตัวอย่าง',
  discard: 'ทำลายตัวอย่าง',
  keep:    'เก็บตัวอย่างไว้',
};

// ===== Service agreement =====
export type SampleDelivery = 'self' | 'courier';
export type TestMethod = 'standard' | 'custom' | 'previous';
export type TestDuration = 'normal' | 'extended' | 'urgent';

export interface ServiceAgreement {
  sampleDelivery: SampleDelivery;
  testMethod: TestMethod;
  testMethodDoneBefore?: string | null;   // เลขที่คำร้องเดิม
  testMethodDetail?: string;              // รายละเอียดวิธีทดสอบกรณี custom
  testDuration: TestDuration;
  testDurationDays?: number | null;       // จำนวนวันกรณี extended/urgent
  requireUncertainty: boolean;            // ต้องการค่าความไม่แน่นอน
}

// ===== Requester / Test delivery =====
export interface PetitionRequester {
  fullName: string;
  department: string;
  address?: string;
  phone?: string;
  fax?: string;
  email?: string;
  contactName?: string;
  position?: string;
}

export type TestDeliveryChannel = 'email' | 'mail' | 'self' | 'report' | 'fax' | 'taxInvoice';
export type AddressChoice = 'default' | 'other';
export type StorageCondition = 'room' | 'chilled';
export type PackageType = 'plasticBag' | 'glassBottle' | 'plasticBottle' | 'can' | 'other';

// ===== Items =====
export type ItemCondition = 'normal' | 'defective';

export interface PetitionItem {
  seq: number;
  sampleName: string;
  commonName?: string;
  batchNo?: string;
  productionDate?: string | null; // ISO date (YYYY-MM-DD)
  submissionNo?: string;
  packageUnit?: string;            // ขนาดบรรจุ
  testUnit?: string;               // หน่วยทดสอบ
  testItems?: string;              // รายการทดสอบ
  note?: string;
  // ข้อมูลฉลาก (ติดตัวอย่าง)
  labelManufacturer?: string;
  labelSeller?: string;
  labelQuantity?: string;
  labelSampledBy?: string;
  labelSampledDate?: string;
  labelRemark?: string;
  // QC
  sampleId?: string;               // เลขตัวอย่างที่ QC กำหนด
  condition?: ItemCondition;
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

// ===== Lab agreement review (FM-QP-07-01-001-R02) =====
export interface LabAgreementReview {
  reviewedAt: string;
  reviewedBy: string;
  capabilityOk: boolean;
  methodOk: boolean;
  scheduleOk: boolean;
  acceptable: boolean;
  remark?: string;
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

// ===== Petition (root) =====
export interface Petition {
  _id: string;
  petitionNo: string;
  status: PetitionStatus;
  serviceAgreement?: ServiceAgreement;
  requester: PetitionRequester;
  sampleReturn?: SampleReturn;
  testDelivery?: TestDeliveryChannel[];
  reportCustomerName?: string;
  reportAddressType?: AddressChoice;
  reportAddressOther?: string;
  invoiceAddressType?: AddressChoice;
  invoiceAddressOther?: string;
  storageCondition?: StorageCondition;
  packageType?: PackageType;
  packageTypeOther?: string;
  sampleSubmittedBy?: string;
  sampleSubmittedDate?: string | null;
  items: PetitionItem[];
  cause?: string;                   // สาเหตุการตรวจ
  reviewHistory?: ReviewEntry[];
  labAgreementReview?: LabAgreementReview | null;
  assignedTo?: PetitionAssignee | null;
  prodOrderNos?: string[];
  createdAt: string;
  updatedAt: string;
}
