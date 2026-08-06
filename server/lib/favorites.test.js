const { MAX_FAVORITES, normalizeEmail, sanitizePaths, isValidEmailShape } = require('./favorites');

describe('normalizeEmail', () => {
  it('ตัดช่องว่างและแปลงเป็นตัวพิมพ์เล็ก', () => {
    expect(normalizeEmail('  Admin@ICPLadda.com ')).toBe('admin@icpladda.com');
  });

  it('คืนสตริงว่างเมื่อไม่ใช่ string', () => {
    expect(normalizeEmail(undefined)).toBe('');
    expect(normalizeEmail(123)).toBe('');
    expect(normalizeEmail(null)).toBe('');
  });
});

describe('sanitizePaths', () => {
  it('คืน array ว่างเมื่อ input ไม่ใช่ array', () => {
    expect(sanitizePaths(undefined)).toEqual([]);
    expect(sanitizePaths('/petition')).toEqual([]);
    expect(sanitizePaths(null)).toEqual([]);
  });

  it('เก็บเฉพาะ string ที่ขึ้นต้นด้วย /', () => {
    expect(sanitizePaths(['/petition', 'petition', 42, null, '/stock'])).toEqual([
      '/petition',
      '/stock',
    ]);
  });

  it('ตัดช่องว่างหัวท้ายก่อนตรวจ', () => {
    expect(sanitizePaths(['  /petition  '])).toEqual(['/petition']);
  });

  it('ทิ้ง path ที่ยาวเกิน 100 ตัวอักษร', () => {
    const long = `/${'a'.repeat(100)}`;
    expect(sanitizePaths([long, '/stock'])).toEqual(['/stock']);
  });

  it('ตัดรายการซ้ำโดยคงลำดับแรกที่เจอ', () => {
    expect(sanitizePaths(['/stock', '/petition', '/stock'])).toEqual(['/stock', '/petition']);
  });

  it('ตัดเหลือ 20 รายการแรก', () => {
    const input = Array.from({ length: 25 }, (_, i) => `/page-${i}`);
    const result = sanitizePaths(input);
    expect(result).toHaveLength(MAX_FAVORITES);
    expect(result[0]).toBe('/page-0');
    expect(result[MAX_FAVORITES - 1]).toBe(`/page-${MAX_FAVORITES - 1}`);
  });
});

describe('isValidEmailShape', () => {
  it('ผ่านสำหรับ email รูปแบบปกติ', () => {
    expect(isValidEmailShape('itadmin@icpladda.com')).toBe(true);
  });

  it('ผ่านสำหรับ email dev mode ที่สังเคราะห์ขึ้น (ไม่มี User doc จริง)', () => {
    // src/config/dev.ts synthesizeDevUser: `${primary.id}.dev@icpladda.com`
    expect(isValidEmailShape('lab-analyst.dev@icpladda.com')).toBe(true);
    expect(isValidEmailShape('admin.dev@icpladda.com')).toBe(true);
    expect(isValidEmailShape('qc-staff.dev@icpladda.com')).toBe(true);
  });

  it('ผ่านแม้ตัวพิมพ์ใหญ่/มีช่องว่างหัวท้าย (normalize ก่อนตรวจ)', () => {
    expect(isValidEmailShape('  Admin@ICPLadda.com  ')).toBe(true);
  });

  it('ไม่ผ่านเมื่อไม่ใช่ string หรือว่างเปล่า', () => {
    expect(isValidEmailShape(undefined)).toBe(false);
    expect(isValidEmailShape(null)).toBe(false);
    expect(isValidEmailShape('')).toBe(false);
    expect(isValidEmailShape('   ')).toBe(false);
  });

  it('ไม่ผ่านเมื่อไม่มี @', () => {
    expect(isValidEmailShape('itadmin.icpladda.com')).toBe(false);
  });

  it('ไม่ผ่านเมื่อ domain ไม่มีจุด', () => {
    expect(isValidEmailShape('itadmin@icpladda')).toBe(false);
  });

  it('ไม่ผ่านเมื่อมีช่องว่างตรงกลาง', () => {
    expect(isValidEmailShape('it admin@icpladda.com')).toBe(false);
  });

  it('ไม่ผ่านเมื่อมี @ มากกว่าหนึ่งตัว', () => {
    expect(isValidEmailShape('it@admin@icpladda.com')).toBe(false);
  });

  it('ไม่ผ่านเมื่อยาวเกินเพดาน', () => {
    const longLocal = 'a'.repeat(250);
    expect(isValidEmailShape(`${longLocal}@icpladda.com`)).toBe(false);
  });
});
