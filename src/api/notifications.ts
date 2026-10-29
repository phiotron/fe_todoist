import { apiFetch, buildQuery } from './client';
import type { CommentAuthor } from './comments';
import type { Page } from './models';

/** Hand-written from the backend M8b DTOs (names match). */
export type NotificationType = 'COMMENT_MENTION' | 'REVIEW_REQUESTED' | 'REVIEW_APPROVED' | 'REVIEW_REJECTED';

export interface NotificationResponse {
  id: string;
  type: NotificationType;
  /** null = the person deleted their account. */
  actor: CommentAuthor | null;
  taskId: string | null;
  taskContent: string | null;
  projectId: string;
  projectName: string;
  commentId: string | null;
  commentExcerpt: string | null;
  isRead: boolean;
  createdAt: string;
}

export type NotificationScope = 'PROJECT' | 'WORKSPACE';
export type NotificationEvent =
  | 'COMMENT_MENTION'
  | 'COMMENT_ADDED'
  | 'TASK_ASSIGNED'
  | 'TASK_COMPLETED'
  | 'MEMBER_JOINED'
  | 'INVITATION_ACCEPTED';

export interface NotificationSettingItem {
  scope: NotificationScope;
  event: NotificationEvent;
  enabled: boolean;
}

export interface NotificationSettingsResponse {
  items: NotificationSettingItem[];
}

export function notificationsPath(unread: boolean, cursor: string | null): string {
  return `/api/v1/notifications${buildQuery({ unread: unread ? true : undefined, cursor })}`;
}

export const notificationsApi = {
  list: (unread: boolean, cursor: string | null) => apiFetch<Page<NotificationResponse>>(notificationsPath(unread, cursor)),
  unreadCount: () => apiFetch<{ count: number }>('/api/v1/notifications/unread-count'),
  markRead: (id: string) => apiFetch<void>(`/api/v1/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' }),
  markAllRead: () => apiFetch<void>('/api/v1/notifications/read-all', { method: 'POST' }),
  settings: () => apiFetch<NotificationSettingsResponse>('/api/v1/me/notification-settings'),
  updateSettings: (items: NotificationSettingItem[]) =>
    apiFetch<NotificationSettingsResponse>('/api/v1/me/notification-settings', { method: 'PUT', body: { items } }),
};
