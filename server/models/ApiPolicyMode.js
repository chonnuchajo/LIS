const mongoose = require('mongoose');
const { POLICY_MODES } = require('../lib/apiPolicy');

// โหมดของแต่ละ endpoint ที่ admin สลับจากหน้า /settings → แท็บ API Key
// ไม่มี doc = ใช้ defaultMode ที่ประกาศไว้ใน apiPolicy.js
const ApiPolicyModeSchema = new mongoose.Schema({
  policyId: { type: String, required: true, unique: true, index: true },
  mode: { type: String, enum: POLICY_MODES, default: 'audit' },
  updatedBy: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('ApiPolicyMode', ApiPolicyModeSchema);
