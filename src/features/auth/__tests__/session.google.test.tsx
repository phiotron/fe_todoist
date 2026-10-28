import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { tokenStore } from '../../../lib/tokenStore';
import { authResponse, testUser } from '../../../test/fixtures';
import { countRequests, jsonResponse, mockFetch, problem, requestAt, type FetchMock } from '../../../test/http';
import { routeFetch, type RouteHandler } from '../../../test/m3Routes';
import { createTestQueryClient, createWrapper } from '../../../test/render';
import { meQueryKey, useSession, type GoogleLinkOutcome, type GoogleSignInOutcome } from '../session';

const GOOGLE = 'POST /api/v1/auth/google';
const LOGIN = 'POST /api/v1/auth/login';
const VERIFY = 'POST /api/v1/auth/2fa/verify';
const IDENTITY = 'POST /api/v1/me/identities/google';
const IDENTITY_PATH = '/api/v1/me/identities/google';
const LINK_REQUIRED = { code: 'link-required', linkToken: 'lt-1' };
const TWO_FACTOR_REQUIRED = { code: 'two-factor-required', twoFactorToken: 'tf-1' };
const PASSWORD = { email: testUser.email, password: 'fixture-pass-1' };

/** Answers the n-th call with the n-th handler (the last one repeats): one route called twice with different answers. */
function sequence(...handlers: RouteHandler[]): RouteHandler {
  let calls = 0;
  return (request) => handlers[Math.min(calls++, handlers.length - 1)](request);
}

async function renderSession(routes: Record<string, RouteHandler>) {
  await tokenStore.clear();
  const fetchMock = mockFetch();
  routeFetch(fetchMock, routes);
  const queryClient = createTestQueryClient();
  const hook = await renderHook(() => useSession(), { wrapper: createWrapper(queryClient) });
  await waitFor(() => expect(hook.result.current.status).toBe('signedOut'));
  return { queryClient, fetchMock, ...hook };
}

/** The first request sent to `path` (robust against extra requests M1/M3 may add after sign-in). */
function requestTo(fetchMock: FetchMock, path: string) {
  const index = fetchMock.mock.calls.findIndex(([input]) => String(input).endsWith(path));
  expect(index).toBeGreaterThanOrEqual(0);
  return requestAt(fetchMock, index);
}

describe('SessionProvider — Google', () => {
  it('signInWithGoogle stores the tokens, caches the user and signs in', async () => {
    const { result, queryClient, fetchMock } = await renderSession({
      [GOOGLE]: () => jsonResponse(200, authResponse('acc-g', 'ref-g')),
    });

    let outcome: GoogleSignInOutcome | undefined;
    await act(async () => {
      outcome = await result.current.signInWithGoogle({ idToken: 'gid-1', email: testUser.email });
    });

    expect(outcome).toBe('signedIn');
    expect(requestAt(fetchMock, 0).url).toMatch(/\/api\/v1\/auth\/google$/);
    expect(requestAt(fetchMock, 0).body).toEqual({ idToken: 'gid-1' });
    expect(result.current.status).toBe('signedIn');
    expect(result.current.pendingGoogleLink).toBeNull();
    expect(queryClient.getQueryData(meQueryKey)).toEqual(testUser);
    await expect(tokenStore.getAccessToken()).resolves.toBe('acc-g');
  });

  it('409 link-required keeps the linkToken in memory only and stays signed out', async () => {
    const { result } = await renderSession({ [GOOGLE]: () => problem(409, 'Conflict', LINK_REQUIRED) });

    let outcome: GoogleSignInOutcome | undefined;
    await act(async () => {
      outcome = await result.current.signInWithGoogle({ idToken: 'gid-1', email: testUser.email });
    });

    expect(outcome).toBe('linkRequired');
    expect(result.current.status).toBe('signedOut');
    expect(result.current.pendingGoogleLink).toEqual({ linkToken: 'lt-1', email: testUser.email });
    await expect(tokenStore.getAccessToken()).resolves.toBeNull();
    // Memory only: nothing is written to SecureStore.
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it.each([
    ['403 email not verified', () => problem(403, 'Forbidden')],
    ['401 invalid ID token', () => problem(401, 'Unauthorized')],
    ['409 with a linkToken but without the link-required code', () => problem(409, 'Conflict', { linkToken: 'lt-1' })],
    ['409 link-required without linkToken', () => problem(409, 'Conflict', { code: 'link-required' })],
  ])('rethrows %s without a pending link or tokens', async (_label, failure) => {
    const { result, fetchMock } = await renderSession({ [GOOGLE]: failure });

    await act(async () => {
      await expect(result.current.signInWithGoogle({ idToken: 'gid-1', email: null })).rejects.toMatchObject({
        status: expect.any(Number),
      });
    });

    expect(result.current.status).toBe('signedOut');
    expect(result.current.pendingGoogleLink).toBeNull();
    expect(countRequests(fetchMock, '/api/v1/auth/refresh')).toBe(0);
  });

  it('401 two-factor-required hands the twoFactorToken to the M3 two-factor step', async () => {
    const { result, fetchMock } = await renderSession({
      [GOOGLE]: () => problem(401, 'Unauthorized', TWO_FACTOR_REQUIRED),
      [VERIFY]: () => jsonResponse(200, authResponse('acc-2f', 'ref-2f')),
    });

    let outcome: GoogleSignInOutcome | undefined;
    await act(async () => {
      outcome = await result.current.signInWithGoogle({ idToken: 'gid-1', email: testUser.email });
    });

    expect(outcome).toBe('twoFactorRequired');
    expect(result.current.status).toBe('signedOut');
    expect(result.current.pendingGoogleLink).toBeNull();
    expect(result.current.pendingTwoFactor).toBe(true);
    expect(countRequests(fetchMock, '/api/v1/auth/refresh')).toBe(0);
    await expect(tokenStore.getAccessToken()).resolves.toBeNull();

    // The user types the code on the M3 two-factor screen.
    await act(async () => {
      await result.current.verifyTwoFactor('123456');
    });

    expect(requestTo(fetchMock, '/api/v1/auth/2fa/verify').body).toEqual({ twoFactorToken: 'tf-1', code: '123456' });
    expect(result.current.status).toBe('signedIn');
    await expect(tokenStore.getAccessToken()).resolves.toBe('acc-2f');
  });

  it('a Google sign-in that needs 2FA drops an earlier pending link', async () => {
    const { result } = await renderSession({
      [GOOGLE]: sequence(
        () => problem(409, 'Conflict', LINK_REQUIRED),
        () => problem(401, 'Unauthorized', TWO_FACTOR_REQUIRED),
      ),
    });

    await act(async () => {
      await result.current.signInWithGoogle({ idToken: 'gid-1', email: testUser.email });
    });
    let outcome: GoogleSignInOutcome | undefined;
    await act(async () => {
      outcome = await result.current.signInWithGoogle({ idToken: 'gid-2', email: 'other@example.com' });
    });

    expect(outcome).toBe('twoFactorRequired');
    expect(result.current.pendingGoogleLink).toBeNull();
  });

  it('after a password sign-in, completeGoogleLink posts the linkToken with the new bearer token', async () => {
    const { result, fetchMock } = await renderSession({
      [GOOGLE]: () => problem(409, 'Conflict', LINK_REQUIRED),
      [LOGIN]: () => jsonResponse(200, authResponse('acc-2', 'ref-2')),
      [IDENTITY]: () => jsonResponse(204),
      'GET /api/v1/me': () => jsonResponse(200, testUser),
    });

    await act(async () => {
      await result.current.signInWithGoogle({ idToken: 'gid-1', email: testUser.email });
    });
    await act(async () => {
      await result.current.signIn(PASSWORD);
    });
    let link: GoogleLinkOutcome | undefined;
    await act(async () => {
      link = await result.current.completeGoogleLink();
    });

    expect(link).toEqual({ type: 'linked' });
    const request = requestTo(fetchMock, IDENTITY_PATH);
    expect(request.method).toBe('POST');
    expect(request.body).toEqual({ linkToken: 'lt-1' });
    expect(request.headers.Authorization).toBe('Bearer acc-2');
    expect(result.current.pendingGoogleLink).toBeNull();
  });

  it('a password sign-in that needs 2FA keeps the pending link until the code is verified', async () => {
    const { result, fetchMock } = await renderSession({
      [GOOGLE]: () => problem(409, 'Conflict', LINK_REQUIRED),
      [LOGIN]: () => problem(401, 'Unauthorized', { code: 'two-factor-required', twoFactorToken: 'tf-pw' }),
      [VERIFY]: () => jsonResponse(200, authResponse('acc-3', 'ref-3')),
      [IDENTITY]: () => jsonResponse(204),
      'GET /api/v1/me': () => jsonResponse(200, testUser),
    });

    await act(async () => {
      await result.current.signInWithGoogle({ idToken: 'gid-1', email: testUser.email });
    });
    let signInOutcome: unknown;
    await act(async () => {
      signInOutcome = await result.current.signIn(PASSWORD);
    });

    // M3: the password was right but the account wants a code: not signed in yet, nothing linked yet.
    expect(signInOutcome).toBe('twoFactorRequired');
    expect(result.current.pendingGoogleLink).toEqual({ linkToken: 'lt-1', email: testUser.email });
    expect(countRequests(fetchMock, IDENTITY_PATH)).toBe(0);

    await act(async () => {
      await result.current.verifyTwoFactor('123456');
    });
    // verifyTwoFactor does not touch the pending link.
    expect(result.current.pendingGoogleLink).not.toBeNull();
    let link: GoogleLinkOutcome | undefined;
    await act(async () => {
      link = await result.current.completeGoogleLink();
    });

    expect(link).toEqual({ type: 'linked' });
    const request = requestTo(fetchMock, IDENTITY_PATH);
    expect(request.body).toEqual({ linkToken: 'lt-1' });
    expect(request.headers.Authorization).toBe('Bearer acc-3');
  });

  it('completeGoogleLink does nothing without a pending link', async () => {
    const { result, fetchMock } = await renderSession({});

    let link: GoogleLinkOutcome | undefined;
    await act(async () => {
      link = await result.current.completeGoogleLink();
    });

    expect(link).toEqual({ type: 'none' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('completeGoogleLink drops the single-use linkToken even when linking fails', async () => {
    const { result, fetchMock } = await renderSession({
      [GOOGLE]: () => problem(409, 'Conflict', LINK_REQUIRED),
      [IDENTITY]: () => problem(400, 'Bad Request'),
    });
    // Signed-in session (auth/google is public, so it still runs): only completeGoogleLink is under test.
    await act(async () => {
      await result.current.signInWithGoogle({ idToken: 'gid-1', email: null });
    });

    let first: GoogleLinkOutcome | undefined;
    let second: GoogleLinkOutcome | undefined;
    await act(async () => {
      first = await result.current.completeGoogleLink();
      second = await result.current.completeGoogleLink();
    });

    expect(first).toMatchObject({ type: 'failed', error: expect.objectContaining({ status: 400 }) });
    expect(second).toEqual({ type: 'none' });
    expect(countRequests(fetchMock, IDENTITY_PATH)).toBe(1);
    expect(result.current.pendingGoogleLink).toBeNull();
  });

  it('cancelGoogleLink clears the pending link', async () => {
    const { result } = await renderSession({ [GOOGLE]: () => problem(409, 'Conflict', LINK_REQUIRED) });
    await act(async () => {
      await result.current.signInWithGoogle({ idToken: 'gid-1', email: null });
    });

    await act(async () => {
      result.current.cancelGoogleLink();
    });

    expect(result.current.pendingGoogleLink).toBeNull();
  });

  it('signOut clears the pending link', async () => {
    const { result } = await renderSession({ [GOOGLE]: () => problem(409, 'Conflict', LINK_REQUIRED) });
    await act(async () => {
      await result.current.signInWithGoogle({ idToken: 'gid-1', email: null });
    });

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.pendingGoogleLink).toBeNull();
  });

  it('endLocalSession (account deleted, logged out of every device) clears the pending link too', async () => {
    const { result } = await renderSession({ [GOOGLE]: () => problem(409, 'Conflict', LINK_REQUIRED) });
    await act(async () => {
      await result.current.signInWithGoogle({ idToken: 'gid-1', email: null });
    });

    await act(async () => {
      await result.current.endLocalSession();
    });

    expect(result.current.pendingGoogleLink).toBeNull();
  });

  it('a new registration drops a pending link: the linkToken belongs to another account', async () => {
    const { result, fetchMock } = await renderSession({
      [GOOGLE]: () => problem(409, 'Conflict', LINK_REQUIRED),
      'POST /api/v1/auth/register': () => jsonResponse(201, authResponse('acc-r', 'ref-r')),
    });
    await act(async () => {
      await result.current.signInWithGoogle({ idToken: 'gid-1', email: testUser.email });
    });
    expect(result.current.pendingGoogleLink).not.toBeNull();

    await act(async () => {
      await result.current.signUp({ email: 'new@example.com', password: 'fixture-pass-2', displayName: 'New' });
    });

    expect(result.current.status).toBe('signedIn');
    expect(result.current.pendingGoogleLink).toBeNull();
    let link: GoogleLinkOutcome | undefined;
    await act(async () => {
      link = await result.current.completeGoogleLink();
    });
    expect(link).toEqual({ type: 'none' });
    expect(countRequests(fetchMock, IDENTITY_PATH)).toBe(0);
  });

  it('a spent 2FA token (401 two-factor-token-invalid) ends the challenge but keeps the pending link for the next full sign-in', async () => {
    const { result, fetchMock } = await renderSession({
      [GOOGLE]: () => problem(409, 'Conflict', LINK_REQUIRED),
      [LOGIN]: sequence(
        () => problem(401, 'Unauthorized', { code: 'two-factor-required', twoFactorToken: 'tf-1' }),
        () => problem(401, 'Unauthorized', { code: 'two-factor-required', twoFactorToken: 'tf-2' }),
      ),
      [VERIFY]: sequence(
        () => problem(401, 'Unauthorized', { code: 'two-factor-token-invalid' }),
        () => jsonResponse(200, authResponse('acc-4', 'ref-4')),
      ),
      [IDENTITY]: () => jsonResponse(204),
      'GET /api/v1/me': () => jsonResponse(200, testUser),
    });
    await act(async () => {
      await result.current.signInWithGoogle({ idToken: 'gid-1', email: testUser.email });
    });
    await act(async () => {
      await result.current.signIn(PASSWORD);
    });

    await act(async () => {
      await expect(result.current.verifyTwoFactor('000000')).rejects.toMatchObject({ status: 401 });
    });
    // M3: the token is spent, no code can be sent until the next password sign-in; the Google link is still waiting.
    expect(result.current.pendingTwoFactor).toBe(false);
    expect(result.current.pendingGoogleLink).toEqual({ linkToken: 'lt-1', email: testUser.email });
    expect(countRequests(fetchMock, IDENTITY_PATH)).toBe(0);

    await act(async () => {
      await result.current.signIn(PASSWORD);
    });
    await act(async () => {
      await result.current.verifyTwoFactor('123456');
    });
    let link: GoogleLinkOutcome | undefined;
    await act(async () => {
      link = await result.current.completeGoogleLink();
    });

    expect(link).toEqual({ type: 'linked' });
    const request = requestTo(fetchMock, IDENTITY_PATH);
    expect(request.body).toEqual({ linkToken: 'lt-1' });
    expect(request.headers.Authorization).toBe('Bearer acc-4');
  });
});
