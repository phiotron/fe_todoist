import { DEFAULT_DATE_SETTINGS, type DateSettings } from '../../lib/dates/settings';

/**
 * Week settings used by the week strip, the calendar and the quick dates. M1: spec defaults.
 * M3 replaces the body with me/settings (startDay, nextWeek, weekendStartDay) and keeps the signature.
 */
export function useDateSettings(): DateSettings {
  return DEFAULT_DATE_SETTINGS;
}
