const test = require('node:test');
const assert = require('node:assert');
const { normalizeActorFields } = require('./stockActor');

test('normalizeActorFields keeps a real submitted name', () => {
  assert.deepStrictEqual(
    normalizeActorFields(
      { email: 'analyst@icpladda.com', name: 'สมชาย' },
      { name: 'Fallback Name' },
    ),
    { email: 'analyst@icpladda.com', name: 'สมชาย' },
  );
});

test('normalizeActorFields uses stored user name when submitted name is missing', () => {
  assert.deepStrictEqual(
    normalizeActorFields(
      { email: 'analyst@icpladda.com', name: '' },
      { name: 'สมชาย' },
    ),
    { email: 'analyst@icpladda.com', name: 'สมชาย' },
  );
});

test('normalizeActorFields uses stored user name when submitted name is only the email', () => {
  assert.deepStrictEqual(
    normalizeActorFields(
      { email: 'analyst@icpladda.com', name: 'analyst@icpladda.com' },
      { name: 'สมชาย' },
    ),
    { email: 'analyst@icpladda.com', name: 'สมชาย' },
  );
});

test('normalizeActorFields does not treat an email-like value as a name', () => {
  assert.deepStrictEqual(
    normalizeActorFields(
      { email: 'analyst@icpladda.com', name: 'analyst@icpladda.com' },
      {},
    ),
    { email: 'analyst@icpladda.com', name: '' },
  );
});
