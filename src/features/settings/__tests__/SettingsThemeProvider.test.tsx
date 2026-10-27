import { act, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { tokenStore } from '../../../lib/tokenStore';
import { mockFetch } from '../../../test/http';
import { memorySettingsStorage } from '../../../test/memorySettingsStorage';
import { renderWithSettings } from '../../../test/renderSettings';
import { serveSettings, settingsResponse, storedSettings, testAppSettings } from '../../../test/settingsFixtures';
import { useTheme } from '../../../theme';
import { PALETTES } from '../../../theme/themes';
import { useSettings } from '../useSettings';

function Probe() {
  const { name, scheme, palette } = useTheme();
  return <Text testID="probe">{`${name}|${scheme}|${palette.acc}`}</Text>;
}

function SyncOff() {
  const { setSyncTheme, update } = useSettings();
  return (
    <Text
      testID="sync-off"
      onPress={async () => {
        await setSyncTheme(false);
        await update({ theme: 'RASPBERRY', appearance: 'LIGHT' });
      }}
    >
      off
    </Text>
  );
}

describe('SettingsThemeProvider', () => {
  it('applies the cached theme and appearance before anything is shown', async () => {
    await tokenStore.clear();
    mockFetch();
    const storage = memorySettingsStorage(storedSettings({ applied: testAppSettings({ theme: 'KALE', appearance: 'DARK' }) }));

    await renderWithSettings(<Probe />, { storage });

    expect((await screen.findByTestId('probe')).props.children).toBe(`KALE|dark|${PALETTES.KALE.dark.acc}`);
  });

  it('follows the account settings, and this device theme while "Sync theme" is off', async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    serveSettings(mockFetch(), { settings: settingsResponse({ theme: 'LAVENDER', appearance: 'DARK' }) });

    await renderWithSettings(
      <>
        <Probe />
        <SyncOff />
      </>,
    );
    expect(await screen.findByText(`LAVENDER|dark|${PALETTES.LAVENDER.dark.acc}`)).toBeTruthy();

    await act(async () => {
      await screen.getByTestId('sync-off').props.onPress();
    });
    expect(screen.getByTestId('probe').props.children).toBe(`RASPBERRY|light|${PALETTES.RASPBERRY.light.acc}`);
  });
});
