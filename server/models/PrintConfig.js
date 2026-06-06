const mongoose = require('mongoose');

const PrintConfigSchema = new mongoose.Schema({
  slug: {
    type: String,
    enum: ['sample-label', 'coa', 'service-request', 'production-plan'],
    required: true,
    unique: true,
    index: true,
  },
  printerName: { type: String, default: '' }, // '' = ยังไม่ตั้ง → บล็อกการพิมพ์
  cupsPrinterUrl: { type: String, default: '' },
  copies: { type: Number, default: 1, min: 1, max: 99 },
  paperSize: { type: String, enum: ['A4', 'label-6x4'], default: 'A4' },
}, { timestamps: true });

module.exports = mongoose.model('PrintConfig', PrintConfigSchema);
