const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'qc-photos');
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('ประเภทไฟล์ไม่รองรับ: รับเฉพาะ JPEG, PNG, WEBP'));
    }
  },
});

// POST /api/uploads/qc-photo
// Body: multipart/form-data with field "photo"
// Returns: { url: "/LIS/uploads/qc-photos/<filename>" }
router.post('/qc-photo', upload.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'ไม่พบไฟล์ภาพ' });
  }
  const url = `/LIS/uploads/qc-photos/${req.file.filename}`;
  res.json({ url });
});

// DELETE /api/uploads/qc-photo
// Body: { url: "/LIS/uploads/qc-photos/<filename>" }
router.delete('/qc-photo', (req, res) => {
  const { url } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' });
  }

  const filename = path.basename(url);
  // Prevent path traversal: filename must not contain separators
  if (filename.includes('/') || filename.includes('\\') || filename !== path.basename(filename)) {
    return res.status(400).json({ error: 'Invalid url' });
  }

  const filePath = path.join(UPLOAD_DIR, filename);
  // Confirm the resolved path is still inside UPLOAD_DIR
  if (!filePath.startsWith(UPLOAD_DIR + path.sep) && filePath !== UPLOAD_DIR) {
    return res.status(400).json({ error: 'Invalid url' });
  }

  fs.unlink(filePath, (err) => {
    if (err && err.code !== 'ENOENT') {
      return res.status(500).json({ error: err.message });
    }
    res.json({ ok: true });
  });
});

// Multer error handler
router.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError || err.message) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Upload error' });
});

module.exports = router;
