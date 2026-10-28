import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { SettingsResponse } from '../../../api/settings';
import { viTranslation as vi } from '../../../i18n';
import { tokenStore } from '../../../lib/tokenStore';
import { jsonResponse, mockFetch } from '../../../test/http';
import { routeFetch } from '../../../test/m3Routes';
import { memorySettingsStorage } from '../../../test/memorySettingsStorage';
import { renderWithSettings } from '../../../test/renderSettings';
import { serveSettings, settingsResponse, storedSettings, testAppSettings } from '../../../test/settingsFixtures';
import { StartPageRedirect } from '../../settings/StartPageRedirect';
import { StartPageSection } from '../../settings/StartPageSection';
import { HOME_VIEW_STORAGE_KEY, resetLocalHomeViewForTests } from '../homeViewStore';
import { SyncHomeViewSection } from '../SyncHomeViewSection';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }));

const TARGETS = {
  'GET /api/v1/projects': () => jsonResponse(200, []),
  'GET /api/v1/labels': () => jsonResponse(200, []),
  'GET /api/v1/filters': () => jsonResponse(200, []),
};

function GeneralStartPage() {
  return (
    <>
      <StartPageSection />
      <SyncHomeViewSection />
    </>
  );
}

const startPageLabel = () => screen.getByTestId('start-page').props.accessibilityLabel as string;

async function chooseStartPage(value: string) {
  await fireEvent.press(await screen.findByTestId('start-page'));
  await fireEvent.press(screen.getByTestId(`start-page-option-${value}`));
}

async function storedHomeView(): Promise<unknown> {
  const text = await AsyncStorage.getItem(HOME_VIEW_STORAGE_KEY);
  return text ? JSON.parse(text) : null;
}

describe('Sync home view (M3x)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    resetLocalHomeViewForTests();
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('is on by default (cache from before M3x) and start page changes go to the account', async () => {
    const { patchBodies } = serveSettings(mockFetch(), { routes: TARGETS });
    await renderWithSettings(<GeneralStartPage />);

    expect((await screen.findByTestId('sync-home-view')).props.accessibilityState).toMatchObject({ checked: true });
    await chooseStartPage('INBOX');

    await waitFor(() => expect(patchBodies).toEqual([{ startPage: 'INBOX' }]));
  });

  it('turning it off keeps the start page on this device; later changes are not sent', async () => {
    const { patchBodies } = serveSettings(mockFetch(), {
      settings: settingsResponse({ startPage: 'UPCOMING' }),
      routes: TARGETS,
    });
    await renderWithSettings(<GeneralStartPage />);

    await fireEvent.press(await screen.findByTestId('sync-home-view'));
    await waitFor(() => expect(patchBodies).toEqual([{ syncHomeView: false }]));
    expect(await storedHomeView()).toEqual({ startPage: 'UPCOMING' });

    await chooseStartPage('INBOX');

    await waitFor(() => expect(startPageLabel()).toBe(`${vi.settings.startPage.title}, ${vi.settings.targets.INBOX}`));
    expect(await storedHomeView()).toEqual({ startPage: 'INBOX' });
    expect(patchBodies).toEqual([{ syncHomeView: false }]);
  });

  it('turning it back on makes this device start page the account one', async () => {
    await AsyncStorage.setItem(HOME_VIEW_STORAGE_KEY, JSON.stringify({ startPage: 'INBOX' }));
    const { patchBodies } = serveSettings(mockFetch(), {
      settings: { ...settingsResponse({ startPage: 'TODAY' }), syncHomeView: false } as SettingsResponse,
      routes: TARGETS,
    });
    await renderWithSettings(<GeneralStartPage />);

    await waitFor(() => expect(startPageLabel()).toBe(`${vi.settings.startPage.title}, ${vi.settings.targets.INBOX}`));
    expect(screen.getByTestId('sync-home-view').props.accessibilityState).toMatchObject({ checked: false });

    await fireEvent.press(screen.getByTestId('sync-home-view'));

    await waitFor(() => expect(patchBodies).toEqual([{ syncHomeView: true, startPage: 'INBOX' }]));
  });

  it('the app opens this device start page while sync is off', async () => {
    await AsyncStorage.setItem(HOME_VIEW_STORAGE_KEY, JSON.stringify({ startPage: 'UPCOMING' }));
    routeFetch(mockFetch(), {});
    await renderWithSettings(<StartPageRedirect />, {
      storage: memorySettingsStorage(
        storedSettings({ applied: testAppSettings({ startPage: 'TODAY' }), extra: { syncHomeView: false } }),
      ),
    });

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/upcoming'));
  });

  it('the app ignores a device start page while sync is on', async () => {
    await AsyncStorage.setItem(HOME_VIEW_STORAGE_KEY, JSON.stringify({ startPage: 'UPCOMING' }));
    routeFetch(mockFetch(), {});
    await renderWithSettings(<StartPageRedirect />, {
      storage: memorySettingsStorage(storedSettings({ applied: testAppSettings({ startPage: 'INBOX' }) })),
    });

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/inbox'));
  });

  it('a broken device value falls back to the account start page', async () => {
    await AsyncStorage.setItem(HOME_VIEW_STORAGE_KEY, '{not json');
    routeFetch(mockFetch(), {});
    await renderWithSettings(<StartPageRedirect />, {
      storage: memorySettingsStorage(
        storedSettings({ applied: testAppSettings({ startPage: 'INBOX' }), extra: { syncHomeView: false } }),
      ),
    });

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/inbox'));
  });
});
