const mongoose = require('mongoose');

const ValueFieldSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true },
  type: { type: String, enum: ['text', 'number', 'float', 'enum', 'photo'], required: true },
  unit: { type: String, default: '' },
  min: { type: Number, default: null },
  max: { type: Number, default: null },
  options: { type: [String], default: [] },
  required: { type: Boolean, default: false },
}, { _id: false });

const ParameterSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, index: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
  applyAll: { type: Boolean, default: false },
  commonNames: { type: [String], default: [] },
  itemNames: { type: [String], default: [] },
  productTypes: { type: [String], default: [] },
  categories: { type: [String], default: [] },
  valueFields: { type: [ValueFieldSchema], default: [] },
  sortOrder: { type: Number, default: 0 },
  note: { type: String, default: '' },
}, { timestamps: true });

ParameterSchema.pre('validate', function (next) {
  for (const f of this.valueFields || []) {
    if (['number', 'float'].includes(f.type) && (!f.unit || !String(f.unit).trim())) {
      return next(new Error(`unit จำเป็นสำหรับช่อง "${f.label}" (type=${f.type})`));
    }
    if (f.type === 'enum' && (!f.options || f.options.length === 0)) {
      return next(new Error(`options ต้องมีอย่างน้อย 1 ตัวสำหรับช่อง "${f.label}"`));
    }
    if (f.min != null && f.max != null && f.min > f.max) {
      return next(new Error(`min > max ในช่อง "${f.label}"`));
    }
  }
  next();
});

module.exports = mongoose.model('Parameter', ParameterSchema);
