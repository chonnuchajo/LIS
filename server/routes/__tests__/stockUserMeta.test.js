const stockRouter = require('../stock');
const User = require('../../models/User');

describe('stock user metadata', () => {
  const originalFindOne = User.findOne;

  afterEach(() => {
    User.findOne = originalFindOne;
  });

  test('resolves logged-in user from X-LIS-User header', async () => {
    User.findOne = jest.fn(() => ({
      lean: jest.fn().mockResolvedValue({
        email: 'analyst@icpladda.com',
        name: 'สมชาย',
      }),
    }));

    const meta = await stockRouter.userMeta({
      body: {},
      headers: { 'x-lis-user': 'Analyst@ICPLadda.com' },
    });

    expect(User.findOne).toHaveBeenCalledWith({ email: 'analyst@icpladda.com' });
    expect(meta).toEqual({ userEmail: 'analyst@icpladda.com', userName: 'สมชาย' });
  });

  test('allows deduction management only for owner on the same Bangkok day', () => {
    const now = new Date('2026-08-28T10:00:00+07:00');

    expect(stockRouter.canManageOwnTodayDeduction?.({
      action: 'deduct',
      userEmail: 'Analyst@ICPLadda.com',
      createdAt: '2026-08-28T02:00:00.000Z',
    }, 'analyst@icpladda.com', now)).toBe(true);

    expect(stockRouter.canManageOwnTodayDeduction?.({
      action: 'deduct',
      userEmail: 'other@icpladda.com',
      createdAt: '2026-08-28T02:00:00.000Z',
    }, 'analyst@icpladda.com', now)).toBe(false);

    expect(stockRouter.canManageOwnTodayDeduction?.({
      action: 'deduct',
      userEmail: 'analyst@icpladda.com',
      createdAt: '2026-08-27T16:59:59.000Z',
    }, 'analyst@icpladda.com', now)).toBe(false);
  });

  test('allows admin and lab inventory to manage anyone within seven Bangkok days', () => {
    const now = new Date('2026-08-28T10:00:00+07:00');
    const row = {
      action: 'deduct',
      userEmail: 'other@icpladda.com',
      createdAt: '2026-08-22T02:00:00.000Z',
    };

    expect(stockRouter.canManageStockDeduction?.(row, { email: 'admin@icpladda.com', roles: ['admin'] }, now)).toBe(true);
    expect(stockRouter.canManageStockDeduction?.(row, { email: 'stock@icpladda.com', roles: ['lab-inventory'] }, now)).toBe(true);
    expect(stockRouter.canManageStockDeduction?.(row, { email: 'analyst@icpladda.com', roles: ['lab-analyze'] }, now)).toBe(false);
  });

  test('blocks admin and lab inventory after seven days', () => {
    const now = new Date('2026-08-28T10:00:00+07:00');

    expect(stockRouter.canManageStockDeduction?.({
      action: 'deduct',
      userEmail: 'other@icpladda.com',
      createdAt: '2026-08-20T02:00:00.000Z',
    }, { email: 'admin@icpladda.com', roles: ['admin'] }, now)).toBe(false);
  });
});
