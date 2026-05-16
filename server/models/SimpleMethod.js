const mongoose = require('mongoose');

const SimpleMethodSchema = new mongoose.Schema({
  itemNo: { type: String, required: true, unique: true, index: true },
  instruments: { type: [String], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('SimpleMethod', SimpleMethodSchema);
