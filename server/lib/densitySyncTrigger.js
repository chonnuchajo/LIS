// Fire the n8n webhook that makes the plant pull fresh DMA 501 readings into the
// Result-Density collection. The webhook is GET-only and async (it answers
// {"message":"Workflow was started"} immediately); callers poll by-batch
// afterwards for the upserted rows to appear. URL comes from
// DENSITY_SYNC_WEBHOOK_URL so it stays out of client code and CORS.

// fetchImpl is injectable for tests; defaults to the global fetch (Node 18+).
async function triggerDensitySync(fetchImpl = globalThis.fetch) {
  const url = process.env.DENSITY_SYNC_WEBHOOK_URL;
  if (!url) throw new Error('DENSITY_SYNC_WEBHOOK_URL not configured');
  const res = await fetchImpl(url, { method: 'GET', signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`density sync webhook responded ${res.status}`);
  return true;
}

module.exports = { triggerDensitySync };
