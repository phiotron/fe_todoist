import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { tokenStore } from '../../../lib/tokenStore';
import { mockFetch } from '../../../test/http';
import { renderWithSettings } from '../../../test/renderSettings';
import { serveSettings, settingsResponse } from '../../../test/settingsFixtures';
import { ProductivitySettingsScreen } from '../ProductivitySettingsScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));

describe('ProductivitySettingsScreen', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('shows the defaults when the server has not sent the M10 fields: goals 5 / 30, Sat + Sun off, Karma on', async () => {
    serveSettings(mockFetch());
    await renderWithSettings(<ProductivitySettingsScreen />);

    expect(await screen.findByTestId('productivity-daily-goal')).toHaveTextContent(/5 việc/);
    expect(screen.getByTestId('productivity-weekly-goal')).toHaveTextContent(/30 việc/);
    expect(screen.getByTestId('productivity-karma-switch').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId('productivity-vacation-switch').props.accessibilityState).toMatchObject({ checked: false });
    expect(screen.getByTestId('productivity-celebrations-switch').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId('productivity-day-off-6').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('productivity-day-off-7').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('productivity-day-off-1').props.accessibilityState).toMatchObject({ selected: false });
  });

  it('reads the saved M10 values', async () => {
    serveSettings(mockFetch(), {
      settings: settingsResponse({ dailyGoal: 8, weeklyGoal: 40, daysOff: [1], vacationMode: true, karmaEnabled: false, goalCelebrations: false }),
    });
    await renderWithSettings(<ProductivitySettingsScreen />);

    await waitFor(() => expect(screen.getByTestId('productivity-daily-goal')).toHaveTextContent(/8 việc/));
    expect(screen.getByTestId('productivity-weekly-goal')).toHaveTextContent(/40 việc/);
    expect(screen.getByTestId('productivity-karma-switch').props.accessibilityState).toMatchObject({ checked: false });
    expect(screen.getByTestId('productivity-vacation-switch').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId('productivity-day-off-1').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('productivity-day-off-6').props.accessibilityState).toMatchObject({ selected: false });
  });

  it('each control PATCHes only its own field', async () => {
    const { patchBodies } = serveSettings(mockFetch());
    await renderWithSettings(<ProductivitySettingsScreen />);

    await fireEvent.press(await screen.findByTestId('productivity-karma-switch'));
    await waitFor(() => expect(patchBodies).toContainEqual({ karmaEnabled: false }));
    await fireEvent.press(screen.getByTestId('productivity-vacation-switch'));
    await waitFor(() => expect(patchBodies).toContainEqual({ vacationMode: true }));
    await fireEvent.press(screen.getByTestId('productivity-celebrations-switch'));
    await waitFor(() => expect(patchBodies).toContainEqual({ goalCelebrations: false }));

    await fireEvent.press(screen.getByTestId('productivity-daily-goal'));
    await fireEvent.press(await screen.findByTestId('productivity-daily-goal-option-10'));
    await waitFor(() => expect(patchBodies).toContainEqual({ dailyGoal: 10 }));

    await fireEvent.press(screen.getByTestId('productivity-weekly-goal'));
    await fireEvent.press(await screen.findByTestId('productivity-weekly-goal-option-50'));
    await waitFor(() => expect(patchBodies).toContainEqual({ weeklyGoal: 50 }));
  });

  it('days off: toggling sends the whole sorted list', async () => {
    const { patchBodies } = serveSettings(mockFetch());
    await renderWithSettings(<ProductivitySettingsScreen />);

    await fireEvent.press(await screen.findByTestId('productivity-day-off-3'));
    await waitFor(() => expect(patchBodies).toContainEqual({ daysOff: [3, 6, 7] }));
    await fireEvent.press(screen.getByTestId('productivity-day-off-6'));
    await waitFor(() => expect(patchBodies).toContainEqual({ daysOff: [3, 7] }));
  });

  it('days off: never lets all 7 days be off (the server allows 6)', async () => {
    const { patchBodies } = serveSettings(mockFetch(), { settings: settingsResponse({ daysOff: [1, 2, 3, 4, 5, 6] }) });
    await renderWithSettings(<ProductivitySettingsScreen />);
    await waitFor(() => expect(screen.getByTestId('productivity-day-off-1').props.accessibilityState).toMatchObject({ selected: true }));

    const seventh = screen.getByTestId('productivity-day-off-7');
    expect(seventh.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(seventh);

    expect(patchBodies).toEqual([]);
  });
});
