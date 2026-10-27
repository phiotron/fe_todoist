import { useMemo } from 'react';
import { DEFAULT_DATE_SETTINGS, type DateSettings } from '../../lib/dates/settings';
import { useSettingsContext } from './SettingsProvider';

/**
 * Week settings used by the week strip, the calendar and the quick dates: the account's startDay / nextWeek /
 * weekendStartDay (spec 12.1.1), the spec defaults without a settings provider. Same signature as M1.
 */
export function useDateSettings(): DateSettings {
  const settings = useSettingsContext()?.settings;
  const startDay = settings?.startDay ?? DEFAULT_DATE_SETTINGS.startDay;
  const nextWeek = settings?.nextWeek ?? DEFAULT_DATE_SETTINGS.nextWeek;
  const weekendStartDay = settings?.weekendStartDay ?? DEFAULT_DATE_SETTINGS.weekendStartDay;
  return useMemo(() => ({ startDay, nextWeek, weekendStartDay }), [startDay, nextWeek, weekendStartDay]);
}
