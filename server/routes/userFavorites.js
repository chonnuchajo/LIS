const express = require('express');
const router = express.Router();
const UserFavorite = require('../models/UserFavorite');
const { normalizeEmail, sanitizePaths, isValidEmailShape } = require('../lib/favorites');

// GET /api/user-favorites?email=... — path รายการโปรดตามลำดับที่ผู้ใช้จัดไว้
router.get('/', async (req, res) => {
  try {
    const email = normalizeEmail(req.query.email);
    if (!email) return res.status(400).json({ error: 'email จำเป็น' });
    const doc = await UserFavorite.findOne({ email }).lean();
    res.json({ data: { email, paths: doc ? sanitizePaths(doc.paths) : [] } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/user-favorites — เขียนทั้ง array ทับของเดิม (client เป็นเจ้าของลำดับ)
router.put('/', async (req, res) => {
  try {
    const body = req.body || {};
    const email = normalizeEmail(body.email);
    if (!email) return res.status(400).json({ error: 'email จำเป็น' });
    // unauthenticated endpoint — กันสร้างเอกสารขยะจาก email มั่ว ๆ (ไม่เช็คกับ User
    // collection เพราะ dev mode ใช้ user สังเคราะห์ที่ไม่มี User doc โดยตั้งใจ)
    if (!isValidEmailShape(email)) {
      return res.status(400).json({ error: 'รูปแบบ email ไม่ถูกต้อง' });
    }
    const paths = sanitizePaths(body.paths);
    const doc = await UserFavorite.findOneAndUpdate(
      { email },
      { email, paths },
      { new: true, upsert: true },
    ).lean();
    res.json({ data: { email: doc.email, paths: doc.paths || [] } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
