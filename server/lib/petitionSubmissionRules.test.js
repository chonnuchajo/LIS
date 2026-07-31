const test = require('node:test');
const assert = require('node:assert');
const {
  isResearchAndDevelopmentDepartment,
  requiresDeliveryAndBatch,
  requiresQcTrack,
  validatePetitionSubmission,
} = require('./petitionSubmissionRules');

test('isResearchAndDevelopmentDepartment accepts R & D department variants', () => {
  assert.strictEqual(isResearchAndDevelopmentDepartment('R & D'), true);
  assert.strictEqual(isResearchAndDevelopmentDepartment('r&d'), true);
  assert.strictEqual(isResearchAndDevelopmentDepartment('R and D'), false);
});

test('requiresDeliveryAndBatch is false only for R & D submitters', () => {
  assert.strictEqual(requiresDeliveryAndBatch({ submittedBy: { department: 'R & D' } }), false);
  assert.strictEqual(requiresDeliveryAndBatch({ submittedBy: { department: 'Production' } }), true);
  assert.strictEqual(requiresDeliveryAndBatch({}), true);
});

test('requiresQcTrack is false only for R & D submitters', () => {
  assert.strictEqual(requiresQcTrack({ submittedBy: { department: 'R & D' } }), false);
  assert.strictEqual(requiresQcTrack({ submittedBy: { department: 'Production' } }), true);
  assert.strictEqual(requiresQcTrack({}), true);
});

test('validatePetitionSubmission allows R & D submissions without deliverer or batch', () => {
  assert.strictEqual(validatePetitionSubmission({
    dept: 'production',
    submittedBy: { name: 'Research User', department: 'R & D' },
    items: [{ seq: 1, sampleName: 'Sample A', batchNo: '' }],
  }), null);
});

test('validatePetitionSubmission still requires deliverer and batch for non-R&D submissions', () => {
  assert.match(validatePetitionSubmission({
    dept: 'production',
    submittedBy: { name: 'Production User', department: 'Production' },
    items: [{ seq: 1, sampleName: 'Sample A', batchNo: '' }],
  }), /นำส่ง/);

  assert.match(validatePetitionSubmission({
    dept: 'production',
    submittedBy: { name: 'Production User', department: 'Production' },
    deliveredBy: { name: 'Runner' },
    items: [{ seq: 1, sampleName: 'Sample A', batchNo: '' }],
  }), /แบช/);
});
