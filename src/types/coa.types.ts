export type CoaStatus =
  | "requested"
  | "draft"
  | "pendingApproval"
  | "approved"
  | "printed"
  | "revisionDraft"
  | "pendingRevisionApproval"
  | "reissued"
  | "cancelled"
  | "superseded"
  | "rejected";

export type CoaPerson = { name?: string; email?: string; role?: string };

export type CoaSampleSnapshot = {
  itemSeq: number;
  sampleName?: string;
  commonName?: string;
  batchNo?: string;
  lotNo?: string;
  productionDate?: string;
  sampleId?: string;
  condition?: string;
  manufacturer?: string;
};

export type CoaResultSnapshot = {
  itemSeq: number;
  testItem?: string;
  result?: string;
  criteria?: string;
  method?: string;
  unit?: string;
};

export type CoaTrendSnapshot = {
  itemSeq: number;
  sampleName?: string;
  commonName?: string;
  aiLabelPercent?: number;
  aiResultPercent?: number;
  aiResultText?: string;
};

export type CoaAuditLogEntry = {
  _id: string;
  event: string;
  actor?: CoaPerson;
  note?: string;
  createdAt: string;
};

export type CoaDocument = {
  _id: string;
  coaNo?: string | null;
  coaYear?: number;
  sequence?: number;
  revision: number;
  status: CoaStatus;
  petitionId: string;
  petitionNoSnapshot?: string;
  selectedItemSeqs: number[];
  sourceCoaId?: string;
  supersededByCoaId?: string;
  customerSnapshot?: { name?: string; company?: string; department?: string; email?: string; phone?: string };
  sampleSnapshots: CoaSampleSnapshot[];
  resultSnapshots: CoaResultSnapshot[];
  trendSnapshots?: CoaTrendSnapshot[];
  remark?: string;
  approval?: {
    submittedBy?: CoaPerson;
    submittedAt?: string;
    approvedBy?: CoaPerson;
    approvedAt?: string;
    rejectedBy?: CoaPerson;
    rejectedAt?: string;
    rejectReason?: string;
  };
  cancel?: { cancelledBy?: CoaPerson; cancelledAt?: string; reason?: string };
  print?: { printCount?: number; lastPrintedAt?: string; lastPrintedBy?: CoaPerson };
  audit?: CoaAuditLogEntry[];
  createdBy?: CoaPerson;
  updatedBy?: CoaPerson;
  createdAt?: string;
  updatedAt?: string;
};

export type EligibleCoaPetition = {
  _id: string;
  petitionNo: string;
  labApprovedAt?: string;
  submittedBy?: { name?: string; email?: string };
  items: Array<{
    seq: number;
    sampleName?: string;
    commonName?: string;
    batchNo?: string;
    lotNo?: string;
    productionDate?: string;
    activeCoa?: {
      coaId: string;
      coaNo: string;
      revision: number;
      petitionNo?: string;
      commonName?: string;
      batchNo?: string;
      productionDate?: string;
    } | null;
  }>;
};
