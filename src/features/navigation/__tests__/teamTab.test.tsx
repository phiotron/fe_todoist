import { screen } from '@testing-library/react-native';
import { tokenStore } from '../../../lib/tokenStore';
import { jsonResponse, mockFetch } from '../../../test/http';
import { makeWorkspace } from '../../../test/m8aFixtures';
import { memorySettingsStorage } from '../../../test/memorySettingsStorage';
import { renderWithSettings } from '../../../test/renderSettings';
import { serveSettings, settingsResponse } from '../../../test/settingsFixtures';
import { AppTabBar, type AppTabBarProps } from '../AppTabBar';
import { TAB_DEFS } from '../navTabs';
import { insertTeamTab, type TabItem } from '../tabBarItems';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }));

const item = (key: string): TabItem => ({ key, route: key.toLowerCase(), title: key, icon: 'inbox' });

describe('insertTeamTab', () => {
  it('puts Team right before the last tab (Browse)', () => {
    const items = insertTeamTab([item('INBOX'), item('TODAY'), item('BROWSE')], TAB_DEFS.TEAM);
    expect(items.map((tab) => tab.key)).toEqual(['INBOX', 'TODAY', 'TEAM', 'BROWSE']);
    expect(items[2]).toMatchObject({ route: 'team', icon: 'users' });
  });

  it('does not add a second Team tab and copes with an empty bar', () => {
    expect(insertTeamTab([item('TEAM'), item('BROWSE')], TAB_DEFS.TEAM).map((tab) => tab.key)).toEqual(['TEAM', 'BROWSE']);
    expect(insertTeamTab([], TAB_DEFS.TEAM).map((tab) => tab.key)).toEqual(['TEAM']);
  });
});

const ROUTES = ['inbox', 'today', 'upcoming', 'team', 'browse', 'pinned'];

async function renderBar(workspaces: unknown) {
  serveSettings(mockFetch(), {
    settings: settingsResponse({ navTabs: ['INBOX', 'TODAY', 'UPCOMING', 'BROWSE'] }),
    routes: { 'GET /api/v1/workspaces': () => jsonResponse(200, workspaces) },
  });
  const props = {
    state: { index: 1, routes: ROUTES.map((name) => ({ key: `${name}-key`, name })) },
    emitter: { emit: jest.fn(() => ({ defaultPrevented: false })) },
    navigateToTab: jest.fn(),
    descriptors: {},
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
  } as unknown as AppTabBarProps;
  await renderWithSettings(<AppTabBar {...props} />, { storage: memorySettingsStorage() });
}

describe('AppTabBar shows the Team tab only for a user with a team workspace (M8a)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('adds the tab before Browse once a TEAM workspace exists', async () => {
    await renderBar([makeWorkspace({ type: 'PERSONAL', name: 'Cá nhân' }), makeWorkspace({ type: 'TEAM' })]);
    expect(await screen.findByTestId('tab-team')).toBeTruthy();
    const tabs = screen.getAllByRole('tab').map((tab) => tab.props.testID);
    expect(tabs).toEqual(['tab-inbox', 'tab-today', 'tab-upcoming', 'tab-team', 'tab-browse']);
  });

  it('keeps the usual bar when the user only has the personal workspace', async () => {
    await renderBar([makeWorkspace({ type: 'PERSONAL', name: 'Cá nhân' })]);
    expect(await screen.findByTestId('tab-browse')).toBeTruthy();
    expect(screen.queryByTestId('tab-team')).toBeNull();
  });
});
