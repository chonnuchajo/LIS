const mongoose = require('mongoose');

const AccessModuleSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, lowercase: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  group: { type: String, default: 'General' },
  path: { type: String, default: '' },
  paths: { type: [String], default: [] },
  locked: { type: Boolean, default: false },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('AccessModule', AccessModuleSchema);
