const mongoose = require('mongoose');

const SimpleMethodExclusionSchema = new mongoose.Schema({
  pattern: { type: String, required: true, trim: true },
  matchType: {
    type: String,
    enum: ['contains', 'startsWith', 'endsWith'],
    default: 'contains',
  },
}, { timestamps: true });

SimpleMethodExclusionSchema.index({ pattern: 1, matchType: 1 }, { unique: true });

module.exports = mongoose.model('SimpleMethodExclusion', SimpleMethodExclusionSchema);
