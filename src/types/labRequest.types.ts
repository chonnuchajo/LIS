// ===== Service agreement =====
export type SampleDelivery = 'self' | 'courier';
export type TestMethod = 'standard' | 'custom' | 'previous';
export type TestDuration = 'normal' | 'extended' | 'urgent';

export interface ServiceAgreement {
  sampleDelivery: SampleDelivery;
  testMethod: TestMethod;
  testMethodDoneBefore?: string | null;
  testMethodDetail?: string;
  testDuration: TestDuration;
  testDurationDays?: number | null;
  requireUncertainty: boolean;
}

export type PersonnelCapability = 'able' | 'unable';
export type PersonnelAbleReason = 'trained' | 'assigned';
export type PersonnelUnableReason = 'neverDone' | 'notTrained' | 'notAssigned';
export type Workload = 'normal' | 'slower' | 'cannot';
export type SubcontractorChoice = 'none' | 'used';
export type EquipmentReadiness = 'ready' | 'notReady';
export type EquipmentReadyReason = 'hasInstrument' | 'calibrated';
export type EquipmentNotReadyReason = 'noInstrument' | 'notCalibrated' | 'outOfRange' | 'broken';

export interface LabAgreementReview {
  reviewedAt: string;
  reviewedBy: string;
  // กรณีวิธีปกติ (standard)
  personnel?: PersonnelCapability;
  personnelAbleReasons?: PersonnelAbleReason[];
  personnelUnableReasons?: PersonnelUnableReason[];
  workload?: Workload;
  subcontractor?: SubcontractorChoice;
  subcontractorName?: string;
  // กรณีวิธีเฉพาะตามเอกสารลูกค้า (custom)
  methodSuitable?: boolean;
  methodSuitableReason?: string;
  equipmentName?: string;
  equipment?: EquipmentReadiness;
  equipmentReadyReasons?: EquipmentReadyReason[];
  equipmentNotReadyReasons?: EquipmentNotReadyReason[];
  // สรุป (ทั้งสองกรณี)
  acceptable?: boolean;
  notAcceptableReason?: string;
  remark?: string;
}

export interface LabRequestRequester {
  fullName: string;
  department?: string;
  address?: string;
  phone?: string;
  fax?: string;
  email?: string;
  contactName?: string;
  position?: string;
}

export type SampleReturn = 'return' | 'discard' | 'keep';

export const SAMPLE_RETURN_LABELS: Record<SampleReturn, string> = {
  return: 'คืนตัวอย่าง',
  discard: 'ทำลายตัวอย่าง',
  keep: 'เก็บตัวอย่างไว้',
};

export type TestDeliveryChannel = 'email' | 'mail' | 'self' | 'report' | 'fax' | 'taxInvoice';
export type AddressChoice = 'default' | 'other';
export type StorageCondition = 'room' | 'chilled';
export type PackageType = 'plasticBag' | 'glassBottle' | 'plasticBottle' | 'can' | 'other';

export interface LabRequest {
  _id: string;
  labRequestNo: string;
  petitionId: string;
  petitionNo: string;
  batchNo: string;
  sampleSeq: number;
  requester?: LabRequestRequester;
  serviceAgreement: ServiceAgreement;
  labAgreementReview?: LabAgreementReview;
  reportCustomerName?: string;
  reportAddressType?: AddressChoice;
  reportAddressOther?: string;
  invoiceAddressType?: AddressChoice;
  invoiceAddressOther?: string;
  testDelivery?: TestDeliveryChannel[];
  storageCondition?: StorageCondition[];
  packageType?: PackageType[];
  packageTypeOther?: string;
  sampleReturn?: SampleReturn;
  createdAt: string;
  updatedAt: string;
}
