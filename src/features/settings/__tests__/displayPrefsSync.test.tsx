import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { describeDue } from '../../../lib/dates';
import { formatDateKey, formatDueLabel } from '../../../lib/dates/format';
import { DEFAULT_DISPLAY_PREFS, getDisplayPrefs, setDisplayPrefs, useDisplayPrefs } from '../../../lib/dates/displayFormat';
import { tokenStore } from '../../../lib/tokenStore';
import { mockFetch } from '../../../test/http';
import { memorySettingsStorage } from '../../../test/memorySettingsStorage';
import { renderWithSettings } from '../../../test/renderSettings';
import { serveSettings, storedSettings, testAppSettings } from '../../../test/settingsFixtures';
import { useSettings } from '../useSettings';

function DateProbe() {
  useDisplayPrefs();
  const { update } = useSettings();
  return (
    <>
      <Text testID="date">{formatDateKey('2026-12-05', true)}</Text>
      <Text testID="switch" onPress={() => void update({ dateFormat: 'MDY', timeFormat: 'H12' })}>
        switch
      </Text>
    </>
  );
}

afterEach(() => setDisplayPrefs(DEFAULT_DISPLAY_PREFS));

describe('SettingsProvider → display format store', () => {
  it('applies the cached date and time format as soon as the settings are read', async () => {
    await tokenStore.clear();
    mockFetch();
    const storage = memorySettingsStorage(storedSettings({ applied: testAppSettings({ dateFormat: 'MDY', timeFormat: 'H12' }) }));

    await renderWithSettings(<DateProbe />, { storage });

    await waitFor(() => expect(getDisplayPrefs()).toEqual({ dateFormat: 'MDY', timeFormat: 'H12' }));
    expect(screen.getByTestId('date').props.children).toBe('12/05/2026');
  });

  it('changing the format in the settings redraws the components that show dates', async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    serveSettings(mockFetch());
    await renderWithSettings(<DateProbe />);
    expect(await screen.findByText('05/12/2026')).toBeTruthy();

    await act(async () => {
      await fireEvent.press(screen.getByTestId('switch'));
    });

    await waitFor(() => expect(screen.getByTestId('date').props.children).toBe('12/05/2026'));
    expect(
      formatDueLabel(
        describeDue({ dueDate: null, dueDatetime: '2026-12-05T14:30:00', durationMinutes: null }, new Date('2026-03-01T03:00:00Z'), 'Asia/Ho_Chi_Minh')!,
      ),
    ).toBe('12/05 2:30 PM');
  });
});
