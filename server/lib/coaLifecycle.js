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
const printableStatuses = new Set(transitions.print);
const activePrintableStatuses = Object.freeze({
  has: (status) => printableStatuses.has(status),
});

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

function canPrintStatus(status) {
  return printableStatuses.has(status);
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
  assertCanEditSnapshots,
  assertCanSupersede,
  buildSupersessionUpdate,
  actorFromBody,
};
