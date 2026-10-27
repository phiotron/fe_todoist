import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { viTranslation as vi } from '../../../i18n';
import { tokenStore } from '../../../lib/tokenStore';
import { mockFetch, problem } from '../../../test/http';
import { renderWithSettings } from '../../../test/renderSettings';
import { serveSettings } from '../../../test/settingsFixtures';
import { TimeZoneSection } from '../TimeZoneSection';

const accountLine = (zone: string) => vi.settings.timeZone.current.replace('{{zone}}', zone);
const deviceLine = (zone: string) => vi.settings.timeZone.device.replace('{{zone}}', zone);

describe('TimeZoneSection', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('shows the account and the device time zones', async () => {
    serveSettings(mockFetch());
    await renderWithSettings(<TimeZoneSection />, { deviceTimeZone: 'Asia/Tokyo' });

    expect(await screen.findByText(accountLine('Asia/Ho_Chi_Minh'))).toBeTruthy();
    expect(screen.getByText(deviceLine('Asia/Tokyo'))).toBeTruthy();
  });

  it('one tap switches the account to the device time zone', async () => {
    const { patchBodies } = serveSettings(mockFetch());
    await renderWithSettings(<TimeZoneSection />, { deviceTimeZone: 'Asia/Tokyo' });
    await screen.findByText(accountLine('Asia/Ho_Chi_Minh'));

    await fireEvent.press(screen.getByTestId('timezone-use-device'));

    await waitFor(() => expect(patchBodies).toEqual([{ timeZone: 'Asia/Tokyo' }]));
    expect(await screen.findByText(accountLine('Asia/Tokyo'))).toBeTruthy();
    expect(screen.queryByTestId('timezone-use-device')).toBeNull();
  });

  it('hides "use device time zone" when both zones are the same', async () => {
    serveSettings(mockFetch());
    await renderWithSettings(<TimeZoneSection />);

    await screen.findByText(accountLine('Asia/Ho_Chi_Minh'));
    expect(screen.queryByTestId('timezone-use-device')).toBeNull();
  });

  it('picks a zone from the searchable list, then closes the list', async () => {
    const { patchBodies } = serveSettings(mockFetch());
    await renderWithSettings(<TimeZoneSection />);
    await screen.findByText(accountLine('Asia/Ho_Chi_Minh'));

    await fireEvent.press(screen.getByTestId('timezone-toggle'));
    await fireEvent.changeText(screen.getByTestId('timezone-search'), 'tokyo');
    expect(screen.queryByTestId('timezone-option-Europe/London')).toBeNull();
    await fireEvent.press(screen.getByTestId('timezone-option-Asia/Tokyo'));

    await waitFor(() => expect(patchBodies).toEqual([{ timeZone: 'Asia/Tokyo' }]));
    expect(screen.queryByTestId('timezone-search')).toBeNull();
  });

  it('says so when no zone matches the search', async () => {
    serveSettings(mockFetch());
    await renderWithSettings(<TimeZoneSection />);
    await screen.findByText(accountLine('Asia/Ho_Chi_Minh'));

    await fireEvent.press(screen.getByTestId('timezone-toggle'));
    await fireEvent.changeText(screen.getByTestId('timezone-search'), 'zzz');

    expect(screen.getByTestId('timezone-empty').props.children).toBe(vi.settings.timeZone.noResults);
  });

  it('keeps the chosen zone and explains when saving fails', async () => {
    serveSettings(mockFetch(), { patch: () => problem(503, 'Service Unavailable') });
    await renderWithSettings(<TimeZoneSection />, { deviceTimeZone: 'Asia/Tokyo' });
    await screen.findByText(accountLine('Asia/Ho_Chi_Minh'));

    await fireEvent.press(screen.getByTestId('timezone-use-device'));

    expect((await screen.findByTestId('timezone-error')).props.children).toBe(vi.settings.saveFailed);
    expect(screen.getByText(accountLine('Asia/Tokyo'))).toBeTruthy();
  });
});
