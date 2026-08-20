const mongoose = require('mongoose');

const StockStandardLabelCounterSchema = new mongoose.Schema(
  {
    standardId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockStandard', required: true, index: true },
    year: { type: Number, required: true, index: true },
    sequence: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

StockStandardLabelCounterSchema.index({ standardId: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('StockStandardLabelCounter', StockStandardLabelCounterSchema);
