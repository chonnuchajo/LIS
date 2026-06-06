const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { primaryRole, normalizeRoles } = require('../lib/roles');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  name: String,
  password: String,
  role: { type: String, default: 'viewer' },
  roles: { type: [String], default: [] },
  department: { type: String, default: 'Unassigned' },
  position: { type: String, default: 'Unassigned' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  lastActive: { type: String, default: 'Never' },
  authProvider: { type: String, enum: ['local', 'microsoft', 'production'], default: 'local' },
  microsoftId: String,
  tenantId: String,
}, { timestamps: true });

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Keep the legacy single `role` and the new `roles[]` consistent. If roles[] is
// set it wins and `role` becomes the primary; if only the legacy `role` is set,
// seed roles[] from it. Lets old single-role docs migrate lazily on next save.
UserSchema.pre('save', function (next) {
  const roles = normalizeRoles(this);
  this.roles = roles;
  this.role = primaryRole(roles);
  next();
});

UserSchema.methods.comparePassword = function (plain) {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', UserSchema);
