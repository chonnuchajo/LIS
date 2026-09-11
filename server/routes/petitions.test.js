const test = require('node:test');
const assert = require('node:assert/strict');
const router = require('./petitions');
const Petition = require('../models/Petition');
const DocumentNumberConfig = require('../models/DocumentNumberConfig');

function handler(path, method) {
  const layer = router.stack.find((entry) => entry.route
    && entry.route.path === path
    && entry.route.methods[method]);
  return layer.route.stack[0].handle;
}

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

async function invoke(path, method, { body = {}, params = {} } = {}) {
  const res = response();
  await handler(path, method)({ body, params }, res);
  return res;
}

test('POST / rejects sendToLab override without item note before creating petition', async () => {
  const originals = {
    configFindOne: DocumentNumberConfig.findOne,
    petitionFindOne: Petition.findOne,
    petitionCreate: Petition.create,
  };
  let createCalled = false;
  try {
    DocumentNumberConfig.findOne = () => ({ lean: async () => null });
    Petition.findOne = () => ({ sort: () => ({ lean: async () => null }) });
    Petition.create = async () => {
      createCalled = true;
      throw new Error('create should not be called');
    };

    const res = await invoke('/', 'post', {
      body: {
        dept: 'production',
        submittedBy: { name: 'Production User', department: 'Production' },
        deliveredBy: { name: 'Runner' },
        items: [{ seq: 2, sampleName: 'Sample B', batchNo: 'B-002', sendToLab: true, note: '' }],
      },
    });

    assert.equal(res.statusCode, 400);
    assert.match(res.body.error.message, /หมายเหตุ/);
    assert.equal(createCalled, false);
  } finally {
    DocumentNumberConfig.findOne = originals.configFindOne;
    Petition.findOne = originals.petitionFindOne;
    Petition.create = originals.petitionCreate;
  }
});

test('PATCH /:id rejects sendToLab override without item note before updating petition', async () => {
  const originals = {
    petitionFindById: Petition.findById,
    petitionFindByIdAndUpdate: Petition.findByIdAndUpdate,
  };
  let updateCalled = false;
  try {
    Petition.findById = async () => ({
      _id: 'petition-1',
      petitionNo: 'P-2609-0001',
      dept: 'production',
      status: 'deliveringQC',
      submittedBy: { name: 'Production User', department: 'Production' },
      deliveredBy: { name: 'Runner' },
      items: [{ seq: 1, sampleName: 'Sample A', batchNo: 'B-001' }],
      toObject() {
        return { ...this };
      },
    });
    Petition.findByIdAndUpdate = async () => {
      updateCalled = true;
      throw new Error('update should not be called');
    };

    const res = await invoke('/:id', 'patch', {
      params: { id: 'petition-1' },
      body: {
        dept: 'production',
        submittedBy: { name: 'Production User', department: 'Production' },
        deliveredBy: { name: 'Runner' },
        items: [{ seq: 1, sampleName: 'Sample A', batchNo: 'B-001', sendToLab: false, note: '' }],
      },
    });

    assert.equal(res.statusCode, 400);
    assert.match(res.body.error.message, /หมายเหตุ/);
    assert.equal(updateCalled, false);
  } finally {
    Petition.findById = originals.petitionFindById;
    Petition.findByIdAndUpdate = originals.petitionFindByIdAndUpdate;
  }
});
