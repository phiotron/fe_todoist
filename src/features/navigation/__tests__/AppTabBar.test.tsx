import '../../../i18n';
import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { tokenStore } from '../../../lib/tokenStore';
import { mockFetch } from '../../../test/http';
import { renderWithSettings } from '../../../test/renderSettings';
import { serveSettings } from '../../../test/settingsFixtures';
import { lightPalette as palette } from '../../../theme';
import { AppTabBar, type AppTabBarProps } from '../AppTabBar';

function setup(index: number, emitPrevented = false, extraRoutes: { key: string; name: string }[] = []) {
  // expo-router 58's bar gets `emitter` + `navigateToTab(routeKey)` (not react-navigation's `navigation`).
  const emitter = { emit: jest.fn(() => ({ defaultPrevented: emitPrevented })) };
  const navigateToTab = jest.fn();
  const state = {
    index,
    routes: [
      { key: 'inbox-1', name: 'inbox' },
      { key: 'today-1', name: 'today' },
      { key: 'upcoming-1', name: 'upcoming' },
      { key: 'browse-1', name: 'browse' },
      ...extraRoutes,
    ],
  };
  return { emitter, navigateToTab, props: { state, emitter, navigateToTab, descriptors: {}, insets: { top: 0, bottom: 0, left: 0, right: 0 } } as unknown as AppTabBarProps };
}

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }));

// M3: the bar reads the account's navTabs, so it renders inside the settings providers (default tabs = the M1 four).
const render = (ui: Parameters<typeof renderWithSettings>[0]) => renderWithSettings(ui);

describe('AppTabBar', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    serveSettings(mockFetch());
  });

  it('draws the four tabs with their labels; the current one is selected and accent coloured', async () => {
    const { props } = setup(1);
    await render(<AppTabBar {...props} />);

    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.getByText('Inbox')).toBeOnTheScreen();
    expect(screen.getByText('Sắp tới')).toBeOnTheScreen();
    expect(screen.getByTestId('tab-today')).toBeSelected();
    expect(StyleSheet.flatten(screen.getByText('Hôm nay').props.style)).toMatchObject({ color: palette.acc, fontSize: 11 });
    expect(StyleSheet.flatten(screen.getByText('Inbox').props.style)).toMatchObject({ color: palette.mute });
  });

  it('pressing another tab announces the press and navigates; pressing the current tab does not navigate', async () => {
    const { emitter, navigateToTab, props } = setup(1);
    await render(<AppTabBar {...props} />);

    await fireEvent.press(screen.getByTestId('tab-browse'));
    expect(emitter.emit).toHaveBeenCalledWith({ type: 'tabPress', target: 'browse-1', canPreventDefault: true });
    expect(navigateToTab).toHaveBeenCalledWith('browse-1');

    navigateToTab.mockClear();
    await fireEvent.press(screen.getByTestId('tab-today'));
    expect(navigateToTab).not.toHaveBeenCalled();
  });

  it('warns (dev) instead of silently doing nothing when a tab points at a route the navigator does not have', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const { navigateToTab, props } = setup(1);
      props.state.routes = props.state.routes.filter((route) => route.name !== 'browse');
      await render(<AppTabBar {...props} />);

      await fireEvent.press(screen.getByTestId('tab-browse'));

      expect(navigateToTab).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('browse'));
    } finally {
      warn.mockRestore();
    }
  });

  it('respects a prevented tabPress', async () => {
    const { navigateToTab, props } = setup(1, true);
    await render(<AppTabBar {...props} />);
    await fireEvent.press(screen.getByTestId('tab-inbox'));
    expect(navigateToTab).not.toHaveBeenCalled();
  });

  it('a route that is not in the bar (M2 search opened from Browse) selects no tab', async () => {
    const { props } = setup(4, false, [{ key: 'search-1', name: 'search' }]);
    await render(<AppTabBar {...props} />);
    expect(screen.getByTestId('tab-inbox')).not.toBeSelected();
    expect(screen.getByTestId('tab-browse')).not.toBeSelected();
  });
});
