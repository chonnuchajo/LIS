const mongoose = require('mongoose');

const CoaCounterSchema = new mongoose.Schema(
  {
    year: { type: Number, required: true, unique: true, index: true },
    sequence: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model('CoaCounter', CoaCounterSchema);
