const stockRouter = require('../stock');

describe('stock transaction filter', () => {
  test('filters deduction history by substance text and requester text', () => {
    const filter = stockRouter.buildTransactionFilter({
      action: 'deduct',
      search: 'methanol',
      user: 'somchai',
    });

    expect(filter).toMatchObject({ action: 'deduct' });
    expect(filter.$and).toEqual([
      {
        $or: [
          { itemName: /methanol/i },
          { itemCode: /methanol/i },
        ],
      },
      {
        $or: [
          { userName: /somchai/i },
          { userEmail: /somchai/i },
        ],
      },
    ]);
  });
});
