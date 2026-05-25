const mongoose = require('mongoose');

const ValueFieldSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true },
  type: { type: String, enum: ['text', 'number', 'float', 'enum', 'photo'], required: true },
  unit: { type: String, default: '' },
  min: { type: Number, default: null },
  max: { type: Number, default: null },
  options: { type: [String], default: [] },
  requireNoteOn: { type: [String], default: [] },
  expectedValues: { type: [String], default: [] },
  standardValue: { type: Number, default: null },
  standardOperator: {
    type: String,
    enum: ['lt', 'lte', 'eq', 'gte', 'gt', 'between', 'tolerance', null],
    default: null,
  },
  standardValue2: { type: Number, default: null },
  timerDurationSec: { type: Number, default: null },
  timerUnit: {
    type: String,
    enum: ['minute', 'hour', 'day', 'month', null],
    default: null,
  },
  required: { type: Boolean, default: false },
}, { _id: false });

const ParameterSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, index: true },
  scope: { type: String, enum: ['lab', 'qc'], default: 'qc', index: true },
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
    if (f.requireNoteOn && f.requireNoteOn.length > 0) {
      const opts = f.options || [];
      const invalid = f.requireNoteOn.filter((v) => !opts.includes(v));
      if (invalid.length > 0) {
        return next(new Error(`requireNoteOn ต้องอยู่ใน options ของช่อง "${f.label}" (ค่าที่ไม่ตรง: ${invalid.join(', ')})`));
      }
    }
    if (f.expectedValues && f.expectedValues.length > 0) {
      const opts = f.options || [];
      const invalid = f.expectedValues.filter((v) => !opts.includes(v));
      if (invalid.length > 0) {
        return next(new Error(`expectedValues ต้องอยู่ใน options ของช่อง "${f.label}" (ค่าที่ไม่ตรง: ${invalid.join(', ')})`));
      }
    }
    if (['number', 'float'].includes(f.type) && f.standardOperator) {
      if (f.standardValue == null) {
        return next(new Error(`ช่อง "${f.label}": ต้องระบุค่ามาตรฐานเมื่อมี standardOperator`));
      }
      if (f.standardOperator === 'between') {
        if (f.standardValue2 == null) {
          return next(new Error(`ช่อง "${f.label}": ต้องระบุค่าสิ้นสุดของช่วง (between)`));
        }
        if (f.standardValue > f.standardValue2) {
          return next(new Error(`ช่อง "${f.label}": ค่าเริ่มต้นต้องน้อยกว่าหรือเท่ากับค่าสิ้นสุด (between)`));
        }
      }
      if (f.standardOperator === 'tolerance') {
        if (f.standardValue2 == null || f.standardValue2 <= 0) {
          return next(new Error(`ช่อง "${f.label}": tolerance % ต้องมากกว่า 0`));
        }
      }
    }
    if (f.type === 'timer') {
      if (!f.timerUnit) {
        return next(new Error(`ช่อง "${f.label}": ต้องระบุหน่วยเวลา (นาที/ชั่วโมง/วัน/เดือน)`));
      }
      if (f.timerDurationSec == null || f.timerDurationSec <= 0) {
        return next(new Error(`ช่อง "${f.label}": ต้องระบุระยะเวลา > 0`));
      }
    }
    if (f.min != null && f.max != null && f.min > f.max) {
      return next(new Error(`min > max ในช่อง "${f.label}"`));
    }
  }
  next();
});

module.exports = mongoose.model('Parameter', ParameterSchema);
