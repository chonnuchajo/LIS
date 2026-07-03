// server/models/StandardWeighing.js
const mongoose = require('mongoose');
const { softDeletePlugin } = require('../lib/softDelete');

const PersonSchema = new mongoose.Schema(
  { email: { type: String, default: '' }, name: { type: String, default: '' } },
  { _id: false },
);

const StandardWeighingSchema = new mongoose.Schema(
  {
    petitionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Petition', required: true, index: true },
    petitionNo: { type: String, default: '' },
    sampleId: { type: String, default: '' },
    commonName: { type: String, required: true, trim: true },
    substance: { type: String, required: true, trim: true },
    instrument: { type: String, required: true, enum: ['GC', 'HPLC'], uppercase: true, trim: true }, // 'GC' | 'HPLC'
    times: { type: Number, default: null },        // snapshot at save time
    mode: { type: String, enum: ['fresh', 'working'], default: 'fresh' },
    masses: { type: [Number], default: [] },       // mg per weigh (mode='fresh')
    totalMg: { type: Number, default: 0 },
    bottleQrId: { type: String, default: '' },     // sealed unit scanned (mode='fresh')
    workingQrId: { type: String, default: '' },    // working unit chosen or auto-created
    deductedAt: { type: Date, default: null },     // null = not deducted yet (idempotent guard)
    deductedBy: { type: PersonSchema, default: undefined },
    note: { type: String, default: '' },
  },
  { timestamps: true },
);

// One weighing per (petition, substance, instrument).
StandardWeighingSchema.index(
  { petitionId: 1, commonName: 1, substance: 1, instrument: 1, deletedAt: 1 },
  { unique: true },
);

StandardWeighingSchema.plugin(softDeletePlugin);
module.exports = mongoose.model('StandardWeighing', StandardWeighingSchema);
