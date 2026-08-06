const ApiKey = require('./ApiKey');
const ApiRequestLog = require('./ApiRequestLog');
const ApiPolicyMode = require('./ApiPolicyMode');

describe('ApiKey schema', () => {
  test('มีฟิลด์ครบตามสเปก', () => {
    const paths = Object.keys(ApiKey.schema.paths);
    for (const field of [
      'name', 'keyPrefix', 'keyHash', 'scopes', 'expiresAt', 'revokedAt',
      'revokedBy', 'rateLimitPerMinute', 'lastUsedAt', 'usageCount', 'createdBy',
      'deletedAt', // จาก softDeletePlugin
    ]) {
      expect(paths).toContain(field);
    }
  });

  test('rateLimitPerMinute ค่าเริ่มต้น 120 และ usageCount เริ่มที่ 0', () => {
    const doc = new ApiKey({ name: 'test', keyPrefix: 'lisk_abc123', keyHash: 'x'.repeat(64) });
    expect(doc.rateLimitPerMinute).toBe(120);
    expect(doc.usageCount).toBe(0);
    expect(doc.expiresAt).toBeNull();
  });

  test('toJSON ไม่หลุด keyHash ออกไปทาง API', () => {
    const doc = new ApiKey({ name: 'test', keyPrefix: 'lisk_abc123', keyHash: 'x'.repeat(64) });
    const json = doc.toJSON();
    expect(json.keyHash).toBeUndefined();
    expect(json.name).toBe('test');
  });

  test('ต้องมี name — validate ไม่ผ่านถ้าไม่ใส่', () => {
    const err = new ApiKey({ keyPrefix: 'lisk_abc123', keyHash: 'x'.repeat(64) }).validateSync();
    expect(err?.errors?.name).toBeTruthy();
  });

  test('keyHash ใช้ compound unique index กับ deletedAt (soft-delete pattern)', () => {
    const indexes = ApiKey.schema.indexes();
    // ตรวจสอบมี compound unique index ที่ { keyHash: 1, deletedAt: 1 }
    const compoundIndex = indexes.find(
      ([keys, opts]) => keys.keyHash && keys.deletedAt && opts.unique
    );
    expect(compoundIndex).toBeTruthy();
    expect(compoundIndex[1].unique).toBe(true);

    // ตรวจสอบไม่มี plain single-field unique index บน keyHash
    const plainUniqueOnHash = indexes.find(
      ([keys, opts]) => keys.keyHash && !keys.deletedAt && opts.unique
    );
    expect(plainUniqueOnHash).toBeFalsy();
  });
});

describe('ApiRequestLog schema', () => {
  test('at มี TTL index', () => {
    const indexes = ApiRequestLog.schema.indexes();
    const ttl = indexes.find(([keys, opts]) => keys.at && opts.expireAfterSeconds);
    expect(ttl).toBeTruthy();
    expect(ttl[1].expireAfterSeconds).toBeGreaterThan(0);
  });

  test('outcome จำกัดค่าที่รู้จัก', () => {
    const doc = new ApiRequestLog({ method: 'POST', path: '/temphum', outcome: 'ระเบิด' });
    expect(doc.validateSync()?.errors?.outcome).toBeTruthy();
  });
});

describe('ApiPolicyMode schema', () => {
  test('mode รับเฉพาะ off/audit/enforce', () => {
    expect(new ApiPolicyMode({ policyId: 'temphum-push', mode: 'enforce' }).validateSync()).toBeUndefined();
    expect(new ApiPolicyMode({ policyId: 'temphum-push', mode: 'บังคับ' }).validateSync()?.errors?.mode).toBeTruthy();
  });
});
