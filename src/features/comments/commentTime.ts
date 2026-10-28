import { nowLocal } from '../../lib/dates';
import { parseInstant } from '../../lib/dates/instant';

/**
 * "HH:mm" for today, "dd/MM HH:mm" for another day — both in the account time zone (spec 5.2). Used on comments and on
 * notifications; the app's own date format settings do not apply to these short stamps.
 */
export function stampLabel(instant: string, now: Date, timeZone: string): string {
  const at = nowLocal(parseInstant(instant), timeZone);
  const today = nowLocal(now, timeZone);
  const time = at.slice(11, 16);
  if (at.slice(0, 10) === today.slice(0, 10)) return time;
  return `${at.slice(8, 10)}/${at.slice(5, 7)} ${time}`;
}
