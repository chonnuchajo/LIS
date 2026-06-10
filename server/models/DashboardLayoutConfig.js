const mongoose = require('mongoose');

const SectionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { _id: false },
);

const DashboardLayoutConfigSchema = new mongoose.Schema(
  {
    dashboard: { type: String, enum: ['lab', 'qc'], required: true, index: true },
    roleId: { type: String, required: true }, // a Role _id, or '_default'
    sections: { type: [SectionSchema], default: [] },
    kpis: {
      all: { type: Boolean, default: true },
      waiting: { type: Boolean, default: true },
      inProgress: { type: Boolean, default: true },
      completed: { type: Boolean, default: true },
    },
  },
  { timestamps: true },
);

// Upsert-only config (like EnvRoomConfig / PrintConfig) — no soft-delete plugin.
DashboardLayoutConfigSchema.index({ dashboard: 1, roleId: 1 }, { unique: true });

module.exports = mongoose.model('DashboardLayoutConfig', DashboardLayoutConfigSchema);
