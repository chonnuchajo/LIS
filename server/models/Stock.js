const mongoose = require('mongoose');
const { softDeletePlugin } = require('../lib/softDelete');

const TierSchema = new mongoose.Schema({
  qty: { type: Number, default: 0 },
  sizeMg: { type: mongoose.Schema.Types.Mixed, default: null },
  exp: { type: String, default: '' },
}, { _id: false });

const OpenShelfLifeSchema = new mongoose.Schema({
  value: { type: Number, default: 0 },
  unit: { type: String, enum: ['day', 'week', 'month'], default: 'day' },
}, { _id: false });

const StockStandardSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, index: true },
  primary: {
    qty: { type: Number, default: 0 },
    ordered: { type: Number, default: 0 },
    sizeMg: { type: mongoose.Schema.Types.Mixed, default: null },
    exp: { type: String, default: '' },
    usesPerBottle: { type: mongoose.Schema.Types.Mixed, default: null },
    pricePerUnit: { type: Number, default: 0 },
    totalPrice: { type: mongoose.Schema.Types.Mixed, default: 0 },
  },
  supplier: { type: TierSchema, default: () => ({}) },
  working: { type: TierSchema, default: () => ({}) },
  usagePerUseMg: { type: mongoose.Schema.Types.Mixed, default: null },
  frequency: { type: String, default: '' },
  openShelfLife: { type: OpenShelfLifeSchema, default: () => ({ value: 0, unit: 'day' }) },
  storageTemp: { type: String, default: '' },
  status: { type: String, default: '' },
  expiryStatus: { type: String, default: '' },
}, { timestamps: true });

const StockSolventSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  sizeLiter: { type: Number, default: 0 },
  qty: { type: Number, default: 0 },
  price: { type: Number, default: 0 },
  note: { type: String, default: '' },
}, { timestamps: true });

const StockGlasswareSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  qty: { type: Number, default: 0 },
  pricePerPiece: { type: Number, default: 0 },
  note: { type: String, default: '' },
}, { timestamps: true });

StockStandardSchema.plugin(softDeletePlugin);
StockSolventSchema.plugin(softDeletePlugin);
StockGlasswareSchema.plugin(softDeletePlugin);
module.exports = {
  StockStandard: mongoose.model('StockStandard', StockStandardSchema),
  StockSolvent: mongoose.model('StockSolvent', StockSolventSchema),
  StockGlassware: mongoose.model('StockGlassware', StockGlasswareSchema),
};
