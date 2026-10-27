import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { tokenStore } from '../../../lib/tokenStore';
import { mockFetch } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import { ThemeProvider } from '../../../theme';
import { darkPalette, lightPalette } from '../../../theme/palette';
import { PALETTES } from '../../../theme/themes';
import { AuthLogo } from '../AuthLogo';
import { LoginScreen } from '../LoginScreen';
import { RegisterScreen } from '../RegisterScreen';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canDismiss: jest.fn(() => false), dismissAll: jest.fn() },
}));

function styleOf(testID: string, prop: 'style' | 'contentContainerStyle' = 'style') {
  return StyleSheet.flatten(screen.getByTestId(testID).props[prop]);
}

describe('auth screens follow the theme', () => {
  beforeEach(async () => {
    await tokenStore.clear();
    mockFetch();
  });

  it('login uses TASKLY light by default (M-Auth: 48-high inputs, accent button)', async () => {
    await renderWithProviders(<LoginScreen />);
    expect(styleOf('keyboard-screen-scroll', 'contentContainerStyle').backgroundColor).toBe(lightPalette.bg);
    expect(styleOf('login-email').color).toBe(lightPalette.ink);
    expect(styleOf('login-email').height).toBe(48);
    expect(styleOf('login-submit').backgroundColor).toBe(lightPalette.acc);
  });

  it('login switches to the dark palette', async () => {
    await renderWithProviders(
      <ThemeProvider theme="TASKLY" appearance="DARK">
        <LoginScreen />
      </ThemeProvider>,
    );
    expect(styleOf('keyboard-screen-scroll', 'contentContainerStyle').backgroundColor).toBe(darkPalette.bg);
    expect(styleOf('login-email').color).toBe(darkPalette.ink);
    expect(styleOf('login-email').borderColor).toBe(darkPalette.line2);
    expect(styleOf('login-submit').backgroundColor).toBe(darkPalette.acc);
    expect(screen.getByTestId('login-email').props.placeholderTextColor).toBe(darkPalette.mute);
  });

  it('register switches to the dark palette', async () => {
    await renderWithProviders(
      <ThemeProvider theme="TASKLY" appearance="DARK">
        <RegisterScreen />
      </ThemeProvider>,
    );
    expect(styleOf('keyboard-screen-scroll', 'contentContainerStyle').backgroundColor).toBe(darkPalette.bg);
    expect(styleOf('register-displayName').color).toBe(darkPalette.ink);
  });

  it('AuthLogo draws the Taskly mark in the accent of the theme', async () => {
    await render(
      <ThemeProvider theme="KALE" appearance="LIGHT">
        <AuthLogo />
      </ThemeProvider>,
    );
    expect(screen.getByText('Taskly')).toBeTruthy();
    expect(styleOf('auth-logo-mark').backgroundColor).toBe(PALETTES.KALE.light.acc);
  });
});
