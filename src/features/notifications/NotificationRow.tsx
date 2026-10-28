import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NotificationResponse } from '../../api/notifications';
import { Avatar } from '../../components/Avatar';
import { fonts, type, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { stampLabel } from '../comments/commentTime';

interface NotificationRowProps {
  item: NotificationResponse;
  now: Date;
  timeZone: string;
  onPress: (item: NotificationResponse) => void;
}

/** One inbox entry (M-Notifications): avatar, sentence, comment excerpt, task / project and time; unread = accent dot. */
export function NotificationRow({ item, now, timeZone, onPress }: NotificationRowProps) {
  const styles = useThemedStyles(createNotificationRowStyles);
  const { t } = useTranslation();
  const name = item.actor?.name ?? t('notifications.someone');
  const where = item.taskContent
    ? t('notifications.onTask', { task: item.taskContent, project: item.projectName })
    : t('notifications.inProject', { project: item.projectName });
  return (
    <Pressable
      testID={`notification-${item.id}`}
      accessibilityRole="button"
      accessibilityState={{ selected: !item.isRead }}
      onPress={() => onPress(item)}
      style={styles.row}
    >
      <Avatar name={name} seed={item.actor?.id ?? item.id} size="l" uri={item.actor?.avatarUrl} />
      <View style={styles.body}>
        <Text style={[styles.title, !item.isRead && styles.unread]}>{t('notifications.mention', { name })}</Text>
        {item.commentExcerpt ? (
          <Text style={styles.excerpt} numberOfLines={2}>
            {item.commentExcerpt}
          </Text>
        ) : null}
        <Text style={styles.meta} numberOfLines={1}>
          {where} · {stampLabel(item.createdAt, now, timeZone)}
        </Text>
      </View>
      {item.isRead ? null : <View testID={`notification-unread-${item.id}`} accessibilityLabel={t('notifications.unreadDot')} style={styles.dot} />}
    </Pressable>
  );
}

function createNotificationRowStyles(palette: Palette) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.line },
    body: { flex: 1, gap: 2 },
    title: { ...type.body, color: palette.ink },
    unread: { fontFamily: fonts.semibold },
    excerpt: { ...type.bodySmall, color: palette.ink2 },
    meta: { ...type.meta, color: palette.mute },
    dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.acc, marginTop: 6 },
  });
}
