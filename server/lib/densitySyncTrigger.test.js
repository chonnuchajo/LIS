const test = require('node:test');
const assert = require('node:assert');
const { triggerDensitySync } = require('./densitySyncTrigger');

test('throws when the webhook URL is not configured', async () => {
  const prev = process.env.DENSITY_SYNC_WEBHOOK_URL;
  delete process.env.DENSITY_SYNC_WEBHOOK_URL;
  try {
    await assert.rejects(() => triggerDensitySync(async () => ({ ok: true })), /not configured/);
  } finally {
    if (prev !== undefined) process.env.DENSITY_SYNC_WEBHOOK_URL = prev;
  }
});

test('GETs the configured URL and resolves true on ok', async () => {
  process.env.DENSITY_SYNC_WEBHOOK_URL = 'https://example.test/webhook/sync-density';
  let calledUrl, calledOpts;
  const fetchImpl = async (url, opts) => {
    calledUrl = url;
    calledOpts = opts;
    return { ok: true };
  };
  const result = await triggerDensitySync(fetchImpl);
  assert.strictEqual(result, true);
  assert.strictEqual(calledUrl, 'https://example.test/webhook/sync-density');
  assert.strictEqual(calledOpts.method, 'GET');
});

test('throws with the status when the webhook responds non-ok', async () => {
  process.env.DENSITY_SYNC_WEBHOOK_URL = 'https://example.test/webhook/sync-density';
  await assert.rejects(
    () => triggerDensitySync(async () => ({ ok: false, status: 500 })),
    /responded 500/,
  );
});
