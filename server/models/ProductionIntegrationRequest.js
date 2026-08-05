const mongoose = require('mongoose');

const ProductionIntegrationRequestSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true, index: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    createdAt: { type: Date, default: Date.now, expires: '2d' },
  },
  { timestamps: false },
);

module.exports = mongoose.model('ProductionIntegrationRequest', ProductionIntegrationRequestSchema);
