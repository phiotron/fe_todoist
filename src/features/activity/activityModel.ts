import type { ActivityItem } from '../../api/activity';
import { nowLocal } from '../../lib/dates';
import { parseInstant } from '../../lib/dates/instant';

export interface ActivityDay {
  /** 'yyyy-MM-dd' in the account time zone. */
  day: string;
  items: ActivityItem[];
}

/** Items (newest first, as the server sends them) grouped by the day they happened in the ACCOUNT time zone. */
export function groupByDay(items: readonly ActivityItem[], timeZone: string): ActivityDay[] {
  const days: ActivityDay[] = [];
  for (const item of items) {
    const day = nowLocal(parseInstant(item.createdAt), timeZone).slice(0, 10);
    const last = days[days.length - 1];
    if (last && last.day === day) last.items.push(item);
    else days.push({ day, items: [item] });
  }
  return days;
}

export const activityItemId = (item: ActivityItem) => item.id;
