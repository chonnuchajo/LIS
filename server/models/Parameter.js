const mongoose = require('mongoose');
const { softDeletePlugin } = require('../lib/softDelete');

const OptionOutputSchema = new mongoose.Schema({
  kind: { type: String, enum: ['normal', 'abnormal', 'text'], required: true },
  text: { type: String, default: '' },
}, { _id: false });

const OP_ENUM = ['lt', 'lte', 'eq', 'gte', 'gt', 'between', 'tolerance', null];

const SubstanceStandardSchema = new mongoose.Schema({
  substance: { type: String, required: true, trim: true },
  operator: { type: String, enum: OP_ENUM, default: null },
  value: { type: Number, default: null },
  value2: { type: Number, default: null },
  headOnly: { type: Boolean, default: false },
  itemNo: { type: String, default: '', trim: true },
  packSize: { type: String, default: '', trim: true },
  masterItemName: { type: String, default: '', trim: true },
  masterCommonName: { type: String, default: '', trim: true },
  masterRaw: { type: mongoose.Schema.Types.Mixed, default: undefined },
  productTypes: { type: [String], default: [] },
  regulatoryTypes: { type: [String], default: [] },
  categories: { type: [String], default: [] },
}, { _id: false });

const LabelToleranceStandardSchema = new mongoose.Schema({
  substance: { type: String, default: '', trim: true },
  mode: { type: String, enum: ['percent', 'abs', 'range'], default: 'percent' },
  autoMode: { type: String, enum: ['none', 'percent', 'abs', 'range'], default: null },
  headMode: { type: String, enum: ['none', 'percent', 'abs', 'range'], default: null },
  labelPercent: { type: Number, default: null },
  itemNo: { type: String, default: '', trim: true },
  packSize: { type: String, default: '', trim: true },
  masterItemName: { type: String, default: '', trim: true },
  masterCommonName: { type: String, default: '', trim: true },
  masterRaw: { type: mongoose.Schema.Types.Mixed, default: undefined },
  productTypes: { type: [String], default: [] },
  autoPct:   { type: Number, default: null },
  headPct:   { type: Number, default: null },
  // mode 'abs' — ± รอบค่ากลาง (%ฉลาก) เป็นค่าจริงในหน่วยของ field
  autoAbs:   { type: Number, default: null },
  headAbs:   { type: Number, default: null },
  passLow: { type: Number, default: null },
  passHigh: { type: Number, default: null },
  failLow: { type: Number, default: null },
  failHigh: { type: Number, default: null },
}, { _id: false });

function normalizeLabelToleranceModes(std) {
  if ((std.mode || 'percent') === 'range') {
    return { mode: 'range', autoMode: null, headMode: null, legacy: false };
  }
  if (std.autoMode || std.headMode) {
    return {
      mode: 'split',
      autoMode: std.autoMode || (std.passLow != null || std.passHigh != null ? 'range' : 'abs'),
      headMode: std.headMode || (std.failLow != null || std.failHigh != null ? 'range' : std.headAbs != null || std.headPct != null ? 'abs' : null),
      legacy: false,
    };
  }
  const legacyMode = std.mode || 'percent';
  return {
    mode: legacyMode,
    autoMode: legacyMode === 'abs' ? 'abs' : 'percent',
    headMode: legacyMode === 'abs' ? (std.headAbs != null ? 'abs' : null) : (std.headPct != null ? 'percent' : null),
    legacy: true,
  };
}

const StandardConditionSchema = new mongoose.Schema({
  sourceParameterId: { type: String, default: null },
  sourceFieldLabel: { type: String, required: true },
  op: { type: String, enum: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between'], required: true },
  value: { type: mongoose.Schema.Types.Mixed },
  value2: { type: Number, default: null },
}, { _id: false });

const StandardRuleSchema = new mongoose.Schema({
  label: { type: String, default: '' },
  conditions: { type: [StandardConditionSchema], default: [] },
  operator: { type: String, enum: OP_ENUM, default: null },
  value: { type: Number, default: null },
  value2: { type: Number, default: null },
  outputText: { type: String, default: '' },
  outputKind: { type: String, enum: ['normal', 'abnormal'], default: 'normal' },
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
    enum: OP_ENUM,
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
  // Per-substance standards (number/float). substanceMode=true → single standardOperator/Value ignored.
  substanceMode: { type: Boolean, default: false },
  substanceStandards: { type: [SubstanceStandardSchema], default: [] },
  // Conditional standards (number/float). conditionalMode=true → single standard* and substance* ignored.
  conditionalMode: { type: Boolean, default: false },
  conditionalStandards: { type: [StandardRuleSchema], default: [] },
  conditionalResult: { type: String, enum: ['standard', 'output'], default: 'standard' },
  // Label-% tolerance (number/float). labelToleranceMode=true → center=%ฉลากที่แกะจากชื่อสาร,
  // 3 ช่วง ต่อสาร. single/substance/conditional ถูก ignore. exclusive กับ substance/conditional.
  labelToleranceMode: { type: Boolean, default: false },
  labelToleranceStandards: { type: [LabelToleranceStandardSchema], default: [] },
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
  excludeCommonNames: { type: [String], default: [] },
  excludeItemNames: { type: [String], default: [] },
  excludeProductTypes: { type: [String], default: [] },
  excludeCategories: { type: [String], default: [] },
  excludeSubCategories: { type: [String], default: [] },
  excludeItemGroups: { type: [String], default: [] },
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
    if ([f.substanceMode, f.conditionalMode, f.labelToleranceMode].filter(Boolean).length > 1) {
      return next(new Error(`ช่อง "${f.label}": เลือกได้โหมดเดียวจาก แยกตามสาร / เงื่อนไขพิเศษ / ตาม %สาร`));
    }
    if (f.substanceMode) {
      const allowedPT = new Set(['water', 'sand', 'powder']);
      const allowedRegType = new Set(['GMP', 'BIO', 'LS']);
      const allowedCat = new Set(['RM', 'FG']);
      for (const s of f.substanceStandards || []) {
        s.productTypes = (s.productTypes || []).map((p) => String(p).trim()).filter(Boolean);
        s.regulatoryTypes = (s.regulatoryTypes || []).map((p) => String(p).trim().toUpperCase()).filter(Boolean);
        s.categories = (s.categories || []).map((c) => String(c).trim().toUpperCase()).filter(Boolean);
        const badPT = s.productTypes.filter((p) => !allowedPT.has(p));
        if (badPT.length > 0) {
          return next(new Error(`ช่อง "${f.label}": productTypes ของเกณฑ์รายสารมีค่าที่ไม่รองรับ: ${badPT.join(', ')}`));
        }
        const badRegType = s.regulatoryTypes.filter((p) => !allowedRegType.has(p));
        if (badRegType.length > 0) {
          return next(new Error(`ช่อง "${f.label}": regulatoryTypes ของเกณฑ์รายสารมีค่าที่ไม่รองรับ: ${badRegType.join(', ')}`));
        }
        const badCat = s.categories.filter((c) => !allowedCat.has(c));
        if (badCat.length > 0) {
          return next(new Error(`ช่อง "${f.label}": categories ของเกณฑ์รายสารมีค่าที่ไม่รองรับ: ${badCat.join(', ')}`));
        }
      }
    }
    if (f.labelToleranceMode) {
      const allowedPT = new Set(['water', 'sand', 'powder']);
      for (const s of f.labelToleranceStandards || []) {
        const productTypes = (s.productTypes || []).filter(Boolean);
        const substance = String(s.substance || '').trim();
        const hasSelector = substance || s.labelPercent != null || productTypes.length > 0;
        const normalized = normalizeLabelToleranceModes(s);
        if (!hasSelector) {
          return next(new Error(`ช่อง "${f.label}": ต้องระบุสาร หรือ %ฉลาก หรือประเภทสินค้า อย่างน้อย 1 อย่างในเกณฑ์ %สาร`));
        }
        const badPT = productTypes.filter((p) => !allowedPT.has(p));
        if (badPT.length > 0) {
          return next(new Error(`ช่อง "${f.label}": productTypes ของเกณฑ์ %สารมีค่าที่ไม่รองรับ: ${badPT.join(', ')}`));
        }
        if (normalized.mode === 'range') {
          if ([s.passLow, s.passHigh, s.failLow, s.failHigh].some((v) => v == null)) {
            return next(new Error(`ช่อง "${f.label}": โหมดช่วงกำหนดเองต้องกรอก failLow, passLow, passHigh, failHigh ให้ครบ`));
          }
          if (!(s.failLow <= s.passLow && s.passLow <= s.passHigh && s.passHigh <= s.failHigh)) {
            return next(new Error(`ช่อง "${f.label}": ช่วงกำหนดเองต้องเรียง failLow ≤ passLow ≤ passHigh ≤ failHigh`));
          }
        } else {
          const headConfigured = normalized.headMode != null && normalized.headMode !== 'none';
          let headComparableAbs = null;
          const headIsRange = normalized.headMode === 'range';
          const autoIsRange = normalized.autoMode === 'range';
          if (normalized.autoMode === 'none' && normalized.headMode === 'none') {
            return next(new Error(`ช่อง "${f.label}" สาร "${s.substance}": ต้องตั้งช่วงผ่านอัตโนมัติหรือหัวหน้าตรวจสอบอย่างน้อยหนึ่งช่วง`));
          }
          if (normalized.autoMode === 'none' && !normalized.headMode) {
            return next(new Error(`field "${f.label}" substance "${s.substance}": autoMode none requires a head-review band`));
          }
          if (normalized.headMode === 'none' && !normalized.autoMode) {
            return next(new Error(`field "${f.label}" substance "${s.substance}": headMode none requires an auto-pass band`));
          }
          if (normalized.headMode === 'percent') {
            if (s.headPct == null || s.headPct <= 0) {
              return next(new Error(`ช่อง "${f.label}" สาร "${s.substance}": หัวหน้าตรวจสอบแบบ % (headPct) ต้องมากกว่า 0`));
            }
          } else if (normalized.headMode === 'none') {
            // no head-review band
          } else if (normalized.headMode === 'abs') {
            if (s.headAbs == null || s.headAbs <= 0) {
              return next(new Error(`ช่อง "${f.label}" สาร "${s.substance}": หัวหน้าตรวจสอบแบบ ±คงที่ (headAbs) ต้องมากกว่า 0`));
            }
            headComparableAbs = s.headAbs;
          } else if (headIsRange) {
            if (s.failLow == null || s.failHigh == null) {
              return next(new Error(`ช่อง "${f.label}" สาร "${s.substance}": หัวหน้าตรวจสอบแบบค่าระหว่างต้องกรอก failLow และ failHigh`));
            }
            if (s.failLow > s.failHigh) {
              return next(new Error(`ช่อง "${f.label}" สาร "${s.substance}": failLow ต้องไม่มากกว่า failHigh`));
            }
          }
          if (normalized.autoMode === 'percent') {
            if (s.autoPct == null || s.autoPct <= 0) {
              return next(new Error(`ช่อง "${f.label}" สาร "${s.substance}": ผ่านแบบ % (autoPct) ต้องมากกว่า 0`));
            }
            if (!normalized.legacy && !headConfigured) {
              return next(new Error(`ช่อง "${f.label}" สาร "${s.substance}": ถ้าช่อง "ผ่าน" ใช้ % ต้องตั้งค่าหัวหน้าตรวจสอบก่อน`));
            }
            if (headConfigured && s.autoPct > 100) {
              return next(new Error(`ช่อง "${f.label}" สาร "${s.substance}": ผ่านแบบ % ต้องไม่เกิน 100% ของหัวหน้าตรวจสอบ`));
            }
            if (normalized.legacy && s.headPct != null && s.headPct < s.autoPct) {
              return next(new Error(`ช่อง "${f.label}" สาร "${s.substance}": ±หัวหน้า (headPct) ต้อง ≥ ±ออโต้`));
            }
          } else if (normalized.autoMode === 'none') {
            // no auto-pass band
          } else if (normalized.autoMode === 'abs') {
            if (s.autoAbs == null || s.autoAbs <= 0) {
              return next(new Error(`ช่อง "${f.label}" สาร "${s.substance}": ±ผ่าน (autoAbs) ต้องมากกว่า 0`));
            }
            if (headComparableAbs != null && s.autoAbs > headComparableAbs) {
              return next(new Error(`ช่อง "${f.label}" สาร "${s.substance}": เกณฑ์ผ่านต้องไม่กว้างกว่าหัวหน้าตรวจสอบ`));
            }
          } else if (autoIsRange) {
            if (s.passLow == null || s.passHigh == null) {
              return next(new Error(`ช่อง "${f.label}" สาร "${s.substance}": ช่วงผ่านแบบค่าระหว่างต้องกรอก passLow และ passHigh`));
            }
            if (s.passLow > s.passHigh) {
              return next(new Error(`ช่อง "${f.label}" สาร "${s.substance}": passLow ต้องไม่มากกว่า passHigh`));
            }
            if (headIsRange && (s.passLow < s.failLow || s.passHigh > s.failHigh)) {
              return next(new Error(`ช่อง "${f.label}" สาร "${s.substance}": passLow/passHigh ต้องอยู่ในช่วง failLow/failHigh ของหัวหน้าตรวจสอบ`));
            }
          }
        }
      }
    }
    if (f.conditionalMode && f.conditionalResult === 'output') {
      if (f.multiple) {
        return next(new Error(`ช่อง "${f.label}": โหมดข้อความผลลัพธ์ใช้ร่วมกับ "กรอกหลายค่า" ไม่ได้`));
      }
      for (const rule of f.conditionalStandards || []) {
        const hasText = (rule.outputText && String(rule.outputText).trim()) || (rule.label && String(rule.label).trim());
        if (!hasText) {
          return next(new Error(`ช่อง "${f.label}": ต้องระบุข้อความผลลัพธ์ของกฎ (โหมดข้อความ)`));
        }
      }
    }
    if (f.multiple) {
      if (!['text', 'number', 'float', 'enum'].includes(f.type)) {
        return next(new Error(`ช่อง "${f.label}": กรอกหลายค่าได้เฉพาะชนิด text/number/float/enum`));
      }
      if (f.substanceMode) {
        return next(new Error(`ช่อง "${f.label}": ใช้ "กรอกหลายค่า" ร่วมกับโหมดรายสารไม่ได้`));
      }
      if (f.labelToleranceMode) {
        return next(new Error(`ช่อง "${f.label}": ใช้ "กรอกหลายค่า" ร่วมกับโหมดตาม %สารไม่ได้`));
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
