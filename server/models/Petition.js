const mongoose = require('mongoose');

const PetitionItemSchema = new mongoose.Schema(
  {
    seq: { type: Number, required: true },
    sampleName: { type: String, required: true },
    commonName: String,
    batchNo: String,
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

const ServiceAgreementSchema = new mongoose.Schema(
  {
    sampleDelivery: { type: String, enum: ['self', 'courier'] },
    testMethod: { type: String, enum: ['standard', 'custom', 'previous'] },
    testMethodDoneBefore: String,
    testMethodDetail: String,
    testDuration: { type: String, enum: ['normal', 'extended', 'urgent'] },
    testDurationDays: Number,
    requireUncertainty: Boolean,
  },
  { _id: false },
);

const LabAgreementReviewSchema = new mongoose.Schema(
  {
    reviewedAt: { type: Date, default: Date.now },
    reviewedBy: String,
    capabilityOk: Boolean,
    methodOk: Boolean,
    scheduleOk: Boolean,
    acceptable: Boolean,
    remark: String,
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

const PetitionSchema = new mongoose.Schema(
  {
    petitionNo: { type: String, required: true, unique: true, index: true },
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
    serviceAgreement: ServiceAgreementSchema,
    requester: {
      fullName: { type: String, required: true },
      department: { type: String, required: true },
      address: String,
      phone: String,
      fax: String,
      email: String,
      contactName: String,
      position: String,
    },
    sampleReturn: { type: String, enum: ['return', 'discard', 'keep'] },
    testDelivery: [{ type: String, enum: ['email', 'mail', 'self', 'report', 'fax', 'taxInvoice'] }],
    reportCustomerName: String,
    reportAddressType: { type: String, enum: ['default', 'other'] },
    reportAddressOther: String,
    invoiceAddressType: { type: String, enum: ['default', 'other'] },
    invoiceAddressOther: String,
    storageCondition: { type: String, enum: ['room', 'chilled'] },
    packageType: { type: String, enum: ['plasticBag', 'glassBottle', 'plasticBottle', 'can', 'other'] },
    packageTypeOther: String,
    sampleSubmittedBy: String,
    sampleSubmittedDate: String,
    items: { type: [PetitionItemSchema], default: [] },
    cause: String,
    reviewHistory: { type: [ReviewEntrySchema], default: [] },
    labAgreementReview: LabAgreementReviewSchema,
    assignedTo: PetitionAssigneeSchema,
    prodOrderNos: { type: [String], default: [], index: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Petition', PetitionSchema);
