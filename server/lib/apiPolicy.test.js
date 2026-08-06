const {
  API_SCOPES,
  API_POLICIES,
  normalizePath,
  matchPolicy,
} = require('./apiPolicy');

describe('normalizePath', () => {
  test('ตัด prefix /api และ /LIS/api ได้ทั้งคู่', () => {
    expect(normalizePath('/api/temphum')).toBe('/temphum');
    expect(normalizePath('/LIS/api/temphum')).toBe('/temphum');
  });

  test('ตัด query string และ trailing slash', () => {
    expect(normalizePath('/LIS/api/line/ingest?key=abc')).toBe('/line/ingest');
    expect(normalizePath('/api/temphum/')).toBe('/temphum');
  });

  test('path ที่ไม่ได้ขึ้นต้นด้วย /api ปล่อยไว้ตามเดิม', () => {
    expect(normalizePath('/uploads/x.png')).toBe('/uploads/x.png');
  });
});

describe('matchPolicy', () => {
  test('POST /temphum ตรง policy temphum-push', () => {
    const p = matchPolicy(API_POLICIES, 'POST', '/LIS/api/temphum');
    expect(p?.id).toBe('temphum-push');
    expect(p?.scope).toBe('temphum:write');
  });

  test('GET /temphum ไม่ถูกคุม (หน้าเว็บใช้อยู่)', () => {
    expect(matchPolicy(API_POLICIES, 'GET', '/api/temphum')).toBeNull();
  });

  test('exact policy ไม่จับ sub-path', () => {
    expect(matchPolicy(API_POLICIES, 'POST', '/api/temphum/bulk')).toBeNull();
  });

  test('prefix policy จับ sub-path ได้', () => {
    const p = matchPolicy(API_POLICIES, 'POST', '/api/production-integration/petitions');
    expect(p?.id).toBe('production-integration');
  });

  test('route ที่หน้าเว็บใช้ต้องไม่ถูกคุม', () => {
    for (const path of ['/api/petitions', '/api/stock/standards', '/api/qc-results', '/api/api-keys']) {
      expect(matchPolicy(API_POLICIES, 'GET', path)).toBeNull();
      expect(matchPolicy(API_POLICIES, 'POST', path)).toBeNull();
    }
  });

  test('ทุก policy อ้าง scope ที่มีจริงในทะเบียน และเริ่มที่โหมด audit', () => {
    const scopeIds = API_SCOPES.map((s) => s.id);
    for (const p of API_POLICIES) {
      expect(scopeIds).toContain(p.scope);
      expect(p.defaultMode).toBe('audit');
    }
  });
});
