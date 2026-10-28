import { FakeGoogleSignInPlatform } from '../../test/fakeGoogleSignInPlatform';
import {
  getGoogleIdToken,
  getGoogleSignInPlatform,
  setGoogleSignInPlatform,
  unavailableGoogleSignInPlatform,
} from '../googleSignIn';

describe('getGoogleIdToken (port to the native Google Sign-In)', () => {
  afterEach(() => setGoogleSignInPlatform(null));

  it('reports notConfigured while no adapter is installed (the default platform is "unavailable")', async () => {
    expect(getGoogleSignInPlatform()).toBe(unavailableGoogleSignInPlatform);
    await expect(getGoogleIdToken()).resolves.toEqual({ type: 'error', reason: 'notConfigured' });
  });

  it('returns what the installed platform answers', async () => {
    const fake = new FakeGoogleSignInPlatform();
    setGoogleSignInPlatform(fake);
    fake.queue({ type: 'success', idToken: 'gid-1', email: 'an@example.com' });

    await expect(getGoogleIdToken()).resolves.toEqual({ type: 'success', idToken: 'gid-1', email: 'an@example.com' });
    expect(fake.signInCalls).toBe(1);
  });

  it.each([
    [{ type: 'cancelled' } as const],
    [{ type: 'error', reason: 'playServices' } as const],
    [{ type: 'error', reason: 'inProgress' } as const],
  ])('passes %j through', async (result) => {
    const fake = new FakeGoogleSignInPlatform();
    setGoogleSignInPlatform(fake);
    fake.queue(result);

    await expect(getGoogleIdToken()).resolves.toEqual(result);
  });

  it('never throws: a platform that throws becomes a "failed" result', async () => {
    const fake = new FakeGoogleSignInPlatform();
    setGoogleSignInPlatform(fake);
    fake.queueError(new Error('boom'));

    await expect(getGoogleIdToken()).resolves.toEqual({ type: 'error', reason: 'failed' });
  });

  it('treats a success without an ID token as "failed" (the web client ID is missing on the Google side)', async () => {
    const fake = new FakeGoogleSignInPlatform();
    setGoogleSignInPlatform(fake);
    fake.queue({ type: 'success', idToken: '', email: null });

    await expect(getGoogleIdToken()).resolves.toEqual({ type: 'error', reason: 'failed' });
  });

  it('restores the unavailable platform with null', () => {
    setGoogleSignInPlatform(new FakeGoogleSignInPlatform());
    setGoogleSignInPlatform(null);
    expect(getGoogleSignInPlatform()).toBe(unavailableGoogleSignInPlatform);
  });
});
