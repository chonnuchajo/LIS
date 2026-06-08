const mongoose = require('mongoose');
const { softDeletePlugin } = require('../lib/softDelete');

const AccessGroupSchema = new mongoose.Schema({
  id: { type: String, required: true, lowercase: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  paths: { type: [String], default: [] },
  locked: { type: Boolean, default: false },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

AccessGroupSchema.index({ id: 1, deletedAt: 1 }, { unique: true });

AccessGroupSchema.plugin(softDeletePlugin);
module.exports = mongoose.model('AccessGroup', AccessGroupSchema);
