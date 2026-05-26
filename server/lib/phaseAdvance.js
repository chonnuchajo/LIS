const Petition = require("../models/Petition");
const PetitionAuditLog = require("../models/PetitionAuditLog");

// When a triggersPhase2 field is filled, schedule the petition's Phase 2 unlock.
// - Timer fields wait timerDurationSec from the time the trigger was filled.
// - Non-timer fields (e.g. a "done" enum/checkbox) unlock Phase 2 immediately.
async function scheduleOrUnlockPhase2({ petitionId, parameter, field, fieldLabel, value, itemSeq }) {
  if (!field || !field.triggersPhase2) return;
  if (value === null || value === undefined || value === "") return;

  const petition = await Petition.findById(petitionId);
  if (!petition) return;
  if (petition.currentPhase === 2) return;

  let dueAt;
  if (field.type === "timer" && field.timerDurationSec > 0) {
    dueAt = new Date(Date.now() + field.timerDurationSec * 1000);
  } else {
    dueAt = new Date();
  }

  // If a trigger was already scheduled, keep the earliest due time
  // (whichever trigger completes first wins).
  if (petition.phase2DueAt && petition.phase2DueAt < dueAt) return;

  petition.phase2DueAt = dueAt;
  petition.phase2TriggeredBy = {
    parameterId: String(parameter._id),
    parameterName: parameter.name,
    fieldLabel,
    itemSeq,
    triggeredAt: new Date(),
  };
  await petition.save();
}

// Lazy auto-advance: called by GET endpoints so a petition transitions to
// Phase 2 the next time it's read after phase2DueAt elapses. Avoids cron.
async function maybeAdvancePhase(petition, actor = "system") {
  if (!petition) return petition;
  if (petition.currentPhase !== 1) return petition;
  if (!petition.phase2DueAt) return petition;
  if (petition.phase2DueAt > new Date()) return petition;

  const beforeStatus = petition.status;
  petition.currentPhase = 2;
  petition.phase2UnlockedAt = new Date();
  if (petition.status === "success") {
    petition.status = "inProgress";
    petition.completedAt = null;
  }
  await petition.save();

  PetitionAuditLog.create({
    petitionId: petition._id,
    petitionNo: petition.petitionNo,
    event: "statusChanged",
    fromStatus: beforeStatus,
    toStatus: petition.status,
    actor,
    note: "เริ่ม Phase 2 (ตรวจค่าหลัง)",
    metadata: { phaseAdvance: { from: 1, to: 2 } },
  }).catch((err) => console.error("[audit-log] phase advance:", err.message));

  return petition;
}

module.exports = { scheduleOrUnlockPhase2, maybeAdvancePhase };
