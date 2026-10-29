import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Platform, StyleSheet, View } from 'react-native';
import type { NotificationResponse } from '../../api/notifications';
import { AppButton } from '../../components/AppButton';
import { ErrorText } from '../../components/ErrorText';
import { QueryStateView } from '../../components/QueryStateView';
import { Segmented } from '../../components/Segmented';
import { StateView } from '../../components/StateView';
import { SubHeader } from '../../components/SubHeader';
import { useDayStableNow } from '../../lib/dayStableNow';
import { useNow } from '../../lib/useNow';
import { gutter, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { useUserTimeZone } from '../auth/useUserTimeZone';
import { NotificationRow } from './NotificationRow';
import { useMarkRead, useNotificationList, useUnreadCount } from './useNotifications';

type Tab = 'all' | 'unread';

const notificationId = (item: NotificationResponse) => item.id;

/** Notification inbox (M-Notifications): All / Unread tabs, "mark all as read", tap = mark read and open the task. */
export function NotificationsScreen() {
  const styles = useThemedStyles(createNotificationsStyles);
  const { t } = useTranslation();
  const timeZone = useUserTimeZone();
  // PERF4: rows only care about the day, so a minute tick does not redraw the 200 of them.
  const now = useDayStableNow(useNow(), timeZone);
  const [tab, setTab] = useState<Tab>('all');
  const unreadCount = useUnreadCount();
  const { query, items } = useNotificationList(tab === 'unread');
  const read = useMarkRead();
  const unread = unreadCount.data ?? 0;

  const markOne = read.markOne;
  const markOneRef = useRef(markOne);
  markOneRef.current = markOne;
  const open = useCallback((item: NotificationResponse) => {
    if (!item.isRead) void markOneRef.current(item.id);
    router.push(item.taskId ? `/task/${item.taskId}` : `/project-comments/${item.projectId}`);
  }, []);
  const renderItem = useCallback(
    ({ item }: { item: NotificationResponse }) => <NotificationRow item={item} now={now} timeZone={timeZone} onPress={open} />,
    [now, timeZone, open],
  );

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
          keyExtractor={notificationId}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
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
