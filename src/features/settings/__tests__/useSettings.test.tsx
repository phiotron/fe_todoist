import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { SettingsResponse } from '../../../api/settings';
import { tokenStore } from '../../../lib/tokenStore';
import { testSettings } from '../../../test/fixtures';
import { jsonResponse, mockFetch, problem } from '../../../test/http';
import { deferred, routeFetch } from '../../../test/m3Routes';
import { memorySettingsStorage } from '../../../test/memorySettingsStorage';
import { createTestQueryClient, createWrapper } from '../../../test/render';
import { createSettingsWrapper } from '../../../test/renderSettings';
import { testAppSettings } from '../../../test/settingsFixtures';
import { useSettings, useUpdateSettings } from '../useSettings';

const SETTINGS = '/api/v1/me/settings';
// Later milestones add fields to the server shape; M3 must carry them untouched.
const withReminders = { ...testSettings, remindersEnabled: true } as SettingsResponse;

function useBoth() {
  return { settings: useSettings(), update: useUpdateSettings() };
}

function settingsWrapper(storage = memorySettingsStorage()) {
  return createSettingsWrapper({ queryClient: createTestQueryClient(), storage, deviceTimeZone: 'Asia/Ho_Chi_Minh' });
}

describe('useSettings / useUpdateSettings', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('outside SettingsProvider: reads GET me/settings with a plain query', async () => {
    routeFetch(mockFetch(), { [`GET ${SETTINGS}`]: () => jsonResponse(200, withReminders) });
    const { result } = await renderHook(() => useSettings(), { wrapper: createWrapper(createTestQueryClient()) });

    await waitFor(() => expect(result.current.data).toEqual(withReminders));
    expect(result.current.settings).toEqual(testAppSettings());
    expect(result.current.hasPending).toBe(false);
    expect(result.current.syncTheme).toBe(true);
  });

  it('outside SettingsProvider: mutate PATCHes only the changed fields and refreshes data', async () => {
    const patchBodies: unknown[] = [];
    routeFetch(mockFetch(), {
      [`GET ${SETTINGS}`]: () => jsonResponse(200, withReminders),
      [`PATCH ${SETTINGS}`]: (request) => {
        patchBodies.push(request.body);
        return jsonResponse(200, { ...withReminders, ...(request.body as object) });
      },
    });
    const { result } = await renderHook(useBoth, { wrapper: createWrapper(createTestQueryClient()) });
    await waitFor(() => expect(result.current.settings.data).toBeDefined());

    await act(async () => {
      result.current.update.mutate({ remindersEnabled: false });
    });

    await waitFor(() => expect(result.current.settings.data).toMatchObject({ remindersEnabled: false }));
    expect(patchBodies).toEqual([{ remindersEnabled: false }]);
  });

  it('inside SettingsProvider: shows the change at once, reports isPending, then the saved data', async () => {
    const patch = deferred<Response>();
    routeFetch(mockFetch(), {
      [`GET ${SETTINGS}`]: () => jsonResponse(200, withReminders),
      [`PATCH ${SETTINGS}`]: () => patch.promise,
    });
    const { result } = await renderHook(useBoth, { wrapper: settingsWrapper() });
    await waitFor(() => expect(result.current?.settings.data).toMatchObject({ remindersEnabled: true }));

    let saving: Promise<void> = Promise.resolve();
    await act(async () => {
      saving = result.current.update.mutateAsync({ remindersEnabled: false });
    });
    expect(result.current.settings.data).toMatchObject({ remindersEnabled: false });
    expect(result.current.update.isPending).toBe(true);

    await act(async () => {
      patch.resolve(jsonResponse(200, { ...withReminders, remindersEnabled: false }));
      await saving;
    });
    expect(result.current.update.isPending).toBe(false);
    expect(result.current.update.error).toBeNull();
    expect(result.current.settings.hasPending).toBe(false);
  });

  it('inside SettingsProvider: a failed save keeps the choice and exposes the error to onError', async () => {
    routeFetch(mockFetch(), {
      [`GET ${SETTINGS}`]: () => jsonResponse(200, withReminders),
      [`PATCH ${SETTINGS}`]: () => problem(503, 'Service Unavailable'),
    });
    const { result } = await renderHook(useBoth, { wrapper: settingsWrapper() });
    await waitFor(() => expect(result.current?.settings.data).toMatchObject({ remindersEnabled: true }));
    const onError = jest.fn();

    await act(async () => {
      result.current.update.mutate({ remindersEnabled: false }, { onError });
    });

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(result.current.update.error).toMatchObject({ status: 503 });
    expect(result.current.settings.data).toMatchObject({ remindersEnabled: false });
    expect(result.current.settings.hasPending).toBe(true);
  });

  it('outside SettingsProvider and signed out: does not call the server', async () => {
    await tokenStore.clear();
    const fetchMock = mockFetch();
    const { result } = await renderHook(() => useSettings(), { wrapper: createWrapper(createTestQueryClient()) });

    await waitFor(() => expect(result.current.data).toBeUndefined());
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
