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
