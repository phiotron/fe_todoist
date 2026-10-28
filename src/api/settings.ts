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
  /** 1 = Monday … 7 = Sunday. */
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
  /** 3–5 keys, "BROWSE" last, at most one pinned project / label / filter. */
  navTabs: string[];
  /** M4 (spec 12.1.1). Optional: a settings cache written before M4 does not have them (never read that as "off"). */
  remindersEnabled?: boolean;
  /** Minutes before a timed task's due time; null = automatic reminders off. */
  autoReminderMinutes?: number | null;
  /** M8a: invitations by email addressed to this account are accepted at once (default false). */
  autoAcceptInvites?: boolean;
}

/**
 * Backend DTO UpdateSettingsRequest: only the fields that change. Open to fields later milestones add (M4 reminders,
 * M6 Quick Add chips…): they pass through untouched, `null` included (M4 `autoReminderMinutes: null` = off).
 */
export type UpdateSettingsRequest = Partial<SettingsResponse> & Record<string, unknown>;

export const SETTINGS_PATH = '/api/v1/me/settings';

export const settingsApi = {
  get: () => apiFetch<SettingsResponse>(SETTINGS_PATH),
  update: (body: UpdateSettingsRequest) => apiFetch<SettingsResponse>(SETTINGS_PATH, { method: 'PATCH', body }),
  reset: () => apiFetch<SettingsResponse>(`${SETTINGS_PATH}/reset`, { method: 'POST' }),
};
