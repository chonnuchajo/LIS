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
    default:
      // resultUpdated = แก้ค่าทีละช่อง (รัวเกินไป), reviewed/deleted = ไม่มีอะไรต้องบอก
      return null;
  }
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
  if (String(log?.note || '').includes('ผิดปกติ')) return 'warning';
  return 'info';
}

// id = audit log id, so NotificationContext.push() de-dupes on its own when two
// polls overlap the same window.
function toNotification(petition, log, desc) {
  return {
    id: String(log?._id),
    petitionNo: petition?.petitionNo || log?.petitionNo || '',
    title: desc.title,
    message: desc.message,
    level: levelForEvent(log),
    link: `/petition/${petition?._id ?? log?.petitionId}`,
    createdAt: log?.createdAt,
  };
}

module.exports = { bellDescribe, isRelevant, levelForEvent, toNotification };
