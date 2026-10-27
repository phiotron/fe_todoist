import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { viTranslation as vi } from '../../../i18n';
import { tokenStore } from '../../../lib/tokenStore';
import { countRequests, mockFetch, problem } from '../../../test/http';
import { renderWithSettings } from '../../../test/renderSettings';
import { serveSettings } from '../../../test/settingsFixtures';
import { TimeZoneBanner } from '../TimeZoneBanner';

const mismatchText = vi.settings.timeZone.mismatch
  .replace('{{device}}', 'Asia/Tokyo')
  .replace('{{account}}', 'Asia/Ho_Chi_Minh');

describe('TimeZoneBanner', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('stays hidden when the device and the account use the same zone', async () => {
    const fetchMock = mockFetch();
    serveSettings(fetchMock);
    await renderWithSettings(
      <>
        <TimeZoneBanner />
        <Text testID="ready">ready</Text>
      </>,
    );
    await screen.findByTestId('ready');
    await waitFor(() => expect(countRequests(fetchMock, '/api/v1/me/settings')).toBe(1));

    expect(screen.queryByTestId('tz-banner')).toBeNull();
  });

  it('offers to update the account time zone to the device one', async () => {
    const { patchBodies } = serveSettings(mockFetch());
    await renderWithSettings(<TimeZoneBanner />, { deviceTimeZone: 'Asia/Tokyo' });

    expect(await screen.findByText(mismatchText)).toBeTruthy();
    expect(screen.getByTestId('tz-banner').props.accessibilityRole).toBe('alert');

    await fireEvent.press(screen.getByTestId('tz-banner-update'));

    await waitFor(() => expect(patchBodies).toEqual([{ timeZone: 'Asia/Tokyo' }]));
    expect(screen.queryByTestId('tz-banner')).toBeNull();
  });

  it('"Dismiss" hides it without calling the server', async () => {
    const { patchBodies } = serveSettings(mockFetch());
    await renderWithSettings(<TimeZoneBanner />, { deviceTimeZone: 'Asia/Tokyo' });
    await screen.findByText(mismatchText);

    await fireEvent.press(screen.getByTestId('tz-banner-dismiss'));

    expect(screen.queryByTestId('tz-banner')).toBeNull();
    expect(patchBodies).toEqual([]);
  });

  it('stays visible with the server explanation when the zone is rejected (400)', async () => {
    serveSettings(mockFetch(), {
      patch: () => problem(400, 'Bad Request', { errors: [{ field: 'timeZone', message: 'Múi giờ không hợp lệ' }] }),
    });
    await renderWithSettings(<TimeZoneBanner />, { deviceTimeZone: 'Asia/Tokyo' });
    await screen.findByText(mismatchText);

    await fireEvent.press(screen.getByTestId('tz-banner-update'));

    expect((await screen.findByTestId('tz-banner-error')).props.children).toBe('Múi giờ không hợp lệ');
    expect(screen.getByTestId('tz-banner')).toBeTruthy();
  });
});
