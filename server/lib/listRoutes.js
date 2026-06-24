// Introspect a mounted Express 4 app and list its API endpoints.
// Used by GET /api/_routes for the admin "API" settings tab.

function extractMountPath(layer) {
  const re = layer && layer.regexp;
  if (!re) return '';
  if (re.fast_slash) return '';
  const source = re.source || '';
  return source
    .replace(/^\^/, '')
    .replace(/\\\/\?\(\?=\\\/\|\$\)$/, '') // trailing /?(?=\/|$)
    .replace(/\$$/, '')
    .replace(/\\\//g, '/');
}

function joinPaths(a, b) {
  const left = (a || '').replace(/\/$/, '');
  const right = b || '';
  if (!right || right === '/') return left || '/';
  return left + (right.startsWith('/') ? right : '/' + right);
}

function methodsOf(route) {
  return Object.keys(route.methods || {})
    .filter((m) => route.methods[m] && m !== '_all')
    .map((m) => m.toUpperCase());
}

function collect(stack, prefix, out) {
  for (const layer of stack || []) {
    if (layer.route) {
      const routePath = layer.route.path;
      const paths = Array.isArray(routePath) ? routePath : [routePath];
      for (const p of paths) {
        const full = joinPaths(prefix, p);
        for (const method of methodsOf(layer.route)) {
          out.push({ method, path: full });
        }
      }
    } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
      collect(layer.handle.stack, joinPaths(prefix, extractMountPath(layer)), out);
    }
  }
}

function extractRoutes(app) {
  // Express 4: routes live on app._router (renamed to app.router in v5).
  // Guarded so a future upgrade fails soft (empty list) rather than throwing.
  const stack = app && app._router && app._router.stack;
  if (!stack) return [];
  const out = [];
  collect(stack, '', out);
  const seen = new Set();
  const deduped = [];
  for (const r of out) {
    if (!r.path.startsWith('/api/')) continue; // drop /LIS/api duplicates + static/SPA
    const key = `${r.method} ${r.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
  }
  deduped.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
  return deduped;
}

module.exports = { extractRoutes, extractMountPath, joinPaths };
