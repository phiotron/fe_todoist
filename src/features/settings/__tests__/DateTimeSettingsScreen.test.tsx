import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { viTranslation as vi } from '../../../i18n';
import { tokenStore } from '../../../lib/tokenStore';
import { mockFetch, problem } from '../../../test/http';
import { renderWithSettings } from '../../../test/renderSettings';
import { serveSettings } from '../../../test/settingsFixtures';
import { DateTimeSettingsScreen } from '../DateTimeSettingsScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }));

const weekday = (n: 1 | 2 | 3 | 4 | 5 | 6 | 7) => vi.settings.dateTime.weekdays[n];

describe('DateTimeSettingsScreen', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('shows the five settings with their spec defaults', async () => {
    serveSettings(mockFetch());
    await renderWithSettings(<DateTimeSettingsScreen />);

    expect(await screen.findByTestId('date-time-settings-screen')).toBeTruthy();
    expect(screen.getByTestId('date-start-day').props.accessibilityLabel).toBe(`${vi.settings.dateTime.startDay}, ${weekday(1)}`);
    expect(screen.getByTestId('date-next-week').props.accessibilityLabel).toBe(`${vi.settings.dateTime.nextWeek}, ${weekday(1)}`);
    expect(screen.getByTestId('date-weekend').props.accessibilityLabel).toBe(`${vi.settings.dateTime.weekend}, ${weekday(6)}`);
    expect(screen.getByText(vi.settings.dateTime.dmy)).toBeTruthy();
    expect(screen.getByText(vi.settings.dateTime.h24)).toBeTruthy();
  });

  it.each([
    ['date-start-day', 'startDay', 7],
    ['date-next-week', 'nextWeek', 3],
    ['date-weekend', 'weekendStartDay', 5],
  ])('%s saves only %s', async (testID, field, day) => {
    const { patchBodies } = serveSettings(mockFetch());
    await renderWithSettings(<DateTimeSettingsScreen />);

    await fireEvent.press(await screen.findByTestId(testID));
    await fireEvent.press(screen.getByTestId(`${testID}-option-${day}`));

    await waitFor(() => expect(patchBodies).toEqual([{ [field]: day }]));
  });

  it('date format MDY and 12-hour time are saved and shown in the example line', async () => {
    const { patchBodies } = serveSettings(mockFetch());
    await renderWithSettings(<DateTimeSettingsScreen />);
    const example = (date: string, time: string) =>
      vi.settings.dateTime.example.replace('{{date}}', date).replace('{{time}}', time);
    expect(await screen.findByText(example('26/10/2026', '14:30'))).toBeTruthy();

    await fireEvent.press(screen.getByTestId('date-format'));
    await fireEvent.press(screen.getByTestId('date-format-option-MDY'));
    await fireEvent.press(screen.getByTestId('time-format'));
    await fireEvent.press(screen.getByTestId('time-format-option-H12'));

    await waitFor(() => expect(patchBodies).toEqual([{ dateFormat: 'MDY' }, { timeFormat: 'H12' }]));
    expect(await screen.findByText(example('10/26/2026', '2:30 CH'))).toBeTruthy();
  });

  it('choosing the current value does not call the server', async () => {
    const { patchBodies } = serveSettings(mockFetch());
    await renderWithSettings(<DateTimeSettingsScreen />);

    await fireEvent.press(await screen.findByTestId('date-start-day'));
    await fireEvent.press(screen.getByTestId('date-start-day-option-1'));

    expect(patchBodies).toEqual([]);
  });

  it('keeps the choice and explains when saving fails', async () => {
    serveSettings(mockFetch(), { patch: () => problem(503, 'Service Unavailable') });
    await renderWithSettings(<DateTimeSettingsScreen />);

    await fireEvent.press(await screen.findByTestId('date-start-day'));
    await fireEvent.press(screen.getByTestId('date-start-day-option-7'));

    expect((await screen.findByTestId('date-time-error')).props.children).toBe(vi.settings.saveFailed);
    expect(screen.getByTestId('date-start-day').props.accessibilityLabel).toBe(`${vi.settings.dateTime.startDay}, ${weekday(7)}`);
  });
});
