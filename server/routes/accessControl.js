const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Role = require('../models/Role');
const AccessModule = require('../models/AccessModule');

const defaultModules = [
  { id: 'dashboard', name: 'Dashboard', description: 'View lab overview and active workload', group: 'Main', path: '/', paths: ['/', '/home'], locked: true, sortOrder: 10 },
  { id: 'samples', name: 'Samples', description: 'Send, receive, and inspect samples', group: 'Lab', path: '/petitions', paths: ['/petitions', '/petitions/new', '/petitions/:id', '/petitions/:id/edit', '/send-sample', '/physical-inspection'], locked: true, sortOrder: 20 },
  { id: 'results', name: 'Results', description: 'Record analysis results and standards', group: 'Lab', path: '/record-results', paths: ['/record-results', '/stock-deduction', '/daily-check'], locked: true, sortOrder: 30 },
  { id: 'qc', name: 'QC Approval', description: 'Approve or reject final results', group: 'Quality', path: '/qc-approval', paths: ['/dashboard/qc', '/dashboard/lab', '/qc-approval', '/petitions/assign'], locked: true, sortOrder: 40 },
  { id: 'stock', name: 'Stock', description: 'Manage standard and solvent stock', group: 'Inventory', path: '/stock', paths: ['/stock', '/master-items'], locked: true, sortOrder: 50 },
  { id: 'reports', name: 'Reports', description: 'View reports and export data', group: 'Reports', path: '/report', paths: ['/report'], locked: true, sortOrder: 60 },
  { id: 'admin', name: 'Admin Data', description: 'Access approved data and logs', group: 'Admin', path: '/admin-data', paths: ['/admin-data'], locked: true, sortOrder: 70 },
  { id: 'access', name: 'Access Control', description: 'Manage users, roles, and permissions', group: 'Admin', path: '/access-control', paths: ['/access-control', '/settings'], locked: true, sortOrder: 80 },
];

const defaultRoles = [
  { id: 'admin', name: 'Administrator', description: 'Full system access', locked: true, permissions: defaultModules.map(m => m.id) },
  { id: 'lab', name: 'Lab Analyst', description: 'Sample handling and result entry', permissions: ['dashboard', 'samples', 'results', 'stock'] },
  { id: 'qc', name: 'QC Reviewer', description: 'Review and approve results', permissions: ['dashboard', 'results', 'qc', 'reports'] },
  { id: 'viewer', name: 'Viewer', description: 'Read-only access to dashboards and reports', permissions: ['dashboard', 'reports'] },
];

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizePaths(value) {
  if (Array.isArray(value)) {
    return value.map(item => String(item).trim()).filter(Boolean);
  }
  return String(value || '')
    .split(/[\n,]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

async function ensureModules() {
  await Promise.all(defaultModules.map(async (module) => {
    await AccessModule.updateOne(
      { id: module.id },
      { $setOnInsert: module },
      { upsert: true },
    );
    await AccessModule.updateOne(
      { id: module.id, $or: [{ paths: { $exists: false } }, { paths: { $size: 0 } }] },
      { $set: { paths: module.paths, path: module.path } },
    );
  }));
  return AccessModule.find().sort({ sortOrder: 1, name: 1 }).lean();
}

async function removePathsFromOtherModules(moduleId, paths) {
  if (!paths.length) return;
  await AccessModule.updateMany(
    { id: { $ne: moduleId } },
    { $pull: { paths: { $in: paths } } },
  );
}

async function normalizeModulePathOwnership(module) {
  const paths = module.paths?.length ? module.paths : [module.path].filter(Boolean);
  await removePathsFromOtherModules(module.id, paths);
}

async function ensureDefaults() {
  const modules = await ensureModules();
  const count = await Role.countDocuments();
  if (count === 0) {
    await Role.insertMany(defaultRoles);
  }
  await Role.updateOne(
    { id: 'admin' },
    { $addToSet: { permissions: { $each: modules.map(module => module.id) } } },
  );
  return modules;
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

function formatModule(module) {
  return {
    id: module.id,
    name: module.name,
    description: module.description || '',
    group: module.group || 'General',
    path: module.path || '',
    paths: module.paths?.length ? module.paths : [module.path].filter(Boolean),
    locked: module.locked,
  };
}

router.get('/', async (req, res) => {
  try {
    const modules = await ensureDefaults();
    const [users, roles] = await Promise.all([
      User.find().sort({ name: 1, email: 1 }),
      Role.find().sort({ locked: -1, name: 1 }),
    ]);
    res.json({
      users: users.map(formatUser),
      roles: roles.map(formatRole),
      modules: modules.map(formatModule),
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
    const modules = await ensureModules();
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

router.post('/modules', async (req, res) => {
  try {
    const { name, description, group } = req.body;
    const paths = normalizePaths(req.body.paths ?? req.body.path);
    const id = slugify(req.body.id || name);
    if (!id) return res.status(400).json({ error: 'module id is required' });
    if (!name) return res.status(400).json({ error: 'module name is required' });

    const module = await AccessModule.create({
      id,
      name,
      description,
      group: group || 'General',
      path: paths[0] || '',
      paths,
      locked: false,
      sortOrder: Date.now(),
    });
    await normalizeModulePathOwnership(module);
    await Role.updateOne({ id: 'admin' }, { $addToSet: { permissions: module.id } });
    res.status(201).json(formatModule(module));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Module already exists' });
    res.status(400).json({ error: err.message });
  }
});

router.patch('/modules/:id', async (req, res) => {
  try {
    const patch = {};
    ['name', 'description', 'group', 'path'].forEach(key => {
      if (req.body[key] !== undefined) patch[key] = req.body[key];
    });
    if (req.body.paths !== undefined) {
      patch.paths = normalizePaths(req.body.paths);
      patch.path = patch.paths[0] || '';
    }
    const module = await AccessModule.findOneAndUpdate(
      { id: req.params.id },
      patch,
      { new: true },
    );
    if (!module) return res.status(404).json({ error: 'module not found' });
    if (req.body.paths !== undefined) {
      await normalizeModulePathOwnership(module);
    }
    res.json(formatModule(module));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/modules/:id', async (req, res) => {
  try {
    const module = await AccessModule.findOne({ id: req.params.id });
    if (!module) return res.status(404).json({ error: 'module not found' });
    if (module.locked) return res.status(400).json({ error: 'locked module cannot be deleted' });
    await module.deleteOne();
    await Role.updateMany({}, { $pull: { permissions: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
