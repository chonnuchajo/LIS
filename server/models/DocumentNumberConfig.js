const mongoose = require('mongoose');

const DocumentNumberConfigSchema = new mongoose.Schema({
  docType: {
    type: String,
    enum: ['petition', 'sampleReceipt', 'labRequest'],
    required: true,
    unique: true,
    index: true,
  },
  prefix: { type: String, default: '' },
  yearFormat: { type: String, enum: ['none', 'yy', 'yyyy'], default: 'yy' },
  includeMonth: { type: Boolean, default: true },
  seqPadding: { type: Number, default: 4, min: 1, max: 10 },
  separator: { type: String, default: '-' },
}, { timestamps: true });

module.exports = mongoose.model('DocumentNumberConfig', DocumentNumberConfigSchema);
