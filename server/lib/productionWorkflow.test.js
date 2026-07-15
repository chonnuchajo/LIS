const { buildProductionWorkflow } = require('./productionWorkflow');

describe('buildProductionWorkflow', () => {
  test('stores production request and LIS sent status', () => {
    const now = new Date('2026-07-15T04:00:00.000Z');

    expect(buildProductionWorkflow(
      { requestNo: 'SA260715023429', requesterEmail: 'chonnucha@icpladda.com' },
      'P26070001',
      now,
    )).toEqual({
      requestNo: 'SA260715023429',
      requesterEmail: 'chonnucha@icpladda.com',
      lisPetitionNo: 'P26070001',
      petitionNo: 'P26070001',
      lisStatus: 'sent',
      lisSent: true,
      sentAt: now,
    });
  });

  test('skips workflow when production request number is absent', () => {
    expect(buildProductionWorkflow({}, 'P26070001')).toBeUndefined();
  });
});
