/** Week settings of spec 5.2 / 10 (ISO weekday: 1 = Monday … 7 = Sunday). M1 uses the defaults, M3 reads me/settings. */
export interface DateSettings {
  startDay: number;
  nextWeek: number;
  weekendStartDay: number;
}

export const DEFAULT_DATE_SETTINGS: DateSettings = { startDay: 1, nextWeek: 1, weekendStartDay: 6 };
