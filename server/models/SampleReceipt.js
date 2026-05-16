const mongoose = require('mongoose');

const SampleReceiptSchema = new mongoose.Schema(
  {
    runNo: { type: String, required: true, unique: true, index: true },
    sampleId: { type: String, required: true, unique: true, index: true },
    petitionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Petition', index: true },
    petitionNo: String,
    sampleName: String,
    receiver: String,
    receivedAt: { type: Date, default: Date.now, index: true },
    instrument: String,
    standardLotNo: String,
    standardName: String,
  },
  { timestamps: true },
);

module.exports = mongoose.model('SampleReceipt', SampleReceiptSchema);
