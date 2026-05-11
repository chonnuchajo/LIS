const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Role = require('../models/Role');

const modules = [
  { id: 'dashboard', name: 'Dashboard', description: 'View lab overview and active workload' },
  { id: 'samples', name: 'Samples', description: 'Send, receive, and inspect samples' },
  { id: 'results', name: 'Results', description: 'Record analysis results and standards' },
  { id: 'qc', name: 'QC Approval', description: 'Approve or reject final results' },
  { id: 'stock', name: 'Stock', description: 'Manage standard and solvent stock' },
  { id: 'reports', name: 'Reports', description: 'View reports and export data' },
  { id: 'admin', name: 'Admin Data', description: 'Access approved data and logs' },
  { id: 'access', name: 'Access Control', description: 'Manage users, roles, and permissions' },
];

const defaultRoles = [
  { id: 'admin', name: 'Administrator', description: 'Full system access', locked: true, permissions: modules.map(m => m.id) },
  { id: 'lab', name: 'Lab Analyst', description: 'Sample handling and result entry', permissions: ['dashboard', 'samples', 'results', 'stock'] },
  { id: 'qc', name: 'QC Reviewer', description: 'Review and approve results', permissions: ['dashboard', 'results', 'qc', 'reports'] },
  { id: 'viewer', name: 'Viewer', description: 'Read-only access to dashboards and reports', permissions: ['dashboard', 'reports'] },
];

async function ensureDefaults() {
  const count = await Role.countDocuments();
  if (count === 0) {
    await Role.insertMany(defaultRoles);
  }
}

async function getRolePermissions(roleId) {
  const role = await Role.findOne({ id: roleId || 'viewer' }).lean();
  return role?.permissions || [];
}

function formatUser(user, permissions) {
  return {
    id: user._id.toString(),
    name: user.name || '',
    email: user.email,
    roleId: user.role || 'viewer',
    permissions,
    department: user.department || 'Unassigned',
    position: user.position || 'Unassigned',
    status: user.status || 'active',
    lastActive: user.lastActive || 'Never',
    authProvider: user.authProvider || 'local',
  };
}

function formatRole(role) {
  return {
    id: role.id,
    name: role.name,
    description: role.description || '',
    locked: role.locked,
  };
}

router.get('/', async (req, res) => {
  try {
    await ensureDefaults();
    const [users, roles] = await Promise.all([
      User.find().sort({ name: 1, email: 1 }),
      Role.find().sort({ locked: -1, name: 1 }),
    ]);
    res.json({
      users: users.map(formatUser),
      roles: roles.map(formatRole),
      modules,
      permissions: Object.fromEntries(roles.map(role => [role.id, role.permissions || []])),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users', async (req, res) => {
  try {
    const { name, email, department, position, roleId, status } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });
    const role = await Role.findOne({ id: roleId || 'viewer' });
    if (!role) return res.status(400).json({ error: 'role not found' });

    const user = await User.create({
      name,
      email,
      department,
      position,
      role: role.id,
      status: status || 'active',
      lastActive: 'Never',
    });
    res.status(201).json(formatUser(user));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Email already exists' });
    res.status(400).json({ error: err.message });
  }
});

router.post('/users/microsoft', async (req, res) => {
  try {
    await ensureDefaults();
    const { email, name, microsoftId, tenantId } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    const normalizedEmail = String(email).toLowerCase();
    const now = new Date().toISOString();
    let user = await User.findOne({ email: normalizedEmail });

    if (user) {
      user.name = name || user.name || normalizedEmail;
      user.authProvider = 'microsoft';
      user.microsoftId = microsoftId || user.microsoftId;
      user.tenantId = tenantId || user.tenantId;
      user.lastActive = now;
      await user.save();
      return res.json(formatUser(user, await getRolePermissions(user.role)));
    }

    const existingUsers = await User.countDocuments();
    const role = existingUsers === 0 ? 'admin' : 'viewer';
    user = await User.create({
      email: normalizedEmail,
      name: name || normalizedEmail,
      role,
      department: 'Unassigned',
      position: 'Unassigned',
      status: 'active',
      lastActive: now,
      authProvider: 'microsoft',
      microsoftId,
      tenantId,
    });

    res.status(201).json(formatUser(user, await getRolePermissions(user.role)));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Email already exists' });
    res.status(400).json({ error: err.message });
  }
});

router.patch('/users/:id', async (req, res) => {
  try {
    const patch = {};
    ['name', 'email', 'department', 'position', 'status', 'lastActive'].forEach(key => {
      if (req.body[key] !== undefined) patch[key] = req.body[key];
    });
    if (req.body.roleId !== undefined) {
      const role = await Role.findOne({ id: req.body.roleId });
      if (!role) return res.status(400).json({ error: 'role not found' });
      patch.role = role.id;
    }

    const user = await User.findByIdAndUpdate(req.params.id, patch, { new: true });
    if (!user) return res.status(404).json({ error: 'user not found' });
    res.json(formatUser(user));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'user not found' });
    if (user.role === 'admin') return res.status(400).json({ error: 'admin users cannot be deleted here' });
    await user.deleteOne();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/roles', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const role = await Role.create({ id, name, description, permissions: [] });
    res.status(201).json(formatRole(role));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Role already exists' });
    res.status(400).json({ error: err.message });
  }
});

router.delete('/roles/:id', async (req, res) => {
  try {
    const role = await Role.findOne({ id: req.params.id });
    if (!role) return res.status(404).json({ error: 'role not found' });
    if (role.locked) return res.status(400).json({ error: 'locked role cannot be deleted' });
    const users = await User.countDocuments({ role: role.id });
    if (users > 0) return res.status(400).json({ error: 'move users to another role before deleting' });
    await role.deleteOne();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/roles/:id/permissions', async (req, res) => {
  try {
    const validIds = new Set(modules.map(module => module.id));
    const permissions = Array.isArray(req.body.permissions)
      ? req.body.permissions.filter(id => validIds.has(id))
      : [];
    const role = await Role.findOneAndUpdate(
      { id: req.params.id },
      { permissions },
      { new: true },
    );
    if (!role) return res.status(404).json({ error: 'role not found' });
    res.json({ roleId: role.id, permissions: role.permissions });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
