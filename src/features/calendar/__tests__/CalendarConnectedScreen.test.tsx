import { waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { jsonResponse, mockFetch } from '../../../test/http';
import { routeFetch } from '../../../test/m3Routes';
import { renderWithProviders } from '../../../test/render';
import { CalendarConnectedScreen } from '../CalendarConnectedScreen';

jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() } }));

describe('CalendarConnectedScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    routeFetch(mockFetch(), {});
  });

  it('returns to Settings > Calendar with a success flag', async () => {
    await renderWithProviders(<CalendarConnectedScreen />);

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({ pathname: '/settings/calendar', params: { result: 'connected' } }),
    );
  });

  it('passes the error code of the deep link on', async () => {
    await renderWithProviders(<CalendarConnectedScreen error="already-connected" />);

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/settings/calendar',
        params: { error: 'already-connected' },
      }),
    );
    expect(jsonResponse(200)).toBeDefined();
  });
});
