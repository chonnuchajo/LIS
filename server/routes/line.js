const express = require('express');
const router = express.Router();
const Petition = require('../models/Petition');
const LineGroup = require('../models/LineGroup');
const line = require('../lib/line');
const { petitionStatusText, itemsSummary, notifyPetitionEvent } = require('../lib/lineNotify');
const { isOpenAIConfigured, generateText } = require('../lib/openaiClient');

const AUDIENCES = LineGroup.AUDIENCES;
const AUDIENCE_LABELS = {
  qc: 'QC', lab: 'Lab', production: 'แผนกผลิต', rm: 'แผนก RM', fg: 'แผนก FG', all: 'ทุกเหตุการณ์',
};

// LINE source id: group > room > 1:1 user.
function sourceId(event) {
  const s = event?.source || {};
  return s.groupId || s.roomId || s.userId || null;
}

const HELP_TEXT = [
  'คำสั่งบอท LIS 🤖',
  '• พิมพ์เลขคำขอ เช่น P-2606-0018 → ดูสถานะ',
  '• batch <เลข> หรือ lot <เลข> → ค้นหาคำขอตาม batch/lot',
  '• งานค้าง → สรุปงานที่ยังไม่เสร็จ',
  '• งานวันนี้ → สรุปงานเข้า/เสร็จวันนี้',
  '• /ถาม <คำถาม> → ถามผู้ช่วย AI แบบภาษาธรรมชาติ (เช่น /ถาม P-2606-0018 ค้างที่ขั้นไหน)',
  '• /ผูก <qc|lab|production|rm|fg|all> → ผูกกลุ่มนี้ให้รับแจ้งเตือน',
  '• /ยกเลิก → ยกเลิกการรับแจ้งเตือนของกลุ่มนี้',
  '• /id → แสดงรหัสกลุ่ม (groupId)',
  '• /help → เมนูนี้',
].join('\n');

const MAX_LIST = 8; // จำนวนรายการสูงสุดที่โชว์ในผลค้นหา/สรุป

// Find the first petition-number-looking token in free text (P-YYMM-#### with
// optional dashes / casing), normalized to canonical "P-YYMM-####".
function extractPetitionNo(text) {
  const m = String(text || '').match(/P[-\s]?(\d{4})[-\s]?(\d{3,4})/i);
  if (!m) return null;
  return `P-${m[1]}-${m[2].padStart(4, '0')}`;
}

// Classify an inbound text into a bot intent. Pure — unit-tested. Precedence:
// slash/keyword commands → summaries → petition-no → batch/lot → unknown.
function parseCommand(text) {
  const t = String(text || '').trim();
  const lower = t.toLowerCase();

  if (lower === '/help' || t === 'เมนู' || t === 'ช่วยเหลือ') return { type: 'help' };
  if (lower === '/id') return { type: 'id' };
  const bind = t.match(/^\/(?:ผูก|bind)\s+(\S+)/i);
  if (bind) return { type: 'bind', audience: bind[1].toLowerCase() };
  // note: \b is unreliable after Thai chars — use a lookahead for end/space instead
  if (/^\/(?:ยกเลิก|unbind)(?=$|\s)/i.test(t)) return { type: 'unbind' };

  // explicit AI Q&A command — works in groups too (implicit free-text only replies in 1:1)
  const ask = t.match(/^\/(?:ถาม|ai|ask)\s+([\s\S]+)/i);
  if (ask) return { type: 'ask', question: ask[1].trim() };

  // summaries — accept slash command, bare keyword, or "งานค้าง/งานวันนี้"
  if (/^\/(?:ค้าง|pending)$/i.test(t) || t === 'ค้าง' || /งานค้าง/.test(t)) return { type: 'pending' };
  if (/^\/(?:วันนี้|today)$/i.test(t) || t === 'วันนี้' || /งานวันนี้/.test(t)) return { type: 'today' };

  // petition number wins over batch (P-#### is unambiguous)
  const pno = extractPetitionNo(t);
  if (pno) return { type: 'status', petitionNo: pno };

  // batch/lot search needs an explicit keyword so groups aren't spammed by stray text
  const b = t.match(/(?:batch|แบตช์|เลขแบตช์|lot|ล็อต|ล๊อต)\s*[:#]?\s*(\S+)/i);
  if (b) return { type: 'batch', term: b[1] };

  return { type: 'unknown' };
}

async function replyPetitionStatus(replyToken, petitionNo) {
  const p = await Petition.findOne({ petitionNo }).lean();
  if (!p) {
    await line.reply(replyToken, `ไม่พบคำขอ ${petitionNo} ในระบบ`);
    return;
  }
  const lines = [
    `🔎 ${p.petitionNo}`,
    `สถานะ: ${petitionStatusText(p)}`,
    `ตัวอย่าง: ${itemsSummary(p)}`,
  ];
  if (p.assignedTo?.name) lines.push(`ผู้รับผิดชอบ: ${p.assignedTo.name}`);
  if (p.submittedBy?.name) lines.push(`ผู้ยื่น: ${p.submittedBy.name}`);
  await line.reply(replyToken, lines.join('\n'));
}

// Bind / unbind this chat to an audience via chat command (self-service setup — no
// admin UI needed: add the bot to a group, type "/ผูก qc").
async function handleBind(replyToken, id, audience, boundBy) {
  if (!AUDIENCES.includes(audience)) {
    await line.reply(
      replyToken,
      `กลุ่มผู้รับไม่ถูกต้อง: "${audience}"\nใช้ได้: ${AUDIENCES.join(', ')}`,
    );
    return;
  }
  await LineGroup.findOneAndUpdate(
    { groupId: id },
    { groupId: id, audience, enabled: true, boundBy: boundBy || 'line' },
    { upsert: true, new: true },
  );
  await line.reply(replyToken, `✅ ผูกกลุ่มนี้เป็น "${AUDIENCE_LABELS[audience]}" แล้ว\nจะได้รับแจ้งเตือนที่เกี่ยวข้องอัตโนมัติ`);
}

async function handleUnbind(replyToken, id) {
  const r = await LineGroup.deleteMany({ groupId: id });
  await line.reply(
    replyToken,
    r.deletedCount ? '🗑️ ยกเลิกการรับแจ้งเตือนของกลุ่มนี้แล้ว' : 'กลุ่มนี้ยังไม่ได้ผูกไว้',
  );
}

// Search petitions by batch or lot number (substring, case-insensitive).
async function buildBatchReply(term) {
  const safe = String(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp(safe, 'i');
  const docs = await Petition.find({ $or: [{ 'items.batchNo': rx }, { 'items.lotNo': rx }] })
    .sort({ createdAt: -1 })
    .limit(MAX_LIST + 1)
    .lean();
  if (!docs.length) return `ไม่พบคำขอที่มี batch/lot: "${term}"`;
  const lines = [`🔎 ผลค้นหา batch/lot "${term}" (${docs.length > MAX_LIST ? MAX_LIST + '+' : docs.length})`];
  for (const p of docs.slice(0, MAX_LIST)) lines.push(`• ${p.petitionNo} · ${petitionStatusText(p)}`);
  if (docs.length > MAX_LIST) lines.push(`…และอีกหลายรายการ (ระบุ batch ให้เจาะจงขึ้น)`);
  return lines.join('\n');
}

// Summary of jobs not yet finished (still in the active pipeline).
async function buildPendingSummary() {
  const active = ['sampleSent', 'pendingReview', 'inProgress'];
  const docs = await Petition.find({ status: { $in: active } }).sort({ createdAt: 1 }).lean();
  const c = { sampleSent: 0, pendingReview: 0, inProgress: 0 };
  for (const d of docs) c[d.status] = (c[d.status] || 0) + 1;
  const lines = [
    `📊 งานค้างทั้งหมด ${docs.length} รายการ`,
    `• รอรับตัวอย่าง: ${c.sampleSent}`,
    `• รับแล้ว/รอมอบหมาย: ${c.pendingReview}`,
    `• กำลังตรวจ: ${c.inProgress}`,
  ];
  if (docs.length) {
    lines.push('รายการล่าสุด:');
    for (const p of docs.slice(0, MAX_LIST)) lines.push(`• ${p.petitionNo} · ${petitionStatusText(p)}`);
    if (docs.length > MAX_LIST) lines.push(`…และอีก ${docs.length - MAX_LIST} รายการ`);
  }
  return lines.join('\n');
}

// Summary of today's inflow / completions (server local day).
async function buildTodaySummary() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [createdToday, doneToday] = await Promise.all([
    Petition.countDocuments({ createdAt: { $gte: start } }),
    Petition.countDocuments({ completedAt: { $gte: start } }),
  ]);
  const dateLabel = now.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  return [
    `📅 สรุปงานวันนี้ (${dateLabel})`,
    `• คำขอเข้าใหม่: ${createdToday}`,
    `• ตรวจเสร็จวันนี้: ${doneToday}`,
  ].join('\n');
}

// LLM-backed free-form Q&A. Grounds gpt-4o-mini on live system data — any petition
// referenced in the question plus the current workload snapshot — so answers stay
// factual. Returns null when OpenAI isn't configured or the call fails, so the caller
// falls back to the static HELP_TEXT (feature stays a safe no-op without a key).
async function buildAssistantReply(question) {
  if (!isOpenAIConfigured() || !String(question || '').trim()) return null;

  const contextParts = [];

  // Pull the referenced petition's live detail, if the question names one.
  const pno = extractPetitionNo(question);
  if (pno) {
    const p = await Petition.findOne({ petitionNo: pno }).lean();
    if (p) {
      const parts = [`คำขอ ${p.petitionNo}: สถานะ ${petitionStatusText(p)}; ตัวอย่าง ${itemsSummary(p)}`];
      if (p.assignedTo?.name) parts.push(`ผู้รับผิดชอบ ${p.assignedTo.name}`);
      if (p.submittedBy?.name) parts.push(`ผู้ยื่น ${p.submittedBy.name}`);
      contextParts.push(parts.join(' '));
    } else {
      contextParts.push(`ไม่พบคำขอ ${pno} ในระบบ`);
    }
  }

  // Ambient workload snapshot (cheap, broadly useful grounding).
  const [pending, today] = await Promise.all([buildPendingSummary(), buildTodaySummary()]);
  contextParts.push(pending, today);

  const system = [
    'คุณเป็นผู้ช่วยของระบบ LIS (Laboratory Information System) ของบริษัทเคมีภัณฑ์/ยาไทย',
    'ตอบเป็นภาษาไทย สั้น กระชับ สุภาพ ไม่เกิน 4-5 ประโยค',
    'ตอบโดยอ้างอิงเฉพาะ "ข้อมูลระบบ" ที่ให้ไว้เท่านั้น ห้ามเดาข้อมูลที่ไม่มี',
    'ถ้าข้อมูลไม่พอ ให้บอกตามตรงและแนะนำให้พิมพ์ /help เพื่อดูคำสั่งที่ใช้ได้',
  ].join('\n');

  const prompt = [
    'ข้อมูลระบบ ณ ปัจจุบัน:',
    contextParts.join('\n'),
    '',
    `คำถามจากผู้ใช้: ${question}`,
  ].join('\n');

  try {
    const answer = await generateText(prompt, { system });
    return answer?.trim() || null;
  } catch (err) {
    console.error('[line assistant] LLM error:', err.message);
    return null;
  }
}

async function handleTextMessage(event) {
  const replyToken = event.replyToken;
  const id = sourceId(event);
  const text = String(event.message?.text || '').trim();
  if (!replyToken) return;

  const cmd = parseCommand(text);
  switch (cmd.type) {
    case 'help':
      await line.reply(replyToken, HELP_TEXT);
      break;
    case 'id':
      await line.reply(replyToken, `รหัสกลุ่มนี้ (groupId):\n${id || '(ไม่พบ)'}`);
      break;
    case 'bind':
      await handleBind(replyToken, id, cmd.audience, event.source?.userId);
      break;
    case 'unbind':
      await handleUnbind(replyToken, id);
      break;
    case 'status':
      await replyPetitionStatus(replyToken, cmd.petitionNo);
      break;
    case 'batch':
      await line.reply(replyToken, await buildBatchReply(cmd.term));
      break;
    case 'pending':
      await line.reply(replyToken, await buildPendingSummary());
      break;
    case 'today':
      await line.reply(replyToken, await buildTodaySummary());
      break;
    case 'ask':
      // Explicit /ถาม — answer everywhere (groups included). Fall back to HELP if the
      // LLM is unavailable so the user still gets something useful.
      await line.reply(replyToken, (await buildAssistantReply(cmd.question)) || HELP_TEXT);
      break;
    default:
      // Unknown message in a 1:1 chat → try a free-form AI answer, else nudge with help.
      // In groups, stay silent to avoid replying to every unrelated message.
      if (event.source?.type === 'user') {
        await line.reply(replyToken, (await buildAssistantReply(text)) || HELP_TEXT);
      }
  }
}

// deferJoinReply = another handler (n8n) owns the join/follow reply, so LIS must NOT
// also reply to it (the single-use replyToken can be used once — a race otherwise).
async function handleEvent(event, deferJoinReply) {
  try {
    switch (event.type) {
      case 'message':
        if (event.message?.type === 'text') await handleTextMessage(event);
        break;
      case 'join': // bot added to a group/room
      case 'follow': // user added the bot (1:1)
        if (event.replyToken && !deferJoinReply) {
          await line.reply(event.replyToken, [
            'สวัสดีครับ 👋 บอท LIS พร้อมใช้งาน',
            `รหัสกลุ่มนี้: ${sourceId(event) || '(ไม่พบ)'}`,
            '',
            HELP_TEXT,
          ].join('\n'));
        }
        break;
      default:
        break; // leave/unfollow/postback ฯลฯ — ไม่ต้องตอบ
    }
  } catch (err) {
    console.error('[line webhook] event error:', err.message);
  }
}

// POST /line/webhook — LINE Messaging API webhook. Verifies X-Line-Signature over the
// RAW request body (captured as req.rawBody in index.js), then handles each event.
router.post('/webhook', async (req, res) => {
  const signature = req.get('x-line-signature');
  // If a channel secret is configured, enforce the signature. If not configured
  // (dev), accept so the endpoint can still be exercised locally.
  if (line.channelSecret()) {
    if (!line.verifySignature(req.rawBody, signature)) {
      return res.status(401).json({ error: { message: 'invalid signature' } });
    }
  }
  // Ack immediately; LINE expects a fast 200 and does not read the body.
  res.status(200).json({ ok: true });

  // Relay the raw payload to a downstream handler (n8n) if configured — fire-and-forget.
  line.forwardWebhook(req.rawBody, signature);

  const events = Array.isArray(req.body?.events) ? req.body.events : [];
  for (const event of events) await handleEvent(event, line.isForwarding());
});

// POST /line/ingest — for the reverse topology: LINE → n8n → LIS. n8n is the webhook
// target and relays the (possibly re-serialized) LINE payload here. Authenticated by a
// static shared key (X-LIS-Ingest-Key header or ?key=), NOT the LINE signature — n8n
// may not preserve byte-exact body. Join replies are deferred (n8n owns them).
router.post('/ingest', async (req, res) => {
  if (!line.ingestSecret()) {
    return res.status(503).json({ error: { message: 'ingest ยังไม่ถูกตั้งค่า (LINE_INGEST_SECRET)' } });
  }
  const key = req.get('x-lis-ingest-key') || req.query.key;
  if (!line.verifyIngestKey(key)) {
    return res.status(401).json({ error: { message: 'invalid ingest key' } });
  }
  res.status(200).json({ ok: true });

  // n8n may wrap the payload as { body: {...} } (n8n webhook shape) or send it raw.
  const payload = req.body?.events ? req.body : req.body?.body || {};
  const events = Array.isArray(payload.events) ? payload.events : [];
  for (const event of events) await handleEvent(event, true);
});

// ─── Admin / setup helpers (mounted under /api/line and /LIS/api/line) ───────────

// GET /line/health — config + registered group count (for a settings UI badge).
router.get('/health', async (_req, res) => {
  try {
    const count = await LineGroup.countDocuments({ enabled: true });
    res.json({
      configured: line.isConfigured(),
      hasSecret: !!line.channelSecret(),
      groupCount: count,
      forwarding: line.isForwarding(),
      forwardUrl: line.forwardUrl() || null,
      ingest: !!line.ingestSecret(), // /line/ingest ready (LINE→n8n→LIS topology)
    });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// GET /line/groups — list registered groups.
router.get('/groups', async (_req, res) => {
  try {
    const groups = await LineGroup.find().sort({ audience: 1, createdAt: 1 }).lean();
    res.json({ data: groups });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /line/groups — manual upsert { groupId, audience, name? } (alternative to the
// in-chat /ผูก command).
router.post('/groups', async (req, res) => {
  try {
    const groupId = String(req.body?.groupId || '').trim();
    const audience = String(req.body?.audience || '').trim();
    const name = req.body?.name ? String(req.body.name).trim() : undefined;
    if (!groupId) return res.status(400).json({ error: { message: 'ต้องระบุ groupId' } });
    if (!AUDIENCES.includes(audience)) {
      return res.status(400).json({ error: { message: `audience ต้องเป็นหนึ่งใน: ${AUDIENCES.join(', ')}` } });
    }
    const doc = await LineGroup.findOneAndUpdate(
      { groupId },
      { groupId, audience, name, enabled: true, boundBy: 'admin' },
      { upsert: true, new: true },
    ).lean();
    res.json({ data: doc });
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

// DELETE /line/groups/:groupId — remove a registration.
router.delete('/groups/:groupId', async (req, res) => {
  try {
    const r = await LineGroup.deleteOne({ groupId: req.params.groupId });
    res.json({ deleted: r.deletedCount });
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

// POST /line/test — push a test message to an audience (verify wiring end-to-end).
router.post('/test', async (req, res) => {
  try {
    const audience = String(req.body?.audience || 'all').trim();
    const message = String(req.body?.message || '🔔 ทดสอบการแจ้งเตือนจากระบบ LIS').trim();
    const { resolveGroupIds } = require('../lib/lineNotify');
    const groupIds = await resolveGroupIds([audience]);
    if (!groupIds.length) {
      return res.status(404).json({ error: { message: 'ไม่พบกลุ่มที่ผูกไว้สำหรับผู้รับนี้' } });
    }
    const results = await Promise.all(groupIds.map((id) => line.pushToGroup(id, message)));
    res.json({ sent: groupIds.length, results });
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

module.exports = router;
// re-export for callers that want the notifier off the route module (rarely needed)
module.exports.notifyPetitionEvent = notifyPetitionEvent;
// exposed for unit tests
module.exports.parseCommand = parseCommand;
module.exports.extractPetitionNo = extractPetitionNo;
