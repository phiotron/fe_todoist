import { act, renderHook, waitFor } from '@testing-library/react-native';
import { apiFetch } from '../../../api/client';
import { tokenStore } from '../../../lib/tokenStore';
import { FakeReminderPlatform } from '../../../test/fakeReminderPlatform';
import { authResponse, testUser } from '../../../test/fixtures';
import { jsonResponse, mockFetch, problem } from '../../../test/http';
import { createTestQueryClient, createWrapper } from '../../../test/render';
import { useSession } from '../../auth/session';
import { setReminderPlatform } from '../platform';

async function scheduleOne(platform: FakeReminderPlatform) {
  await platform.scheduler.schedule({
    id: 'auto:t-1', taskId: 't-1', kind: 'AUTO', fireAtMs: 1, title: 'x', body: 'y', signature: 's',
  });
}

async function renderSession() {
  return renderHook(() => useSession(), { wrapper: createWrapper(createTestQueryClient()) });
}

describe('session ends → reminders are cancelled', () => {
  let platform: FakeReminderPlatform;

  beforeEach(async () => {
    platform = new FakeReminderPlatform();
    setReminderPlatform(platform);
    await scheduleOne(platform);
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  afterEach(() => {
    setReminderPlatform(null);
    jest.restoreAllMocks();
  });

  it('sign-out cancels every scheduled reminder', async () => {
    mockFetch().mockResolvedValueOnce(jsonResponse(200, testUser)).mockResolvedValue(jsonResponse(204));
    const { result } = await renderSession();
    await waitFor(() => expect(result.current.status).toBe('signedIn'));

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.status).toBe('signedOut');
    expect(await platform.scheduler.listScheduled()).toEqual([]);
  });

  it('an expired session (refresh rejected) cancels every scheduled reminder', async () => {
    mockFetch().mockResolvedValueOnce(jsonResponse(200, testUser)).mockResolvedValue(problem(401, 'Unauthorized'));
    const { result } = await renderSession();
    await waitFor(() => expect(result.current.status).toBe('signedIn'));

    await act(async () => {
      await apiFetch('/api/v1/me').catch(() => undefined);
    });

    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    await waitFor(async () => expect(await platform.scheduler.listScheduled()).toEqual([]));
  });

  it('signing in as another account cancels the previous account reminders', async () => {
    await tokenStore.clear();
    mockFetch().mockResolvedValueOnce(jsonResponse(200, authResponse()));
    const { result } = await renderSession();
    await waitFor(() => expect(result.current.status).toBe('signedOut'));

    await act(async () => {
      await result.current.signIn({ email: testUser.email, password: 'fixture-pass-1' });
    });

    expect(result.current.status).toBe('signedIn');
    expect(await platform.scheduler.listScheduled()).toEqual([]);
  });

  it('still signs out when cancelling reminders fails', async () => {
    mockFetch().mockResolvedValueOnce(jsonResponse(200, testUser)).mockResolvedValue(jsonResponse(204));
    platform.cancelAll = jest.fn().mockRejectedValue(new Error('native'));
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { result } = await renderSession();
    await waitFor(() => expect(result.current.status).toBe('signedIn'));

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.status).toBe('signedOut');
  });
});
