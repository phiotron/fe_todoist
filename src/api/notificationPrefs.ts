import { apiFetch } from './client';

/** Hand-written from the M13c plan F7 (backend DTO NotificationPrefsResponse) until the types are generated again. */
export interface NotificationPrefsResponse {
  /** Task reminders pushed by the server to the user's other devices (FCM). */
  reminderPush: boolean;
  /** Task reminders by email. */
  reminderEmail: boolean;
  /** 07:00 (account time zone) email with today's and overdue tasks. */
  morningOverview: boolean;
  /** 20:00 (account time zone) email summing up the day. */
  eveningReview: boolean;
  subscribedEmails: boolean;
}

/** Backend DTO UpdateNotificationPrefsRequest: only the fields that change (null is refused with 400). */
export type UpdateNotificationPrefsRequest = Partial<NotificationPrefsResponse>;

export const NOTIFICATION_PREFS_PATH = '/api/v1/me/notification-prefs';

export const notificationPrefsApi = {
  get: () => apiFetch<NotificationPrefsResponse>(NOTIFICATION_PREFS_PATH),
  /** Answers with the full prefs after the change. */
  update: (body: UpdateNotificationPrefsRequest) =>
    apiFetch<NotificationPrefsResponse>(NOTIFICATION_PREFS_PATH, { method: 'PATCH', body }),
};
