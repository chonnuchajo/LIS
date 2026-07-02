const mongoose = require('mongoose');
const { softDeletePlugin } = require('../lib/softDelete');

const OptionOutputSchema = new mongoose.Schema({
  kind: { type: String, enum: ['normal', 'abnormal', 'text'], required: true },
  text: { type: String, default: '' },
}, { _id: false });

const ValueFieldSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true },
  type: { type: String, enum: ['text', 'number', 'float', 'enum', 'photo', 'file', 'timer', 'reference'], required: true },
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
  // Field-level repeat — when true this single field is filled multiple times;
  // its stored value becomes an array. Only valid for text/number/float/enum.
  multiple: { type: Boolean, default: false },
  maxPhotos: { type: Number, default: 5, min: 1, max: 20 },
  maxFiles: { type: Number, default: 5, min: 1, max: 20 },
  allowedFileTypes: { type: [String], default: ['pdf'] },
  // 2-phase support: which phase this field appears in
  // 'both'   = field appears in both Phase 1 (ก่อน) and Phase 2 (หลัง) — collected twice
  // 'before' = field only appears in Phase 1
  // 'after'  = field only appears in Phase 2 (deferred value)
  phase: {
    type: String,
    enum: ['both', 'before', 'after'],
    default: 'both',
  },
  // When true, completing this field (or timer expiry) advances petition.currentPhase from 1 → 2
  triggersPhase2: { type: Boolean, default: false },
  // For type='reference' — pulls value from another parameter's saved field
  // on the SAME petition + itemSeq (no re-entry).
  refParameterId: { type: String, default: null },
  refFieldLabel: { type: String, default: null },
  refPhase: { type: Number, enum: [1, 2, null], default: 1 },
  optionFilters: {
    type: Map,
    of: new mongoose.Schema({
      itemNames: { type: [String], default: [] },
      commonNames: { type: [String], default: [] },
      productTypes: { type: [String], default: [] },
      categories: { type: [String], default: [] },
      subCategories: { type: [String], default: [] },
      itemGroups: { type: [String], default: [] },
    }, { _id: false }),
    default: undefined,
  },
  // Per-option result classification for enum fields.
  // Absent = legacy (expectedValues). Present = { option: {kind, text?} }.
  optionOutputs: { type: Map, of: OptionOutputSchema, default: undefined },
}, { _id: false });

const ParameterSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, index: true },
  scope: { type: String, enum: ['lab', 'qc'], default: 'qc', index: true },
  shareWithLab: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
  applyAll: { type: Boolean, default: false },
  commonNames: { type: [String], default: [] },
  itemNames: { type: [String], default: [] },
  productTypes: { type: [String], default: [] },
  categories: { type: [String], default: [] },
  subCategories: { type: [String], default: [] },
  itemGroups: { type: [String], default: [] },
  valueFields: { type: [ValueFieldSchema], default: [] },
  sortOrder: { type: Number, default: 0 },
  note: { type: String, default: '' },
  // 2-phase testing flag — when true this parameter is split into Phase 1 (ก่อน) / Phase 2 (หลัง)
  hasPhases: { type: Boolean, default: false, index: true },
  // Parameter-level repeat — when true the whole valueFields set repeats as
  // independent rows stored in QCTestResult.entries. Mutually exclusive with hasPhases.
  multiEntry: { type: Boolean, default: false, index: true },
}, { timestamps: true });

ParameterSchema.pre('validate', function (next) {
  for (const f of this.valueFields || []) {
    if (['number', 'float'].includes(f.type) && (!f.unit || !String(f.unit).trim())) {
      return next(new Error(`unit จำเป็นสำหรับช่อง "${f.label}" (type=${f.type})`));
    }
    if (f.type === 'enum' && (!f.options || f.options.length === 0)) {
      return next(new Error(`options ต้องมีอย่างน้อย 1 ตัวสำหรับช่อง "${f.label}"`));
    }
    if (f.type === 'enum' && f.optionFilters) {
      const opts = new Set(f.options || []);
      const allowedPT = new Set(['water', 'sand', 'powder']);
      const allowedCat = new Set(['RM', 'FG']);
      // Drop orphan keys (option ถูกลบไปแล้ว แต่ filter ยังค้างอยู่)
      for (const key of Array.from(f.optionFilters.keys())) {
        if (!opts.has(key)) f.optionFilters.delete(key);
      }
      // Validate productTypes / categories values + normalize subCategories
      for (const [key, val] of f.optionFilters.entries()) {
        const pts = val?.productTypes || [];
        const badPT = pts.filter((p) => !allowedPT.has(p));
        if (badPT.length > 0) {
          return next(new Error(`optionFilters[${key}].productTypes มีค่าที่ไม่รองรับ: ${badPT.join(', ')} (รองรับเฉพาะ water/sand/powder) — ช่อง "${f.label}"`));
        }
        const cats = val?.categories || [];
        const badCat = cats.filter((c) => !allowedCat.has(c));
        if (badCat.length > 0) {
          return next(new Error(`optionFilters[${key}].categories มีค่าที่ไม่รองรับ: ${badCat.join(', ')} (รองรับเฉพาะ RM/FG) — ช่อง "${f.label}"`));
        }
        // Normalize subCategories + commonNames to uppercase trimmed
        val.subCategories = (val?.subCategories || []).map((s) => String(s).trim().toUpperCase()).filter(Boolean);
        val.commonNames = (val?.commonNames || []).map((s) => String(s).trim().toUpperCase()).filter(Boolean);
      }
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
    if (f.type === 'enum' && f.optionOutputs) {
      const opts = new Set(f.options || []);
      // Drop orphan keys (option ถูกลบไปแล้ว แต่ output ยังค้าง)
      for (const key of Array.from(f.optionOutputs.keys())) {
        if (!opts.has(key)) f.optionOutputs.delete(key);
      }
      // An all-orphan (now empty) map must collapse to undefined so the
      // present/absent discriminator stays honest (empty map = "no normal", not legacy).
      if (f.optionOutputs.size === 0) {
        f.optionOutputs = undefined;
      } else {
        for (const [key, val] of f.optionOutputs.entries()) {
          if (val && val.kind === 'text' && (!val.text || !String(val.text).trim())) {
            return next(new Error(`ช่อง "${f.label}" ตัวเลือก "${key}": ต้องระบุข้อความเมื่อเลือก output แบบ "ข้อความ"`));
          }
        }
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
    if (f.type === 'reference') {
      if (!f.refParameterId || !f.refFieldLabel) {
        return next(new Error(`ช่อง "${f.label}": ต้องระบุ parameter และ field ต้นทาง`));
      }
      if (f.required) {
        return next(new Error(`ช่อง "${f.label}": field แบบ reference บังคับกรอกไม่ได้ (ดึงค่าอัตโนมัติ)`));
      }
      if (f.triggersPhase2) {
        return next(new Error(`ช่อง "${f.label}": field แบบ reference ใช้เป็น trigger ไม่ได้`));
      }
    }
    if (f.multiple) {
      if (!['text', 'number', 'float', 'enum'].includes(f.type)) {
        return next(new Error(`ช่อง "${f.label}": กรอกหลายค่าได้เฉพาะชนิด text/number/float/enum`));
      }
      if (f.substanceMode) {
        return next(new Error(`ช่อง "${f.label}": ใช้ "กรอกหลายค่า" ร่วมกับโหมดรายสารไม่ได้`));
      }
      if (f.triggersPhase2) {
        return next(new Error(`ช่อง "${f.label}": ตัว trigger Phase 2 กรอกหลายค่าไม่ได้`));
      }
    }
    if (f.min != null && f.max != null && f.min > f.max) {
      return next(new Error(`min > max ในช่อง "${f.label}"`));
    }
  }

  if (this.multiEntry && this.hasPhases) {
    return next(new Error('Parameter แบบ "กรอกหลายรายการ" ใช้ร่วมกับโหมด 2 phase ไม่ได้'));
  }

  // Phase validation
  if (this.hasPhases) {
    const fields = this.valueFields || [];
    const hasBeforeField = fields.some((f) => f.phase === 'both' || f.phase === 'before');
    const hasTrigger = fields.some((f) => f.triggersPhase2);
    if (!hasBeforeField) {
      return next(new Error('Parameter แบบ 2-phase ต้องมีอย่างน้อย 1 field ที่กรอกใน Phase 1 (phase=before หรือ both)'));
    }
    if (!hasTrigger) {
      return next(new Error('Parameter แบบ 2-phase ต้องมีอย่างน้อย 1 field ที่ติ๊ก "ส่งให้ Lab ตรวจค่าหลัง" (triggersPhase2)'));
    }
    for (const f of fields) {
      if (f.triggersPhase2 && f.phase === 'after') {
        return next(new Error(`ช่อง "${f.label}": ตัว trigger ต้องอยู่ใน Phase 1 (phase=before หรือ both) ไม่ใช่ after`));
      }
    }
  } else {
    // Non-phased: reset phase fields to defaults
    for (const f of this.valueFields || []) {
      if (f.phase && f.phase !== 'both') f.phase = 'both';
      if (f.triggersPhase2) f.triggersPhase2 = false;
    }
  }

  next();
});

ParameterSchema.plugin(softDeletePlugin);
module.exports = mongoose.model('Parameter', ParameterSchema);
