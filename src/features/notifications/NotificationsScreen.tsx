import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import type { NotificationResponse } from '../../api/notifications';
import { AppButton } from '../../components/AppButton';
import { ErrorText } from '../../components/ErrorText';
import { QueryStateView } from '../../components/QueryStateView';
import { Segmented } from '../../components/Segmented';
import { StateView } from '../../components/StateView';
import { SubHeader } from '../../components/SubHeader';
import { useNow } from '../../lib/useNow';
import { gutter, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { useUserTimeZone } from '../auth/useUserTimeZone';
import { NotificationRow } from './NotificationRow';
import { useMarkRead, useNotificationList, useUnreadCount } from './useNotifications';

type Tab = 'all' | 'unread';

/** Notification inbox (M-Notifications): All / Unread tabs, "mark all as read", tap = mark read and open the task. */
export function NotificationsScreen() {
  const styles = useThemedStyles(createNotificationsStyles);
  const { t } = useTranslation();
  const now = useNow();
  const timeZone = useUserTimeZone();
  const [tab, setTab] = useState<Tab>('all');
  const unreadCount = useUnreadCount();
  const { query, items } = useNotificationList(tab === 'unread');
  const read = useMarkRead();
  const unread = unreadCount.data ?? 0;

  function open(item: NotificationResponse) {
    if (!item.isRead) void read.markOne(item.id);
    router.push(item.taskId ? `/task/${item.taskId}` : `/project-comments/${item.projectId}`);
  }

  return (
    <View testID="notifications-screen" style={styles.fill}>
      <SubHeader
        title={t('notifications.title')}
        onBack={() => router.back()}
        right={
          <AppButton
            testID="notifications-mark-all"
            variant="ghost"
            size="sm"
            label={t('notifications.markAllRead')}
            disabled={unread === 0}
            busy={read.markingAll}
            requiresOnline
            onPress={() => void read.markAll()}
          />
        }
        testID="notifications-header"
      />
      <View style={styles.tabs}>
        <Segmented
          testID="notifications-tabs"
          value={tab}
          onChange={setTab}
          options={[
            { key: 'all', label: t('notifications.tabAll') },
            { key: 'unread', label: unread > 0 ? t('notifications.tabUnreadCount', { n: unread }) : t('notifications.tabUnread') },
          ]}
        />
      </View>
      <ErrorText testID="notifications-error" message={read.error} />
      {query.isPending || query.isError ? (
        <QueryStateView query={query} testID="notifications-state" />
      ) : (
        <FlatList
          testID="notifications-list"
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <NotificationRow item={item} now={now} timeZone={timeZone} onPress={open} />}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <StateView
              tone="ok"
              icon="bell"
              title={tab === 'unread' ? t('notifications.emptyUnread') : t('notifications.emptyAll')}
              testID="notifications-empty"
            />
          }
          ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator testID="notifications-more" /> : undefined}
        />
      )}
    </View>
  );
}

function createNotificationsStyles(palette: Palette) {
  return StyleSheet.create({
    fill: { flex: 1, backgroundColor: palette.bg },
    tabs: { paddingHorizontal: gutter, paddingBottom: 8 },
    list: { paddingHorizontal: gutter, paddingBottom: 48, flexGrow: 1 },
  });
}
