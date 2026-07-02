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
