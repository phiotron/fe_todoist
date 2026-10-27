import { tokenStore } from '../../lib/tokenStore';
import { authResponse } from '../../test/fixtures';
import { countRequests, jsonResponse, mockFetch, problem, requestAt } from '../../test/http';
import { twoFactorApi } from '../twoFactor';

const CODES = Array.from({ length: 10 }, (_, index) => `fixture-recovery-${index + 1}`);

describe('twoFactorApi', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('status reads GET /me/2fa with the bearer token', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { enabled: false, recoveryCodesLeft: 0 }));

    await expect(twoFactorApi.status()).resolves.toEqual({ enabled: false, recoveryCodesLeft: 0 });

    const request = requestAt(fetchMock, 0);
    expect(request.method).toBe('GET');
    expect(request.url).toMatch(/\/api\/v1\/me\/2fa$/);
    expect(request.headers.Authorization).toBe('Bearer acc-1');
  });

  it('setup POSTs /me/2fa/setup and returns the secret and the otpauth URI', async () => {
    const fetchMock = mockFetch();
    const setup = { secret: 'FIXTURESECRET', otpauthUri: 'otpauth://totp/Taskly:an%40example.com?secret=FIXTURESECRET' };
    fetchMock.mockResolvedValueOnce(jsonResponse(200, setup));

    await expect(twoFactorApi.setup()).resolves.toEqual(setup);

    expect(requestAt(fetchMock, 0).method).toBe('POST');
    expect(requestAt(fetchMock, 0).url).toMatch(/\/api\/v1\/me\/2fa\/setup$/);
  });

  it('enable and regenerateRecoveryCodes send the code and return 10 codes', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockImplementation(async () => jsonResponse(200, { recoveryCodes: CODES }));

    await expect(twoFactorApi.enable({ code: '123456' })).resolves.toEqual({ recoveryCodes: CODES });
    await expect(twoFactorApi.regenerateRecoveryCodes({ code: '123456' })).resolves.toEqual({ recoveryCodes: CODES });

    expect(requestAt(fetchMock, 0).url).toMatch(/\/api\/v1\/me\/2fa\/enable$/);
    expect(requestAt(fetchMock, 0).body).toEqual({ code: '123456' });
    expect(requestAt(fetchMock, 1).url).toMatch(/\/api\/v1\/me\/2fa\/recovery-codes$/);
    expect(requestAt(fetchMock, 1).body).toEqual({ code: '123456' });
  });

  it('disable POSTs the password and the code', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse(204));

    await expect(twoFactorApi.disable({ password: 'fixture-pass-1', code: '123456' })).resolves.toBeUndefined();

    expect(requestAt(fetchMock, 0).url).toMatch(/\/api\/v1\/me\/2fa\/disable$/);
    expect(requestAt(fetchMock, 0).body).toEqual({ password: 'fixture-pass-1', code: '123456' });
  });

  it('a wrong code (400) on a signed-in 2FA call never triggers a refresh', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(problem(400, 'Bad Request'));

    await expect(twoFactorApi.enable({ code: '000000' })).rejects.toMatchObject({ status: 400 });
    expect(countRequests(fetchMock, '/api/v1/auth/refresh')).toBe(0);
  });

  it('verify is public: no bearer token, and a 401 is passed through without refreshing', async () => {
    const fetchMock = mockFetch();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, authResponse('acc-2', 'ref-2')))
      .mockResolvedValueOnce(problem(401, 'Unauthorized', { code: 'two-factor-code-invalid' }));

    await expect(twoFactorApi.verify({ twoFactorToken: 'challenge-1', code: '123456' })).resolves.toMatchObject({
      accessToken: 'acc-2',
    });
    await expect(twoFactorApi.verify({ twoFactorToken: 'challenge-1', code: '000000' })).rejects.toMatchObject({
      status: 401,
      code: 'two-factor-code-invalid',
    });

    const request = requestAt(fetchMock, 0);
    expect(request.url).toMatch(/\/api\/v1\/auth\/2fa\/verify$/);
    expect(request.body).toEqual({ twoFactorToken: 'challenge-1', code: '123456' });
    expect(request.headers.Authorization).toBeUndefined();
    expect(countRequests(fetchMock, '/api/v1/auth/refresh')).toBe(0);
  });
});
