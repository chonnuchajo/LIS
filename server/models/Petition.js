const mongoose = require('mongoose');
const { softDeletePlugin } = require('../lib/softDelete');

const PetitionItemSchema = new mongoose.Schema(
  {
    seq: { type: Number, required: true },
    sampleName: { type: String, required: true },
    commonName: String,
    batchNo: { type: String, required: true },
    lotNo: String,
    productionDate: String,
    submissionNo: String,
    packageUnit: String,
    testUnit: String,
    testItems: String,
    note: String,
    labelManufacturer: String,
    labelSeller: String,
    labelQuantity: String,
    labelSampledBy: String,
    labelSampledDate: String,
    labelRemark: String,
    sampleId: String,
    condition: { type: String, enum: ['normal', 'defective'] },
  },
  { _id: false },
);

const SpecificGravitySchema = new mongoose.Schema(
  { seq: Number, sampleName: String, value: String },
  { _id: false },
);

const ReviewEntrySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ['note', 'approve', 'reject', 'startTesting', 'lab-approve', 'lab-reject'],
      required: true,
    },
    reviewedBy: { type: String, required: true },
    reviewedAt: { type: Date, required: true, default: Date.now },
    note: String,
    specificGravities: [SpecificGravitySchema],
  },
  { _id: false },
);

const PetitionAssigneeSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true },
    name: { type: String, required: true },
    department: String,
    position: String,
    assignedAt: { type: Date, default: Date.now },
    assignedBy: String,
  },
  { _id: false },
);

const PetitionAssignedMachineSchema = new mongoose.Schema(
  {
    machineId: { type: String, required: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    location: String,
    // Substance identity — petition items sharing the same sampleName+commonName form
    // one substance group; each group is assigned its own machine(s).
    sampleName: String,
    commonName: String,
  },
  { _id: false },
);

const SubmittedBySchema = new mongoose.Schema(
  {
    employeeId: String,
    name: { type: String, required: true },
    department: String, // แผนกผู้ยื่น จาก HR/Microsoft
    submittedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const DeliveredBySchema = new mongoose.Schema(
  {
    employeeId: String,
    name: { type: String, required: true },
  },
  { _id: false },
);

const PetitionSchema = new mongoose.Schema(
  {
    petitionNo: { type: String, required: true, index: true },
    dept: {
      type: String,
      enum: ['production', 'rm', 'fg'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['deliveringQC', 'sampleSent', 'pendingReview', 'inProgress', 'success', 'approved', 'rejected'],
      default: 'deliveringQC',
      index: true,
    },
    sampleSentAt: Date,
    receivedAt: Date,
    receivedBy: String,
    labReceivedAt: Date,
    labReceivedBy: String,
    qcReceivedAt: Date,
    qcReceivedBy: String,
    // Per-track completion ("บันทึกผล" pressed). Petition → success only when every
    // required track is done (QC always; Lab when there is a lab-batch item).
    labCompletedAt: Date,
    labCompletedBy: String,
    qcCompletedAt: Date,
    qcCompletedBy: String,
    // Lab supervisor approval (ด่านหลังผู้ทดสอบ Lab บันทึกผล — success เกิดหลังขั้นนี้)
    labApprovedAt: Date,
    labApprovedBy: String,
    // เหตุผลล่าสุดที่ track ถูกส่งกลับ (เคลียร์เมื่อผู้ทดสอบ re-confirm)
    labReturnNote: String,
    qcReturnNote: String,
    // ผู้ทดสอบอธิบาย "ทำใหม่ยังไง" ตอน re-confirm หลังโดนส่งกลับ
    labRedoExplanation: String,
    qcRedoExplanation: String,
    firstResultAt: Date,
    completedAt: Date,
    submittedBy: { type: SubmittedBySchema, required: true },
    deliveredBy: { type: DeliveredBySchema },
    items: { type: [PetitionItemSchema], default: [] },
    cause: String,
    reviewHistory: { type: [ReviewEntrySchema], default: [] },
    assignedTo: PetitionAssigneeSchema,
    assignedMachines: { type: [PetitionAssignedMachineSchema], default: [] },
    prodOrderNos: { type: [String], default: [], index: true },

    // 2-phase testing — used when at least one parameter on this petition has hasPhases=true
    currentPhase: { type: Number, enum: [1, 2], default: 1, index: true },
    phase2UnlockedAt: { type: Date, default: null },
    phase2DueAt: { type: Date, default: null },
    phase2TriggeredBy: {
      type: new mongoose.Schema(
        {
          parameterId: String,
          parameterName: String,
          fieldLabel: String,
          itemSeq: Number,
          triggeredAt: Date,
        },
        { _id: false },
      ),
      default: null,
    },
    revisionOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Petition',
      default: null,
      index: true,
    },
    approvedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

PetitionSchema.index({ petitionNo: 1, deletedAt: 1 }, { unique: true });

PetitionSchema.plugin(softDeletePlugin);
module.exports = mongoose.model('Petition', PetitionSchema);
