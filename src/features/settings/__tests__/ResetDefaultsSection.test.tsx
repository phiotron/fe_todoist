import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { viTranslation as vi } from '../../../i18n';
import { tokenStore } from '../../../lib/tokenStore';
import { jsonResponse, mockFetch } from '../../../test/http';
import type { RouteHandler } from '../../../test/m3Routes';
import { renderWithSettings } from '../../../test/renderSettings';
import { serveSettings, settingsResponse } from '../../../test/settingsFixtures';
import { useTheme } from '../../../theme';
import { ResetDefaultsSection } from '../ResetDefaultsSection';

function SchemeProbe() {
  const { scheme } = useTheme();
  return <Text testID="scheme">{scheme}</Text>;
}

function serveReset(handler: RouteHandler) {
  let resetCalls = 0;
  serveSettings(mockFetch(), {
    settings: settingsResponse({ appearance: 'DARK' }),
    routes: {
      'POST /api/v1/me/settings/reset': (request) => {
        resetCalls += 1;
        return handler(request);
      },
    },
  });
  return { resetCalls: () => resetCalls };
}

async function renderReset() {
  await renderWithSettings(
    <>
      <ResetDefaultsSection />
      <SchemeProbe />
    </>,
  );
  await waitFor(() => expect(screen.getByTestId('scheme').props.children).toBe('dark'));
}

describe('ResetDefaultsSection', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('asks for confirmation first (BR-11) without calling the server', async () => {
    const server = serveReset(() => jsonResponse(200, settingsResponse()));
    await renderReset();

    await fireEvent.press(screen.getByTestId('settings-reset'));

    expect(screen.getByText(vi.settings.reset.confirmTitle)).toBeTruthy();
    expect(screen.getByText(vi.settings.reset.confirmMessage)).toBeTruthy();
    expect(server.resetCalls()).toBe(0);
  });

  it('Cancel closes the dialog and changes nothing', async () => {
    const server = serveReset(() => jsonResponse(200, settingsResponse()));
    await renderReset();
    await fireEvent.press(screen.getByTestId('settings-reset'));

    await fireEvent.press(screen.getByTestId('settings-reset-dialog-cancel'));

    expect(server.resetCalls()).toBe(0);
    expect(screen.queryByText(vi.settings.reset.confirmTitle)).toBeNull();
    expect(screen.getByTestId('scheme').props.children).toBe('dark');
  });

  it('confirming restores the defaults and says so', async () => {
    const server = serveReset(() => jsonResponse(200, settingsResponse()));
    await renderReset();
    await fireEvent.press(screen.getByTestId('settings-reset'));

    await fireEvent.press(screen.getByTestId('settings-reset-dialog-confirm'));

    expect((await screen.findByTestId('settings-reset-done')).props.children).toBe(vi.settings.reset.done);
    expect(server.resetCalls()).toBe(1);
    expect(screen.getByTestId('scheme').props.children).toBe('light');
    expect(screen.queryByText(vi.settings.reset.confirmTitle)).toBeNull();
  });

  it('a failure is shown in the dialog and keeps the current settings', async () => {
    serveReset(() => {
      throw new TypeError('Network request failed');
    });
    await renderReset();
    await fireEvent.press(screen.getByTestId('settings-reset'));

    await fireEvent.press(screen.getByTestId('settings-reset-dialog-confirm'));

    expect((await screen.findByTestId('settings-reset-dialog-error')).props.children).toBe(vi.errors.network);
    expect(screen.getByTestId('scheme').props.children).toBe('dark');
  });
});
