const mongoose = require('mongoose');

const StockTransactionSchema = new mongoose.Schema({
  itemType: { type: String, enum: ['standard', 'solvent', 'glassware'], required: true, index: true },
  itemId: { type: String, required: true, index: true },
  itemCode: String,
  itemName: String,
  action: { type: String, enum: ['create', 'update', 'delete', 'deduct', 'receive'], required: true, index: true },
  tier: { type: String, enum: ['primary', 'supplier', 'working', null], default: null },
  beforeQty: { type: Number, default: null },
  afterQty: { type: Number, default: null },
  delta: { type: Number, default: null },
  unit: String,
  sampleId: String,
  note: String,
  userEmail: String,
  userName: String,
}, { timestamps: true });

StockTransactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('StockTransaction', StockTransactionSchema);
