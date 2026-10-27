import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SettingsLinkRow } from '../SettingsLinkRow';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }));

describe('SettingsLinkRow', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens its page when pressed, with an optional value shown on the right', async () => {
    await render(<SettingsLinkRow testID="settings-row-general" label="General" value="On" href="/settings/general" />);

    expect(screen.getByText('General')).toBeTruthy();
    expect(screen.getByText('On')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('settings-row-general'));
    expect(router.push).toHaveBeenCalledWith('/settings/general');
  });

  it('accepts a Feather icon name', async () => {
    await render(<SettingsLinkRow testID="row" icon="bell" label="Reminders" href="/settings/reminders" />);
    expect(screen.getByTestId('row')).toBeTruthy();
  });
});
