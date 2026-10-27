import { getCalendars } from 'expo-localization';
import { getDeviceTimeZone } from '../deviceTimeZone';

// File-level mock: jest.setup.ts only fakes getLocales (and is edited by M1), so getCalendars lives here.
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'vi', languageTag: 'vi-VN' }],
  getCalendars: jest.fn(),
}));

type Calendars = ReturnType<typeof getCalendars>;

function calendarsWith(timeZone: string | null): Calendars {
  return [{ calendar: 'gregory', timeZone, uses24hourClock: true, firstWeekday: 2 }] as unknown as Calendars;
}

describe('getDeviceTimeZone', () => {
  it('returns the IANA zone of the first calendar', () => {
    jest.mocked(getCalendars).mockReturnValue(calendarsWith('Asia/Ho_Chi_Minh'));
    expect(getDeviceTimeZone()).toBe('Asia/Ho_Chi_Minh');
  });

  it('returns null when the zone is unknown or blank', () => {
    jest.mocked(getCalendars).mockReturnValue(calendarsWith(null));
    expect(getDeviceTimeZone()).toBeNull();
    jest.mocked(getCalendars).mockReturnValue(calendarsWith('  '));
    expect(getDeviceTimeZone()).toBeNull();
  });

  it('returns null when the native module throws', () => {
    jest.mocked(getCalendars).mockImplementation(() => {
      throw new Error('native module missing');
    });
    expect(getDeviceTimeZone()).toBeNull();
  });
});
