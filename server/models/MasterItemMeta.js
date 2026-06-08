const mongoose = require('mongoose');
const { softDeletePlugin } = require('../lib/softDelete');

const MasterItemMetaSchema = new mongoose.Schema({
  itemNo: { type: String, required: true, index: true },
  itemCode: { type: String, default: '' },
  itemName: { type: String, default: '' },
  itemType: { type: String, default: '' },
  category: { type: String, default: '' },
  unit: { type: String, default: '' },
  status: { type: String, default: '' },
  description: { type: String, default: '' },
  requiredInspectionQty: { type: Number, default: 0 },
}, { timestamps: true });

MasterItemMetaSchema.index({ itemNo: 1, deletedAt: 1 }, { unique: true });

MasterItemMetaSchema.plugin(softDeletePlugin);
module.exports = mongoose.model('MasterItemMeta', MasterItemMetaSchema);
