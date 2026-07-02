// Thin LINE Messaging API client — push/reply + webhook signature verification.
// No DB access, no domain knowledge (see lineNotify.js for that). Node 18+ global
// fetch and crypto only; no new npm deps.
//
// Setup (server/.env):
//   LINE_CHANNEL_ACCESS_TOKEN=...   # Messaging API → channel access token (long-lived)
//   LINE_CHANNEL_SECRET=...         # Messaging API → channel secret (for webhook signature)
//
// When LINE_CHANNEL_ACCESS_TOKEN is absent the client is a safe no-op: calls log a
// warning and resolve `{ ok:false, skipped:true }` instead of throwing — so dev boxes
// without LINE credentials run normally.
const crypto = require('crypto');

const LINE_API = 'https://api.line.me/v2/bot';

function accessToken() {
  return String(process.env.LINE_CHANNEL_ACCESS_TOKEN || '').trim();
}
function channelSecret() {
  return String(process.env.LINE_CHANNEL_SECRET || '').trim();
}
function isConfigured() {
  return accessToken().length > 0;
}

// Verify the X-Line-Signature header: base64( HMAC-SHA256(channelSecret, rawBody) ).
// rawBody MUST be the exact bytes LINE sent (see req.rawBody capture in index.js) —
// re-serializing the parsed JSON would change the bytes and break verification.
function verifySignature(rawBody, signature) {
  const secret = channelSecret();
  if (!secret || !signature) return false;
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody ?? ''), 'utf8');
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Accepts a string, a message object, or an array of either. Strings become text
// messages. LINE caps a single push/reply at 5 message objects — extras are dropped.
function toMessages(input) {
  const arr = Array.isArray(input) ? input : [input];
  return arr
    .filter((m) => m != null && m !== '')
    .map((m) => (typeof m === 'string' ? { type: 'text', text: m } : m))
    .slice(0, 5);
}

async function callLineApi(endpoint, payload) {
  if (!isConfigured()) {
    console.warn(`[line] skipped ${endpoint} — LINE_CHANNEL_ACCESS_TOKEN not set`);
    return { ok: false, skipped: true };
  }
  try {
    const resp = await fetch(`${LINE_API}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken()}`,
      },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      console.error(`[line] ${endpoint} failed ${resp.status}: ${text}`);
      return { ok: false, status: resp.status, body: text };
    }
    return { ok: true };
  } catch (err) {
    console.error(`[line] ${endpoint} error: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

// Push (unsolicited) message to a group/room/user by id.
async function pushToGroup(groupId, messages) {
  if (!groupId) return { ok: false, error: 'no groupId' };
  const msgs = toMessages(messages);
  if (!msgs.length) return { ok: false, error: 'no messages' };
  return callLineApi('/message/push', { to: groupId, messages: msgs });
}

// Reply to an incoming webhook event using its (single-use, ~30s) replyToken.
async function reply(replyToken, messages) {
  if (!replyToken) return { ok: false, error: 'no replyToken' };
  const msgs = toMessages(messages);
  if (!msgs.length) return { ok: false, error: 'no messages' };
  return callLineApi('/message/reply', { replyToken, messages: msgs });
}

module.exports = {
  LINE_API,
  isConfigured,
  channelSecret,
  verifySignature,
  toMessages,
  pushToGroup,
  reply,
};
