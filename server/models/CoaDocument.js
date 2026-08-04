const mongoose = require('mongoose');

const PersonSchema = new mongoose.Schema(
  { name: String, email: String, role: String },
  { _id: false },
);

const CustomerSnapshotSchema = new mongoose.Schema(
  { name: String, company: String, department: String, email: String, phone: String },
  { _id: false },
);

const SampleSnapshotSchema = new mongoose.Schema(
  {
    itemSeq: { type: Number, required: true },
    sampleName: String,
    commonName: String,
    batchNo: String,
    lotNo: String,
    productionDate: String,
    sampleId: String,
    condition: String,
    manufacturer: String,
  },
  { _id: false },
);

const ResultSnapshotSchema = new mongoose.Schema(
  {
    itemSeq: { type: Number, required: true },
    testItem: String,
    result: String,
    criteria: String,
    method: String,
    unit: String,
  },
  { _id: false },
);

const PrintEventSchema = new mongoose.Schema(
  { event: String, printedAt: Date, printedBy: PersonSchema, copies: Number, outputMode: String },
  { _id: false },
);

const CancelSchema = new mongoose.Schema(
  {
    cancelledBy: PersonSchema,
    cancelledAt: Date,
    reason: {
      type: String,
      required: true,
      validate: {
        validator: (value) => typeof value === 'string' && value.trim().length > 0,
        message: 'COA cancellation reason is required',
      },
    },
  },
  { _id: false },
);

const STATUS = [
  'draft',
  'pendingApproval',
  'approved',
  'printed',
  'revisionDraft',
  'pendingRevisionApproval',
  'reissued',
  'cancelled',
  'superseded',
  'rejected',
];

const CoaDocumentSchema = new mongoose.Schema(
  {
    coaNo: { type: String, default: null, index: true },
    coaYear: Number,
    sequence: Number,
    revision: { type: Number, default: 0 },
    status: { type: String, enum: STATUS, required: true, default: 'draft', index: true },
    petitionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Petition', required: true, index: true },
    petitionNoSnapshot: String,
    selectedItemSeqs: { type: [Number], default: [] },
    sourceCoaId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoaDocument' },
    supersedesCoaId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoaDocument' },
    supersededByCoaId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoaDocument' },
    customerSnapshot: CustomerSnapshotSchema,
    sampleSnapshots: { type: [SampleSnapshotSchema], default: [] },
    resultSnapshots: { type: [ResultSnapshotSchema], default: [] },
    remark: { type: String, default: '' },
    approval: {
      submittedBy: PersonSchema,
      submittedAt: Date,
      approvedBy: PersonSchema,
      approvedAt: Date,
      rejectedBy: PersonSchema,
      rejectedAt: Date,
      rejectReason: String,
    },
    cancel: CancelSchema,
    print: {
      printCount: { type: Number, default: 0 },
      lastPrintedAt: Date,
      lastPrintedBy: PersonSchema,
      printEvents: { type: [PrintEventSchema], default: [] },
    },
    createdBy: PersonSchema,
    updatedBy: PersonSchema,
  },
  { timestamps: true },
);

CoaDocumentSchema.index(
  { coaNo: 1, revision: 1 },
  { unique: true, partialFilterExpression: { coaNo: { $type: 'string' } } },
);
CoaDocumentSchema.index({ petitionId: 1, status: 1 });
CoaDocumentSchema.index({ status: 1, updatedAt: -1 });
CoaDocumentSchema.index({ coaYear: 1, sequence: -1 });

module.exports = mongoose.model('CoaDocument', CoaDocumentSchema);
module.exports.COA_STATUSES = STATUS;
