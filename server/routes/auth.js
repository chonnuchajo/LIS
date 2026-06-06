const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const User = require('../models/User');
const Role = require('../models/Role');
const { primaryRole, normalizeRoles, unionPermissions } = require('../lib/roles');

function b64urlDecode(value) {
  const padded = value + '='.repeat((4 - (value.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function verifyHs256Jwt(token, secret, leewaySeconds = 30) {
  if (!token || !secret) return null;
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signaturePart] = parts;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${headerPart}.${payloadPart}`)
    .digest();
  const provided = b64urlDecode(signaturePart);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return null;

  const header = JSON.parse(b64urlDecode(headerPart).toString('utf8'));
  if (header.alg !== 'HS256') return null;
  const payload = JSON.parse(b64urlDecode(payloadPart).toString('utf8'));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > Number(payload.exp) + leewaySeconds) return null;
  if (payload.nbf && now < Number(payload.nbf) - leewaySeconds) return null;
  return payload;
}

async function getPermissions(rolesInput) {
  const roles = normalizeRoles(
    Array.isArray(rolesInput) ? { roles: rolesInput } : { role: rolesInput },
  );
  if (roles.length === 0) roles.push('viewer');
  const roleDocs = await Role.find({ id: { $in: roles } }).lean();
  const permsByRole = Object.fromEntries(roleDocs.map((r) => [r.id, r.permissions || []]));
  return unionPermissions(roles, permsByRole);
}

function formatSsoUser(user, permissions = []) {
  const roles = normalizeRoles(user);
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    role: primaryRole(roles),
    roleId: primaryRole(roles),
    roleIds: roles,
    permissions,
    department: user.department,
    position: user.position,
    status: user.status,
  };
}

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: 'ไม่พบบัญชีผู้ใช้นี้ในระบบ' });

    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง' });

    res.json({ email: user.email, name: user.name, role: user.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sso', (req, res) => {
  const token = String(req.query.token || '').trim();
  const ret = String(req.query.ret || '').trim();
  const params = new URLSearchParams();
  if (token) params.set('token', token);
  if (ret) params.set('ret', ret);
  res.redirect(`/LIS/login${params.size ? `?${params.toString()}` : ''}`);
});

router.post('/sso', async (req, res) => {
  try {
    const secret = process.env.LIS_SSO_SECRET || process.env.PRODUCTION_SSO_SECRET || '';
    if (!secret) return res.status(500).json({ error: 'LIS SSO is not configured' });

    let payload;
    try {
      payload = verifyHs256Jwt(req.body?.token, secret);
    } catch {
      payload = null;
    }
    if (!payload) return res.status(401).json({ error: 'SSO token ไม่ถูกต้องหรือหมดอายุ' });
    if (payload.iss !== 'production' || payload.aud !== 'lis') {
      return res.status(401).json({ error: 'SSO token ไม่ใช่ของระบบที่อนุญาต' });
    }

    const normalizedEmail = String(payload.email || '').trim().toLowerCase();
    if (!normalizedEmail) return res.status(400).json({ error: 'SSO token ไม่มีอีเมลผู้ใช้' });

    const claimedRole = String(payload.role || '').trim().toLowerCase();
    const role = claimedRole ? await Role.findOne({ id: claimedRole }) : null;
    const now = new Date().toISOString();
    let user = await User.findOne({ email: normalizedEmail });

    if (user) {
      user.name = String(payload.name || '').trim() || user.name || normalizedEmail;
      user.department = String(payload.dept || '').trim() || user.department || 'Unassigned';
      user.position = user.position || 'Unassigned';
      user.authProvider = 'production';
      user.lastActive = now;
      const currentRoles = normalizeRoles(user);
      const onlyViewer = currentRoles.length === 0 || (currentRoles.length === 1 && currentRoles[0] === 'viewer');
      if (role && onlyViewer) user.roles = [role.id];
      await user.save();
      return res.json(formatSsoUser(user, await getPermissions(normalizeRoles(user))));
    }

    user = await User.create({
      email: normalizedEmail,
      name: String(payload.name || '').trim() || normalizedEmail,
      roles: [role?.id || 'viewer'],
      department: String(payload.dept || '').trim() || 'Unassigned',
      position: 'Unassigned',
      status: 'active',
      lastActive: now,
      authProvider: 'production',
      microsoftId: payload.sub ? `production:${payload.sub}` : undefined,
      tenantId: 'production',
    });

    res.status(201).json(formatSsoUser(user, await getPermissions(normalizeRoles(user))));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Email นี้มีในระบบแล้ว' });
    res.status(400).json({ error: err.message });
  }
});

// Admin only: create user
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const user = await User.create({ email, password, name, role });
    res.status(201).json({ email: user.email, name: user.name, role: user.role });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Email นี้มีในระบบแล้ว' });
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
