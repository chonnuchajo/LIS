const COA_STATUSES = [
  'draft',
  'pendingApproval',
  'approved',
  'printed',
  'revisionDraft',
  'pendingRevisionApproval',
  'reissued',
  'cancelled',
  'superseded',
  'rejected',
];

const transitions = {
  submit: new Set(['draft', 'revisionDraft']),
  approve: new Set(['pendingApproval', 'pendingRevisionApproval']),
  reject: new Set(['pendingApproval', 'pendingRevisionApproval']),
  revise: new Set(['approved', 'printed', 'reissued']),
  cancel: new Set(['approved', 'printed', 'reissued']),
  print: new Set(['approved', 'printed', 'reissued']),
  update: new Set(['draft', 'revisionDraft']),
};

const protectedActions = new Set(['approve', 'reject', 'cancel']);
const editableSnapshotStatuses = new Set(['draft', 'revisionDraft']);
const supersedableStatuses = new Set(['approved', 'printed', 'reissued']);
// Prefer canPrintStatus() for read checks; this Set remains exported for Task 1 compatibility.
const activePrintableStatuses = new Set(transitions.print);

const COA_AUDIT_EVENTS = [
  'created',
  'updated',
  'submitted',
  'approved',
  'rejected',
  'revisionCreated',
  'revisionSubmitted',
  'revisionApproved',
  'superseded',
  'cancelled',
  'printed',
];

const lifecycleActionEvents = {
  submit: (status) => (status === 'revisionDraft' ? 'revisionSubmitted' : 'submitted'),
  approve: (status) => (status === 'pendingRevisionApproval' ? 'revisionApproved' : 'approved'),
  reject: () => 'rejected',
  revise: () => 'revisionCreated',
  cancel: () => 'cancelled',
  print: () => 'printed',
  update: () => 'updated',
};

function normalizeRole(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function isQcHead(user = {}) {
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  return (
    normalizeRole(user.role) === 'qc_head' ||
    normalizeRole(user.activeRole) === 'qc_head' ||
    normalizeRole(user.position) === 'qc_head' ||
    permissions.includes('coa.approve')
  );
}

function assertCanTransition(fromStatus, action, actor) {
  const allowed = transitions[action];
  if (!allowed) throw new Error(`Unknown COA action ${action}`);
  if (!allowed.has(fromStatus)) {
    throw new Error(`Cannot ${action} COA from ${fromStatus}`);
  }
  if (protectedActions.has(action) && !isQcHead(actor)) {
    throw new Error(`QC Head required to ${action} COA`);
  }
}

function assertValidCancellation(reason) {
  if (typeof reason !== 'string' || reason.trim().length === 0) {
    throw new Error('COA cancellation reason is required');
  }
}

function buildCoaAuditEvent(input = {}) {
  if (!COA_AUDIT_EVENTS.includes(input.event)) {
    throw new Error(`Invalid COA audit event ${input.event || ''}`.trim());
  }
  const actor = input.actor || {};
  if (typeof actor.name !== 'string' || actor.name.trim().length === 0) {
    throw new Error('COA audit actor name is required');
  }
  if (typeof actor.email !== 'string' || actor.email.trim().length === 0) {
    throw new Error('COA audit actor email is required');
  }
  return {
    ...input,
    actor: {
      name: actor.name.trim(),
      email: actor.email.trim(),
      role: String(actor.role || '').trim(),
    },
    createdAt: input.createdAt instanceof Date ? input.createdAt : new Date(),
  };
}

async function writeCoaAuditEvent(doc, event, actor, note, metadata, CoaAuditLogModel) {
  const AuditModel = CoaAuditLogModel || require('../models/CoaAuditLog');
  if (!doc || !doc._id) {
    throw new Error('COA audit event requires a COA document');
  }
  return AuditModel.create(buildCoaAuditEvent({
    coaId: doc._id,
    coaNo: doc.coaNo,
    petitionId: doc.petitionId,
    petitionNo: doc.petitionNoSnapshot,
    event,
    actor,
    note,
    metadata,
  }));
}

async function recordCoaLifecycleAction({
  doc,
  action,
  actor,
  note,
  metadata,
  CoaAuditLogModel,
} = {}) {
  if (!doc || !doc._id) {
    throw new Error('COA lifecycle action requires a COA document');
  }
  assertCanTransition(doc.status, action, actor);
  const eventForAction = lifecycleActionEvents[action];
  if (!eventForAction) {
    throw new Error(`Unknown COA action ${action}`);
  }
  return writeCoaAuditEvent(
    doc,
    eventForAction(doc.status),
    actor,
    note,
    { action, ...(metadata || {}) },
    CoaAuditLogModel,
  );
}

function assertCanEditSnapshots(status) {
  if (!editableSnapshotStatuses.has(status)) {
    throw new Error(`Cannot edit COA snapshots from ${status}`);
  }
}

function assertCanSupersede(sourceStatus) {
  if (!supersedableStatuses.has(sourceStatus)) {
    throw new Error(`Cannot supersede COA from ${sourceStatus}`);
  }
}

function buildSupersessionUpdate({ sourceCoaId, replacementCoaId, sourceStatus } = {}) {
  assertCanSupersede(sourceStatus);
  if (!sourceCoaId || !replacementCoaId) {
    throw new Error('COA supersession requires source and replacement IDs');
  }
  return {
    source: { status: 'superseded', supersededByCoaId: replacementCoaId },
    replacement: { status: 'reissued', supersedesCoaId: sourceCoaId },
  };
}

function resolveQuerySession(query, session) {
  return session && typeof query.session === 'function' ? query.session(session) : query;
}

async function applySupersession({ sourceCoaId, revisionCoaId, CoaDocumentModel, session } = {}) {
  const DocumentModel = CoaDocumentModel || require('../models/CoaDocument');
  if (!sourceCoaId || !revisionCoaId) {
    throw new Error('COA supersession requires source and revision IDs');
  }
  const ownedSession = session ? null : await startSupersessionSession(DocumentModel);
  const activeSession = session || ownedSession;
  if (!activeSession) {
    throw new Error('COA supersession requires a transaction session');
  }

  const runUpdates = async () => {
    const sourceDoc = await resolveQuerySession(DocumentModel.findById(sourceCoaId), activeSession)
      .select('status')
      .lean();
    if (!sourceDoc) {
      throw new Error('Source COA not found for supersession');
    }
    const updates = buildSupersessionUpdate({
      sourceCoaId,
      replacementCoaId: revisionCoaId,
      sourceStatus: sourceDoc.status,
    });
    const options = { session: activeSession, allowCoaIssuedSnapshotMutation: true };
    const source = await DocumentModel.updateOne(
      { _id: sourceCoaId },
      { $set: updates.source },
      options,
    );
    const revision = await DocumentModel.updateOne(
      { _id: revisionCoaId },
      { $set: updates.replacement },
      options,
    );
    return { source, revision };
  };

  try {
    if (typeof activeSession.withTransaction === 'function') {
      return await activeSession.withTransaction(runUpdates);
    }
    const result = await runUpdates();
    if (typeof activeSession.commitTransaction === 'function') {
      await activeSession.commitTransaction();
    }
    return result;
  } catch (error) {
    if (typeof activeSession.abortTransaction === 'function') {
      await activeSession.abortTransaction();
    }
    throw error;
  } finally {
    if (ownedSession && typeof ownedSession.endSession === 'function') {
      await ownedSession.endSession();
    }
  }
}

async function startSupersessionSession(DocumentModel) {
  if (typeof DocumentModel.startSession === 'function') {
    return DocumentModel.startSession();
  }
  if (DocumentModel.db && typeof DocumentModel.db.startSession === 'function') {
    return DocumentModel.db.startSession();
  }
  return null;
}

function canPrintStatus(status) {
  return activePrintableStatuses.has(status);
}

function actorFromBody(body = {}) {
  const u = body._user || body.actor || {};
  return {
    name: String(u.name || body.actorName || '').trim(),
    email: String(u.email || body.actorEmail || '').trim(),
    role: String(u.role || body.actorRole || '').trim(),
  };
}

module.exports = {
  COA_STATUSES,
  COA_AUDIT_EVENTS,
  activePrintableStatuses,
  canPrintStatus,
  isQcHead,
  assertCanTransition,
  assertValidCancellation,
  buildCoaAuditEvent,
  writeCoaAuditEvent,
  recordCoaLifecycleAction,
  assertCanEditSnapshots,
  assertCanSupersede,
  buildSupersessionUpdate,
  applySupersession,
  actorFromBody,
};
