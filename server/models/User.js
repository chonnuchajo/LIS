const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  name: String,
  password: String,
  role: { type: String, default: 'viewer' },
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

UserSchema.methods.comparePassword = function (plain) {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', UserSchema);
