const mongoose = require('mongoose');
const { softDeletePlugin } = require('../lib/softDelete');

// A printer destination. Documents route to one of these by "kind"
// (see server/lib/printerRouting.js). CUPS-only — the URL carries the queue.
const PrinterConfigSchema = new mongoose.Schema({
  kind: { type: String, enum: ['a4', 'sticker'], required: true, index: true },
  label: { type: String, default: '' },            // display name, optional
  cupsPrinterUrl: { type: String, default: '' },   // e.g. https://192.168.0.237:631/printers/HP-A4
  isDefault: { type: Boolean, default: false },    // the printer used when printing this kind
}, { timestamps: true });

PrinterConfigSchema.plugin(softDeletePlugin);
module.exports = mongoose.model('PrinterConfig', PrinterConfigSchema);
