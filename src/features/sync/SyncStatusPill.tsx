import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSyncStatus } from '../../lib/sync/runtime';
import { useIsConnected } from '../../lib/useIsOnline';
import { radius, size, type, useThemedStyles, useTheme } from '../../theme';
import type { Palette } from '../../theme/palette';
import { useSyncPill } from './useSyncPill';

/**
 * M9 sync indicator while CONNECTED ("Đang đồng bộ…" / "N thay đổi chưa đồng bộ" when a retry is waiting). Offline the
 * OfflineBanner carries the count. A small pill floating under the status bar: it takes no layout space, so it never
 * competes with the other top banners for the status-bar inset.
 */
export function SyncStatusPill() {
  const styles = useThemedStyles(createStyles);
  const { palette } = useTheme();
  const { t } = useTranslation();
  const connected = useIsConnected();
  // PERF: only a run that lasts (> 1 s) or changes still waiting show it; a short background sync never flashes it.
  const view = useSyncPill(useSyncStatus(), connected);
  const insets = useSafeAreaInsets();
  if (!view) return null;
  const { pending, syncing } = view;
  const label = syncing ? t('sync.syncing') : t('sync.pending', { n: pending });
  return (
    <View pointerEvents="none" style={[styles.host, { top: insets.top + 4 }]}>
      <View testID="sync-status" accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.pill}>
        <Feather name={syncing ? 'refresh-cw' : 'upload-cloud'} size={size.iconSmall} color={palette.acc} />
        <Text style={styles.text}>{label}</Text>
      </View>
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    host: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 10 },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: radius.control,
      backgroundColor: palette.bg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.line,
    },
    text: { ...type.meta, color: palette.ink },
  });
}
