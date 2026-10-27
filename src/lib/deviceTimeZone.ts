import { getCalendars } from 'expo-localization';

/** IANA time zone of the device (e.g. "Asia/Ho_Chi_Minh"), or null when the OS does not tell. */
export function getDeviceTimeZone(): string | null {
  try {
    const zone = getCalendars()[0]?.timeZone;
    return zone && zone.trim() ? zone : null;
  } catch {
    return null;
  }
}
