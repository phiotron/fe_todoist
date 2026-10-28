import { useQuery, useQueryClient } from '@tanstack/react-query';
import { describeError } from '../../api/describeError';
import { notificationsApi, type NotificationResponse, type NotificationSettingItem } from '../../api/notifications';
import { useDataMutation } from '../../lib/useDataMutation';
import { usePagedList } from '../../lib/usePagedList';

/** A root of its own: other users create notifications, so a local write never refreshes it by itself. */
export const notificationKeys = {
  all: ['notifications'] as const,
  list: (unread: boolean) => ['notifications', 'list', { unread }] as const,
  count: () => ['notifications', 'count'] as const,
  settings: () => ['notifications', 'settings'] as const,
};

const idOf = (item: NotificationResponse) => item.id;

/** One tab of the inbox (All / Unread), cursor-paged, newest first. */
export function useNotificationList(unread: boolean) {
  return usePagedList(notificationKeys.list(unread), (cursor) => notificationsApi.list(unread, cursor), idOf);
}

/** Unread count for the bell and the Unread tab; polled gently while a screen shows it. */
export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.count(),
    queryFn: () => notificationsApi.unreadCount(),
    refetchInterval: 60_000,
    select: (data) => data.count,
  });
}

/** Mark one / all as read; both refresh the inbox lists and the count. */
export function useMarkRead() {
  const queryClient = useQueryClient();
  const refresh = () => void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
  const markOne = useDataMutation(async (id: string) => {
    await notificationsApi.markRead(id);
    refresh();
  });
  const markAll = useDataMutation(async () => {
    await notificationsApi.markAllRead();
    refresh();
  });
  const failure = markOne.error ?? markAll.error;
  return {
    markOne: (id: string) => markOne.mutateAsync(id).catch(() => undefined),
    markAll: () => markAll.mutateAsync().catch(() => undefined),
    markingAll: markAll.isPending,
    error: failure ? describeError(failure).message : undefined,
  };
}

export function useNotificationSettings() {
  return useQuery({ queryKey: notificationKeys.settings(), queryFn: () => notificationsApi.settings() });
}

/** Saves one switch; the answer (all pairs) replaces the cached settings. */
export function useUpdateNotificationSetting() {
  const queryClient = useQueryClient();
  const update = useDataMutation(async (item: NotificationSettingItem) => {
    const saved = await notificationsApi.updateSettings([item]);
    queryClient.setQueryData(notificationKeys.settings(), saved);
    return saved;
  });
  return {
    save: (item: NotificationSettingItem) => update.mutateAsync(item).then(() => true, () => false),
    pending: update.isPending,
    error: update.error ? describeError(update.error).message : undefined,
    reset: update.reset,
  };
}
