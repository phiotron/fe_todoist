import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsOnline } from '../lib/useIsOnline';
import { radius, size, type, useThemedStyles, useTheme } from '../theme';
import type { Palette } from '../theme/palette';

/**
 * M-Error: banner at the top (does not block reading). Shown by the (app) layout above every screen while offline;
 * cached screens stay readable, write buttons are disabled (spec 9.3).
 */
export function OfflineBanner() {
  const styles = useThemedStyles(createOfflineBannerStyles);
  const { palette } = useTheme();
  const { t } = useTranslation();
  const online = useIsOnline();
  const insets = useSafeAreaInsets();
  if (online) return null;
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: palette.bg }}>
      <View testID="offline-banner" accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.banner}>
        <Feather name="wifi-off" size={size.iconSmall} color={palette.p2} />
        <Text style={styles.text}>{t('common.offlineBanner')}</Text>
      </View>
    </View>
  );
}

function createOfflineBannerStyles(palette: Palette) {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginHorizontal: 16,
      marginTop: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: radius.control,
      backgroundColor: palette.p2s,
    },
    text: { ...type.meta, color: palette.ink, flex: 1 },
  });
}
