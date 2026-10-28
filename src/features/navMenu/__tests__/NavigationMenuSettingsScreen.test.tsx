import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { viTranslation as vi } from '../../../i18n';
import { tokenStore } from '../../../lib/tokenStore';
import { testUser } from '../../../test/fixtures';
import { jsonResponse, mockFetch, problem } from '../../../test/http';
import { renderWithSettings } from '../../../test/renderSettings';
import { serveSettings, settingsResponse, type ServeSettingsOptions } from '../../../test/settingsFixtures';
import { SettingsScreen } from '../../settings/SettingsScreen';
import { NavigationMenuSettingsScreen } from '../NavigationMenuSettingsScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }));

const ALL = ['INBOX', 'TODAY', 'UPCOMING', 'FILTERS_LABELS', 'REPORTING', 'BROWSE_TEMPLATES'];

function serveMenu(extra: Record<string, unknown> = {}, patch?: ServeSettingsOptions['patch']) {
  return serveSettings(mockFetch(), {
    settings: { ...settingsResponse(), navMenuShowTaskCount: true, navMenuItems: ALL, ...extra } as ReturnType<typeof settingsResponse>,
    patch,
  });
}

describe('NavigationMenuSettingsScreen (M3x)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('lists the six Todoist items, notes the ones on the tab bar and the ones coming later', async () => {
    serveMenu();
    await renderWithSettings(<NavigationMenuSettingsScreen />);

    await screen.findByTestId('nav-menu-INBOX');
    const order = screen.getAllByTestId(/^nav-menu-[A-Z_]+$/).map((node) => node.props.testID);
    expect(order).toEqual(ALL.map((item) => `nav-menu-${item}`));
    expect(screen.getByTestId('nav-menu-INBOX')).toHaveTextContent(new RegExp(vi.navMenu.onTabBar));
    expect(screen.getByTestId('nav-menu-FILTERS_LABELS')).not.toHaveTextContent(new RegExp(vi.navMenu.onTabBar));
    expect(screen.getByTestId('nav-menu-REPORTING')).toHaveTextContent(new RegExp(vi.navMenu.comingLater));
    expect(screen.getByTestId('nav-menu-count').props.accessibilityState).toMatchObject({ checked: true });
  });

  it('turning "Show task count" off saves navMenuShowTaskCount=false', async () => {
    const { patchBodies } = serveMenu();
    await renderWithSettings(<NavigationMenuSettingsScreen />);

    await fireEvent.press(await screen.findByTestId('nav-menu-count'));

    await waitFor(() => expect(patchBodies).toEqual([{ navMenuShowTaskCount: false }]));
    await waitFor(() => expect(screen.getByTestId('nav-menu-count').props.accessibilityState).toMatchObject({ checked: false }));
  });

  it('hiding an item removes it from the list; showing it again adds it at the end', async () => {
    const { patchBodies } = serveMenu({ navMenuItems: ['INBOX', 'TODAY'] });
    await renderWithSettings(<NavigationMenuSettingsScreen />);

    await fireEvent.press(await screen.findByTestId('nav-menu-INBOX-toggle'));
    await waitFor(() => expect(patchBodies).toEqual([{ navMenuItems: ['TODAY'] }]));

    await fireEvent.press(screen.getByTestId('nav-menu-UPCOMING-toggle'));
    await waitFor(() => expect(patchBodies[1]).toEqual({ navMenuItems: ['TODAY', 'UPCOMING'] }));
  });

  it('moves a shown item up; the first cannot go up and the last cannot go down', async () => {
    const { patchBodies } = serveMenu({ navMenuItems: ['INBOX', 'TODAY', 'UPCOMING'] });
    await renderWithSettings(<NavigationMenuSettingsScreen />);

    expect((await screen.findByTestId('nav-menu-INBOX-up')).props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByTestId('nav-menu-UPCOMING-down').props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.queryByTestId('nav-menu-REPORTING-up')).toBeNull();

    await fireEvent.press(screen.getByTestId('nav-menu-UPCOMING-up'));

    await waitFor(() => expect(patchBodies).toEqual([{ navMenuItems: ['INBOX', 'UPCOMING', 'TODAY'] }]));
  });

  it('a rejected save shows the reason and keeps the list', async () => {
    serveMenu({}, () => problem(400, 'Bad request'));
    await renderWithSettings(<NavigationMenuSettingsScreen />);

    await fireEvent.press(await screen.findByTestId('nav-menu-INBOX-toggle'));

    expect(await screen.findByTestId('nav-menu-error')).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByTestId('nav-menu-INBOX-toggle').props.accessibilityState).toMatchObject({ checked: true }),
    );
  });

  it('is reached from the Settings home', async () => {
    serveSettings(mockFetch(), { routes: { 'GET /api/v1/me': () => jsonResponse(200, testUser) } });
    await renderWithSettings(<SettingsScreen />);

    await fireEvent.press(await screen.findByTestId('settings-row-navigation-menu'));

    expect(router.push).toHaveBeenCalledWith('/settings/navigation-menu');
  });
});
