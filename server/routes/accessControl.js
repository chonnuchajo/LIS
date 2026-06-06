const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const User = require('../models/User');
const Role = require('../models/Role');
const AccessGroup = require('../models/AccessGroup');
const { findOrphanBackfillPaths } = require('../lib/accessGroups');
const { resolveHrField } = require('../lib/userProfile');
const { primaryRole, normalizeRoles, unionPermissions } = require('../lib/roles');

const defaultGroups = [
  { id: 'dashboard', name: 'หน้าหลัก', description: 'ภาพรวมแล็บและงานที่กำลังดำเนินการ', paths: ['/', '/home', '/dashboard/lab'], locked: false, sortOrder: 10 },
  { id: 'samples', name: 'งานตัวอย่าง', description: 'รับ ส่ง และตรวจกายภาพตัวอย่าง', paths: ['/petitions', '/petitions/new', '/petitions/production/new', '/petitions/ProductionIntegrationPetitionNewPage', '/petitions/:id', '/petitions/:id/edit', '/physical-inspection'], locked: false, sortOrder: 20 },
  { id: 'audit-log', name: 'Audit Log', description: 'ประวัติการเปลี่ยนสถานะคำร้อง', paths: ['/adutuilog', '/auditlog'], locked: false, sortOrder: 25 },
  { id: 'results', name: 'ผลวิเคราะห์', description: 'บันทึกผลและมาตรฐาน', paths: ['/record-results', '/stock-deduction', '/daily-check'], locked: false, sortOrder: 30 },
  { id: 'qc', name: 'ควบคุมคุณภาพ', description: 'อนุมัติหรือปฏิเสธผลและ Assign คำร้อง', paths: ['/dashboard/qc', '/qc-approval', '/petitions/assign', '/petitions/:id'], locked: false, sortOrder: 40 },
  { id: 'stock', name: 'สต๊อก', description: 'จัดการ standard ตัวทำละลาย master item simple method และเครื่องมือ', paths: ['/stock', '/master-items', '/simple-method', '/machines'], locked: false, sortOrder: 50 },
  { id: 'reports', name: 'รายงาน', description: 'ดูรายงานและส่งออกข้อมูล', paths: ['/report'], locked: false, sortOrder: 60 },
  { id: 'admin', name: 'ข้อมูลแอดมิน', description: 'ข้อมูลที่อนุมัติแล้วและบันทึกการใช้งาน', paths: ['/admin-data'], locked: false, sortOrder: 70 },
  { id: 'access', name: 'สิทธิ์เข้าใช้งาน', description: 'จัดการผู้ใช้ บทบาท และสิทธิ์', paths: ['/access-control', '/settings'], locked: false, sortOrder: 80 },
  { id: 'others', name: 'อื่นๆ', description: 'หน้าที่ยังไม่ถูกกำหนดกลุ่ม (รับช่วงต่ออัตโนมัติเมื่อลบกลุ่มอื่น)', paths: [], locked: true, sortOrder: 999 },
];

const defaultRoles = [
  { id: 'admin', name: 'Administrator', description: 'Full system access', locked: true, permissions: defaultGroups.map(g => g.id) },
  { id: 'lab', name: 'Lab Analyst', description: 'Sample handling and result entry', permissions: ['dashboard', 'samples', 'results', 'stock'] },
  { id: 'qc', name: 'QC Reviewer', description: 'Review and approve results', permissions: ['dashboard', 'results', 'qc', 'reports'] },
  { id: 'viewer', name: 'Viewer', description: 'Read-only access to dashboards and reports', permissions: ['dashboard', 'reports'] },
];

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9฀-๿]+/g, '-')
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

// One-time migration from legacy `accessmodules` collection to the new
// `accessgroups` collection. Runs only when the new collection is empty.
async function migrateLegacyModules() {
  const count = await AccessGroup.countDocuments();
  if (count > 0) return;
  try {
    const legacy = await mongoose.connection.db
      .collection('accessmodules')
      .find({})
      .toArray();
    if (!legacy.length) return;
    await AccessGroup.insertMany(
      legacy.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description || '',
        paths: m.paths?.length ? m.paths : [m.path].filter(Boolean),
        locked: !!m.locked,
        sortOrder: typeof m.sortOrder === 'number' ? m.sortOrder : 0,
      })),
      { ordered: false },
    );
    await mongoose.connection.db.collection('accessmodules').drop().catch(() => {});
  } catch {
    // Legacy collection may not exist; nothing to do.
  }
}

async function ensureGroups() {
  await migrateLegacyModules();

  // 'others' is the locked catch-all that the sidebar relies on as a fallback —
  // it must always exist, even if every other group has been deleted. Because
  // it's never deletable, a freshly-inserted 'others' is a reliable marker that
  // this is the very first run on this database.
  const othersDefault = defaultGroups.find(group => group.id === 'others');
  let firstRun = false;
  if (othersDefault) {
    const result = await AccessGroup.updateOne(
      { id: 'others' },
      { $setOnInsert: othersDefault },
      { upsert: true },
    );
    firstRun = result.upsertedCount === 1;
  }

  // First-time seed only. Seed the default groups exactly once, on the first
  // run ever (detected via 'others' above). After that, never re-create deleted
  // defaults — deletions must stick across refreshes, even if the admin deletes
  // every group. The extra count guard avoids re-seeding on top of groups that
  // a legacy migration already created.
  if (firstRun) {
    const existingNonOthers = await AccessGroup.countDocuments({ id: { $ne: 'others' } });
    if (existingNonOthers === 0) {
      const seeds = defaultGroups.filter(group => group.id !== 'others');
      if (seeds.length) {
        await AccessGroup.insertMany(seeds, { ordered: false }).catch(() => {});
      }
    }
  }

  await AccessGroup.updateOne({ id: 'others' }, { $set: { locked: true } });

  // Backfill pages added after the original seed (/simple-method, /machines)
  // ONLY when no group claims them yet — giving legacy DBs a default home in
  // 'stock' without ever forcing the page back once an admin has regrouped it.
  // (Doing this unconditionally made Simple Method un-movable between groups.)
  const existingGroups = await AccessGroup.find().lean();
  const orphanPaths = findOrphanBackfillPaths(existingGroups);
  if (orphanPaths.length) {
    await AccessGroup.updateOne(
      { id: 'stock' },
      { $addToSet: { paths: { $each: orphanPaths } } },
    );
  }
  return AccessGroup.find().sort({ sortOrder: 1, name: 1 }).lean();
}

async function ensureDefaults() {
  const groups = await ensureGroups();
  const count = await Role.countDocuments();
  if (count === 0) {
    await Role.insertMany(defaultRoles);
  }
  await Role.updateOne(
    { id: 'admin' },
    { $addToSet: { permissions: { $each: groups.map(group => group.id) } } },
  );
  return groups;
}

async function getRolePermissions(rolesInput) {
  const roles = normalizeRoles(
    Array.isArray(rolesInput) ? { roles: rolesInput } : { role: rolesInput },
  );
  if (roles.length === 0) roles.push('viewer');
  const roleDocs = await Role.find({ id: { $in: roles } }).lean();
  const permsByRole = Object.fromEntries(roleDocs.map((r) => [r.id, r.permissions || []]));
  return unionPermissions(roles, permsByRole);
}

function formatUser(user, permissions) {
  const roles = normalizeRoles(user);
  return {
    id: user._id.toString(),
    name: user.name || '',
    email: user.email,
    roleId: primaryRole(roles),
    roleIds: roles,
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

function formatGroup(group) {
  return {
    id: group.id,
    name: group.name,
    description: group.description || '',
    paths: group.paths || [],
    locked: group.locked,
    sortOrder: group.sortOrder ?? 0,
  };
}

router.get('/', async (req, res) => {
  try {
    const groups = await ensureDefaults();
    const [users, roles] = await Promise.all([
      User.find().sort({ name: 1, email: 1 }),
      Role.find().sort({ locked: -1, name: 1 }),
    ]);
    res.json({
      users: users.map(formatUser),
      roles: roles.map(formatRole),
      groups: groups.map(formatGroup),
      permissions: Object.fromEntries(roles.map(role => [role.id, role.permissions || []])),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users', async (req, res) => {
  try {
    const { name, email, department, position, roleId, roleIds, status } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    const requested = Array.isArray(roleIds) && roleIds.length > 0
      ? roleIds
      : [roleId || 'viewer'];
    const found = await Role.find({ id: { $in: requested } });
    if (found.length !== requested.length) {
      return res.status(400).json({ error: 'role not found' });
    }

    const user = await User.create({
      name,
      email,
      department,
      position,
      roles: requested,
      status: status || 'active',
      lastActive: 'Never',
    });
    res.status(201).json(formatUser(user, await getRolePermissions(requested)));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Email already exists' });
    res.status(400).json({ error: err.message });
  }
});

router.post('/users/microsoft', async (req, res) => {
  try {
    await ensureDefaults();
    const { email, name, microsoftId, tenantId, department, position } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    const normalizedEmail = String(email).toLowerCase();
    const now = new Date().toISOString();
    let user = await User.findOne({ email: normalizedEmail });

    if (user) {
      user.name = name || user.name || normalizedEmail;
      user.authProvider = 'microsoft';
      user.microsoftId = microsoftId || user.microsoftId;
      user.tenantId = tenantId || user.tenantId;
      // Sync แผนก/ตำแหน่ง from Microsoft Graph, but never wipe an admin-set
      // value when Graph has nothing for this user.
      user.department = resolveHrField(department, user.department);
      user.position = resolveHrField(position, user.position);
      user.lastActive = now;
      await user.save();
      return res.json(formatUser(user, await getRolePermissions(normalizeRoles(user))));
    }

    const existingUsers = await User.countDocuments();
    const role = existingUsers === 0 ? 'admin' : 'viewer';
    user = await User.create({
      email: normalizedEmail,
      name: name || normalizedEmail,
      role,
      department: resolveHrField(department, undefined),
      position: resolveHrField(position, undefined),
      status: 'active',
      lastActive: now,
      authProvider: 'microsoft',
      microsoftId,
      tenantId,
    });

    res.status(201).json(formatUser(user, await getRolePermissions(normalizeRoles(user))));
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
    if (req.body.roleIds !== undefined || req.body.roleId !== undefined) {
      const requested = Array.isArray(req.body.roleIds) && req.body.roleIds.length > 0
        ? req.body.roleIds
        : [req.body.roleId];
      const found = await Role.find({ id: { $in: requested } });
      if (found.length !== requested.length) {
        return res.status(400).json({ error: 'role not found' });
      }
      patch.roles = requested;
    }
    if (patch.roles) patch.role = primaryRole(patch.roles);

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
    if (normalizeRoles(user).includes('admin')) {
      return res.status(400).json({ error: 'admin users cannot be deleted here' });
    }
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
    const users = await User.countDocuments({ $or: [{ role: role.id }, { roles: role.id }] });
    if (users > 0) return res.status(400).json({ error: 'move users to another role before deleting' });
    await role.deleteOne();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/roles/:id/permissions', async (req, res) => {
  try {
    const groups = await ensureGroups();
    const validIds = new Set([
      ...groups.map(group => group.id),
      ...groups.flatMap(group => group.paths || []),
    ]);
    // Also accept route-shaped strings (`/...`) so per-page entries from the
    // computed 'others' group — paths that live only in the frontend's
    // PAGE_ITEMS and aren't stored in any group's `paths` — survive the filter.
    const permissions = Array.isArray(req.body.permissions)
      ? req.body.permissions.filter(
          id => typeof id === 'string' && (validIds.has(id) || id.startsWith('/')),
        )
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

router.post('/groups', async (req, res) => {
  try {
    const { name, description } = req.body;
    const paths = normalizePaths(req.body.paths);
    const id = slugify(req.body.id || name);
    if (!id) return res.status(400).json({ error: 'group id is required' });
    if (!name) return res.status(400).json({ error: 'group name is required' });

    // Place new groups right after the current last group, but always before
    // the locked 'others' catch-all (sortOrder 999).
    const last = await AccessGroup.findOne({ id: { $ne: 'others' } })
      .sort({ sortOrder: -1 })
      .lean();
    const sortOrder = (last?.sortOrder ?? 0) + 10;

    const group = await AccessGroup.create({
      id,
      name,
      description,
      paths,
      locked: false,
      sortOrder,
    });
    await Role.updateOne({ id: 'admin' }, { $addToSet: { permissions: group.id } });
    res.status(201).json(formatGroup(group));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Group already exists' });
    res.status(400).json({ error: err.message });
  }
});

router.patch('/groups/:id', async (req, res) => {
  try {
    const patch = {};
    ['name', 'description', 'sortOrder'].forEach(key => {
      if (req.body[key] !== undefined) patch[key] = req.body[key];
    });
    // 'others' membership stays computed (catch-all), but its paths are still
    // writable as an ordering hint for the sidebar.
    if (req.body.paths !== undefined) {
      patch.paths = normalizePaths(req.body.paths);
    }
    const group = await AccessGroup.findOneAndUpdate(
      { id: req.params.id },
      patch,
      { new: true },
    );
    if (!group) return res.status(404).json({ error: 'group not found' });
    res.json(formatGroup(group));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/groups/:id', async (req, res) => {
  try {
    const group = await AccessGroup.findOne({ id: req.params.id });
    if (!group) return res.status(404).json({ error: 'group not found' });
    if (group.locked) return res.status(400).json({ error: 'locked group cannot be deleted' });
    await group.deleteOne();
    await Role.updateMany({}, { $pull: { permissions: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
