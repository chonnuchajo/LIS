const test = require('node:test');
const assert = require('node:assert');
const {
  DASHBOARDS,
  SECTION_IDS,
  KPI_IDS,
  validate,
  normalizeSections,
  normalizeKpis,
} = require('./dashboardLayout');

test('constants expose both dashboards and five sections', () => {
  assert.deepEqual(DASHBOARDS, ['lab', 'qc']);
  assert.deepEqual(SECTION_IDS, ['header', 'kpi', 'primaryTable', 'rightRail', 'completed']);
  assert.deepEqual(KPI_IDS, ['all', 'waiting', 'inProgress', 'completed']);
});

test('validate rejects unknown section id', () => {
  const err = validate({ sections: [{ id: 'bogus', enabled: true, order: 0 }] });
  assert.match(err, /section id/);
});

test('validate rejects unknown kpi id', () => {
  const err = validate({ kpis: { bogus: true } });
  assert.match(err, /kpi id/);
});

test('validate passes a well-formed body', () => {
  const err = validate({
    sections: [{ id: 'kpi', enabled: false, order: 1 }],
    kpis: { all: true },
  });
  assert.equal(err, null);
});

test('normalizeSections forces header/primaryTable on and orders header first', () => {
  const out = normalizeSections([
    { id: 'completed', enabled: true, order: 0 },
    { id: 'header', enabled: false, order: 9 },
    { id: 'primaryTable', enabled: false, order: 1 },
  ]);
  assert.equal(out[0].id, 'header');
  assert.equal(out.find((s) => s.id === 'header').enabled, true);
  assert.equal(out.find((s) => s.id === 'primaryTable').enabled, true);
  assert.deepEqual(out.map((s) => s.order), [0, 1, 2]);
});

test('normalizeKpis defaults missing flags to true', () => {
  assert.deepEqual(normalizeKpis({ waiting: false }), {
    all: true,
    waiting: false,
    inProgress: true,
    completed: true,
  });
});
