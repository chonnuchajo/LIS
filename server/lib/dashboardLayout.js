// Single source of truth for Lab/QC dashboard layout config (backend).
// Mirrors src/lib/dashboardLayout.ts — keep section/kpi ids in sync.

const DASHBOARDS = ['lab', 'qc'];
const SECTION_IDS = ['header', 'kpi', 'primaryTable', 'rightRail', 'completed'];
const FORCED_ON = ['header', 'primaryTable'];
const KPI_IDS = ['all', 'waiting', 'inProgress', 'completed'];

function validate(body) {
  const { sections, kpis } = body || {};
  if (sections != null) {
    if (!Array.isArray(sections)) return 'sections ต้องเป็น array';
    for (const s of sections) {
      if (!s || !SECTION_IDS.includes(s.id)) return `section id ไม่ถูกต้อง: ${s && s.id}`;
      if (typeof s.enabled !== 'boolean') return 'section.enabled ต้องเป็น boolean';
      if (typeof s.order !== 'number') return 'section.order ต้องเป็นตัวเลข';
    }
  }
  if (kpis != null) {
    if (typeof kpis !== 'object') return 'kpis ต้องเป็น object';
    for (const k of Object.keys(kpis)) {
      if (!KPI_IDS.includes(k)) return `kpi id ไม่ถูกต้อง: ${k}`;
      if (typeof kpis[k] !== 'boolean') return 'kpi value ต้องเป็น boolean';
    }
  }
  return null;
}

function normalizeSections(sections) {
  const arr = Array.isArray(sections)
    ? sections.map((s) => ({ id: s.id, enabled: !!s.enabled, order: s.order }))
    : [];
  for (const s of arr) {
    if (FORCED_ON.includes(s.id)) s.enabled = true;
  }
  arr.sort((a, b) => {
    if (a.id === 'header') return -1;
    if (b.id === 'header') return 1;
    return a.order - b.order;
  });
  return arr.map((s, i) => ({ id: s.id, enabled: s.enabled, order: i }));
}

function normalizeKpis(kpis) {
  const k = kpis || {};
  return {
    all: typeof k.all === 'boolean' ? k.all : true,
    waiting: typeof k.waiting === 'boolean' ? k.waiting : true,
    inProgress: typeof k.inProgress === 'boolean' ? k.inProgress : true,
    completed: typeof k.completed === 'boolean' ? k.completed : true,
  };
}

module.exports = {
  DASHBOARDS,
  SECTION_IDS,
  FORCED_ON,
  KPI_IDS,
  validate,
  normalizeSections,
  normalizeKpis,
};
