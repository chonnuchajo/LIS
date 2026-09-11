const path = require('path');
const {
  canManageSignature,
  decodeSignatureDataUrl,
  signaturePathFromUrl,
} = require('../profile');

test('canManageSignature allows admin and head roles only', () => {
  expect(canManageSignature({ roles: ['admin'] })).toBe(true);
  expect(canManageSignature({ roles: ['lab-head'] })).toBe(true);
  expect(canManageSignature({ roles: ['qc-head'] })).toBe(true);
  expect(canManageSignature({ roles: ['lab-analyze'] })).toBe(false);
});

test('decodeSignatureDataUrl accepts PNG data URL and rejects other input', () => {
  const dataUrl = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64')}`;

  expect(decodeSignatureDataUrl(dataUrl)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  expect(() => decodeSignatureDataUrl('data:image/jpeg;base64,abcd')).toThrow('รองรับเฉพาะลายเซ็น PNG');
  expect(() => decodeSignatureDataUrl('data:image/png;base64,abcd')).toThrow('ไฟล์ลายเซ็นต้องเป็น PNG');
});

test('signaturePathFromUrl resolves only stored signature files', () => {
  const filePath = signaturePathFromUrl('/LIS/uploads/signatures/user-1.png');

  expect(filePath).toBeTruthy();
  expect(path.basename(filePath)).toBe('user-1.png');
  expect(signaturePathFromUrl('/LIS/uploads/signatures/../secret.png')).toBeNull();
  expect(signaturePathFromUrl('/LIS/uploads/qc-photos/user-1.png')).toBeNull();
});
