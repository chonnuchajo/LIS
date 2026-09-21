const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const line = require('./line');

const SECRET = 'test-channel-secret';
const LINEMA_KEY = `lin_${'1'.repeat(40)}`;
const ENV_KEYS = ['LINE_CHANNEL_ACCESS_TOKEN', 'LINE_PUSH_URL', 'LINEMA_BASE_URL', 'LINEMA_API_KEY'];
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

test.beforeEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

test.afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});
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

test('isConfigured requires Linema URL and API key, not a LINE channel token', () => {
  process.env.LINE_CHANNEL_ACCESS_TOKEN = 'legacy-token';
  assert.strictEqual(line.isConfigured(), false);
  process.env.LINEMA_API_KEY = LINEMA_KEY;
  assert.strictEqual(line.isConfigured(), false);
  process.env.LINEMA_BASE_URL = 'https://app-plant.icpladda.com/Linema';
  assert.strictEqual(line.isConfigured(), true);
  process.env.LINEMA_API_KEY = `lin_${'AB'.repeat(20)}`;
  assert.strictEqual(line.isConfigured(), true);
  process.env.LINEMA_API_KEY = `LIN_${'1'.repeat(40)}`;
  assert.strictEqual(line.isConfigured(), false);
});

for (const [baseUrl, fallbackUrl, expectedUrl] of [
  ['https://app-plant.icpladda.com/Linema', '', 'https://app-plant.icpladda.com/Linema/api/v1/messages'],
  [' https://app-plant.icpladda.com/Linema/ ', '', 'https://app-plant.icpladda.com/Linema/api/v1/messages'],
  ['https://app-plant.icpladda.com/Linema/api/v1/', '', 'https://app-plant.icpladda.com/Linema/api/v1/messages'],
  ['', 'https://app-plant.icpladda.com/Linema', 'https://app-plant.icpladda.com/Linema/api/v1/messages'],
  [' ', 'https://app-plant.icpladda.com/Linema/', 'https://app-plant.icpladda.com/Linema/api/v1/messages'],
  ['https://primary.example/Linema', 'https://fallback.example/Linema', 'https://primary.example/Linema/api/v1/messages'],
]) {
  test(`pushToGroup: normalizes Linema URL (${baseUrl || 'fallback'}) and accepts 201`, async (context) => {
    process.env.LINEMA_BASE_URL = baseUrl;
    process.env.LINE_PUSH_URL = fallbackUrl;
    process.env.LINEMA_API_KEY = ` ${LINEMA_KEY} `;
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'legacy-token';
    const request = context.mock.method(global, 'fetch', async () => new Response('{"messages":[]}', { status: 201 }));

    assert.deepStrictEqual(await line.pushToGroup('C123', 'hello'), { ok: true });
    assert.strictEqual(request.mock.callCount(), 1);
    const [url, options] = request.mock.calls[0].arguments;
    assert.strictEqual(url, expectedUrl);
    assert.strictEqual(options.method, 'POST');
    assert.strictEqual(options.redirect, 'error');
    assert.strictEqual(options.headers.Authorization, `Bearer ${LINEMA_KEY}`);
    assert.strictEqual(options.headers['Content-Type'], 'application/json');
    assert.deepStrictEqual(JSON.parse(options.body), { to: 'C123', messages: [{ type: 'text', text: 'hello' }] });
  });
}

test('pushToGroup: missing or invalid Linema key skips without using legacy credentials', async (context) => {
  process.env.LINEMA_BASE_URL = 'https://app-plant.icpladda.com/Linema';
  process.env.LINE_CHANNEL_ACCESS_TOKEN = 'legacy-token';
  const request = context.mock.method(global, 'fetch', async () => new Response('{}'));
  for (const key of ['', ' ', 'legacy-token', 'lin_short']) {
    process.env.LINEMA_API_KEY = key;
    assert.strictEqual(line.isConfigured(), false);
    const result = await line.pushToGroup('C123', 'hello');
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.skipped, true);
    assert.match(result.error, /LINEMA/);
  }
  assert.strictEqual(request.mock.callCount(), 0);
});

test('pushToGroup: rejects unsafe or invalid URLs without sending the API key', async (context) => {
  process.env.LINEMA_API_KEY = LINEMA_KEY;
  const request = context.mock.method(global, 'fetch', async () => new Response('{}'));
  for (const baseUrl of ['', 'not-a-url', 'http://example.com/Linema', 'https://user:pass@example.com/Linema', 'https://example.com/Linema?token=secret', 'https://example.com/Linema#fragment']) {
    process.env.LINEMA_BASE_URL = baseUrl;
    assert.strictEqual(line.isConfigured(), false);
    assert.strictEqual((await line.pushToGroup('C123', 'hello')).skipped, true);
  }
  assert.strictEqual(request.mock.callCount(), 0);
});

for (const status of [401, 403, 429, 500]) {
  test(`pushToGroup: preserves HTTP ${status} failure without retry or fallback`, async (context) => {
    process.env.LINEMA_BASE_URL = 'https://app-plant.icpladda.com/Linema';
    process.env.LINEMA_API_KEY = LINEMA_KEY;
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'legacy-token';
    const body = '{"error":"missing scope or route"}';
    const request = context.mock.method(global, 'fetch', async () => new Response(body, { status }));
    const result = await line.pushToGroup('C123', 'hello');
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.status, status);
    assert.strictEqual(result.body, body);
    if (status === 403) assert.match(result.error, /messages:send.*routing/);
    assert.strictEqual(request.mock.callCount(), 1);
  });
}

test('pushToGroup: network failure resolves without retry', async (context) => {
  process.env.LINEMA_BASE_URL = 'https://app-plant.icpladda.com/Linema';
  process.env.LINEMA_API_KEY = LINEMA_KEY;
  const request = context.mock.method(global, 'fetch', async () => { throw new Error('network unavailable'); });
  assert.deepStrictEqual(await line.pushToGroup('C123', 'hello'), { ok: false, error: 'network unavailable' });
  assert.strictEqual(request.mock.callCount(), 1);
});

test('pushToGroup: empty recipients and messages do not send a request', async (context) => {
  process.env.LINEMA_BASE_URL = 'https://app-plant.icpladda.com/Linema';
  process.env.LINEMA_API_KEY = LINEMA_KEY;
  const request = context.mock.method(global, 'fetch', async () => new Response('{}'));
  assert.deepStrictEqual(await line.pushToGroup('', 'hello'), { ok: false, error: 'no groupId' });
  assert.deepStrictEqual(await line.pushToGroup('C123', []), { ok: false, error: 'no messages' });
  assert.strictEqual(request.mock.callCount(), 0);
});

test('reply: keeps legacy LINE credentials separate from Linema configuration', async (context) => {
  process.env.LINE_CHANNEL_ACCESS_TOKEN = 'legacy-token';
  const request = context.mock.method(global, 'fetch', async () => new Response('{}'));
  assert.deepStrictEqual(await line.reply('reply-token', 'hello'), { ok: true });
  assert.strictEqual(request.mock.calls[0].arguments[0], 'https://api.line.me/v2/bot/message/reply');
  assert.strictEqual(request.mock.calls[0].arguments[1].headers.Authorization, 'Bearer legacy-token');
  delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
  process.env.LINEMA_BASE_URL = 'https://app-plant.icpladda.com/Linema';
  process.env.LINEMA_API_KEY = LINEMA_KEY;
  assert.strictEqual((await line.reply('reply-token', 'hello')).skipped, true);
  assert.strictEqual(request.mock.callCount(), 1);
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
