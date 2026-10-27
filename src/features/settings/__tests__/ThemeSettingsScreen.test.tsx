import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { viTranslation as vi } from '../../../i18n';
import { tokenStore } from '../../../lib/tokenStore';
import { mockFetch, problem } from '../../../test/http';
import { renderWithSettings } from '../../../test/renderSettings';
import { serveSettings } from '../../../test/settingsFixtures';
import { useTheme } from '../../../theme';
import { PALETTES } from '../../../theme/themes';
import { THEME_NAMES } from '../../../theme/themeNames';
import { ThemeSettingsScreen } from '../ThemeSettingsScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }));

function ThemeProbe() {
  const { name, scheme } = useTheme();
  return <Text testID="theme-probe">{`${name}|${scheme}`}</Text>;
}

async function renderPage() {
  return renderWithSettings(
    <>
      <ThemeSettingsScreen />
      <ThemeProbe />
    </>,
  );
}

describe('ThemeSettingsScreen', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('shows Light / Dark / Auto and the 7 named themes with the current ones selected', async () => {
    serveSettings(mockFetch());
    await renderPage();

    expect(await screen.findByTestId('appearance')).toBeTruthy();
    expect(screen.getByText(vi.settings.appearance.light)).toBeTruthy();
    expect(screen.getByText(vi.settings.appearance.dark)).toBeTruthy();
    expect(screen.getByText(vi.settings.appearance.auto)).toBeTruthy();
    expect(screen.getByTestId('appearance-AUTO').props.accessibilityState).toMatchObject({ selected: true });
    for (const name of THEME_NAMES) {
      expect(screen.getByText(vi.settings.themeNames[name])).toBeTruthy();
    }
    expect(screen.getByTestId('theme-option-TASKLY').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId('theme-sync').props.accessibilityState).toMatchObject({ checked: true });
  });

  it('choosing a theme applies it at once and saves only the theme on the account', async () => {
    const { patchBodies } = serveSettings(mockFetch());
    await renderPage();

    await fireEvent.press(await screen.findByTestId('theme-option-KALE'));

    expect(screen.getByTestId('theme-option-KALE').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId('theme-probe').props.children).toBe('KALE|light');
    await waitFor(() => expect(patchBodies).toEqual([{ theme: 'KALE' }]));
  });

  it('choosing Dark applies it at once and saves only the appearance', async () => {
    const { patchBodies } = serveSettings(mockFetch());
    await renderPage();

    await fireEvent.press(await screen.findByTestId('appearance-DARK'));

    expect(screen.getByTestId('theme-probe').props.children).toBe('TASKLY|dark');
    await waitFor(() => expect(patchBodies).toEqual([{ appearance: 'DARK' }]));
  });

  it('each theme row carries the accent of that theme in the current mode', async () => {
    serveSettings(mockFetch());
    await renderPage();

    const swatch = await screen.findByTestId('theme-swatch-LAVENDER');
    expect(StyleSheet.flatten(swatch.props.style).backgroundColor).toBe(PALETTES.LAVENDER.light.acc);
  });

  it('keeps the choice and explains when saving fails', async () => {
    serveSettings(mockFetch(), { patch: () => problem(503, 'Service Unavailable') });
    await renderPage();

    await fireEvent.press(await screen.findByTestId('theme-option-BLUEBERRY'));

    expect((await screen.findByTestId('theme-error')).props.children).toBe(vi.settings.saveFailed);
    expect(screen.getByTestId('theme-option-BLUEBERRY').props.accessibilityState).toMatchObject({ checked: true });
  });

  it('does not call the server when the current choice is pressed again', async () => {
    const { patchBodies } = serveSettings(mockFetch());
    await renderPage();

    await fireEvent.press(await screen.findByTestId('theme-option-TASKLY'));
    await fireEvent.press(screen.getByTestId('appearance-AUTO'));

    expect(patchBodies).toEqual([]);
  });

  it('with "Sync theme" off the theme changes on this device only', async () => {
    const { patchBodies } = serveSettings(mockFetch());
    await renderPage();

    await fireEvent.press(await screen.findByTestId('theme-sync'));
    expect(screen.getByTestId('theme-sync').props.accessibilityState).toMatchObject({ checked: false });
    await fireEvent.press(screen.getByTestId('theme-option-RASPBERRY'));
    await fireEvent.press(screen.getByTestId('appearance-DARK'));

    expect(screen.getByTestId('theme-probe').props.children).toBe('RASPBERRY|dark');
    expect(patchBodies).toEqual([]);
  });
});
