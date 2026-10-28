import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { SettingsResponse } from '../../../api/settings';
import { SnackbarProvider } from '../../../components/Snackbar';
import { tokenStore } from '../../../lib/tokenStore';
import { testUser } from '../../../test/fixtures';
import { jsonResponse, mockFetch } from '../../../test/http';
import { inboxProject } from '../../../test/m1Fixtures';
import { renderWithSettings } from '../../../test/renderSettings';
import { serveSettings, settingsResponse } from '../../../test/settingsFixtures';
import { BrowseScreen } from '../../browse/BrowseScreen';
import { browseShortcuts } from '../browseShortcuts';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));

const ALL = ['INBOX', 'TODAY', 'UPCOMING', 'FILTERS_LABELS', 'REPORTING', 'BROWSE_TEMPLATES'] as const;

async function renderBrowse(settings: Record<string, unknown>) {
  serveSettings(mockFetch(), {
    settings: { ...settingsResponse(), ...settings } as SettingsResponse,
    routes: {
      'GET /api/v1/me': () => jsonResponse(200, testUser),
      'GET /api/v1/projects': () => jsonResponse(200, [{ ...inboxProject, activeTaskCount: 4 }]),
      'GET /api/v1/favorites': () => jsonResponse(200, []),
      'GET /api/v1/labels': () => jsonResponse(200, []),
      'GET /api/v1/filters': () => jsonResponse(200, []),
    },
  });
  await renderWithSettings(
    <SnackbarProvider>
      <BrowseScreen />
    </SnackbarProvider>,
  );
}

const shortcutIds = () => screen.getAllByTestId(/^browse-shortcut-/).map((node) => node.props.testID);

describe('browseShortcuts (M3x Navigation menu)', () => {
  const keys = (items: readonly (typeof ALL)[number][], navTabs: string[]) =>
    browseShortcuts(items, navTabs).map((shortcut) => shortcut.key);

  it('default menu + default tab bar: only Filters & Labels, then Completed', () => {
    expect(keys(ALL, ['INBOX', 'TODAY', 'UPCOMING', 'BROWSE'])).toEqual(['filters-labels', 'completed']);
  });

  it('follows the menu order and skips Reporting / Browse templates (no screen yet)', () => {
    expect(keys(['REPORTING', 'UPCOMING', 'INBOX', 'BROWSE_TEMPLATES'], ['SEARCH', 'FILTERS_LABELS', 'BROWSE'])).toEqual([
      'upcoming',
      'inbox',
      'completed',
    ]);
  });

  it('an empty menu leaves only Completed', () => {
    expect(keys([], ['SEARCH', 'FILTERS_LABELS', 'BROWSE'])).toEqual(['completed']);
  });
});

describe('Browse with Navigation menu settings (M3x)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('shows the menu items that are not on the tab bar, in menu order, with the Inbox count', async () => {
    await renderBrowse({
      navTabs: ['SEARCH', 'FILTERS_LABELS', 'BROWSE'],
      navMenuItems: ['UPCOMING', 'TODAY', 'INBOX', 'FILTERS_LABELS', 'REPORTING'],
      navMenuShowTaskCount: true,
    });

    expect(await screen.findByTestId('browse-shortcut-upcoming')).toBeOnTheScreen();
    expect(shortcutIds()).toEqual([
      'browse-shortcut-upcoming',
      'browse-shortcut-today',
      'browse-shortcut-inbox',
      'browse-shortcut-completed',
    ]);
    expect(await screen.findByText('4')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('browse-shortcut-upcoming'));
    expect(router.navigate).toHaveBeenCalledWith('/upcoming');
    await fireEvent.press(screen.getByTestId('browse-shortcut-inbox'));
    expect(router.navigate).toHaveBeenCalledWith('/inbox');
  });

  it('"Show task count" off hides the Inbox count', async () => {
    await renderBrowse({ navTabs: ['SEARCH', 'TODAY', 'BROWSE'], navMenuItems: ['INBOX'], navMenuShowTaskCount: false });

    expect(await screen.findByTestId('browse-shortcut-inbox')).toBeOnTheScreen();
    await screen.findByTestId('browse-shortcut-completed');
    expect(screen.queryByText('4')).toBeNull();
  });

  it('a settings cache from before M3x shows the default menu minus the tab bar', async () => {
    await renderBrowse({ navTabs: ['TODAY', 'UPCOMING', 'BROWSE'] });

    expect(await screen.findByTestId('browse-shortcut-inbox')).toBeOnTheScreen();
    expect(shortcutIds()).toEqual(['browse-shortcut-inbox', 'browse-shortcut-filters-labels', 'browse-shortcut-completed']);
  });
});
