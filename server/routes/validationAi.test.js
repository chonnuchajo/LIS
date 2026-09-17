jest.mock('../lib/lisSessionCookie', () => ({ getLisSessionUserId: jest.fn() }));
jest.mock('../lib/validationAi', () => ({ ...jest.requireActual('../lib/validationAi'), runValidationAi: jest.fn() }));
const { getLisSessionUserId } = require('../lib/lisSessionCookie');
const { runValidationAi } = require('../lib/validationAi');
const handler = require('./validationAi').stack.find(layer => layer.route).route.stack[0].handle;
const oldKey = process.env.OPENAI_API_KEY;
beforeEach(() => { jest.clearAllMocks(); process.env.OPENAI_API_KEY = 'test-key-not-real'; });
afterAll(() => { if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey; });
function response() { return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }
test('unauthenticated callers cannot invoke the provider', async () => {
  getLisSessionUserId.mockReturnValue(null);
  const res = response(); await handler({ ip: '203.0.113.1', body: { mode: 'review', text: 'test' } }, res);
  expect(res.statusCode).toBe(401); expect(runValidationAi).not.toHaveBeenCalled();
});
test('validates before invoking provider and limits bursts', async () => {
  getLisSessionUserId.mockReturnValue('test-session');
  const invalid = response(); await handler({ body: { mode: 'review', text: '' } }, invalid);
  expect(invalid.statusCode).toBe(400); expect(runValidationAi).not.toHaveBeenCalled();
  runValidationAi.mockResolvedValue({ summary: 'ร่าง', warnings: [], rows: [] });
  for (let i = 0; i < 6; i++) { const res = response(); await handler({ body: { mode: 'review', text: 'test' } }, res); expect(res.statusCode).toBe(200); }
  const limited = response(); await handler({ body: { mode: 'review', text: 'test' } }, limited);
  expect(limited.statusCode).toBe(429); expect(runValidationAi).toHaveBeenCalledTimes(6);
});
