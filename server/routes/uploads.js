const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'qc-photos');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const PARAM_FILES_DIR = path.join(__dirname, '..', 'uploads', 'param-files');
fs.mkdirSync(PARAM_FILES_DIR, { recursive: true });

const ALLOWED_DOC_MIME = new Set([
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
  'text/plain',
]);

const DOC_MIME_EXT = {
  'application/pdf': '.pdf',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'text/csv': '.csv',
  'text/plain': '.txt',
};

const paramFileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PARAM_FILES_DIR),
  filename: (_req, file, cb) => {
    const ext = DOC_MIME_EXT[file.mimetype] || '.bin';
    cb(null, `${randomUUID()}${ext}`);
  },
});

const uploadParamFileMiddleware = multer({
  storage: paramFileStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_DOC_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('ประเภทไฟล์ไม่รองรับ: รับเฉพาะ PDF, Excel, Word, CSV'));
    }
  },
});

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const MIME_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
    const ext = MIME_EXT[file.mimetype] || '.jpg';
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

// POST /api/uploads/param-file
// Body: multipart/form-data with field "file"
// Returns: { url: "/LIS/uploads/param-files/<filename>", name: <original>, size: <bytes> }
router.post('/param-file', uploadParamFileMiddleware.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'ไม่พบไฟล์' });
  }
  const url = `/LIS/uploads/param-files/${req.file.filename}`;
  res.json({ url, name: req.file.originalname, size: req.file.size });
});

// DELETE /api/uploads/param-file
// Body: { url: "/LIS/uploads/param-files/<filename>" }
router.delete('/param-file', (req, res) => {
  const { url } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' });
  }
  const filename = path.basename(url);
  if (filename.includes('/') || filename.includes('\\') || filename !== path.basename(filename)) {
    return res.status(400).json({ error: 'Invalid url' });
  }
  const filePath = path.join(PARAM_FILES_DIR, filename);
  if (!filePath.startsWith(PARAM_FILES_DIR + path.sep) && filePath !== PARAM_FILES_DIR) {
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
  const status = err instanceof multer.MulterError ? 400 : 500;
  res.status(status).json({ error: err.message || 'Upload error' });
});

module.exports = router;
