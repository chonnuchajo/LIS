const mongoose = require('mongoose');
const { softDeletePlugin } = require('../lib/softDelete');

// Config that maps a result parameter (e.g. "density") to the lab instrument's
// API endpoint, so the LIS backend can pull the latest reading on demand.
// One row per parameter; add an instrument = add a row, no code change.
const InstrumentSourceSchema = new mongoose.Schema({
  key: { type: String, required: true },           // param key, ties to a result field e.g. "density"
  label: { type: String, default: '' },            // display name e.g. "ความถ่วงจำเพาะ (ถ.พ.)"
  instrumentName: { type: String, default: '' },   // e.g. "DMA 4500"
  fetchUrl: { type: String, default: '' },         // instrument endpoint (server-side only)
  method: { type: String, default: 'GET' },
  authHeader: { type: String, default: '' },        // raw "Header: value" sent verbatim, optional
  responsePath: { type: String, default: '' },      // dotted path to the value in the JSON reply e.g. "data.value"
  readingAtPath: { type: String, default: '' },     // optional dotted path to the device timestamp
  unit: { type: String, default: '' },
  decimals: { type: Number, default: null },
  timeoutMs: { type: Number, default: 5000 },
  enabled: { type: Boolean, default: true },
}, { timestamps: true });

InstrumentSourceSchema.index({ key: 1, deletedAt: 1 }, { unique: true });

InstrumentSourceSchema.plugin(softDeletePlugin);
module.exports = mongoose.model('InstrumentSource', InstrumentSourceSchema);
