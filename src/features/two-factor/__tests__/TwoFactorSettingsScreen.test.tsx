import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { Linking } from 'react-native';
import { viTranslation as vi } from '../../../i18n';
import { tokenStore } from '../../../lib/tokenStore';
import { countRequests, jsonResponse, mockFetch, problem, requestAt } from '../../../test/http';
import type { RouteHandler } from '../../../test/m3Routes';
import { renderWithSettings } from '../../../test/renderSettings';
import { serveSettings } from '../../../test/settingsFixtures';
import { TwoFactorSettingsScreen } from '../TwoFactorSettingsScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));
jest.mock('../OtpQrCode', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    OtpQrCode: function OtpQrCode(props: { value: string }) {
      return React.createElement(View, { testID: 'qr-code', accessibilityLabel: props.value });
    },
  };
});

const SECRET = 'FIXTURESECRET';
const OTPAUTH = 'otpauth://totp/Taskly:an%40example.com?secret=FIXTURESECRET&issuer=Taskly';
const CODES = Array.from({ length: 10 }, (_, index) => `fixture-recovery-${index + 1}`);
const NEW_CODES = Array.from({ length: 10 }, (_, index) => `fixture-new-recovery-${index + 1}`);

interface Backend {
  enabled: boolean;
  left: number;
  setup?: RouteHandler;
  enable?: RouteHandler;
  disable?: RouteHandler;
  recovery?: RouteHandler;
}

function serveTwoFactor(initial: Backend) {
  const state = { enabled: initial.enabled, left: initial.left };
  const fetchMock = mockFetch();
  serveSettings(fetchMock, {
    routes: {
      'GET /api/v1/me/2fa': () => jsonResponse(200, { enabled: state.enabled, recoveryCodesLeft: state.left }),
      'POST /api/v1/me/2fa/setup': initial.setup ?? (() => jsonResponse(200, { secret: SECRET, otpauthUri: OTPAUTH })),
      'POST /api/v1/me/2fa/enable':
        initial.enable ??
        (() => {
          state.enabled = true;
          state.left = 10;
          return jsonResponse(200, { recoveryCodes: CODES });
        }),
      'POST /api/v1/me/2fa/recovery-codes': initial.recovery ?? (() => jsonResponse(200, { recoveryCodes: NEW_CODES })),
      'POST /api/v1/me/2fa/disable':
        initial.disable ??
        (() => {
          state.enabled = false;
          state.left = 0;
          return jsonResponse(204);
        }),
    },
  });
  return fetchMock;
}

function bodiesOf(fetchMock: ReturnType<typeof mockFetch>, path: string): unknown[] {
  return fetchMock.mock.calls
    .map((_, index) => requestAt(fetchMock, index))
    .filter((request) => request.url.endsWith(path))
    .map((request) => request.body);
}

describe('TwoFactorSettingsScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('off: explains and offers to turn it on', async () => {
    serveTwoFactor({ enabled: false, left: 0 });
    await renderWithSettings(<TwoFactorSettingsScreen />);

    expect((await screen.findByTestId('two-factor-status')).props.children).toBe(vi.twoFactor.settings.statusOff);
    expect(screen.getByTestId('two-factor-enable')).toBeTruthy();
    expect(screen.queryByTestId('two-factor-disable-open')).toBeNull();
  });

  it('turning it on shows the QR code of the otpauth URI and the secret key', async () => {
    serveTwoFactor({ enabled: false, left: 0 });
    await renderWithSettings(<TwoFactorSettingsScreen />);

    await fireEvent.press(await screen.findByTestId('two-factor-enable'));

    expect((await screen.findByTestId('qr-code')).props.accessibilityLabel).toBe(OTPAUTH);
    expect(screen.getByTestId('two-factor-secret').props.children).toBe(SECRET);
    expect(screen.getByText(vi.twoFactor.settings.scanTitle)).toBeTruthy();
    expect(screen.getByText(vi.twoFactor.settings.confirmTitle)).toBeTruthy();
  });

  it('copies the secret key and can open the authenticator app on this device', async () => {
    serveTwoFactor({ enabled: false, left: 0 });
    const openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderWithSettings(<TwoFactorSettingsScreen />);
    await fireEvent.press(await screen.findByTestId('two-factor-enable'));

    await fireEvent.press(await screen.findByTestId('two-factor-copy-secret'));
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(SECRET);
    expect(await screen.findByText(vi.twoFactor.settings.copied)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('two-factor-open-app'));
    expect(openUrl).toHaveBeenCalledWith(OTPAUTH);
  });

  it('checks the confirmation code on the device first (6 digits)', async () => {
    const fetchMock = serveTwoFactor({ enabled: false, left: 0 });
    await renderWithSettings(<TwoFactorSettingsScreen />);
    await fireEvent.press(await screen.findByTestId('two-factor-enable'));

    await fireEvent.changeText(await screen.findByTestId('two-factor-setup-code'), '12ab');
    await fireEvent.press(screen.getByTestId('two-factor-setup-confirm'));

    expect((await screen.findByTestId('two-factor-setup-error')).props.children).toBe(vi.twoFactor.login.codeFormat);
    expect(bodiesOf(fetchMock, '/me/2fa/enable')).toEqual([]);
  });

  it('a wrong code (400) keeps the setup open; the right one shows the 10 recovery codes once', async () => {
    let tries = 0;
    serveTwoFactor({
      enabled: false,
      left: 0,
      enable: () => {
        tries += 1;
        return tries === 1 ? problem(400, 'Bad Request') : jsonResponse(200, { recoveryCodes: CODES });
      },
    });
    await renderWithSettings(<TwoFactorSettingsScreen />);
    await fireEvent.press(await screen.findByTestId('two-factor-enable'));

    await fireEvent.changeText(await screen.findByTestId('two-factor-setup-code'), '000000');
    await fireEvent.press(screen.getByTestId('two-factor-setup-confirm'));
    expect((await screen.findByTestId('two-factor-setup-error')).props.children).toBe(vi.twoFactor.settings.wrongCode);
    expect(screen.getByTestId('two-factor-setup-code').props.value).toBe('000000');

    await fireEvent.changeText(screen.getByTestId('two-factor-setup-code'), '123456');
    await fireEvent.press(screen.getByTestId('two-factor-setup-confirm'));

    expect(await screen.findByTestId('two-factor-code-10')).toBeTruthy();
    expect(screen.getByTestId('two-factor-code-1').props.children).toBe('fixture-recovery-1');
    expect(screen.queryByTestId('qr-code')).toBeNull();
    expect(screen.getByText(vi.twoFactor.settings.recoveryHint)).toBeTruthy();
  });

  it('copies all recovery codes, then "I have saved the codes" hides them and shows the status as on', async () => {
    serveTwoFactor({ enabled: false, left: 0 });
    await renderWithSettings(<TwoFactorSettingsScreen />);
    await fireEvent.press(await screen.findByTestId('two-factor-enable'));
    await fireEvent.changeText(await screen.findByTestId('two-factor-setup-code'), '123456');
    await fireEvent.press(screen.getByTestId('two-factor-setup-confirm'));

    await fireEvent.press(await screen.findByTestId('two-factor-copy-codes'));
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(CODES.join('\n'));

    await fireEvent.press(screen.getByTestId('two-factor-codes-saved'));

    expect(screen.queryByTestId('two-factor-code-1')).toBeNull();
    await waitFor(() =>
      expect(screen.getByTestId('two-factor-status').props.children).toBe(vi.twoFactor.settings.statusOn.replace('{{count}}', '10')),
    );
    expect(screen.getByTestId('two-factor-disable-open')).toBeTruthy();
  });

  it('a setup that expired (409 two-factor-not-setup) goes back to the start with an explanation', async () => {
    serveTwoFactor({ enabled: false, left: 0, enable: () => problem(409, 'Conflict', { code: 'two-factor-not-setup' }) });
    await renderWithSettings(<TwoFactorSettingsScreen />);
    await fireEvent.press(await screen.findByTestId('two-factor-enable'));
    await fireEvent.changeText(await screen.findByTestId('two-factor-setup-code'), '123456');

    await fireEvent.press(screen.getByTestId('two-factor-setup-confirm'));

    expect((await screen.findByTestId('two-factor-notice')).props.children).toBe(vi.twoFactor.settings.notSetup);
    expect(screen.getByTestId('two-factor-enable')).toBeTruthy();
    expect(screen.queryByTestId('qr-code')).toBeNull();
  });

  it('already enabled elsewhere (409 two-factor-already-enabled): says so and shows the status as on', async () => {
    const state = { enabled: false };
    const fetchMock = mockFetch();
    serveSettings(fetchMock, {
      routes: {
        'GET /api/v1/me/2fa': () => jsonResponse(200, { enabled: state.enabled, recoveryCodesLeft: state.enabled ? 4 : 0 }),
        'POST /api/v1/me/2fa/setup': () => {
          state.enabled = true;
          return problem(409, 'Conflict', { code: 'two-factor-already-enabled' });
        },
      },
    });
    await renderWithSettings(<TwoFactorSettingsScreen />);

    await fireEvent.press(await screen.findByTestId('two-factor-enable'));

    expect((await screen.findByTestId('two-factor-notice')).props.children).toBe(vi.twoFactor.settings.alreadyEnabled);
    await waitFor(() => expect(screen.getByTestId('two-factor-disable-open')).toBeTruthy());
  });

  it('Cancel drops the setup without a request and forgets the secret', async () => {
    const fetchMock = serveTwoFactor({ enabled: false, left: 0 });
    await renderWithSettings(<TwoFactorSettingsScreen />);
    await fireEvent.press(await screen.findByTestId('two-factor-enable'));
    await screen.findByTestId('qr-code');

    await fireEvent.press(screen.getByTestId('two-factor-setup-cancel'));

    expect(screen.queryByTestId('two-factor-secret')).toBeNull();
    expect(bodiesOf(fetchMock, '/me/2fa/enable')).toEqual([]);
  });

  it('on: shows how many recovery codes are left and generates new ones with a current code', async () => {
    const fetchMock = serveTwoFactor({ enabled: true, left: 3 });
    await renderWithSettings(<TwoFactorSettingsScreen />);
    expect((await screen.findByTestId('two-factor-status')).props.children).toBe(vi.twoFactor.settings.statusOn.replace('{{count}}', '3'));

    await fireEvent.changeText(screen.getByTestId('two-factor-regen-code'), '123456');
    await fireEvent.press(screen.getByTestId('two-factor-regen-submit'));

    expect(await screen.findByTestId('two-factor-code-10')).toBeTruthy();
    expect(screen.getByTestId('two-factor-code-1').props.children).toBe('fixture-new-recovery-1');
    expect(bodiesOf(fetchMock, '/me/2fa/recovery-codes')).toEqual([{ code: '123456' }]);
  });

  it('a wrong code when generating new recovery codes is explained, nothing changes', async () => {
    serveTwoFactor({ enabled: true, left: 3, recovery: () => problem(400, 'Bad Request') });
    await renderWithSettings(<TwoFactorSettingsScreen />);

    await fireEvent.changeText(await screen.findByTestId('two-factor-regen-code'), '000000');
    await fireEvent.press(screen.getByTestId('two-factor-regen-submit'));

    expect((await screen.findByTestId('two-factor-regen-error')).props.children).toBe(vi.twoFactor.settings.wrongCode);
    expect(screen.queryByTestId('two-factor-code-1')).toBeNull();
  });

  it('turning it off asks first (BR-11) and needs the password and a code', async () => {
    const fetchMock = serveTwoFactor({ enabled: true, left: 10 });
    await renderWithSettings(<TwoFactorSettingsScreen />);

    await fireEvent.press(await screen.findByTestId('two-factor-disable-open'));
    expect(screen.getByText(vi.twoFactor.settings.disableMessage)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('two-factor-disable-dialog-confirm'));
    expect((await screen.findByTestId('two-factor-disable-dialog-error')).props.children).toBe(vi.auth.validation.passwordRequired);
    await fireEvent.changeText(screen.getByTestId('two-factor-disable-password'), 'fixture-pass-1');
    await fireEvent.press(screen.getByTestId('two-factor-disable-dialog-confirm'));
    expect(screen.getByTestId('two-factor-disable-dialog-error').props.children).toBe(vi.twoFactor.settings.codeRequired);

    expect(bodiesOf(fetchMock, '/me/2fa/disable')).toEqual([]);
  });

  it('turning it off sends password and code, then shows the status as off', async () => {
    const fetchMock = serveTwoFactor({ enabled: true, left: 10 });
    await renderWithSettings(<TwoFactorSettingsScreen />);

    await fireEvent.press(await screen.findByTestId('two-factor-disable-open'));
    await fireEvent.changeText(screen.getByTestId('two-factor-disable-password'), 'fixture-pass-1');
    await fireEvent.changeText(screen.getByTestId('two-factor-disable-code'), '123456');
    await fireEvent.press(screen.getByTestId('two-factor-disable-dialog-confirm'));

    await waitFor(() => expect(screen.getByTestId('two-factor-status').props.children).toBe(vi.twoFactor.settings.statusOff));
    expect(bodiesOf(fetchMock, '/me/2fa/disable')).toEqual([{ password: 'fixture-pass-1', code: '123456' }]);
    expect(screen.getByTestId('two-factor-notice').props.children).toBe(vi.twoFactor.settings.disabled);
  });

  it('a wrong password or code when turning it off (400) is explained in the dialog', async () => {
    serveTwoFactor({ enabled: true, left: 10, disable: () => problem(400, 'Bad Request') });
    await renderWithSettings(<TwoFactorSettingsScreen />);

    await fireEvent.press(await screen.findByTestId('two-factor-disable-open'));
    await fireEvent.changeText(screen.getByTestId('two-factor-disable-password'), 'fixture-wrong-1');
    await fireEvent.changeText(screen.getByTestId('two-factor-disable-code'), '000000');
    await fireEvent.press(screen.getByTestId('two-factor-disable-dialog-confirm'));

    expect((await screen.findByTestId('two-factor-disable-dialog-error')).props.children).toBe(
      vi.twoFactor.settings.wrongCredentials,
    );
    expect(screen.getByTestId('two-factor-status').props.children).toContain('10');
  });

  it('never touches the network for anything but its own 2FA calls', async () => {
    const fetchMock = serveTwoFactor({ enabled: false, left: 0 });
    await renderWithSettings(<TwoFactorSettingsScreen />);
    await screen.findByTestId('two-factor-enable');
    await act(async () => undefined);

    expect(countRequests(fetchMock, '/api/v1/me/2fa')).toBe(1);
  });
});
