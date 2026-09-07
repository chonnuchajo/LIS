const stockRouter = require('../stock');

describe('stock transaction filter', () => {
  test('searches deduction history by substance or requester text', () => {
    const filter = stockRouter.buildTransactionFilter({
      action: 'deduct',
      search: 'somchai',
    });

    expect(filter).toMatchObject({ action: 'deduct' });
    expect(filter.$and).toEqual([
      {
        $or: [
          { itemName: /somchai/i },
          { itemCode: /somchai/i },
          { userName: /somchai/i },
          { userEmail: /somchai/i },
        ],
      },
    ]);
  });

  test('keeps requester filter separate when user is passed', () => {
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
          { userName: /methanol/i },
          { userEmail: /methanol/i },
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
