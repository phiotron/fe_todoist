import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { tokenStore } from '../../../lib/tokenStore';
import { jsonResponse, mockFetch } from '../../../test/http';
import { renderWithSettings } from '../../../test/renderSettings';
import { serveSettings, settingsResponse } from '../../../test/settingsFixtures';
import { NavigationSettingsScreen } from '../../settings/NavigationSettingsScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }));

const targetRoutes = {
  'GET /api/v1/projects': () => jsonResponse(200, []),
  'GET /api/v1/labels': () => jsonResponse(200, []),
  'GET /api/v1/filters': () => jsonResponse(200, []),
};

describe('Settings › Navigation bar › Add button position (M3x)', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('shows Right as the default for an account cached before M3x', async () => {
    serveSettings(mockFetch(), { routes: targetRoutes });
    await renderWithSettings(<NavigationSettingsScreen />);

    expect((await screen.findByTestId('add-button-RIGHT')).props.accessibilityState).toMatchObject({ checked: true });
  });

  it('choosing Center saves addButtonPlacement and marks it', async () => {
    const { patchBodies } = serveSettings(mockFetch(), {
      settings: { ...settingsResponse(), addButtonPlacement: 'RIGHT' } as ReturnType<typeof settingsResponse>,
      routes: targetRoutes,
    });
    await renderWithSettings(<NavigationSettingsScreen />);

    await fireEvent.press(await screen.findByTestId('add-button-CENTER'));

    await waitFor(() => expect(patchBodies).toEqual([{ addButtonPlacement: 'CENTER' }]));
    await waitFor(() =>
      expect(screen.getByTestId('add-button-CENTER').props.accessibilityState).toMatchObject({ checked: true }),
    );
  });

  it('choosing the current position sends nothing', async () => {
    const { patchBodies } = serveSettings(mockFetch(), { routes: targetRoutes });
    await renderWithSettings(<NavigationSettingsScreen />);

    await fireEvent.press(await screen.findByTestId('add-button-RIGHT'));

    expect(patchBodies).toEqual([]);
  });
});
