import { act, renderHook, waitFor } from '@testing-library/react-native';
import { tokenStore } from '../../../lib/tokenStore';
import { authResponse, testUser } from '../../../test/fixtures';
import { jsonResponse, mockFetch, problem, requestAt, type FetchMock } from '../../../test/http';
import { routeFetch, type RouteHandler } from '../../../test/m3Routes';
import { createTestQueryClient, createWrapper } from '../../../test/render';
import { useSession, type GoogleLinkOutcome, type GoogleSignInOutcome } from '../session';

const APPLE = 'POST /api/v1/auth/apple';
const FACEBOOK = 'POST /api/v1/auth/facebook';
const LINK_REQUIRED = { code: 'link-required', linkToken: 'lt-1' };
const TWO_FACTOR_REQUIRED = { code: 'two-factor-required', twoFactorToken: 'tf-1' };

async function renderSession(routes: Record<string, RouteHandler>) {
  await tokenStore.clear();
  const fetchMock = mockFetch();
  routeFetch(fetchMock, routes);
  const hook = await renderHook(() => useSession(), { wrapper: createWrapper(createTestQueryClient()) });
  await waitFor(() => expect(hook.result.current.status).toBe('signedOut'));
  return { fetchMock, ...hook };
}

function requestTo(fetchMock: FetchMock, path: string) {
  const index = fetchMock.mock.calls.findIndex(([input]) => String(input).endsWith(path));
  expect(index).toBeGreaterThanOrEqual(0);
  return requestAt(fetchMock, index);
}

describe('SessionProvider — Apple / Facebook (M13b)', () => {
  it('signInWithSocial signs in and stores the tokens', async () => {
    const { result } = await renderSession({ [APPLE]: () => jsonResponse(200, authResponse('acc-a', 'ref-a')) });

    let outcome: GoogleSignInOutcome | undefined;
    await act(async () => {
      outcome = await result.current.signInWithSocial({ provider: 'APPLE', token: 'jwt', displayName: 'Lan' });
    });

    expect(outcome).toBe('signedIn');
    expect(result.current.status).toBe('signedIn');
    await expect(tokenStore.getAccessToken()).resolves.toBe('acc-a');
  });

  it('409 link-required keeps the linkToken WITH its provider and stays signed out', async () => {
    const { result } = await renderSession({ [FACEBOOK]: () => problem(409, 'Conflict', LINK_REQUIRED) });

    let outcome: GoogleSignInOutcome | undefined;
    await act(async () => {
      outcome = await result.current.signInWithSocial({ provider: 'FACEBOOK', token: 'fb' });
    });

    expect(outcome).toBe('linkRequired');
    expect(result.current.pendingGoogleLink).toEqual({ linkToken: 'lt-1', email: null, provider: 'FACEBOOK' });
    expect(result.current.status).toBe('signedOut');
  });

  it('401 two-factor-required starts the two-factor step', async () => {
    const { result } = await renderSession({ [APPLE]: () => problem(401, 'Unauthorized', TWO_FACTOR_REQUIRED) });

    let outcome: GoogleSignInOutcome | undefined;
    await act(async () => {
      outcome = await result.current.signInWithSocial({ provider: 'APPLE', token: 'jwt' });
    });

    expect(outcome).toBe('twoFactorRequired');
    expect(result.current.pendingTwoFactor).toBe(true);
    expect(result.current.pendingGoogleLink).toBeNull();
  });

  it('any other failure is thrown to the caller', async () => {
    const { result } = await renderSession({ [APPLE]: () => problem(403, 'Forbidden') });

    await expect(
      act(async () => {
        await result.current.signInWithSocial({ provider: 'APPLE', token: 'jwt' });
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('completeGoogleLink finishes an Apple link with the linkToken and reports the provider', async () => {
    const { result, fetchMock } = await renderSession({
      [APPLE]: () => problem(409, 'Conflict', LINK_REQUIRED),
      'POST /api/v1/auth/login': () => jsonResponse(200, authResponse('acc-p', 'ref-p')),
      'POST /api/v1/me/identities/apple': () => jsonResponse(204),
      'GET /api/v1/me': () => jsonResponse(200, testUser),
    });
    await act(async () => {
      await result.current.signInWithSocial({ provider: 'APPLE', token: 'jwt' });
    });
    await act(async () => {
      await result.current.signIn({ email: testUser.email, password: 'fixture-pass-1' });
    });

    let link: GoogleLinkOutcome | undefined;
    await act(async () => {
      link = await result.current.completeGoogleLink();
    });

    expect(link).toEqual({ type: 'linked', provider: 'APPLE' });
    expect(requestTo(fetchMock, '/me/identities/apple').body).toEqual({ linkToken: 'lt-1' });
    expect(result.current.pendingGoogleLink).toBeNull();
  });

  it('a failed Facebook link reports the provider and is not retried', async () => {
    const { result } = await renderSession({
      [FACEBOOK]: () => problem(409, 'Conflict', LINK_REQUIRED),
      'POST /api/v1/auth/login': () => jsonResponse(200, authResponse()),
      'POST /api/v1/me/identities/facebook': () => problem(400, 'Bad Request'),
      'GET /api/v1/me': () => jsonResponse(200, testUser),
    });
    await act(async () => {
      await result.current.signInWithSocial({ provider: 'FACEBOOK', token: 'fb' });
    });
    await act(async () => {
      await result.current.signIn({ email: testUser.email, password: 'fixture-pass-1' });
    });

    let link: GoogleLinkOutcome | undefined;
    await act(async () => {
      link = await result.current.completeGoogleLink();
    });

    expect(link).toMatchObject({ type: 'failed', provider: 'FACEBOOK' });
    await act(async () => {
      link = await result.current.completeGoogleLink();
    });
    expect(link).toEqual({ type: 'none' });
  });
});
