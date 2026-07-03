const { planDeductMg } = require('../stock');

describe('planDeductMg', () => {
  const base = { status: 'active', exp: null, volume: { remaining: 100, unit: 'mg' } };
  test('ok when active and enough remaining', () => {
    expect(planDeductMg(base, 30)).toEqual({ ok: true, after: 70 });
  });
  test('rejects insufficient remaining', () => {
    expect(planDeductMg({ ...base, volume: { remaining: 10, unit: 'mg' } }, 30))
      .toEqual({ ok: false, reason: 'ปริมาณคงเหลือไม่พอ' });
  });
  test('rejects non-active unit', () => {
    expect(planDeductMg({ ...base, status: 'discarded' }, 5).ok).toBe(false);
  });
  test('rejects expired unit', () => {
    expect(planDeductMg({ ...base, exp: '2000-01-01' }, 5))
      .toEqual({ ok: false, reason: 'ขวดนี้หมดอายุแล้ว' });
  });
  test('rejects invalid mg', () => {
    expect(planDeductMg(base, 0).ok).toBe(false);
    expect(planDeductMg(base, -5).ok).toBe(false);
  });
});
