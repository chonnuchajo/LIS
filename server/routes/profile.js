const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const { normalizeRoles } = require('../lib/roles');
const { getLisSessionUserId } = require('../lib/lisSessionCookie');

const router = express.Router();

const SIGNATURE_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'signatures');
const SIGNATURE_URL_PREFIX = '/LIS/uploads/signatures/';
const SIGNATURE_ROLES = new Set(['admin', 'lab-head', 'qc-head']);
const MAX_SIGNATURE_BYTES = 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function canManageSignature(user) {
  return normalizeRoles(user).some((role) => SIGNATURE_ROLES.has(role));
}

async function resolveCurrentUser(req) {
  const sessionUserId = getLisSessionUserId(req);
  if (sessionUserId && mongoose.isValidObjectId(sessionUserId)) {
    const bySession = await User.findById(sessionUserId);
    if (bySession) return bySession;
  }

  const email = String(req.get('X-LIS-User') || req.body?._user?.email || '').trim().toLowerCase();
  if (!email) return null;
  return User.findOne({ email });
}

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function decodeSignatureDataUrl(value) {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(value || '').trim());
  if (!match) throw httpError('รองรับเฉพาะลายเซ็น PNG', 400);

  const buffer = Buffer.from(match[1], 'base64');
  if (buffer.length === 0) throw httpError('ไม่พบข้อมูลลายเซ็น', 400);
  if (buffer.length > MAX_SIGNATURE_BYTES) throw httpError('ไฟล์ลายเซ็นใหญ่เกิน 1 MB', 400);
  if (!buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw httpError('ไฟล์ลายเซ็นต้องเป็น PNG', 400);
  }
  return buffer;
}

function signaturePathFromUrl(url) {
  const raw = String(url || '');
  if (!raw.startsWith(SIGNATURE_URL_PREFIX)) return null;
  const filename = raw.slice(SIGNATURE_URL_PREFIX.length);
  if (!filename || filename !== path.basename(filename) || !filename.endsWith('.png')) return null;

  const filePath = path.join(SIGNATURE_UPLOAD_DIR, filename);
  const relative = path.relative(SIGNATURE_UPLOAD_DIR, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return filePath;
}

async function removeOldSignature(url) {
  const filePath = signaturePathFromUrl(url);
  if (!filePath) return;
  await fs.unlink(filePath).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
}

router.put('/signature', async (req, res) => {
  try {
    const user = await resolveCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'ไม่พบบัญชีผู้ใช้' });
    if (!canManageSignature(user)) return res.status(403).json({ error: 'ไม่มีสิทธิ์เพิ่มลายเซ็น' });

    const signatureBuffer = decodeSignatureDataUrl(req.body?.signatureDataUrl);
    await fs.mkdir(SIGNATURE_UPLOAD_DIR, { recursive: true });

    const filename = `${user._id}-${randomUUID()}.png`;
    const nextPath = path.join(SIGNATURE_UPLOAD_DIR, filename);
    await fs.writeFile(nextPath, signatureBuffer);
    await removeOldSignature(user.signatureUrl);

    user.signatureUrl = `${SIGNATURE_URL_PREFIX}${filename}`;
    await user.save();

    res.json({ signatureUrl: user.signatureUrl });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/signature', async (req, res) => {
  try {
    const user = await resolveCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'ไม่พบบัญชีผู้ใช้' });
    if (!canManageSignature(user)) return res.status(403).json({ error: 'ไม่มีสิทธิ์เพิ่มลายเซ็น' });
    res.json({ signatureUrl: user.signatureUrl || '' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.canManageSignature = canManageSignature;
module.exports.decodeSignatureDataUrl = decodeSignatureDataUrl;
module.exports.signaturePathFromUrl = signaturePathFromUrl;
