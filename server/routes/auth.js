const express = require('express');
const router = express.Router();
const User = require('../models/User');

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
