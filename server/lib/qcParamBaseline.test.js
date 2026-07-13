const { buildQcParamBaseline, qcBaselineMinutes, qcReceivedAtOf } = require('./qcParamBaseline');

// ใบที่ปิดแล้ว: ใช้เวลา QC 60 / 120 / 180 นาที ทุกใบเป็นสินค้า "ยาเขียว"
const closed = [
  { _id: 'c1', items: [{ commonName: 'ยาเขียว' }], qcReceivedAt: '2026-07-01T00:00:00.000Z', qcCompletedAt: '2026-07-01T01:00:00.000Z' },
  { _id: 'c2', items: [{ commonName: 'ยาเขียว' }], qcReceivedAt: '2026-07-02T00:00:00.000Z', qcCompletedAt: '2026-07-02T02:00:00.000Z' },
  { _id: 'c3', items: [{ commonName: 'ยาเขียว' }], qcReceivedAt: '2026-07-03T00:00:00.000Z', qcCompletedAt: '2026-07-03T03:00:00.000Z' },
  // parameter "slow" มีประวัติแค่ 2 ใบ (ไม่ถึง minSamples=3) แต่เฉลี่ยดิบ 480 นาที สูงกว่า pH มาก
  // ต้องถูกตัดทิ้ง ไม่ใช่ชนะ baseline — ถ้ากฎ minSamples หายไป ค่านี้จะโผล่มาแทน pH
  { _id: 'c4', items: [{ commonName: 'ยาเขียว' }], qcReceivedAt: '2026-07-04T00:00:00.000Z', qcCompletedAt: '2026-07-04T08:00:00.000Z' },
  { _id: 'c5', items: [{ commonName: 'ยาเขียว' }], qcReceivedAt: '2026-07-05T00:00:00.000Z', qcCompletedAt: '2026-07-05T08:00:00.000Z' },
];
const results = [
  { petitionId: 'c1', parameterId: 'pH', parameterName: 'ความเป็นกรด', commonName: 'ยาเขียว' },
  { petitionId: 'c2', parameterId: 'pH', parameterName: 'ความเป็นกรด', commonName: 'ยาเขียว' },
  { petitionId: 'c3', parameterId: 'pH', parameterName: 'ความเป็นกรด', commonName: 'ยาเขียว' },
  // parameter ที่มีประวัติแค่ใบเดียว → ต้องถูกตัดทิ้งด้วยกฎ minSamples
  { petitionId: 'c1', parameterId: 'rare', parameterName: 'หายาก', commonName: 'ยาเขียว' },
  { petitionId: 'c4', parameterId: 'slow', parameterName: 'ช้ามาก', commonName: 'ยาเขียว' },
  { petitionId: 'c5', parameterId: 'slow', parameterName: 'ช้ามาก', commonName: 'ยาเขียว' },
];

describe('buildQcParamBaseline', () => {
  it('averages QC duration per parameter over the petitions that recorded it', () => {
    const b = buildQcParamBaseline(closed, results);
    expect(b.avgMinutesByParam.pH).toBe(120); // (60+120+180)/3
  });

  it('drops parameters with fewer than minSamples petitions', () => {
    const b = buildQcParamBaseline(closed, results);
    expect(b.avgMinutesByParam.rare).toBeUndefined();
    // "slow" เฉลี่ยดิบ 480 (สูงกว่า pH) แต่มีแค่ 2 ใบ < minSamples=3 → ต้องหายไปเหมือนกัน
    expect(b.avgMinutesByParam.slow).toBeUndefined();
  });

  it('records the human-readable parameter name for each parameterId', () => {
    const b = buildQcParamBaseline(closed, results);
    expect(b.paramNameById.pH).toBe('ความเป็นกรด');
  });

  it('maps each product to the parameters historically recorded for it', () => {
    const b = buildQcParamBaseline(closed, results);
    expect(b.paramIdsByCommonName['ยาเขียว']).toEqual(expect.arrayContaining(['pH', 'rare', 'slow']));
  });

  it('skips petitions with missing QC timestamps', () => {
    const broken = [{ _id: 'x', items: [{ commonName: 'ยาเขียว' }], qcReceivedAt: null, qcCompletedAt: '2026-07-01T01:00:00.000Z' }];
    const b = buildQcParamBaseline([...closed, ...broken], [...results, { petitionId: 'x', parameterId: 'pH', commonName: 'ยาเขียว' }]);
    expect(b.avgMinutesByParam.pH).toBe(120); // ใบ x ไม่ถูกนับ ค่าเฉลี่ยไม่เปลี่ยน
  });

  it('skips petitions with an inverted QC duration (completed before received)', () => {
    const inverted = { _id: 'y', items: [{ commonName: 'ยาเขียว' }], qcReceivedAt: '2026-07-01T02:00:00.000Z', qcCompletedAt: '2026-07-01T01:00:00.000Z' };
    const b = buildQcParamBaseline([...closed, inverted], [...results, { petitionId: 'y', parameterId: 'pH', commonName: 'ยาเขียว' }]);
    expect(b.avgMinutesByParam.pH).toBe(120); // ใบ y เวลากลับด้าน (เสร็จก่อนรับ) ต้องไม่ถูกนับ
  });

  it('skips petitions with a zero-duration QC (completed equals received)', () => {
    const zeroDuration = { _id: 'z', items: [{ commonName: 'ยาเขียว' }], qcReceivedAt: '2026-07-01T00:00:00.000Z', qcCompletedAt: '2026-07-01T00:00:00.000Z' };
    const b = buildQcParamBaseline([...closed, zeroDuration], [...results, { petitionId: 'z', parameterId: 'pH', commonName: 'ยาเขียว' }]);
    expect(b.avgMinutesByParam.pH).toBe(120); // ใบ z ใช้เวลา 0 นาที ต้องไม่ถูกนับ
  });

  it('counts a petition once even when it has multiple QCTestResult rows for the same parameter', () => {
    const dupClosed = [
      { _id: 'd1', items: [{ commonName: 'ยาเขียว' }], qcReceivedAt: '2026-07-06T00:00:00.000Z', qcCompletedAt: '2026-07-06T01:00:00.000Z' },
      { _id: 'd2', items: [{ commonName: 'ยาเขียว' }], qcReceivedAt: '2026-07-07T00:00:00.000Z', qcCompletedAt: '2026-07-07T02:00:00.000Z' },
      { _id: 'd3', items: [{ commonName: 'ยาเขียว' }], qcReceivedAt: '2026-07-08T00:00:00.000Z', qcCompletedAt: '2026-07-08T03:00:00.000Z' },
    ];
    const dupResults = [
      { petitionId: 'd1', parameterId: 'dup', parameterName: 'ซ้ำ', commonName: 'ยาเขียว' },
      { petitionId: 'd2', parameterId: 'dup', parameterName: 'ซ้ำ', commonName: 'ยาเขียว' },
      // ใบ d3 มี 2 item ที่ต้องเช็ค parameter เดียวกัน → ได้ QCTestResult 2 แถว แต่ใบนี้ต้องถูกนับครั้งเดียว
      { petitionId: 'd3', parameterId: 'dup', parameterName: 'ซ้ำ', commonName: 'ยาเขียว' },
      { petitionId: 'd3', parameterId: 'dup', parameterName: 'ซ้ำ', commonName: 'ยาเขียว' },
    ];
    const b = buildQcParamBaseline(dupClosed, dupResults);
    expect(b.avgMinutesByParam.dup).toBe(120); // (60+120+180)/3 ไม่ใช่ (60+120+180+180)/4
  });
});

describe('qcBaselineMinutes', () => {
  const baseline = buildQcParamBaseline(closed, results);

  it('takes the slowest parameter historically seen for the products in the petition', () => {
    const open = { _id: 'o1', items: [{ commonName: 'ยาเขียว' }] };
    expect(qcBaselineMinutes(open, baseline)).toBe(120); // "slow" เฉลี่ยสูงกว่าแต่ไม่ถึง minSamples จึงไม่ถูกเลือก
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
