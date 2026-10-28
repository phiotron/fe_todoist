import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { getGoogleIdToken, getGoogleSignInPlatform, setGoogleSignInPlatform } from '../googleSignIn';
import { createGoogleSignInAdapter, installNativeGoogleSignIn } from '../googleSignInAdapter';

const WEB_CLIENT_ID = '123-abc.apps.googleusercontent.com';
const mocked = jest.mocked(GoogleSignin);

function nativeError(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

function success(idToken: string | null, email = 'an@example.com') {
  return {
    type: 'success' as const,
    data: {
      idToken,
      serverAuthCode: null,
      scopes: [],
      user: { id: 'g-1', email, name: 'An', photo: null, familyName: null, givenName: 'An' },
    },
  };
}

describe('createGoogleSignInAdapter (@react-native-google-signin v16 behind the GoogleSignInPlatform port)', () => {
  it('configures with the web client ID, checks Play Services, signs in and returns the ID token and email', async () => {
    mocked.signIn.mockResolvedValueOnce(success('gid-1', 'an@example.com'));
    const adapter = createGoogleSignInAdapter(WEB_CLIENT_ID);

    await expect(adapter.signIn()).resolves.toEqual({ type: 'success', idToken: 'gid-1', email: 'an@example.com' });

    expect(mocked.configure).toHaveBeenCalledWith({ webClientId: WEB_CLIENT_ID });
    expect(mocked.hasPlayServices).toHaveBeenCalledWith({ showPlayServicesUpdateDialog: true });
    expect(mocked.signIn).toHaveBeenCalledTimes(1);
    // The order matters: configure before anything else, Play Services before the picker.
    const order = [mocked.configure, mocked.hasPlayServices, mocked.signIn].map((fn) => fn.mock.invocationCallOrder[0]);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('signs out afterwards (best effort) so the next press shows the account picker again', async () => {
    const adapter = createGoogleSignInAdapter(WEB_CLIENT_ID);
    await adapter.signIn();
    expect(mocked.signOut).toHaveBeenCalledTimes(1);
  });

  it('still succeeds when signOut fails', async () => {
    mocked.signOut.mockRejectedValueOnce(new Error('boom'));
    const adapter = createGoogleSignInAdapter(WEB_CLIENT_ID);
    await expect(adapter.signIn()).resolves.toMatchObject({ type: 'success', idToken: 'google-id-token' });
  });

  it('configures only once across sign-ins', async () => {
    const adapter = createGoogleSignInAdapter(WEB_CLIENT_ID);
    await adapter.signIn();
    await adapter.signIn();
    expect(mocked.configure).toHaveBeenCalledTimes(1);
    expect(mocked.signIn).toHaveBeenCalledTimes(2);
  });

  it('is "notConfigured" without a web client ID and never touches the native module', async () => {
    const adapter = createGoogleSignInAdapter(null);
    await expect(adapter.signIn()).resolves.toEqual({ type: 'error', reason: 'notConfigured' });
    expect(mocked.configure).not.toHaveBeenCalled();
    expect(mocked.signIn).not.toHaveBeenCalled();
  });

  it('maps a cancelled response (closed picker) to cancelled, without signing out', async () => {
    mocked.signIn.mockResolvedValueOnce({ type: 'cancelled', data: null });
    const adapter = createGoogleSignInAdapter(WEB_CLIENT_ID);
    await expect(adapter.signIn()).resolves.toEqual({ type: 'cancelled' });
    expect(mocked.signOut).not.toHaveBeenCalled();
  });

  it('maps a SIGN_IN_CANCELLED rejection to cancelled', async () => {
    mocked.signIn.mockRejectedValueOnce(nativeError(statusCodes.SIGN_IN_CANCELLED));
    await expect(createGoogleSignInAdapter(WEB_CLIENT_ID).signIn()).resolves.toEqual({ type: 'cancelled' });
  });

  it('maps IN_PROGRESS to error inProgress', async () => {
    mocked.signIn.mockRejectedValueOnce(nativeError(statusCodes.IN_PROGRESS));
    await expect(createGoogleSignInAdapter(WEB_CLIENT_ID).signIn()).resolves.toEqual({
      type: 'error',
      reason: 'inProgress',
    });
  });

  it('maps PLAY_SERVICES_NOT_AVAILABLE (thrown by hasPlayServices) to error playServices, before the picker', async () => {
    mocked.hasPlayServices.mockRejectedValueOnce(nativeError(statusCodes.PLAY_SERVICES_NOT_AVAILABLE));
    await expect(createGoogleSignInAdapter(WEB_CLIENT_ID).signIn()).resolves.toEqual({
      type: 'error',
      reason: 'playServices',
    });
    expect(mocked.signIn).not.toHaveBeenCalled();
  });

  it('maps hasPlayServices() === false to error playServices', async () => {
    mocked.hasPlayServices.mockResolvedValueOnce(false);
    await expect(createGoogleSignInAdapter(WEB_CLIENT_ID).signIn()).resolves.toEqual({
      type: 'error',
      reason: 'playServices',
    });
    expect(mocked.signIn).not.toHaveBeenCalled();
  });

  it.each([
    ['an unknown status code (e.g. DEVELOPER_ERROR)', nativeError('DEVELOPER_ERROR')],
    ['a plain error without a code', new Error('network')],
    ['a non-error rejection', 'oops'],
  ])('maps %s to error failed', async (_name, error) => {
    mocked.signIn.mockRejectedValueOnce(error);
    await expect(createGoogleSignInAdapter(WEB_CLIENT_ID).signIn()).resolves.toEqual({ type: 'error', reason: 'failed' });
  });

  it('maps a success without an ID token to error failed (the Web client ID is not accepted by Google)', async () => {
    mocked.signIn.mockResolvedValueOnce(success(null));
    await expect(createGoogleSignInAdapter(WEB_CLIENT_ID).signIn()).resolves.toEqual({ type: 'error', reason: 'failed' });
  });

  it('still returns the success when the email is missing', async () => {
    mocked.signIn.mockResolvedValueOnce({
      type: 'success',
      data: { ...success('gid-2').data, user: { ...success('gid-2').data.user, email: undefined as unknown as string } },
    });
    await expect(createGoogleSignInAdapter(WEB_CLIENT_ID).signIn()).resolves.toEqual({
      type: 'success',
      idToken: 'gid-2',
      email: null,
    });
  });
});

describe('installNativeGoogleSignIn', () => {
  afterEach(() => setGoogleSignInPlatform(null));

  it('installs the adapter as the app platform, used by getGoogleIdToken()', async () => {
    installNativeGoogleSignIn(WEB_CLIENT_ID, null, 'android');
    await expect(getGoogleIdToken()).resolves.toEqual({
      type: 'success',
      idToken: 'google-id-token',
      email: 'an@example.com',
    });
  });

  it('installs a "notConfigured" adapter when the client ID is missing', async () => {
    installNativeGoogleSignIn(null, null, 'android');
    expect(getGoogleSignInPlatform()).not.toBeNull();
    await expect(getGoogleIdToken()).resolves.toEqual({ type: 'error', reason: 'notConfigured' });
  });
});
