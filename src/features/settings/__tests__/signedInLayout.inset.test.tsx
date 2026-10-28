import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SignedInLayout from '../../../app/(app)/_layout';
import { layout } from '../../../theme';
import { tokenStore } from '../../../lib/tokenStore';
import { goOffline, goOnline } from '../../../test/network';
import { mockFetch } from '../../../test/http';
import { renderWithSettings } from '../../../test/renderSettings';
import { serveSettings } from '../../../test/settingsFixtures';

// The Stack renders one header screen so the test sees the padding a real screen under the banners gets.
jest.mock('expo-router', () => {
  const { ScreenHeader: Header } = require('../../../components/ScreenHeader');
  const Stack = Object.assign(() => <Header title="Hôm nay" testID="screen-header" />, { Screen: () => null });
  const router = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
  return { Stack, Redirect: () => null, router, useRouter: () => router, usePathname: () => '/' };
});

const insetTop = 28;
const headerPaddingTop = () =>
  StyleSheet.flatten(screen.getByTestId('screen-header').props.style).paddingTop as number;

describe('signed-in layout: status-bar inset under the top banners', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    jest.mocked(useSafeAreaInsets).mockReturnValue({ top: insetTop, bottom: 0, left: 0, right: 0 });
  });
  afterEach(() => {
    goOnline();
    jest.mocked(useSafeAreaInsets).mockReturnValue({ top: 0, bottom: 0, left: 0, right: 0 });
  });

  it('screens do not add the inset again while the time zone banner (online) already covers the status bar', async () => {
    serveSettings(mockFetch());
    await renderWithSettings(<SignedInLayout />, { deviceTimeZone: 'Asia/Tokyo' });
    await screen.findByTestId('tz-banner');

    expect(headerPaddingTop()).toBe(layout.headerGap);
  });

  it('screens keep the inset when no banner covers the status bar (zones match)', async () => {
    serveSettings(mockFetch());
    await renderWithSettings(<SignedInLayout />);
    await screen.findByTestId('screen-header');

    expect(screen.queryByTestId('tz-banner')).toBeNull();
    expect(headerPaddingTop()).toBe(insetTop + layout.headerGap);
  });

  it('screens take the inset back once the banner is dismissed', async () => {
    serveSettings(mockFetch());
    await renderWithSettings(<SignedInLayout />, { deviceTimeZone: 'Asia/Tokyo' });
    await screen.findByTestId('tz-banner');
    await fireEvent.press(screen.getByTestId('tz-banner-dismiss'));

    expect(screen.queryByTestId('tz-banner')).toBeNull();
    expect(headerPaddingTop()).toBe(insetTop + layout.headerGap);
  });

  it('the banner itself still clears the status bar when online', async () => {
    serveSettings(mockFetch());
    await renderWithSettings(<SignedInLayout />, { deviceTimeZone: 'Asia/Tokyo' });
    const banner = await screen.findByTestId('tz-banner');

    expect(StyleSheet.flatten(banner.props.style).paddingTop).toBeGreaterThanOrEqual(insetTop);
  });

  it('offline: the offline banner covers the status bar, so neither the time zone banner nor screens add it', async () => {
    goOffline();
    serveSettings(mockFetch());
    await renderWithSettings(<SignedInLayout />, { deviceTimeZone: 'Asia/Tokyo' });
    const banner = await screen.findByTestId('tz-banner');

    expect(StyleSheet.flatten(banner.props.style).paddingTop).toBeLessThan(insetTop);
    expect(headerPaddingTop()).toBe(layout.headerGap);
  });
});
