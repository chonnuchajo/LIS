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
});
