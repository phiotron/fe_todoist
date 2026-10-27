import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { CHALLENGE_TTL_MS } from '../twoFactorToken';
import { viTranslation as vi } from '../../../i18n';
import { tokenStore } from '../../../lib/tokenStore';
import { authResponse } from '../../../test/fixtures';
import { countRequests, jsonResponse, mockFetch, problem, requestAt } from '../../../test/http';
import { routeFetch, type RouteHandler } from '../../../test/m3Routes';
import { renderWithProviders } from '../../../test/render';
import { useSession } from '../../auth/session';
import { TwoFactorScreen } from '../TwoFactorScreen';

jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
    push: jest.fn(),
    back: jest.fn(),
    dismissTo: jest.fn(),
    dismissAll: jest.fn(),
    canDismiss: jest.fn(() => false),
  },
}));

const LOGIN = { email: 'an@example.com', password: 'fixture-pass-1' };
const VERIFY = '/api/v1/auth/2fa/verify';

/** Starts a password sign-in that is answered 401 two-factor-required, then shows the code screen. */
function WithChallenge() {
  const { signIn } = useSession();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void signIn(LOGIN).then(() => setReady(true));
  }, [signIn]);
  return ready ? <TwoFactorScreen /> : null;
}

function serve(verify: RouteHandler) {
  const fetchMock = mockFetch();
  routeFetch(fetchMock, {
    'POST /api/v1/auth/login': () => problem(401, 'Unauthorized', { code: 'two-factor-required', twoFactorToken: 'challenge-1' }),
    [`POST ${VERIFY}`]: verify,
  });
  return fetchMock;
}

async function enterCode(value: string) {
  await fireEvent.changeText(await screen.findByTestId('two-factor-code'), value);
  await fireEvent.press(screen.getByTestId('two-factor-submit'));
}

describe('TwoFactorScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await tokenStore.clear();
  });

  afterEach(() => jest.restoreAllMocks());

  it('checks the code on the device first: empty, and anything but 6 digits in app mode', async () => {
    const fetchMock = serve(() => jsonResponse(200, authResponse('acc-2', 'ref-2')));
    await renderWithProviders(<WithChallenge />);

    await enterCode('   ');
    expect((await screen.findByTestId('two-factor-error')).props.children).toBe(vi.twoFactor.login.codeRequired);
    await enterCode('12ab56');
    expect(screen.getByTestId('two-factor-error').props.children).toBe(vi.twoFactor.login.codeFormat);

    expect(countRequests(fetchMock, VERIFY)).toBe(0);
  });

  it('sends the held token with the code, signs in and leaves the auth screens', async () => {
    const fetchMock = serve(() => jsonResponse(200, authResponse('acc-2', 'ref-2')));
    await renderWithProviders(<WithChallenge />);

    await enterCode('123 456');

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    const request = requestAt(fetchMock, 1);
    expect(request.url).toMatch(/\/api\/v1\/auth\/2fa\/verify$/);
    expect(request.body).toEqual({ twoFactorToken: 'challenge-1', code: '123456' });
    expect(request.headers.Authorization).toBeUndefined();
    await expect(tokenStore.getAccessToken()).resolves.toBe('acc-2');
  });

  it('401 two-factor-token-invalid ends this sign-in: an error-styled sentence and a way back to log in, no second send', async () => {
    const fetchMock = serve(() => problem(401, 'Unauthorized', { code: 'two-factor-token-invalid' }));
    await renderWithProviders(<WithChallenge />);

    await enterCode('123456');

    const rejected = await screen.findByTestId('two-factor-rejected');
    expect(rejected.props.children).toBe(vi.twoFactor.login.rejected);
    expect(rejected.props.accessibilityRole).toBe('alert');
    expect(screen.queryByTestId('two-factor-code')).toBeNull();
    expect(countRequests(fetchMock, VERIFY)).toBe(1);
    await fireEvent.press(screen.getByTestId('two-factor-back-login'));
    expect(router.replace).toHaveBeenCalledWith('/login');
  });

  it('401 two-factor-code-invalid (wrong code) keeps the form: "the code is wrong", the same token is sent again with the next code', async () => {
    let answers = 0;
    const fetchMock = serve(() => {
      answers += 1;
      return answers === 1
        ? problem(401, 'Unauthorized', { code: 'two-factor-code-invalid' })
        : jsonResponse(200, authResponse('acc-2', 'ref-2'));
    });
    await renderWithProviders(<WithChallenge />);

    await enterCode('000000');

    expect((await screen.findByTestId('two-factor-error')).props.children).toBe(vi.twoFactor.login.wrongCode);
    expect(screen.queryByTestId('two-factor-rejected')).toBeNull();
    expect(screen.queryByTestId('two-factor-expired')).toBeNull();
    expect(screen.getByTestId('two-factor-code')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('two-factor-code'), '123456');
    await fireEvent.press(screen.getByTestId('two-factor-submit'));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(requestAt(fetchMock, 2).body).toEqual({ twoFactorToken: 'challenge-1', code: '123456' });
  });

  it('a 400 validation answer shows its message at the code field and does not end the sign-in', async () => {
    serve(() => problem(400, 'Bad Request', { errors: [{ field: 'code', message: 'Code too long' }] }));
    await renderWithProviders(<WithChallenge />);
    await fireEvent.press(await screen.findByTestId('two-factor-toggle-recovery'));

    await enterCode('x'.repeat(30));

    expect((await screen.findByTestId('two-factor-code-error')).props.children).toBe('Code too long');
    expect(screen.queryByTestId('two-factor-rejected')).toBeNull();
    expect(screen.queryByTestId('two-factor-expired')).toBeNull();
    expect(screen.getByTestId('two-factor-code')).toBeTruthy();
  });

  it('recovery mode accepts a recovery code of any shape and sends it trimmed', async () => {
    const fetchMock = serve(() => jsonResponse(200, authResponse('acc-2', 'ref-2')));
    await renderWithProviders(<WithChallenge />);
    await fireEvent.press(await screen.findByTestId('two-factor-toggle-recovery'));
    expect(screen.getByText(vi.twoFactor.login.introRecovery)).toBeTruthy();
    expect(screen.getByTestId('two-factor-code').props.maxLength).toBe(32); // the server accepts 1-32 characters

    await enterCode('  fixture-recovery-1  ');

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(requestAt(fetchMock, 1).body).toEqual({ twoFactorToken: 'challenge-1', code: 'fixture-recovery-1' });
  });

  it('too many tries (429) tells the user to wait and keeps the form: the challenge stays, a later send works', async () => {
    let answers = 0;
    serve(() => {
      answers += 1;
      return answers === 1 ? problem(429, 'Too Many Requests') : jsonResponse(200, authResponse('acc-2', 'ref-2'));
    });
    await renderWithProviders(<WithChallenge />);

    await enterCode('123456');

    expect((await screen.findByTestId('two-factor-error')).props.children).toBe(vi.errors.tooManyRequests);
    expect(screen.queryByTestId('two-factor-rejected')).toBeNull();
    expect(screen.getByTestId('two-factor-code').props.value).toBe('123456');

    await fireEvent.press(screen.getByTestId('two-factor-submit'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  });

  it('shows "this sign-in has expired" when no sign-in is waiting for a code', async () => {
    mockFetch();
    await renderWithProviders(<TwoFactorScreen />);

    expect(screen.getByTestId('two-factor-expired').props.children).toBe(vi.twoFactor.login.expired);
    await fireEvent.press(screen.getByTestId('two-factor-back-login'));
    expect(router.replace).toHaveBeenCalledWith('/login');
  });

  it('a challenge older than 5 minutes turns into the expired state on submit, without calling the server', async () => {
    const fetchMock = serve(() => jsonResponse(200, authResponse('acc-2', 'ref-2')));
    await renderWithProviders(<WithChallenge />);
    await screen.findByTestId('two-factor-code');

    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + CHALLENGE_TTL_MS + 1);
    await enterCode('123456');

    expect(await screen.findByTestId('two-factor-expired')).toBeTruthy();
    expect(countRequests(fetchMock, VERIFY)).toBe(0);
  });

  it('the back button forgets the challenge and returns to log in', async () => {
    serve(() => jsonResponse(200, authResponse('acc-2', 'ref-2')));
    await renderWithProviders(<WithChallenge />);
    await screen.findByTestId('two-factor-code');

    await act(async () => {
      await fireEvent.press(screen.getByTestId('two-factor-back'));
    });

    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('sends a single request when submit is pressed twice quickly', async () => {
    const fetchMock = serve(() => jsonResponse(200, authResponse('acc-2', 'ref-2')));
    await renderWithProviders(<WithChallenge />);
    await fireEvent.changeText(await screen.findByTestId('two-factor-code'), '123456');

    const button = screen.getByTestId('two-factor-submit');
    await act(async () => {
      void fireEvent.press(button);
      void fireEvent.press(button);
    });

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(countRequests(fetchMock, VERIFY)).toBe(1);
  });
});
