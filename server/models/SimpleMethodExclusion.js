const mongoose = require('mongoose');
const { softDeletePlugin } = require('../lib/softDelete');

const SimpleMethodExclusionSchema = new mongoose.Schema({
  pattern: { type: String, required: true, trim: true },
  matchType: {
    type: String,
    enum: ['contains', 'startsWith', 'endsWith'],
    default: 'contains',
  },
}, { timestamps: true });

SimpleMethodExclusionSchema.index({ pattern: 1, matchType: 1 }, { unique: true });

SimpleMethodExclusionSchema.plugin(softDeletePlugin);
module.exports = mongoose.model('SimpleMethodExclusion', SimpleMethodExclusionSchema);
