import { useMe } from './session';

export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/** IANA zone of the account (spec 5.2: "now" and "today" are computed in it); the device zone until /me is known. */
export function useUserTimeZone(): string {
  const me = useMe();
  return me.data?.timeZone || deviceTimeZone();
}
