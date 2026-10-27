import { act, renderHook, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ApiError } from '../../../api/errors';
import type { SettingsResponse } from '../../../api/settings';
import i18n from '../../../i18n';
import { tokenStore } from '../../../lib/tokenStore';
import { testUser } from '../../../test/fixtures';
import { requestsTo } from '../../../test/apiRoutes';
import { countRequests, jsonResponse, mockFetch, problem } from '../../../test/http';
import { deferred, routeFetch } from '../../../test/m3Routes';
import { memorySettingsStorage, type MemorySettingsStorage } from '../../../test/memorySettingsStorage';
import { createTestQueryClient } from '../../../test/render';
import { createSettingsWrapper, renderWithSettings } from '../../../test/renderSettings';
import { settingsResponse, storedSettings, testAppSettings } from '../../../test/settingsFixtures';
import { meQueryKey, useSession } from '../../auth/session';
import type { StoredSettings } from '../settingsModel';
import type { SettingsStorage } from '../settingsStore';
import { useSettings } from '../useSettings';

const SETTINGS = '/api/v1/me/settings';

function Probe() {
  const { settings, hasPending, timeZoneMismatch } = useSettings();
  const parts = [settings.theme, settings.appearance, settings.locale, settings.timeZone, hasPending, timeZoneMismatch];
  return <Text testID="probe">{parts.join('|')}</Text>;
}

function probeText(): string {
  return screen.getByTestId('probe').props.children;
}

async function signIn() {
  await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
}

async function renderSettingsHook(options: { storage?: MemorySettingsStorage; deviceTimeZone?: string | null } = {}) {
  const queryClient = createTestQueryClient();
  const storage = options.storage ?? memorySettingsStorage();
  const hook = await renderHook(() => ({ settings: useSettings(), session: useSession() }), {
    wrapper: createSettingsWrapper({
      queryClient,
      storage,
      deviceTimeZone: options.deviceTimeZone === undefined ? 'Asia/Ho_Chi_Minh' : options.deviceTimeZone,
    }),
  });
  // Rendered only after the device cache is read; wait until the session status is known too.
  await waitFor(() => expect(hook.result.current?.session.status).not.toBe('loading'));
  return { ...hook, queryClient, storage };
}

describe('SettingsProvider', () => {
  beforeEach(async () => {
    await tokenStore.clear();
  });

  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('vi');
    });
  });

  it('applies the settings cached on the device before showing anything (signed out: no request)', async () => {
    const fetchMock = mockFetch();
    const storage = memorySettingsStorage(
      storedSettings({ applied: testAppSettings({ theme: 'KALE', appearance: 'DARK', locale: 'en' }) }),
    );

    await renderWithSettings(<Probe />, { storage });

    expect(await screen.findByText('KALE|DARK|en|Asia/Ho_Chi_Minh|false|false')).toBeTruthy();
    expect(i18n.language).toBe('en');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renders nothing until the device cache has been read', async () => {
    mockFetch();
    let release: (value: StoredSettings) => void = () => undefined;
    const storage: SettingsStorage = {
      load: () =>
        new Promise<StoredSettings>((resolve) => {
          release = resolve;
        }),
      save: async () => undefined,
    };

    await renderWithSettings(<Probe />, { storage });
    expect(screen.queryByTestId('probe')).toBeNull();

    await act(async () => {
      release(storedSettings());
    });
    expect(await screen.findByTestId('probe')).toBeTruthy();
  });

  it('signed in: loads the account settings from the server, applies and caches them', async () => {
    await signIn();
    routeFetch(mockFetch(), {
      [`GET ${SETTINGS}`]: () =>
        jsonResponse(200, settingsResponse({ theme: 'BLUEBERRY', appearance: 'LIGHT', locale: 'en', startDay: 7 })),
    });
    const storage = memorySettingsStorage();

    await renderWithSettings(<Probe />, { storage });

    expect(await screen.findByText('BLUEBERRY|LIGHT|en|Asia/Ho_Chi_Minh|false|false')).toBeTruthy();
    expect(i18n.language).toBe('en');
    expect(storage.current()?.applied).toEqual(
      testAppSettings({ theme: 'BLUEBERRY', appearance: 'LIGHT', locale: 'en', startDay: 7 }),
    );
  });

  it('keeps server fields M3 does not use (M4 reminders) in data and on the device', async () => {
    await signIn();
    routeFetch(mockFetch(), {
      [`GET ${SETTINGS}`]: () =>
        jsonResponse(200, { ...settingsResponse(), remindersEnabled: true, autoReminderMinutes: null }),
    });
    const { result, storage } = await renderSettingsHook();

    await waitFor(() => expect(result.current.settings.data).toMatchObject({ remindersEnabled: true }));
    expect(result.current.settings.data).toEqual({
      ...settingsResponse(),
      remindersEnabled: true,
      autoReminderMinutes: null,
    });
    expect(storage.current()?.extra).toEqual({ remindersEnabled: true, autoReminderMinutes: null });
  });

  describe('a field whose value is null (M4 "auto reminder off")', () => {
    const withAutoReminder = (minutes: number | null) => ({ ...settingsResponse(), remindersEnabled: true, autoReminderMinutes: minutes });

    it('update({ autoReminderMinutes: null }) sends the null, caches it on the device and shows it in data', async () => {
      await signIn();
      const patchBodies: unknown[] = [];
      routeFetch(mockFetch(), {
        [`GET ${SETTINGS}`]: () => jsonResponse(200, withAutoReminder(30)),
        [`PATCH ${SETTINGS}`]: (request) => {
          patchBodies.push(request.body);
          return jsonResponse(200, { ...withAutoReminder(30), ...(request.body as object) });
        },
      });
      const { result, storage } = await renderSettingsHook();
      await waitFor(() => expect(result.current.settings.data).toMatchObject({ autoReminderMinutes: 30 }));

      await act(async () => {
        await result.current.settings.update({ autoReminderMinutes: null });
      });

      expect(patchBodies).toEqual([{ autoReminderMinutes: null }]);
      expect(result.current.settings.data).toMatchObject({ autoReminderMinutes: null });
      expect(result.current.settings.hasPending).toBe(false);
      expect(storage.current()?.extra).toEqual({ remindersEnabled: true, autoReminderMinutes: null });
      expect(storage.current()?.pending).toBeNull();
    });

    it('a failed save keeps the null as the temporary choice (shown, stored, marked pending)', async () => {
      await signIn();
      routeFetch(mockFetch(), {
        [`GET ${SETTINGS}`]: () => jsonResponse(200, withAutoReminder(30)),
        [`PATCH ${SETTINGS}`]: () => problem(503, 'Service Unavailable'),
      });
      const { result, storage } = await renderSettingsHook();
      await waitFor(() => expect(result.current.settings.data).toMatchObject({ autoReminderMinutes: 30 }));

      await act(async () => {
        await expect(result.current.settings.update({ autoReminderMinutes: null })).rejects.toMatchObject({ status: 503 });
      });

      expect(result.current.settings.data).toMatchObject({ autoReminderMinutes: null });
      expect(result.current.settings.hasPending).toBe(true);
      expect(storage.current()?.pending).toEqual({ autoReminderMinutes: null });
    });

    it('the null kept on the device is sent again the next time the app opens', async () => {
      await signIn();
      const fetchMock = mockFetch();
      routeFetch(fetchMock, {
        [`PATCH ${SETTINGS}`]: (request) => jsonResponse(200, { ...withAutoReminder(30), ...(request.body as object) }),
      });
      const storage = memorySettingsStorage(
        storedSettings({ extra: { remindersEnabled: true, autoReminderMinutes: 30 }, pending: { autoReminderMinutes: null } }),
      );

      const { result } = await renderSettingsHook({ storage });

      await waitFor(() => expect(storage.current()?.pending).toBeNull());
      expect(requestsTo(fetchMock, 'PATCH', SETTINGS)[0]?.body).toEqual({ autoReminderMinutes: null });
      expect(result.current.settings.data).toMatchObject({ autoReminderMinutes: null });
      expect(storage.current()?.extra).toEqual({ remindersEnabled: true, autoReminderMinutes: null });
    });

    it('a null-only change is not mistaken for "nothing to save"', async () => {
      await signIn();
      const fetchMock = mockFetch();
      routeFetch(fetchMock, {
        [`GET ${SETTINGS}`]: () => jsonResponse(200, withAutoReminder(15)),
        [`PATCH ${SETTINGS}`]: (request) => jsonResponse(200, { ...withAutoReminder(15), ...(request.body as object) }),
      });
      const { result } = await renderSettingsHook();
      await waitFor(() => expect(result.current.settings.data).toMatchObject({ autoReminderMinutes: 15 }));

      await act(async () => {
        await result.current.settings.update({ autoReminderMinutes: null });
      });

      expect(countRequests(fetchMock, SETTINGS)).toBe(2);
    });
  });

  it('uses Vietnamese when the account language is not supported any more', async () => {
    await signIn();
    routeFetch(mockFetch(), { [`GET ${SETTINGS}`]: () => jsonResponse(200, settingsResponse({ locale: 'fr' })) });
    const storage = memorySettingsStorage(storedSettings({ applied: testAppSettings({ locale: 'en' }) }));

    await renderWithSettings(<Probe />, { storage });

    expect(await screen.findByText('TASKLY|AUTO|vi|Asia/Ho_Chi_Minh|false|false')).toBeTruthy();
    expect(i18n.language).toBe('vi');
  });

  it('signed in with a change kept only on this device: sends it first, then clears it', async () => {
    await signIn();
    const fetchMock = mockFetch();
    routeFetch(fetchMock, {
      [`PATCH ${SETTINGS}`]: () => jsonResponse(200, settingsResponse({ appearance: 'DARK' })),
    });
    const storage = memorySettingsStorage(storedSettings({ pending: { appearance: 'DARK' } }));

    await renderWithSettings(<Probe />, { storage });

    await waitFor(() => expect(storage.current()?.pending).toBeNull());
    expect(requestsTo(fetchMock, 'PATCH', SETTINGS)[0]?.body).toEqual({ appearance: 'DARK' });
    expect(countRequests(fetchMock, SETTINGS)).toBe(1);
    expect(probeText()).toBe('TASKLY|DARK|vi|Asia/Ho_Chi_Minh|false|false');
  });

  it('keeps the temporary choice when re-sending fails again (offline) so the next open retries', async () => {
    await signIn();
    const fetchMock = mockFetch();
    routeFetch(fetchMock, {
      [`PATCH ${SETTINGS}`]: () => {
        throw new TypeError('Network request failed');
      },
    });
    const storage = memorySettingsStorage(storedSettings({ pending: { appearance: 'DARK' } }));

    await renderWithSettings(<Probe />, { storage });

    await waitFor(() => expect(countRequests(fetchMock, SETTINGS)).toBe(1));
    expect(await screen.findByText('TASKLY|DARK|vi|Asia/Ho_Chi_Minh|true|false')).toBeTruthy();
    expect(storage.current()?.pending).toEqual({ appearance: 'DARK' });
  });

  it('update applies the choice at once, then saves only the changed fields and syncs the cached user', async () => {
    await signIn();
    const fetchMock = mockFetch();
    const patch = deferred<Response>();
    routeFetch(fetchMock, {
      [`GET ${SETTINGS}`]: () => jsonResponse(200, settingsResponse()),
      [`PATCH ${SETTINGS}`]: () => patch.promise,
    });
    const { result, queryClient, storage } = await renderSettingsHook();
    await waitFor(() => expect(countRequests(fetchMock, SETTINGS)).toBe(1));
    queryClient.setQueryData(meQueryKey, testUser);

    let saving: Promise<void> = Promise.resolve();
    await act(async () => {
      saving = result.current.settings.update({ locale: 'en', timeZone: 'Asia/Tokyo' });
    });
    expect(result.current.settings.settings).toMatchObject({ locale: 'en', timeZone: 'Asia/Tokyo' });
    expect(result.current.settings.hasPending).toBe(true);
    expect(i18n.language).toBe('en');

    await act(async () => {
      patch.resolve(jsonResponse(200, settingsResponse({ locale: 'en', timeZone: 'Asia/Tokyo' })));
      await saving;
    });
    expect(requestsTo(fetchMock, 'PATCH', SETTINGS)[0]?.body).toEqual({ locale: 'en', timeZone: 'Asia/Tokyo' });
    expect(result.current.settings.hasPending).toBe(false);
    expect(storage.current()?.pending).toBeNull();
    expect(queryClient.getQueryData(meQueryKey)).toEqual({ ...testUser, locale: 'en', timeZone: 'Asia/Tokyo' });
  });

  it('update failure (server down) rejects but keeps the temporary choice, marked as pending', async () => {
    await signIn();
    routeFetch(mockFetch(), {
      [`GET ${SETTINGS}`]: () => jsonResponse(200, settingsResponse()),
      [`PATCH ${SETTINGS}`]: () => problem(503, 'Service Unavailable'),
    });
    const { result, storage } = await renderSettingsHook();

    await act(async () => {
      await expect(result.current.settings.update({ navTabs: ['TODAY', 'INBOX', 'BROWSE'] })).rejects.toBeInstanceOf(
        ApiError,
      );
    });

    expect(result.current.settings.settings.navTabs).toEqual(['TODAY', 'INBOX', 'BROWSE']);
    expect(result.current.settings.hasPending).toBe(true);
    expect(storage.current()?.pending).toEqual({ navTabs: ['TODAY', 'INBOX', 'BROWSE'] });
  });

  it('update rejected as invalid (400) drops the change', async () => {
    await signIn();
    routeFetch(mockFetch(), {
      [`GET ${SETTINGS}`]: () => jsonResponse(200, settingsResponse()),
      [`PATCH ${SETTINGS}`]: () =>
        problem(400, 'Bad Request', { errors: [{ field: 'timeZone', message: 'Múi giờ không hợp lệ' }] }),
    });
    const { result, storage } = await renderSettingsHook();

    await act(async () => {
      await expect(result.current.settings.update({ timeZone: 'Mars/Base' })).rejects.toMatchObject({ status: 400 });
    });

    expect(result.current.settings.settings.timeZone).toBe('Asia/Ho_Chi_Minh');
    expect(result.current.settings.hasPending).toBe(false);
    expect(storage.current()?.pending).toBeNull();
  });

  it('a navTabs list the server cannot read (400 errors[], e.g. a pinned project that is gone) keeps the old list', async () => {
    await signIn();
    const oldTabs = ['INBOX', 'TODAY', 'UPCOMING', 'BROWSE'];
    routeFetch(mockFetch(), {
      [`GET ${SETTINGS}`]: () => jsonResponse(200, settingsResponse({ navTabs: oldTabs })),
      [`PATCH ${SETTINGS}`]: () =>
        problem(400, 'Bad Request', { errors: [{ field: 'navTabs', message: 'Mục ghim không đọc được' }] }),
    });
    const { result, storage } = await renderSettingsHook();

    await act(async () => {
      await expect(
        result.current.settings.update({
          navTabs: ['INBOX', 'TODAY', 'UPCOMING', 'project:11111111-1111-4111-8111-111111111111', 'BROWSE'],
        }),
      ).rejects.toMatchObject({ status: 400, errors: [{ field: 'navTabs' }] });
    });

    expect(result.current.settings.settings.navTabs).toEqual(oldTabs);
    expect(result.current.settings.hasPending).toBe(false);
    expect(storage.current()?.pending).toBeNull();
  });

  it('serialises changes: a change made while a save is running is sent after it', async () => {
    await signIn();
    const fetchMock = mockFetch();
    const first = deferred<Response>();
    const patchBodies: unknown[] = [];
    routeFetch(fetchMock, {
      [`GET ${SETTINGS}`]: () => jsonResponse(200, settingsResponse()),
      [`PATCH ${SETTINGS}`]: (request) => {
        patchBodies.push(request.body);
        return patchBodies.length === 1
          ? first.promise
          : jsonResponse(200, settingsResponse(request.body as Partial<SettingsResponse>));
      },
    });
    const { result } = await renderSettingsHook();
    await waitFor(() => expect(countRequests(fetchMock, SETTINGS)).toBe(1));

    let a: Promise<void> = Promise.resolve();
    let b: Promise<void> = Promise.resolve();
    await act(async () => {
      a = result.current.settings.update({ theme: 'KALE' });
    });
    await act(async () => {
      b = result.current.settings.update({ theme: 'LAVENDER' });
    });
    expect(patchBodies).toEqual([{ theme: 'KALE' }]);
    expect(result.current.settings.settings.theme).toBe('LAVENDER');

    await act(async () => {
      first.resolve(jsonResponse(200, settingsResponse({ theme: 'KALE' })));
      await a;
      await b;
    });

    expect(patchBodies).toEqual([{ theme: 'KALE' }, { theme: 'LAVENDER' }]);
    expect(result.current.settings.settings.theme).toBe('LAVENDER');
    expect(result.current.settings.hasPending).toBe(false);
  });

  it('reset restores the server defaults and forgets pending changes', async () => {
    await signIn();
    const fetchMock = mockFetch();
    routeFetch(fetchMock, {
      [`PATCH ${SETTINGS}`]: () => {
        throw new TypeError('Network request failed');
      },
      [`POST ${SETTINGS}/reset`]: () => jsonResponse(200, settingsResponse()),
    });
    const storage = memorySettingsStorage(
      storedSettings({
        applied: testAppSettings({ theme: 'KALE', locale: 'en', startDay: 7 }),
        pending: { appearance: 'DARK' },
      }),
    );
    const { result } = await renderSettingsHook({ storage });
    await waitFor(() => expect(countRequests(fetchMock, SETTINGS)).toBe(1));

    await act(async () => {
      await result.current.settings.reset();
    });

    expect(result.current.settings.settings).toEqual(testAppSettings());
    expect(result.current.settings.hasPending).toBe(false);
    expect(storage.current()?.pending).toBeNull();
  });

  it('signing out drops changes not saved yet but keeps the current look on this device', async () => {
    await signIn();
    routeFetch(mockFetch(), {
      [`PATCH ${SETTINGS}`]: () => {
        throw new TypeError('Network request failed');
      },
      'POST /api/v1/auth/logout': () => jsonResponse(204),
    });
    const storage = memorySettingsStorage(
      storedSettings({ applied: testAppSettings({ appearance: 'DARK' }), pending: { appearance: 'LIGHT' } }),
    );
    const { result } = await renderSettingsHook({ storage });

    await act(async () => {
      await result.current.session.signOut();
    });

    await waitFor(() => expect(storage.current()?.pending).toBeNull());
    expect(result.current.settings.settings.appearance).toBe('DARK');
  });

  it('signed out: update changes the look on this device only, without calling the server', async () => {
    const fetchMock = mockFetch();
    const { result, storage } = await renderSettingsHook();

    await act(async () => {
      await result.current.settings.update({ appearance: 'DARK' });
    });

    expect(result.current.settings.settings.appearance).toBe('DARK');
    expect(storage.current()?.applied.appearance).toBe('DARK');
    expect(storage.current()?.pending).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('flags a device time zone that differs from the account and remembers a dismissal', async () => {
    await signIn();
    routeFetch(mockFetch(), { [`GET ${SETTINGS}`]: () => jsonResponse(200, settingsResponse()) });
    const { result, storage } = await renderSettingsHook({ deviceTimeZone: 'Asia/Tokyo' });
    await waitFor(() => expect(result.current.settings.timeZoneMismatch).toBe(true));
    expect(result.current.settings.deviceTimeZone).toBe('Asia/Tokyo');

    await act(async () => {
      result.current.settings.dismissTimeZoneMismatch();
    });

    expect(result.current.settings.timeZoneMismatch).toBe(false);
    expect(storage.current()?.dismissedTimeZone).toBe('Asia/Tokyo|Asia/Ho_Chi_Minh');
  });

  it('"Sync theme" off: the theme changes on this device only, other settings are still saved', async () => {
    await signIn();
    const patchBodies: unknown[] = [];
    routeFetch(mockFetch(), {
      [`GET ${SETTINGS}`]: () => jsonResponse(200, settingsResponse()),
      [`PATCH ${SETTINGS}`]: (request) => {
        patchBodies.push(request.body);
        return jsonResponse(200, settingsResponse(request.body as Partial<SettingsResponse>));
      },
    });
    const { result, storage } = await renderSettingsHook();
    await waitFor(() => expect(result.current.settings.data).toBeDefined());

    await act(async () => {
      await result.current.settings.setSyncTheme(false);
    });
    await act(async () => {
      await result.current.settings.update({ theme: 'RASPBERRY', appearance: 'DARK', startDay: 7 });
    });

    expect(result.current.settings.syncTheme).toBe(false);
    expect(result.current.settings.settings).toMatchObject({ theme: 'RASPBERRY', appearance: 'DARK', startDay: 7 });
    expect(patchBodies).toEqual([{ startDay: 7 }]);
    expect(storage.current()?.localTheme).toEqual({ theme: 'RASPBERRY', appearance: 'DARK' });
    expect(storage.current()?.applied.theme).toBe('TASKLY');
  });

  it('turning "Sync theme" back on saves this device theme on the account (the look does not jump)', async () => {
    await signIn();
    const patchBodies: unknown[] = [];
    routeFetch(mockFetch(), {
      [`GET ${SETTINGS}`]: () => jsonResponse(200, settingsResponse()),
      [`PATCH ${SETTINGS}`]: (request) => {
        patchBodies.push(request.body);
        return jsonResponse(200, settingsResponse(request.body as Partial<SettingsResponse>));
      },
    });
    const storage = memorySettingsStorage(
      storedSettings({ syncTheme: false, localTheme: { theme: 'KALE', appearance: 'LIGHT' } }),
    );
    const { result } = await renderSettingsHook({ storage });
    await waitFor(() => expect(result.current.settings.data).toBeDefined());

    await act(async () => {
      await result.current.settings.setSyncTheme(true);
    });

    expect(patchBodies).toEqual([{ theme: 'KALE', appearance: 'LIGHT' }]);
    expect(result.current.settings.settings).toMatchObject({ theme: 'KALE', appearance: 'LIGHT' });
    expect(storage.current()).toMatchObject({ syncTheme: true, localTheme: null, pending: null });
  });
});
