const mongoose = require('mongoose');

const SimpleMethodSchema = new mongoose.Schema({
  itemNo: { type: String, required: true, unique: true, index: true },
  instruments: { type: [String], default: [] },     // legacy (back-compat read; written until cleanup)
  methods: { type: [[String]], default: undefined }, // positional AND-sets per substance
}, { timestamps: true });

module.exports = mongoose.model('SimpleMethod', SimpleMethodSchema);
