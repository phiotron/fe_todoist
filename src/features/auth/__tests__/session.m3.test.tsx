import { act, renderHook, waitFor } from '@testing-library/react-native';
import { apiFetch } from '../../../api/client';
import { tokenStore } from '../../../lib/tokenStore';
import { CHALLENGE_TTL_MS, TwoFactorExpiredError, TwoFactorMissingError } from '../../two-factor/twoFactorToken';
import { authResponse, testUser } from '../../../test/fixtures';
import { countRequests, jsonResponse, mockFetch, problem, requestAt } from '../../../test/http';
import { deferred, routeFetch } from '../../../test/m3Routes';
import { createTestQueryClient, createWrapper } from '../../../test/render';
import { meQueryKey, useSession } from '../session';

const LOGIN = { email: 'an@example.com', password: 'fixture-pass-1' };
const twoFactorRequired = () =>
  problem(401, 'Unauthorized', { code: 'two-factor-required', twoFactorToken: 'challenge-1' });

async function renderSignedOutSession(routes: Parameters<typeof routeFetch>[1]) {
  await tokenStore.clear();
  const fetchMock = mockFetch();
  routeFetch(fetchMock, routes);
  const queryClient = createTestQueryClient();
  const hook = await renderHook(() => useSession(), { wrapper: createWrapper(queryClient) });
  await waitFor(() => expect(hook.result.current.status).toBe('signedOut'));
  return { ...hook, fetchMock, queryClient };
}

describe('session — M3 two-factor and local sign-out', () => {
  afterEach(() => jest.restoreAllMocks());

  it('signIn resolves "signedIn" when there is no second factor', async () => {
    const { result } = await renderSignedOutSession({
      'POST /api/v1/auth/login': () => jsonResponse(200, authResponse('acc-1', 'ref-1')),
    });
    let outcome = '';
    await act(async () => {
      outcome = await result.current.signIn(LOGIN);
    });
    expect(outcome).toBe('signedIn');
    expect(result.current.status).toBe('signedIn');
    expect(result.current.pendingTwoFactor).toBe(false);
  });

  it('signIn resolves "twoFactorRequired" on 401 two-factor-required: no tokens saved, still signed out', async () => {
    const { result } = await renderSignedOutSession({ 'POST /api/v1/auth/login': twoFactorRequired });
    let outcome = '';
    await act(async () => {
      outcome = await result.current.signIn(LOGIN);
    });
    expect(outcome).toBe('twoFactorRequired');
    expect(result.current.status).toBe('signedOut');
    expect(result.current.pendingTwoFactor).toBe(true);
    await expect(tokenStore.getAccessToken()).resolves.toBeNull();
  });

  it('a wrong password is still an error, not a two-factor outcome', async () => {
    const { result } = await renderSignedOutSession({ 'POST /api/v1/auth/login': () => problem(401, 'Unauthorized') });
    await act(async () => {
      await expect(result.current.signIn(LOGIN)).rejects.toMatchObject({ status: 401 });
    });
    expect(result.current.pendingTwoFactor).toBe(false);
  });

  it('verifyTwoFactor sends the held token with the code, completes the sign-in and forgets the token', async () => {
    const { result, fetchMock, queryClient } = await renderSignedOutSession({
      'POST /api/v1/auth/login': twoFactorRequired,
      'POST /api/v1/auth/2fa/verify': () => jsonResponse(200, authResponse('acc-2', 'ref-2')),
    });
    await act(async () => {
      await result.current.signIn(LOGIN);
    });

    await act(async () => {
      await result.current.verifyTwoFactor('123456');
    });

    expect(result.current.status).toBe('signedIn');
    expect(result.current.pendingTwoFactor).toBe(false);
    expect(requestAt(fetchMock, 1).body).toEqual({ twoFactorToken: 'challenge-1', code: '123456' });
    expect(requestAt(fetchMock, 1).headers.Authorization).toBeUndefined();
    await expect(tokenStore.getAccessToken()).resolves.toBe('acc-2');
    expect(queryClient.getQueryData(meQueryKey)).toEqual(testUser);
  });

  it('two-factor-token-invalid (401) ends the challenge: expired, unknown or already used token, and it is never sent again', async () => {
    const { result, fetchMock } = await renderSignedOutSession({
      'POST /api/v1/auth/login': twoFactorRequired,
      'POST /api/v1/auth/2fa/verify': () => problem(401, 'Unauthorized', { code: 'two-factor-token-invalid' }),
    });
    await act(async () => {
      await result.current.signIn(LOGIN);
    });

    await act(async () => {
      await expect(result.current.verifyTwoFactor('123456')).rejects.toMatchObject({
        status: 401,
        code: 'two-factor-token-invalid',
      });
    });

    expect(result.current.pendingTwoFactor).toBe(false);
    expect(result.current.status).toBe('signedOut');
    await act(async () => {
      await expect(result.current.verifyTwoFactor('123456')).rejects.toBeInstanceOf(TwoFactorMissingError);
    });
    expect(countRequests(fetchMock, '/api/v1/auth/2fa/verify')).toBe(1);
  });

  it('a wrong code (401 two-factor-code-invalid) does not spend the token: the challenge stays and the right code then signs in', async () => {
    let answers = 0;
    const { result, fetchMock } = await renderSignedOutSession({
      'POST /api/v1/auth/login': twoFactorRequired,
      'POST /api/v1/auth/2fa/verify': () => {
        answers += 1;
        return answers === 1
          ? problem(401, 'Unauthorized', { code: 'two-factor-code-invalid' })
          : jsonResponse(200, authResponse('acc-2', 'ref-2'));
      },
    });
    await act(async () => {
      await result.current.signIn(LOGIN);
    });

    await act(async () => {
      await expect(result.current.verifyTwoFactor('000000')).rejects.toMatchObject({
        status: 401,
        code: 'two-factor-code-invalid',
      });
    });
    expect(result.current.pendingTwoFactor).toBe(true);
    expect(result.current.status).toBe('signedOut');

    await act(async () => {
      await result.current.verifyTwoFactor('123456');
    });
    expect(result.current.status).toBe('signedIn');
    expect(requestAt(fetchMock, 1).body).toEqual({ twoFactorToken: 'challenge-1', code: '000000' });
    expect(requestAt(fetchMock, 2).body).toEqual({ twoFactorToken: 'challenge-1', code: '123456' });
  });

  it('a 400 validation error (empty or over-long code) is not "token spent": the challenge stays', async () => {
    const { result } = await renderSignedOutSession({
      'POST /api/v1/auth/login': twoFactorRequired,
      'POST /api/v1/auth/2fa/verify': () =>
        problem(400, 'Bad Request', { errors: [{ field: 'code', message: 'size must be between 1 and 32' }] }),
    });
    await act(async () => {
      await result.current.signIn(LOGIN);
    });

    await act(async () => {
      await expect(result.current.verifyTwoFactor('x'.repeat(33))).rejects.toMatchObject({ status: 400 });
    });

    expect(result.current.pendingTwoFactor).toBe(true);
  });

  it('an answer that says nothing about the token (429) keeps the challenge, and the same token can be sent again', async () => {
    let answers = 0;
    const { result, fetchMock } = await renderSignedOutSession({
      'POST /api/v1/auth/login': twoFactorRequired,
      'POST /api/v1/auth/2fa/verify': () => {
        answers += 1;
        return answers === 1 ? problem(429, 'Too Many Requests') : jsonResponse(200, authResponse('acc-2', 'ref-2'));
      },
    });
    await act(async () => {
      await result.current.signIn(LOGIN);
    });

    await act(async () => {
      await expect(result.current.verifyTwoFactor('123456')).rejects.toMatchObject({ status: 429 });
    });
    expect(result.current.pendingTwoFactor).toBe(true);

    await act(async () => {
      await result.current.verifyTwoFactor('123456');
    });
    expect(result.current.status).toBe('signedIn');
    expect(requestAt(fetchMock, 2).body).toEqual({ twoFactorToken: 'challenge-1', code: '123456' });
  });

  it('sends one request per token even when verifyTwoFactor is called twice while the first is in flight', async () => {
    const answer = deferred<Response>();
    const { result, fetchMock } = await renderSignedOutSession({
      'POST /api/v1/auth/login': twoFactorRequired,
      'POST /api/v1/auth/2fa/verify': () => answer.promise,
    });
    await act(async () => {
      await result.current.signIn(LOGIN);
    });

    let first: Promise<void> = Promise.resolve();
    let second: Promise<void> = Promise.resolve();
    await act(async () => {
      first = result.current.verifyTwoFactor('123456');
      second = result.current.verifyTwoFactor('123456');
    });
    expect(countRequests(fetchMock, '/api/v1/auth/2fa/verify')).toBe(1);

    await act(async () => {
      answer.resolve(jsonResponse(200, authResponse('acc-2', 'ref-2')));
      await Promise.all([first, second]);
    });
    expect(result.current.status).toBe('signedIn');
    expect(countRequests(fetchMock, '/api/v1/auth/2fa/verify')).toBe(1);
  });

  it('after a successful verification the token is forgotten and cannot be sent again', async () => {
    const { result, fetchMock } = await renderSignedOutSession({
      'POST /api/v1/auth/login': twoFactorRequired,
      'POST /api/v1/auth/2fa/verify': () => jsonResponse(200, authResponse('acc-2', 'ref-2')),
    });
    await act(async () => {
      await result.current.signIn(LOGIN);
    });
    await act(async () => {
      await result.current.verifyTwoFactor('123456');
    });

    await act(async () => {
      await expect(result.current.verifyTwoFactor('123456')).rejects.toBeInstanceOf(TwoFactorMissingError);
    });
    expect(countRequests(fetchMock, '/api/v1/auth/2fa/verify')).toBe(1);
  });

  it('verifyTwoFactor without a pending challenge rejects, and so does one older than 5 minutes', async () => {
    const { result } = await renderSignedOutSession({ 'POST /api/v1/auth/login': twoFactorRequired });
    await act(async () => {
      await expect(result.current.verifyTwoFactor('123456')).rejects.toBeInstanceOf(TwoFactorMissingError);
    });

    const start = Date.now();
    await act(async () => {
      await result.current.signIn(LOGIN);
    });
    jest.spyOn(Date, 'now').mockReturnValue(start + CHALLENGE_TTL_MS + 1);
    await act(async () => {
      await expect(result.current.verifyTwoFactor('123456')).rejects.toBeInstanceOf(TwoFactorExpiredError);
    });
    expect(result.current.pendingTwoFactor).toBe(false);
  });

  it('cancelTwoFactor forgets the challenge', async () => {
    const { result } = await renderSignedOutSession({ 'POST /api/v1/auth/login': twoFactorRequired });
    await act(async () => {
      await result.current.signIn(LOGIN);
    });
    await act(async () => {
      result.current.cancelTwoFactor();
    });
    expect(result.current.pendingTwoFactor).toBe(false);
  });

  it('endLocalSession signs this device out without calling the server', async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    const fetchMock = mockFetch();
    routeFetch(fetchMock, { 'GET /api/v1/me': () => jsonResponse(200, testUser) });
    const { result } = await renderHook(() => useSession(), { wrapper: createWrapper(createTestQueryClient()) });
    await waitFor(() => expect(result.current.status).toBe('signedIn'));

    await act(async () => {
      await result.current.endLocalSession();
    });

    expect(result.current.status).toBe('signedOut');
    await expect(tokenStore.getAccessToken()).resolves.toBeNull();
    expect(countRequests(fetchMock, '/api/v1/auth/logout')).toBe(0);
  });

  it('endLocalSession closes the API session epoch before clearing tokens (the order M1 tests for signOut)', async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    const order: string[] = [];
    jest.spyOn(apiFetch, 'resetSession').mockImplementation(async () => {
      order.push('reset');
    });
    const realClear = tokenStore.clear;
    jest.spyOn(tokenStore, 'clear').mockImplementation(async () => {
      order.push('clear');
      await realClear();
    });
    const fetchMock = mockFetch();
    routeFetch(fetchMock, { 'GET /api/v1/me': () => jsonResponse(200, testUser) });
    const { result } = await renderHook(() => useSession(), { wrapper: createWrapper(createTestQueryClient()) });
    await waitFor(() => expect(result.current.status).toBe('signedIn'));
    order.length = 0; // only the sign-out sequence is under test

    await act(async () => {
      await result.current.endLocalSession();
    });

    expect(order).toEqual(['reset', 'clear']);
    expect(result.current.status).toBe('signedOut');
    expect(countRequests(fetchMock, '/api/v1/auth/logout')).toBe(0);
  });
});
