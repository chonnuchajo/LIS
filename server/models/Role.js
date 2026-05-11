const mongoose = require('mongoose');

const RoleSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, lowercase: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  locked: { type: Boolean, default: false },
  permissions: { type: [String], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('Role', RoleSchema);
