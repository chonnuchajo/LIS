const mongoose = require('mongoose');
const { softDeletePlugin } = require('../lib/softDelete');

const ItemGroupSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  commonNames: { type: [String], default: [] },
  tradeNames: { type: [String], default: [] },
  includeItemNos: { type: [String], default: [] },
  excludeItemNos: { type: [String], default: [] },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

// unique ชื่อกลุ่มในกลุ่มที่ยังไม่ถูกลบ (compound กับ deletedAt — soft-delete pattern)
ItemGroupSchema.index({ name: 1, deletedAt: 1 }, { unique: true });

ItemGroupSchema.plugin(softDeletePlugin);
module.exports = mongoose.model('ItemGroup', ItemGroupSchema);
