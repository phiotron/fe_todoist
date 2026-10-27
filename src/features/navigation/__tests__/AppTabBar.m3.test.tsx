import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { tokenStore } from '../../../lib/tokenStore';
import { jsonResponse, mockFetch } from '../../../test/http';
import { memorySettingsStorage } from '../../../test/memorySettingsStorage';
import { renderWithSettings } from '../../../test/renderSettings';
import { serveSettings, settingsResponse } from '../../../test/settingsFixtures';
import { AppTabBar, type AppTabBarProps } from '../AppTabBar';
import { TAB_DEFS } from '../navTabs';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }));

const P1 = '11111111-1111-4111-8111-111111111111';
const ROUTES = ['inbox', 'today', 'upcoming', 'browse', 'pinned'];
const titleOf = (key: keyof typeof TAB_DEFS) => TAB_DEFS[key].title();

function fakeProps(active: string) {
  // expo-router 58's bar gets `emitter` + `navigateToTab(routeKey)` (not react-navigation's `navigation`).
  const emitter = { emit: jest.fn(() => ({ defaultPrevented: false })) };
  const navigateToTab = jest.fn();
  const props = {
    state: { index: ROUTES.indexOf(active), routes: ROUTES.map((name) => ({ key: `${name}-key`, name })) },
    emitter,
    navigateToTab,
    descriptors: {},
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
  } as unknown as AppTabBarProps;
  return { props, navigateToTab };
}

async function renderBar(navTabs: string[], active = 'today') {
  serveSettings(mockFetch(), {
    settings: settingsResponse({ navTabs }),
    routes: { 'GET /api/v1/projects': () => jsonResponse(200, [{ id: P1, name: 'Marketing', isInbox: false, archivedAt: null }]) },
  });
  const { props, navigateToTab } = fakeProps(active);
  await renderWithSettings(<AppTabBar {...props} />, { storage: memorySettingsStorage() });
  return { navigateToTab };
}

describe('AppTabBar follows the navTabs setting', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('shows only the configured tabs, in order', async () => {
    await renderBar(['TODAY', 'UPCOMING', 'BROWSE']);

    expect(await screen.findByText(titleOf('TODAY'))).toBeTruthy();
    expect(screen.getByText(titleOf('UPCOMING'))).toBeTruthy();
    expect(screen.getByText(titleOf('BROWSE'))).toBeTruthy();
    expect(screen.queryByText(titleOf('INBOX'))).toBeNull();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('shows the pinned project as a tab named after it, selected on the pinned route', async () => {
    await renderBar(['INBOX', 'TODAY', `project:${P1}`, 'BROWSE'], 'pinned');

    expect(await screen.findByText('Marketing')).toBeTruthy();
    expect(screen.getByTestId('tab-pinned')).toBeSelected();
  });

  it('pressing a tab navigates to its route', async () => {
    const { navigateToTab } = await renderBar(['TODAY', 'UPCOMING', 'BROWSE']);

    await fireEvent.press(await screen.findByText(titleOf('UPCOMING')));

    expect(navigateToTab).toHaveBeenCalledWith('upcoming-key');
  });

  it('pressing and holding a tab opens the tab bar settings (Edit Tab Bar)', async () => {
    await renderBar(['TODAY', 'UPCOMING', 'BROWSE']);

    await fireEvent(await screen.findByText(titleOf('TODAY')), 'longPress');

    expect(router.push).toHaveBeenCalledWith('/settings/navigation');
  });
});
