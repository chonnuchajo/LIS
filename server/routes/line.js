const express = require('express');
const router = express.Router();
const Petition = require('../models/Petition');
const LineGroup = require('../models/LineGroup');
const line = require('../lib/line');
const { petitionStatusText, itemsSummary, notifyPetitionEvent } = require('../lib/lineNotify');

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
  '• /ผูก <qc|lab|production|rm|fg|all> → ผูกกลุ่มนี้ให้รับแจ้งเตือน',
  '• /ยกเลิก → ยกเลิกการรับแจ้งเตือนของกลุ่มนี้',
  '• /id → แสดงรหัสกลุ่ม (groupId)',
  '• /help → เมนูนี้',
].join('\n');

// Find the first petition-number-looking token in free text (P-YYMM-#### with
// optional dashes / casing), normalized to canonical "P-YYMM-####".
function extractPetitionNo(text) {
  const m = String(text || '').match(/P[-\s]?(\d{4})[-\s]?(\d{3,4})/i);
  if (!m) return null;
  return `P-${m[1]}-${m[2].padStart(4, '0')}`;
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

async function handleTextMessage(event) {
  const replyToken = event.replyToken;
  const id = sourceId(event);
  const text = String(event.message?.text || '').trim();
  if (!replyToken) return;

  // Commands start with "/" (or the Thai bare word เมนู/ช่วยเหลือ)
  const lower = text.toLowerCase();
  if (lower === '/help' || text === 'เมนู' || text === 'ช่วยเหลือ') {
    await line.reply(replyToken, HELP_TEXT);
    return;
  }
  if (lower === '/id') {
    await line.reply(replyToken, `รหัสกลุ่มนี้ (groupId):\n${id || '(ไม่พบ)'}`);
    return;
  }
  const bind = text.match(/^\/(?:ผูก|bind)\s+(\S+)/i);
  if (bind) {
    await handleBind(replyToken, id, bind[1].toLowerCase(), event.source?.userId);
    return;
  }
  if (/^\/(?:ยกเลิก|unbind)\b/i.test(text)) {
    await handleUnbind(replyToken, id);
    return;
  }

  const petitionNo = extractPetitionNo(text);
  if (petitionNo) {
    await replyPetitionStatus(replyToken, petitionNo);
    return;
  }
  // Unknown message in a 1:1 chat → nudge with help. In groups, stay silent to
  // avoid replying to every unrelated message.
  if (event.source?.type === 'user') {
    await line.reply(replyToken, HELP_TEXT);
  }
}

async function handleEvent(event) {
  try {
    switch (event.type) {
      case 'message':
        if (event.message?.type === 'text') await handleTextMessage(event);
        break;
      case 'join': // bot added to a group/room
      case 'follow': // user added the bot (1:1)
        if (event.replyToken) {
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

  const events = Array.isArray(req.body?.events) ? req.body.events : [];
  for (const event of events) await handleEvent(event);
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
