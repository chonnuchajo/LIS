const { computeAbnormalFlags, ensureRequestedIdsPresent } = require('./abnormalFlags');

const petition = { _id: 'p1', dept: 'fg', items: [{ seq: 1 }] };
const numberParam = {
  _id: 'par1',
  valueFields: [{ label: 'ค่า', type: 'number', standardOperator: 'lte', standardValue: 10 }],
};

describe('computeAbnormalFlags', () => {
  it('flags a petition whose numeric value breaks the standard', () => {
    const docs = [{ petitionId: 'p1', parameterId: 'par1', itemSeq: 1, values: { 'ค่า': 12 } }];
    expect(computeAbnormalFlags({ docs, params: [numberParam], petitions: [petition] }))
      .toEqual({ p1: true });
  });

  it('leaves a petition normal when every value is within the standard', () => {
    const docs = [{ petitionId: 'p1', parameterId: 'par1', itemSeq: 1, values: { 'ค่า': 5 } }];
    expect(computeAbnormalFlags({ docs, params: [numberParam], petitions: [petition] }))
      .toEqual({ p1: false });
  });

  it('reports false for a petition that has no results yet', () => {
    expect(computeAbnormalFlags({ docs: [], params: [], petitions: [petition] }))
      .toEqual({ p1: false });
  });

  it('ignores results whose parameter has no valueFields', () => {
    const docs = [{ petitionId: 'p1', parameterId: 'ghost', itemSeq: 1, values: { 'ค่า': 999 } }];
    expect(computeAbnormalFlags({ docs, params: [], petitions: [petition] }))
      .toEqual({ p1: false });
  });
});

describe('ensureRequestedIdsPresent', () => {
  it('adds false for a requested id with no QCTestResult docs and no matching petition', () => {
    const map = computeAbnormalFlags({ docs: [], params: [], petitions: [] });
    expect(ensureRequestedIdsPresent(map, ['ghost-id'])).toEqual({ 'ghost-id': false });
  });

  it('keeps true for an id already flagged abnormal (does not clobber real results)', () => {
    const docs = [{ petitionId: 'p1', parameterId: 'par1', itemSeq: 1, values: { 'ค่า': 12 } }];
    const map = computeAbnormalFlags({ docs, params: [numberParam], petitions: [petition] });
    expect(ensureRequestedIdsPresent(map, ['p1'])).toEqual({ p1: true });
  });

  it('returns the map unchanged for an empty id list', () => {
    const map = computeAbnormalFlags({ docs: [], params: [], petitions: [petition] });
    expect(ensureRequestedIdsPresent(map, [])).toEqual(map);
  });
});
