import { apiFetch } from './client';

/** Hand-written from spec 12.1.1 (backend DTO SettingsResponse) until Task 36 switches to generated types. */
export type SettingsTheme = 'TASKLY' | 'MOONSTONE' | 'TANGERINE' | 'KALE' | 'BLUEBERRY' | 'LAVENDER' | 'RASPBERRY';
export type SettingsAppearance = 'AUTO' | 'LIGHT' | 'DARK';
export type SettingsSwipeAction = 'COMPLETE' | 'SCHEDULE' | 'DELETE' | 'REMINDERS' | 'SELECT' | 'NONE';

export interface SettingsResponse {
  theme: SettingsTheme;
  appearance: SettingsAppearance;
  locale: string;
  timeZone: string;
  /** 1 = Monday â€¦ 7 = Sunday. */
  startDay: number;
  nextWeek: number;
  weekendStartDay: number;
  dateFormat: 'DMY' | 'MDY';
  timeFormat: 'H24' | 'H12';
  /** INBOX | TODAY | UPCOMING | project:<uuid> | label:<uuid> | filter:<uuid> */
  startPage: string;
  smartDateRecognition: boolean;
  swipeLeft: SettingsSwipeAction;
  swipeRight: SettingsSwipeAction;
  /** 3â€“5 keys, "BROWSE" last, at most one pinned project / label / filter. */
  navTabs: string[];
  /** M4 (spec 12.1.1). Optional: a settings cache written before M4 does not have them (never read that as "off"). */
  remindersEnabled?: boolean;
  /** Minutes before a timed task's due time; null = automatic reminders off. */
  autoReminderMinutes?: number | null;
  /** M6c: reopen the completed direct sub-tasks (â‰¤ 30) when a repeating task moves to its next due. Default false. */
  resetSubtasks?: boolean;
  /**
   * M6b (contract 2 / 8.2): Quick Add chips in display order (PROJECT always present, no duplicates; absent = hidden).
   * Optional for the same reason as the M4 fields: a cache written before M6b has none.
   */
  quickAddChips?: string[];
  /** M6b "Show action labels": chips show their text, not only the icon. */
  quickAddShowActionLabels?: boolean;
  /** M6b "Show description": Quick Add draws the description field. */
  quickAddShowDescription?: boolean;
}

/**
 * Backend DTO UpdateSettingsRequest: only the fields that change. Open to fields later milestones add (M4 reminders,
 * M6 Quick Add chipsâ€¦): they pass through untouched, `null` included (M4 `autoReminderMinutes: null` = off).
 */
export type UpdateSettingsRequest = Partial<SettingsResponse> & Record<string, unknown>;

export const SETTINGS_PATH = '/api/v1/me/settings';

export const settingsApi = {
  get: () => apiFetch<SettingsResponse>(SETTINGS_PATH),
  update: (body: UpdateSettingsRequest) => apiFetch<SettingsResponse>(SETTINGS_PATH, { method: 'PATCH', body }),
  reset: () => apiFetch<SettingsResponse>(`${SETTINGS_PATH}/reset`, { method: 'POST' }),
};
