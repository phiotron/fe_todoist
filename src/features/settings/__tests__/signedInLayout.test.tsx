import { screen, waitFor } from '@testing-library/react-native';
import SignedInLayout from '../../../app/(app)/_layout';
import { viTranslation as vi } from '../../../i18n';
import { tokenStore } from '../../../lib/tokenStore';
import { countRequests, mockFetch } from '../../../test/http';
import { renderWithSettings } from '../../../test/renderSettings';
import { serveSettings } from '../../../test/settingsFixtures';

jest.mock('expo-router', () => {
  const Stack = Object.assign(() => null, { Screen: () => null });
  return { Stack, Redirect: () => null, router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } };
});

describe('signed-in layout', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('shows the time zone banner on every signed-in screen when the zones differ', async () => {
    serveSettings(mockFetch());
    await renderWithSettings(<SignedInLayout />, { deviceTimeZone: 'Asia/Tokyo' });

    expect(await screen.findByTestId('tz-banner')).toBeTruthy();
    expect(
      screen.getByText(
        vi.settings.timeZone.mismatch.replace('{{device}}', 'Asia/Tokyo').replace('{{account}}', 'Asia/Ho_Chi_Minh'),
      ),
    ).toBeTruthy();
  });

  it('shows no banner when the zones match', async () => {
    const fetchMock = mockFetch();
    serveSettings(fetchMock);
    await renderWithSettings(<SignedInLayout />);

    await waitFor(() => expect(countRequests(fetchMock, '/api/v1/me/settings')).toBe(1));
    expect(screen.queryByTestId('tz-banner')).toBeNull();
  });
});
