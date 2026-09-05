// Turns PetitionAuditLog rows into in-app bell notifications. Pure — no DB access;
// routes/petitions.js loads the inputs and calls these.
//
// Wording and audience routing come from lineNotify.describeEvent so the bell and the
// LINE groups can never drift apart. The bell tolerates finer-grained events than a
// LINE group does, so the two events describeEvent deliberately skips (received /
// resultEntered) get a bell-only fallback here.
const { describeEvent } = require('./lineNotify');
const { hasLabTrack } = require('./petitionStatusLog');
const { requiresQcTrack } = require('./petitionSubmissionRules');

const SIDE_LABELS = { lab: 'Lab', qc: 'QC' };

// describeEvent builds ONE multi-line LINE message; the bell wants a short title plus
// a secondary line. First line = title, everything else collapses into message.
function splitText(text) {
  const [first, ...rest] = String(text).split('\n');
  const message = rest.map((s) => s.trim()).filter(Boolean).join(' · ');
  return { title: first.trim(), message: message || undefined };
}

function bothSides(petition) {
  return [requiresQcTrack(petition) ? 'qc' : null, hasLabTrack(petition) ? 'lab' : null].filter(Boolean);
}

function bellDescribe(petition, log) {
  const shared = describeEvent(petition, log);
  if (shared) return { audiences: shared.audiences, ...splitText(shared.text) };

  const no = petition?.petitionNo || log?.petitionNo || '(ไม่ทราบเลข)';
  const side = log?.metadata?.side;

  switch (log?.event) {
    case 'received': {
      if (side !== 'lab' && side !== 'qc') return null;
      return { audiences: [side], title: `📥 ${SIDE_LABELS[side]} รับตัวอย่าง ${no}` };
    }
    case 'resultEntered': {
      const audiences = side === 'lab' || side === 'qc' ? [side] : bothSides(petition);
      if (!audiences.length) return null;
      return {
        audiences,
        title: `🧪 เริ่มบันทึกผล ${no}`,
        message: log?.metadata?.parameterName || undefined,
      };
    }
    case 'statusChanged': {
      // Head QC bounces the petition back to Lab/QC/both for retest (routes/petitions.js
      // ~line 1018: toStatus 'inProgress' + metadata.returnTo). audiencesForEvent maps
      // plain 'inProgress' to [] so describeEvent already returned null above — but a
      // routine inProgress transition with no returnTo (e.g. a generic field edit) must
      // stay null here too, it is not this event.
      const returnTo = log?.metadata?.returnTo;
      if (log?.toStatus !== 'inProgress' || !returnTo) return null;
      const audiences =
        returnTo === 'both' ? bothSides(petition) : returnTo === 'lab' || returnTo === 'qc' ? [returnTo] : [];
      if (!audiences.length) return null;
      return {
        audiences,
        title: `🔁 ส่งกลับทดสอบใหม่ ${no}`,
        // Reuse the note routes/petitions.js already composed ("หัวหน้า QC ส่งกลับฝั่ง...
        // ทดสอบใหม่: <reason>") instead of re-writing the Thai here.
        message: log?.note || undefined,
      };
    }
    default:
      // resultUpdated = แก้ค่าทีละช่อง (รัวเกินไป), reviewed/deleted = ไม่มีอะไรต้องบอก
      return null;
  }
}

// resultEntered fires once per FORM FIELD (see qcResultAuditEvent in auditEvents.js: "log
// ทุก field"), so one analyst filling one petition emits tens of rows, each producing an
// identical bell entry. Logs arrive sorted newest-first, so the first occurrence of a
// petitionId is the newest — keep it, collapse the rest. Mutates seenPetitionIds (adds the
// key the first time it is NOT a duplicate) so a caller can thread the same Set through a
// full newest-first loop and have "first wins" fall out naturally.
function isCollapsibleDuplicate(log, seenPetitionIds) {
  if (log?.event !== 'resultEntered') return false;
  const key = String(log?.petitionId || '');
  if (!key) return false;
  if (seenPetitionIds.has(key)) return true;
  seenPetitionIds.add(key);
  return false;
}

// Does this viewer care? Audience match OR it is their own job.
function isRelevant(desc, petition, viewer) {
  if (viewer?.seeAll) return true;
  const mine = viewer?.audiences || [];
  if ((desc?.audiences || []).some((a) => mine.includes(a))) return true;

  // employeeId only — names collide, and a collision would leak someone else's work.
  const empId = String(viewer?.employeeId || '').trim();
  if (!empId) return false;
  return (
    String(petition?.assignedTo?.employeeId || '').trim() === empId ||
    String(petition?.submittedBy?.employeeId || '').trim() === empId
  );
}

function levelForEvent(log) {
  if (log?.toStatus === 'rejected') return 'error';
  if (log?.toStatus === 'success' || log?.toStatus === 'approved') return 'success';
  // Sent back to redo work — not routine info, but not the terminal-rejection 'error' either.
  if (log?.toStatus === 'inProgress' && log?.metadata?.returnTo) return 'warning';
  if (String(log?.note || '').includes('ผิดปกติ')) return 'warning';
  return 'info';
}

// id = audit log id, so NotificationContext.push() de-dupes on its own when two
// polls overlap the same window.
function toNotification(petition, log, desc) {
  const petitionId = String(petition?._id ?? log?.petitionId ?? '');
  return {
    id: String(log?._id),
    petitionId,
    petitionNo: petition?.petitionNo || log?.petitionNo || '',
    event: log?.event,
    fromStatus: log?.fromStatus,
    toStatus: log?.toStatus,
    title: desc.title,
    message: desc.message,
    level: levelForEvent(log),
    link: `/petition/${petitionId}`,
    createdAt: log?.createdAt,
  };
}

module.exports = { bellDescribe, isCollapsibleDuplicate, isRelevant, levelForEvent, toNotification };
