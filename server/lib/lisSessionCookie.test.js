const {
  COOKIE_NAME,
  createLisSessionCookieValue,
  clearLisSessionCookie,
  getLisSessionUserId,
  setLisSessionCookie,
  verifyLisSessionCookieValue,
} = require('./lisSessionCookie');

describe('LIS session cookie', () => {
  const secret = 'test-session-secret';
  const now = new Date('2026-08-17T00:00:00.000Z');

  test('signs and verifies the production SSO user id', () => {
    const value = createLisSessionCookieValue('user-123', { secret, now, ttlSeconds: 60 });

    expect(verifyLisSessionCookieValue(value, { secret, now })).toEqual({
      userId: 'user-123',
      expiresAt: Math.floor(now.getTime() / 1000) + 60,
    });
  });

  test('rejects tampered cookie values', () => {
    const value = createLisSessionCookieValue('user-123', { secret, now, ttlSeconds: 60 });
    const tampered = `${value.slice(0, -1)}${value.endsWith('x') ? 'y' : 'x'}`;

    expect(verifyLisSessionCookieValue(tampered, { secret, now })).toBeNull();
  });

  test('reads the signed user id from the request cookie header', () => {
    const value = createLisSessionCookieValue('user-123', { secret, now, ttlSeconds: 60 });
    const req = { headers: { cookie: `theme=dark; ${COOKIE_NAME}=${value}` } };

    expect(getLisSessionUserId(req, { secret, now })).toBe('user-123');
  });

  test('sets and clears an HttpOnly SameSite cookie', () => {
    const setHeader = jest.fn();
    const res = { setHeader };
    const req = { secure: true, get: jest.fn(() => 'https') };

    setLisSessionCookie(res, 'user-123', req, { secret, now, ttlSeconds: 60 });

    expect(setHeader).toHaveBeenCalledWith(
      'Set-Cookie',
      expect.stringContaining(`${COOKIE_NAME}=`),
    );
    expect(setHeader.mock.calls[0][1]).toEqual(expect.stringContaining('HttpOnly'));
    expect(setHeader.mock.calls[0][1]).toEqual(expect.stringContaining('SameSite=Lax'));
    expect(setHeader.mock.calls[0][1]).toEqual(expect.stringContaining('Secure'));

    clearLisSessionCookie(res, req);

    expect(setHeader.mock.calls[1][1]).toEqual(expect.stringContaining('Max-Age=0'));
  });
});
