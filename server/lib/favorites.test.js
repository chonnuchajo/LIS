const { MAX_FAVORITES, normalizeEmail, sanitizePaths } = require('./favorites');

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
