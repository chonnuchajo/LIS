const { buildQcParamBaseline, qcBaselineMinutes, qcReceivedAtOf } = require('./qcParamBaseline');

// ใบที่ปิดแล้ว: ใช้เวลา QC 60 / 120 / 180 นาที ทุกใบเป็นสินค้า "ยาเขียว"
const closed = [
  { _id: 'c1', items: [{ commonName: 'ยาเขียว' }], qcReceivedAt: '2026-07-01T00:00:00.000Z', qcCompletedAt: '2026-07-01T01:00:00.000Z' },
  { _id: 'c2', items: [{ commonName: 'ยาเขียว' }], qcReceivedAt: '2026-07-02T00:00:00.000Z', qcCompletedAt: '2026-07-02T02:00:00.000Z' },
  { _id: 'c3', items: [{ commonName: 'ยาเขียว' }], qcReceivedAt: '2026-07-03T00:00:00.000Z', qcCompletedAt: '2026-07-03T03:00:00.000Z' },
];
const results = [
  { petitionId: 'c1', parameterId: 'pH', parameterName: 'ความเป็นกรด', commonName: 'ยาเขียว' },
  { petitionId: 'c2', parameterId: 'pH', parameterName: 'ความเป็นกรด', commonName: 'ยาเขียว' },
  { petitionId: 'c3', parameterId: 'pH', parameterName: 'ความเป็นกรด', commonName: 'ยาเขียว' },
  // parameter ที่มีประวัติแค่ใบเดียว → ต้องถูกตัดทิ้งด้วยกฎ minSamples
  { petitionId: 'c1', parameterId: 'rare', parameterName: 'หายาก', commonName: 'ยาเขียว' },
];

describe('buildQcParamBaseline', () => {
  it('averages QC duration per parameter over the petitions that recorded it', () => {
    const b = buildQcParamBaseline(closed, results);
    expect(b.avgMinutesByParam.pH).toBe(120); // (60+120+180)/3
  });

  it('drops parameters with fewer than minSamples petitions', () => {
    const b = buildQcParamBaseline(closed, results);
    expect(b.avgMinutesByParam.rare).toBeUndefined();
  });

  it('maps each product to the parameters historically recorded for it', () => {
    const b = buildQcParamBaseline(closed, results);
    expect(b.paramIdsByCommonName['ยาเขียว']).toEqual(expect.arrayContaining(['pH', 'rare']));
  });

  it('skips petitions with missing or inverted QC timestamps', () => {
    const broken = [{ _id: 'x', items: [{ commonName: 'ยาเขียว' }], qcReceivedAt: null, qcCompletedAt: '2026-07-01T01:00:00.000Z' }];
    const b = buildQcParamBaseline([...closed, ...broken], [...results, { petitionId: 'x', parameterId: 'pH', commonName: 'ยาเขียว' }]);
    expect(b.avgMinutesByParam.pH).toBe(120); // ใบ x ไม่ถูกนับ ค่าเฉลี่ยไม่เปลี่ยน
  });
});

describe('qcBaselineMinutes', () => {
  const baseline = buildQcParamBaseline(closed, results);

  it('takes the slowest parameter historically seen for the products in the petition', () => {
    const open = { _id: 'o1', items: [{ commonName: 'ยาเขียว' }] };
    expect(qcBaselineMinutes(open, baseline)).toBe(120); // มีแต่ pH ที่ผ่านกฎ minSamples
  });

  it('returns null when the product has no usable history', () => {
    const open = { _id: 'o2', items: [{ commonName: 'สินค้าใหม่' }] };
    expect(qcBaselineMinutes(open, baseline)).toBeNull();
  });

  it('returns null when the item carries no commonName', () => {
    expect(qcBaselineMinutes({ _id: 'o3', items: [{ commonName: '' }] }, baseline)).toBeNull();
  });
});

describe('qcReceivedAtOf', () => {
  it('falls back to the legacy receivedAt when no side-specific field exists', () => {
    const legacy = { receivedAt: '2026-07-01T00:00:00.000Z' };
    expect(qcReceivedAtOf(legacy).toISOString()).toBe('2026-07-01T00:00:00.000Z');
  });

  it('ignores receivedAt once a side-specific field is present', () => {
    const modern = { labReceivedAt: '2026-07-01T00:00:00.000Z', receivedAt: '2026-06-01T00:00:00.000Z' };
    expect(qcReceivedAtOf(modern)).toBeNull();
  });
});
