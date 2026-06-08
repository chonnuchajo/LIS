// Soft-delete plugin: marks rows hidden instead of removing them, and auto-hides
// them from reads. Apply explicitly per model (NOT as a global mongoose.plugin),
// so embedded subdocument schemas don't get polluted with deletedAt fields.

const QUERY_HOOKS = [
  'find',
  'findOne',
  'findOneAndUpdate',
  'findOneAndReplace',
  'count',
  'countDocuments',
  'updateOne',
  'updateMany',
];

// Pure: filter that matches live (non-deleted) rows. `{ deletedAt: null }` also
// matches rows where the field is absent (legacy rows predating soft delete).
const liveFilter = () => ({ deletedAt: null });

// Pure: the field patch written when soft-deleting.
const softDeleteValues = (by, now) => ({
  deletedAt: now,
  deletedBy: by || 'system',
});

// Query pre-hook body. `this` is a Mongoose Query. Adds the not-deleted filter
// unless the query opted out with `.setOptions({ withDeleted: true })`.
function applyLiveFilter(next) {
  const opts = typeof this.getOptions === 'function' ? this.getOptions() : {};
  if (!opts.withDeleted) {
    this.where(liveFilter());
  }
  next();
}

function softDeletePlugin(schema) {
  schema.add({
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: String, default: '' },
  });

  for (const hook of QUERY_HOOKS) {
    schema.pre(hook, applyLiveFilter);
  }

  // Instance: soft-delete a loaded document.
  schema.methods.softDelete = function softDelete(by) {
    Object.assign(this, softDeleteValues(by, new Date()));
    return this.save();
  };

  // Static: soft-delete every live row matching `filter`. The updateMany pre-hook
  // scopes this to live rows, so it is idempotent.
  schema.statics.softDeleteMany = function softDeleteMany(filter, by) {
    return this.updateMany(filter, { $set: softDeleteValues(by, new Date()) });
  };
}

module.exports = {
  QUERY_HOOKS,
  liveFilter,
  softDeleteValues,
  applyLiveFilter,
  softDeletePlugin,
};
