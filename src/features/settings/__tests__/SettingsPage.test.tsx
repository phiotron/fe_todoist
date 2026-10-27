import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SettingsPage } from '../SettingsPage';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }));

describe('SettingsPage', () => {
  it('draws the back header with the page title above scrollable content', async () => {
    await render(
      <SettingsPage testID="settings-page-demo" title="Demo page">
        <Text>content</Text>
      </SettingsPage>,
    );

    expect(screen.getByTestId('settings-page-demo')).toBeTruthy();
    expect(screen.getByText('Demo page')).toBeTruthy();
    expect(screen.getByText('content')).toBeTruthy();
  });
});
