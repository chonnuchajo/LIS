const mongoose = require('mongoose');

const MasterItemMetaSchema = new mongoose.Schema({
  itemNo: { type: String, required: true, unique: true, index: true },
  itemCode: { type: String, default: '' },
  itemName: { type: String, default: '' },
  itemType: { type: String, default: '' },
  category: { type: String, default: '' },
  unit: { type: String, default: '' },
  status: { type: String, default: '' },
  description: { type: String, default: '' },
  requiredInspectionQty: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('MasterItemMeta', MasterItemMetaSchema);
