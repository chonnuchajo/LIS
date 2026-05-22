const mongoose = require('mongoose');

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

const RequesterSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    department: String,
    address: String,
    phone: String,
    fax: String,
    email: String,
    contactName: String,
    position: String,
  },
  { _id: false },
);

const LabRequestSchema = new mongoose.Schema(
  {
    labRequestNo: { type: String, required: true, unique: true, index: true },
    petitionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Petition', required: true, index: true },
    petitionNo: { type: String, required: true, index: true },
    batchNo: { type: String, required: true, index: true },
    sampleSeq: { type: Number, required: true },
    requester: RequesterSchema,
    serviceAgreement: { type: ServiceAgreementSchema, required: true },
    labAgreementReview: LabAgreementReviewSchema,
    reportCustomerName: String,
    reportAddressType: { type: String, enum: ['default', 'other'] },
    reportAddressOther: String,
    invoiceAddressType: { type: String, enum: ['default', 'other'] },
    invoiceAddressOther: String,
    testDelivery: [{ type: String, enum: ['email', 'mail', 'self', 'report', 'fax', 'taxInvoice'] }],
    storageCondition: [{ type: String, enum: ['room', 'chilled'] }],
    packageType: [{ type: String, enum: ['plasticBag', 'glassBottle', 'plasticBottle', 'can', 'other'] }],
    packageTypeOther: String,
    sampleReturn: { type: String, enum: ['return', 'discard', 'keep'] },
  },
  { timestamps: true },
);

module.exports = mongoose.model('LabRequest', LabRequestSchema);
