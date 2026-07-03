const mongoose = require('mongoose');
const { softDeletePlugin } = require('../lib/softDelete');

const PersonSchema = new mongoose.Schema({
  email: { type: String, default: '' },
  name: { type: String, default: '' },
}, { _id: false });

const ChemicalRequisitionSchema = new mongoose.Schema({
  date: { type: String, required: true, index: true },     // "YYYY-MM-DD" (local)
  roomSlug: { type: String, required: true, index: true },
  instrumentId: { type: String, required: true },
  instrumentName: { type: String, default: '' },
  itemType: { type: String, enum: ['solvent'], default: 'solvent' },
  solventId: { type: String, required: true, index: true },
  solventName: { type: String, default: '' },
  qty: { type: Number, required: true },
  unit: { type: String, default: 'bottle' },
  note: { type: String, default: '' },
  requestedBy: { type: PersonSchema, default: undefined },
}, { timestamps: true });

ChemicalRequisitionSchema.index({ roomSlug: 1, date: 1 });
ChemicalRequisitionSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('ChemicalRequisition', ChemicalRequisitionSchema);
