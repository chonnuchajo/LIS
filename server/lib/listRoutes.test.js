const test = require('node:test');
const assert = require('node:assert');
const { extractRoutes, extractMountPath, joinPaths } = require('./listRoutes');

// mock app: top-level health route + /api/samples router mounted twice (/api + /LIS/api)
function makeApp() {
  const samplesStack = [
    { route: { path: '/', methods: { get: true } } },
    { route: { path: '/:id', methods: { get: true, post: true } } },
  ];
  return {
    _router: {
      stack: [
        { route: { path: '/api/health', methods: { get: true } } },
        {
          name: 'router',
          regexp: { source: '^\\/api\\/samples\\/?(?=\\/|$)' },
          handle: { stack: samplesStack },
        },
        // duplicate /LIS mount — must be dropped
        {
          name: 'router',
          regexp: { source: '^\\/LIS\\/api\\/samples\\/?(?=\\/|$)' },
          handle: { stack: samplesStack },
        },
        // static/middleware layer with no route — must be ignored
        { name: 'serveStatic', regexp: { source: '^\\/uploads\\/?(?=\\/|$)' } },
      ],
    },
  };
}

test('extractMountPath: parses Express 4 mount regexp', () => {
  assert.equal(extractMountPath({ regexp: { source: '^\\/api\\/samples\\/?(?=\\/|$)' } }), '/api/samples');
  assert.equal(extractMountPath({ regexp: { fast_slash: true } }), '');
  assert.equal(extractMountPath({}), '');
});

test('joinPaths: normalizes slashes and root', () => {
  assert.equal(joinPaths('/api/samples', '/'), '/api/samples');
  assert.equal(joinPaths('/api/samples', '/:id'), '/api/samples/:id');
  assert.equal(joinPaths('', '/api/health'), '/api/health');
});

test('extractRoutes: collects, drops /LIS duplicates, dedupes, sorts', () => {
  const routes = extractRoutes(makeApp());
  assert.deepEqual(routes, [
    { method: 'GET', path: '/api/health' },
    { method: 'GET', path: '/api/samples' },
    { method: 'GET', path: '/api/samples/:id' },
    { method: 'POST', path: '/api/samples/:id' },
  ]);
});

test('extractRoutes: empty when no router', () => {
  assert.deepEqual(extractRoutes({}), []);
});

test('extractRoutes: expands array route.path without throwing', () => {
  // Regression: layer.route.path can be an array (e.g. Express SPA fallback
  // app.get(['/LIS/*'], ...) used to crash with "right.startsWith is not a function").
  const app = {
    _router: {
      stack: [
        // array path with two real API entries — both must appear in result
        { route: { path: ['/api/multi-a', '/api/multi-b'], methods: { get: true } } },
        // array path that should be filtered out (no /api/ prefix)
        { route: { path: ['/LIS/*'], methods: { get: true } } },
      ],
    },
  };
  const routes = extractRoutes(app);
  assert.ok(
    routes.some((r) => r.method === 'GET' && r.path === '/api/multi-a'),
    'should include /api/multi-a',
  );
  assert.ok(
    routes.some((r) => r.method === 'GET' && r.path === '/api/multi-b'),
    'should include /api/multi-b',
  );
  assert.ok(
    !routes.some((r) => r.path === '/LIS/*'),
    'should not include /LIS/* (filtered by /api/ rule)',
  );
});
