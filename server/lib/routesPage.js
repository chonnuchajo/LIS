// Render the endpoint list from extractRoutes() as a standalone HTML page.
// Served at GET /api/list — it replaces the old admin "API" settings tab, so it has to
// be self-contained (inline CSS/JS): Express serves it directly, there is no bundler here.

const METHOD_COLORS = {
  GET: '#047857',
  POST: '#1d4ed8',
  PUT: '#b45309',
  PATCH: '#b45309',
  DELETE: '#b91c1c',
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Group by the first segment after /api/ — same grouping the settings tab used.
function groupRoutes(routes) {
  const map = new Map();
  for (const route of routes || []) {
    const seg = String(route.path).replace(/^\/api\//, '').split('/')[0] || '(root)';
    if (!map.has(seg)) map.set(seg, []);
    map.get(seg).push(route);
  }
  return Array.from(map.entries());
}

function renderRow(route) {
  const method = escapeHtml(route.method);
  const path = escapeHtml(route.path);
  const color = METHOD_COLORS[route.method] || '#4b5563';
  const key = escapeHtml(`${route.method} ${route.path}`.toLowerCase());
  return (
    `<li class="row" data-key="${key}">` +
    `<span class="method" style="color:${color}">${method}</span>` +
    `<code>${path}</code>` +
    '</li>'
  );
}

function renderGroup([segment, routes]) {
  return (
    `<section class="group" data-group>` +
    `<h2>${escapeHtml(segment)} <span class="muted" data-count>${routes.length}</span></h2>` +
    `<ul>${routes.map(renderRow).join('')}</ul>` +
    '</section>'
  );
}

function renderRoutesPage(routes) {
  const list = routes || [];
  const groups = groupRoutes(list);
  const body = groups.length
    ? groups.map(renderGroup).join('')
    : '<p class="muted">ไม่พบ endpoint</p>';

  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LIS API — รายการ endpoint</title>
<style>
  :root { color-scheme: light dark; --fg:#111827; --muted:#6b7280; --bg:#f9fafb; --card:#fff; --line:#e5e7eb; }
  @media (prefers-color-scheme: dark) {
    :root { --fg:#e5e7eb; --muted:#9ca3af; --bg:#0b0f19; --card:#111827; --line:#1f2937; }
  }
  * { box-sizing: border-box; }
  body { margin:0; padding:24px 16px 48px; background:var(--bg); color:var(--fg);
         font-family: ui-sans-serif, system-ui, "Segoe UI", "Noto Sans Thai", sans-serif; }
  .wrap { max-width: 900px; margin: 0 auto; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .muted { color: var(--muted); font-weight: 400; }
  .sub { font-size: 13px; margin: 0 0 16px; }
  .bar { position: sticky; top: 0; display: flex; gap: 12px; align-items: center;
         padding: 12px 0; background: var(--bg); }
  input { flex: 1; max-width: 360px; padding: 8px 12px; font-size: 14px; border-radius: 8px;
          border: 1px solid var(--line); background: var(--card); color: inherit; }
  #count { font-size: 13px; color: var(--muted); white-space: nowrap; }
  .group { margin-bottom: 20px; }
  .group h2 { font-size: 14px; margin: 0 0 6px; }
  ul { list-style: none; margin: 0; padding: 0; border: 1px solid var(--line);
       border-radius: 8px; background: var(--card); overflow: hidden; }
  .row { display: flex; align-items: center; gap: 12px; padding: 6px 12px;
         border-top: 1px solid var(--line); }
  .row:first-child { border-top: 0; }
  .method { width: 64px; flex: none; font-size: 12px; font-weight: 700; }
  code { font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; font-size: 13px; word-break: break-all; }
  [hidden] { display: none !important; }
</style>
</head>
<body>
<div class="wrap">
  <h1>LIS API <span class="muted">— รายการ endpoint ทั้งหมด</span></h1>
  <p class="sub muted">อ่านอย่างเดียว ดึงจาก Express ตอนรันจริง · ทุก path ใช้ได้ทั้ง <code>/api/…</code> และ <code>/LIS/api/…</code> · ต่อ <code>?format=json</code> เพื่อดึงเป็น JSON</p>
  <div class="bar">
    <input id="q" type="search" placeholder="ค้นหา path หรือ method…" autocomplete="off">
    <span id="count"></span>
  </div>
  ${body}
</div>
<script>
  var total = ${list.length};
  var rows = Array.prototype.slice.call(document.querySelectorAll('.row'));
  var groups = Array.prototype.slice.call(document.querySelectorAll('[data-group]'));
  var count = document.getElementById('count');
  var q = document.getElementById('q');
  function apply() {
    var term = q.value.trim().toLowerCase();
    var shown = 0;
    rows.forEach(function (row) {
      var hit = !term || row.getAttribute('data-key').indexOf(term) !== -1;
      row.hidden = !hit;
      if (hit) shown++;
    });
    groups.forEach(function (group) {
      var visible = group.querySelectorAll('.row:not([hidden])').length;
      group.hidden = visible === 0;
      group.querySelector('[data-count]').textContent = visible;
    });
    count.textContent = shown + ' / ' + total + ' endpoint';
  }
  q.addEventListener('input', apply);
  apply();
</script>
</body>
</html>`;
}

module.exports = { renderRoutesPage, groupRoutes, escapeHtml };
