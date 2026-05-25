const mongoose = require("mongoose");

const qcTestResultSchema = new mongoose.Schema(
  {
    petitionId:    { type: String, required: true },
    petitionNo:    { type: String },
    itemSeq:       { type: Number, required: true },
    sampleId:      { type: String },
    sampleName:    { type: String },
    parameterId:   { type: String, required: true },
    parameterName: { type: String },
    values:        { type: mongoose.Schema.Types.Mixed, default: {} },
    enteredBy:     { name: String, email: String },
    enteredAt:     { type: Date },
    updatedBy:     { name: String, email: String },
    updatedAt:     { type: Date },
  },
  { timestamps: false }
);

qcTestResultSchema.index(
  { petitionId: 1, itemSeq: 1, parameterId: 1 },
  { unique: true }
);

module.exports = mongoose.model("QCTestResult", qcTestResultSchema);
