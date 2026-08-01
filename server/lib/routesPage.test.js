const test = require('node:test');
const assert = require('node:assert');
const { renderRoutesPage, groupRoutes, escapeHtml } = require('./routesPage');

const ROUTES = [
  { method: 'GET', path: '/api/list' },
  { method: 'GET', path: '/api/petitions' },
  { method: 'POST', path: '/api/petitions' },
  { method: 'PATCH', path: '/api/petitions/:id' },
];

test('groupRoutes buckets by the first segment after /api/', () => {
  const groups = groupRoutes(ROUTES);
  assert.deepStrictEqual(
    groups.map(([seg, items]) => [seg, items.length]),
    [['list', 1], ['petitions', 3]],
  );
});

test('groupRoutes labels a bare /api/ path as (root)', () => {
  assert.strictEqual(groupRoutes([{ method: 'GET', path: '/api/' }])[0][0], '(root)');
});

test('escapeHtml neutralizes markup characters', () => {
  assert.strictEqual(escapeHtml('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
});

test('renderRoutesPage lists every method + path', () => {
  const html = renderRoutesPage(ROUTES);
  assert.match(html, /^<!doctype html>/);
  for (const r of ROUTES) {
    assert.ok(html.includes(r.path), `missing path ${r.path}`);
  }
  assert.ok(html.includes('PATCH'), 'missing PATCH badge');
  // group headings
  assert.ok(html.includes('>petitions '), 'missing petitions group heading');
});

test('renderRoutesPage escapes route paths', () => {
  const html = renderRoutesPage([{ method: 'GET', path: '/api/x/<script>' }]);
  assert.ok(!html.includes('/api/x/<script>'), 'raw markup leaked into the page');
  assert.ok(html.includes('&lt;script&gt;'), 'path not escaped');
});

test('renderRoutesPage survives an empty list', () => {
  const html = renderRoutesPage([]);
  assert.ok(html.includes('ไม่พบ endpoint'));
  assert.ok(html.includes('var total = 0;'));
});
