const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const line = require('./line');

const SECRET = 'test-channel-secret';
function sign(body, secret = SECRET) {
  return crypto.createHmac('sha256', secret).update(Buffer.from(body, 'utf8')).digest('base64');
}

test('verifySignature: valid signature passes', () => {
  process.env.LINE_CHANNEL_SECRET = SECRET;
  const body = JSON.stringify({ events: [] });
  assert.strictEqual(line.verifySignature(Buffer.from(body), sign(body)), true);
});

test('verifySignature: tampered body fails', () => {
  process.env.LINE_CHANNEL_SECRET = SECRET;
  const body = JSON.stringify({ events: [{ x: 1 }] });
  const sig = sign(body);
  assert.strictEqual(line.verifySignature(Buffer.from(body + ' '), sig), false);
});

test('verifySignature: wrong secret fails', () => {
  process.env.LINE_CHANNEL_SECRET = SECRET;
  const body = JSON.stringify({ events: [] });
  assert.strictEqual(line.verifySignature(Buffer.from(body), sign(body, 'other')), false);
});

test('verifySignature: no secret configured → false', () => {
  delete process.env.LINE_CHANNEL_SECRET;
  assert.strictEqual(line.verifySignature(Buffer.from('{}'), 'anything'), false);
});

test('toMessages: strings become text messages, capped at 5', () => {
  assert.deepStrictEqual(line.toMessages('hi'), [{ type: 'text', text: 'hi' }]);
  assert.strictEqual(line.toMessages(['a', 'b', 'c', 'd', 'e', 'f']).length, 5);
  assert.deepStrictEqual(line.toMessages([null, '', 'x']), [{ type: 'text', text: 'x' }]);
});

test('isConfigured reflects the access token env', () => {
  delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
  assert.strictEqual(line.isConfigured(), false);
  process.env.LINE_CHANNEL_ACCESS_TOKEN = 'token';
  assert.strictEqual(line.isConfigured(), true);
  delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
});

test('isForwarding reflects LINE_FORWARD_WEBHOOK_URL', () => {
  delete process.env.LINE_FORWARD_WEBHOOK_URL;
  assert.strictEqual(line.isForwarding(), false);
  process.env.LINE_FORWARD_WEBHOOK_URL = 'https://example.com/hook';
  assert.strictEqual(line.isForwarding(), true);
  assert.strictEqual(line.forwardUrl(), 'https://example.com/hook');
  delete process.env.LINE_FORWARD_WEBHOOK_URL;
});

test('forwardWebhook: relays raw body + signature to the forward URL', async () => {
  process.env.LINE_FORWARD_WEBHOOK_URL = 'https://n8n.example/webhook/line';
  const seen = [];
  const realFetch = global.fetch;
  global.fetch = async (url, opts) => {
    seen.push({ url: String(url), opts });
    return { ok: true, status: 200, text: async () => '' };
  };
  try {
    const body = Buffer.from(JSON.stringify({ events: [{ type: 'join' }] }), 'utf8');
    const res = await line.forwardWebhook(body, 'sig-123');
    assert.strictEqual(res.ok, true);
    assert.strictEqual(seen.length, 1);
    assert.strictEqual(seen[0].url, 'https://n8n.example/webhook/line');
    assert.strictEqual(seen[0].opts.headers['X-Line-Signature'], 'sig-123');
    assert.strictEqual(seen[0].opts.body.toString('utf8'), body.toString('utf8'));
  } finally {
    global.fetch = realFetch;
    delete process.env.LINE_FORWARD_WEBHOOK_URL;
  }
});

test('verifyIngestKey: matches only the configured secret (timing-safe)', () => {
  delete process.env.LINE_INGEST_SECRET;
  assert.strictEqual(line.verifyIngestKey('anything'), false); // no secret set
  process.env.LINE_INGEST_SECRET = 'super-secret-key';
  assert.strictEqual(line.verifyIngestKey('super-secret-key'), true);
  assert.strictEqual(line.verifyIngestKey('wrong'), false);
  assert.strictEqual(line.verifyIngestKey(''), false);
  assert.strictEqual(line.verifyIngestKey(undefined), false);
  delete process.env.LINE_INGEST_SECRET;
});

test('forwardWebhook: no URL configured → skipped, no fetch', async () => {
  delete process.env.LINE_FORWARD_WEBHOOK_URL;
  let called = false;
  const realFetch = global.fetch;
  global.fetch = async () => { called = true; return { ok: true, status: 200, text: async () => '' }; };
  try {
    const res = await line.forwardWebhook(Buffer.from('{}'), 'sig');
    assert.strictEqual(res.skipped, true);
    assert.strictEqual(called, false);
  } finally {
    global.fetch = realFetch;
  }
});
