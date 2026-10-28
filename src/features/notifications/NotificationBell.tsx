import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { IconButton } from '../../components/IconButton';
import { fonts, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { useUnreadCount } from './useNotifications';

/** Bell in the Browse header (M-Browse): opens the inbox; a badge shows how many are unread (99+ at most). */
export function NotificationBell() {
  const styles = useThemedStyles(createNotificationBellStyles);
  const { t } = useTranslation();
  const count = useUnreadCount().data ?? 0;
  return (
    <View>
      <IconButton
        icon="bell"
        label={count > 0 ? t('notifications.openWithUnread', { n: count }) : t('notifications.open')}
        onPress={() => router.push('/notifications')}
        testID="browse-notifications"
      />
      {count > 0 ? (
        <View testID="browse-notifications-badge" pointerEvents="none" style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? '99+' : String(count)}</Text>
        </View>
      ) : null}
    </View>
  );
}

function createNotificationBellStyles(palette: Palette) {
  return StyleSheet.create({
    badge: {
      position: 'absolute',
      top: 4,
      right: 2,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.acc,
    },
    badgeText: { fontFamily: fonts.bold, fontSize: 11, color: palette.onacc },
  });
}
