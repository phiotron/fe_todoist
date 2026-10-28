import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { viTranslation as vi } from '../../../i18n';
import { tokenStore } from '../../../lib/tokenStore';
import { authResponse, testUser } from '../../../test/fixtures';
import { countRequests, jsonResponse, mockFetch, problem, requestAt } from '../../../test/http';
import { deferred, routeFetch, type RouteHandler } from '../../../test/m3Routes';
import { renderWithProviders } from '../../../test/render';
import { useSession } from '../../auth/session';
import { TwoFactorScreen } from '../TwoFactorScreen';

jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
    push: jest.fn(),
    back: jest.fn(),
    dismissAll: jest.fn(),
    canGoBack: jest.fn(() => true),
    canDismiss: jest.fn(() => true),
  },
}));

const GOOGLE = 'POST /api/v1/auth/google';
const LOGIN = 'POST /api/v1/auth/login';
const VERIFY = 'POST /api/v1/auth/2fa/verify';
const LINK = 'POST /api/v1/me/identities/google';
const LINK_PATH = '/api/v1/me/identities/google';
const LINK_REQUIRED = { code: 'link-required', linkToken: 'lt-1' };
const TWO_FACTOR_REQUIRED = { code: 'two-factor-required', twoFactorToken: 'tf-1' };

type Flow = 'passwordAfterLinkRequired' | 'googleWithTwoFactor';

/**
 * Starts the sign-in the way the auth screens do, then mounts the code screen once the session waits for a code
 * (same technique as the M3 TwoFactorScreen tests: the screen exists only after the challenge does).
 */
function WithChallenge({ flow }: { flow: Flow }) {
  const session = useSession();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void (async () => {
      // Flow 1: Google answers 409 link-required, then the password sign-in answers 401 two-factor-required.
      // Flow 2: Google itself answers 401 two-factor-required (account already linked).
      await session.signInWithGoogle({ idToken: 'gid-1', email: testUser.email });
      if (flow === 'passwordAfterLinkRequired') {
        await session.signIn({ email: testUser.email, password: 'fixture-pass-1' });
      }
      setReady(true);
    })();
    // Started once per mount of the harness; the session callbacks are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ready ? <TwoFactorScreen /> : null;
}

function serve(routes: Record<string, RouteHandler>) {
  const fetchMock = mockFetch();
  routeFetch(fetchMock, routes);
  return fetchMock;
}

async function enterCode() {
  await fireEvent.changeText(await screen.findByTestId('two-factor-code'), '123456');
  await fireEvent.press(screen.getByTestId('two-factor-submit'));
}

/** Presses submit without waiting for the async handler (it stays pending while a request is held). */
async function startSubmit() {
  await fireEvent.changeText(await screen.findByTestId('two-factor-code'), '123456');
  const button = screen.getByTestId('two-factor-submit');
  const click = { currentTarget: button, target: button, nativeEvent: {}, stopPropagation: () => undefined };
  await act(async () => {
    button.props.onClick(click);
  });
}

describe('TwoFactorScreen — pending Google link', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(async () => {
    await tokenStore.clear();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('links Google after the code is verified when a password sign-in started from link-required', async () => {
    const fetchMock = serve({
      [GOOGLE]: () => problem(409, 'Conflict', LINK_REQUIRED),
      [LOGIN]: () => problem(401, 'Unauthorized', TWO_FACTOR_REQUIRED),
      [VERIFY]: () => jsonResponse(200, authResponse('acc-3', 'ref-3')),
      [LINK]: () => jsonResponse(204),
    });
    await renderWithProviders(<WithChallenge flow="passwordAfterLinkRequired" />);
    await screen.findByTestId('two-factor-code');
    // The password was right but the code is still missing: nothing may be linked yet.
    expect(countRequests(fetchMock, LINK_PATH)).toBe(0);

    await enterCode();

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    const index = fetchMock.mock.calls.findIndex(([input]) => String(input).endsWith(LINK_PATH));
    expect(index).toBeGreaterThanOrEqual(0);
    const link = requestAt(fetchMock, index);
    expect(link.body).toEqual({ linkToken: 'lt-1' });
    expect(link.headers.Authorization).toBe('Bearer acc-3');
    expect(alertSpy).toHaveBeenCalledWith(vi.google.linkedTitle, vi.google.linkedMessage);
  });

  it('a Google sign-in with 2FA has nothing to link: no request, no dialog', async () => {
    const fetchMock = serve({
      [GOOGLE]: () => problem(401, 'Unauthorized', TWO_FACTOR_REQUIRED),
      [VERIFY]: () => jsonResponse(200, authResponse('acc-g', 'ref-g')),
    });
    await renderWithProviders(<WithChallenge flow="googleWithTwoFactor" />);

    await enterCode();

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(countRequests(fetchMock, LINK_PATH)).toBe(0);
    expect(alertSpy).not.toHaveBeenCalled();
    await expect(tokenStore.getAccessToken()).resolves.toBe('acc-g');
  });

  it('keeps the form, not the "expired" state, on screen while the link request is still running', async () => {
    const linkAnswer = deferred<Response>();
    serve({
      [GOOGLE]: () => problem(409, 'Conflict', LINK_REQUIRED),
      [LOGIN]: () => problem(401, 'Unauthorized', TWO_FACTOR_REQUIRED),
      [VERIFY]: () => jsonResponse(200, authResponse('acc-3', 'ref-3')),
      [LINK]: () => linkAnswer.promise,
    });
    await renderWithProviders(<WithChallenge flow="passwordAfterLinkRequired" />);

    await startSubmit();

    // The code was accepted (the session no longer waits for one) but the link request has not answered yet.
    await waitFor(async () => expect(await tokenStore.getAccessToken()).toBe('acc-3'));
    expect(screen.queryByTestId('two-factor-expired')).toBeNull();
    expect(screen.getByTestId('two-factor-submit').props.accessibilityState).toMatchObject({ busy: true });
    expect(router.replace).not.toHaveBeenCalled();

    linkAnswer.resolve(jsonResponse(204));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  });

  it('a spent token (401 two-factor-token-invalid) shows the "sign in again" state and sends no link request', async () => {
    const fetchMock = serve({
      [GOOGLE]: () => problem(409, 'Conflict', LINK_REQUIRED),
      [LOGIN]: () => problem(401, 'Unauthorized', TWO_FACTOR_REQUIRED),
      [VERIFY]: () => problem(401, 'Unauthorized', { code: 'two-factor-token-invalid' }),
      [LINK]: () => jsonResponse(204),
    });
    await renderWithProviders(<WithChallenge flow="passwordAfterLinkRequired" />);

    await enterCode();

    expect(await screen.findByTestId('two-factor-rejected')).toBeTruthy();
    expect(countRequests(fetchMock, LINK_PATH)).toBe(0);
    expect(alertSpy).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalledWith('/');
  });

  it('a wrong code (401 two-factor-code-invalid) keeps the form and the pending link: no link request yet', async () => {
    const fetchMock = serve({
      [GOOGLE]: () => problem(409, 'Conflict', LINK_REQUIRED),
      [LOGIN]: () => problem(401, 'Unauthorized', TWO_FACTOR_REQUIRED),
      [VERIFY]: () => problem(401, 'Unauthorized', { code: 'two-factor-code-invalid' }),
      [LINK]: () => jsonResponse(204),
    });
    await renderWithProviders(<WithChallenge flow="passwordAfterLinkRequired" />);

    await enterCode();

    expect(await screen.findByText(vi.twoFactor.login.wrongCode)).toBeTruthy();
    expect(screen.getByTestId('two-factor-code')).toBeTruthy();
    expect(countRequests(fetchMock, LINK_PATH)).toBe(0);
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
