const test = require('node:test');
const assert = require('node:assert/strict');
const {
  selectedItemsFromPetition,
  buildCoaSnapshots,
} = require('../lib/coaLifecycle');

test('selectedItemsFromPetition returns only requested item seqs in petition order', () => {
  const petition = {
    items: [
      { seq: 1, sampleName: 'A' },
      { seq: 2, sampleName: 'B' },
      { seq: 3, sampleName: 'C' },
    ],
  };

  assert.deepEqual(selectedItemsFromPetition(petition, [3, 1]).map((item) => item.seq), [1, 3]);
});

test('selectedItemsFromPetition rejects missing item seqs', () => {
  const petition = { items: [{ seq: 1, sampleName: 'A' }] };

  assert.throws(
    () => selectedItemsFromPetition(petition, [1, 9]),
    /Invalid COA item seqs: 9/,
  );
});

test('buildCoaSnapshots freezes selected sample and lab result data', () => {
  const snapshots = buildCoaSnapshots({
    petition: {
      petitionNo: 'P-2608-0001',
      submittedBy: { name: 'Petition Requester' },
      items: [
        { seq: 1, sampleName: 'Ignore', commonName: 'Ignore' },
        {
          seq: 2,
          sampleName: 'Selected',
          commonName: 'Selected Common',
          batchNo: 'B-2',
          lotNo: 'L-2',
          labelManufacturer: 'Manufacturer',
        },
      ],
    },
    labRequests: [{
      reportCustomerName: 'Report Customer',
      requester: { department: 'Quality', email: 'customer@example.com', phone: '1234' },
    }],
    parameters: [
      { _id: 'qc-parameter', scope: 'qc' },
      { _id: 'lab-parameter', scope: 'lab' },
    ],
    qcResults: [
      { itemSeq: 1, parameterId: 'lab-parameter', values: { Assay: 'Ignored' } },
      { itemSeq: 2, parameterId: 'qc-parameter', values: { Appearance: 'Ignored' } },
      { itemSeq: 2, parameterId: 'lab-parameter', values: { Assay: 99.5, Moisture: '' } },
    ],
    selectedItemSeqs: [2],
    groupMembership: {},
  });

  assert.equal(snapshots.petitionNoSnapshot, 'P-2608-0001');
  assert.deepEqual(snapshots.customerSnapshot, {
    name: 'Report Customer',
    company: 'บริษัท ไอ ซี พี ลัดดา จำกัด',
    department: 'Quality',
    email: 'customer@example.com',
    phone: '1234',
  });
  assert.deepEqual(snapshots.sampleSnapshots, [{
    itemSeq: 2,
    sampleName: 'Selected',
    commonName: 'Selected Common',
    batchNo: 'B-2',
    lotNo: 'L-2',
    productionDate: '',
    sampleId: '',
    condition: '',
    manufacturer: 'Manufacturer',
  }]);
  assert.deepEqual(snapshots.resultSnapshots, [
    { itemSeq: 2, testItem: 'Assay', result: '99.5', criteria: '-', method: '-', unit: '' },
    { itemSeq: 2, testItem: 'Moisture', result: '-', criteria: '-', method: '-', unit: '' },
  ]);
});
