const mongoose = require('mongoose');

const PetitionItemSchema = new mongoose.Schema(
  {
    seq: { type: Number, required: true },
    sampleName: { type: String, required: true },
    commonName: String,
    batchNo: { type: String, required: true },
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
      enum: ['note', 'approve', 'reject', 'startTesting'],
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

const MachineCheckSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    ok: Boolean,
    dateOk: String,
  },
  { _id: false },
);

const PhysicalCheckSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    result1: String,
    pass1: Boolean,
    inspector1: String,
    result2: String,
    pass2: Boolean,
  },
  { _id: false },
);

const WeighingRowSchema = new mongoose.Schema(
  {
    seq: { type: Number, required: true },
    rawMaterial: String,
    amounts: { type: [Number], default: [] },
  },
  { _id: false },
);

const ProductionStepSchema = new mongoose.Schema(
  {
    description: String,
    startDate: String,
    startTime: String,
    endDate: String,
    endTime: String,
  },
  { _id: false },
);

const DowntimeSchema = new mongoose.Schema(
  {
    fromTime: String,
    toTime: String,
    reason: String,
  },
  { _id: false },
);

const ProductionPlanSchema = new mongoose.Schema(
  {
    batchNo: { type: String, required: true },
    batchNos: { type: [String], default: undefined },

    // ส่วนที่ 1
    planDate: String,
    productionDate: String,
    commonName: String,
    quantity: String,
    staffNames: String,

    // ส่วนที่ 2
    machineChecks: { type: [MachineCheckSchema], default: [] },
    machineInspectedBy: String,
    machineInspectedAt: String,
    machineDefectNote: String,

    // ส่วนที่ 3
    cleaning: {
      continuous: { type: Boolean, default: false },
      solvent: Number,
      water: Number,
      kaolin: Number,
      sand: Number,
      inspectedBy: String,
      inspectedAt: String,
    },

    // ส่วนที่ 4
    actualStart: { date: String, time: String },
    actualEnd: { date: String, time: String },
    actualQty: String,
    downtimes: { type: [DowntimeSchema], default: [] },
    physicalChecks: { type: [PhysicalCheckSchema], default: [] },
    sendToLab: Boolean,
    followUpFail1: String,
    followUpFail2: String,
    weighingRef: { docNo: String, docDate: String },
    weighingRows: { type: [WeighingRowSchema], default: [] },
    weigher: String,
    weigherTime: String,
    weighSupervisor: String,
    weighSupervisorTime: String,
    mixer: String,
    mixerTime: String,
    mixSupervisor: String,
    mixSupervisorTime: String,
    steps: { type: [ProductionStepSchema], default: [] },
    approver: String,
    approvedAt: String,
  },
  { _id: false },
);

const SubmittedBySchema = new mongoose.Schema(
  {
    employeeId: String,
    name: { type: String, required: true },
    submittedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const PetitionSchema = new mongoose.Schema(
  {
    petitionNo: { type: String, required: true, unique: true, index: true },
    dept: {
      type: String,
      enum: ['production', 'rm', 'fg'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['deliveringQC', 'sampleSent', 'pendingReview', 'inProgress', 'success'],
      default: 'deliveringQC',
      index: true,
    },
    sampleSentAt: Date,
    receivedAt: Date,
    receivedBy: String,
    firstResultAt: Date,
    completedAt: Date,
    submittedBy: { type: SubmittedBySchema, required: true },
    items: { type: [PetitionItemSchema], default: [] },
    productionPlans: { type: [ProductionPlanSchema], default: [] },
    cause: String,
    reviewHistory: { type: [ReviewEntrySchema], default: [] },
    assignedTo: PetitionAssigneeSchema,
    prodOrderNos: { type: [String], default: [], index: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Petition', PetitionSchema);
