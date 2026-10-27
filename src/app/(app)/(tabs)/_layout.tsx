import { Tabs, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Fab } from '../../../components/Fab';
import { useUserTimeZone } from '../../../features/auth/useUserTimeZone';
import { AppTabBar } from '../../../features/navigation/AppTabBar';
import { fabParamsFor } from '../../../features/navigation/fabTarget';
import { TAB_DEFS } from '../../../features/navigation/navTabs';
import { openQuickAdd } from '../../../features/quickAdd/quickAddTarget';
import { useUpcomingDay } from '../../../features/views/upcomingDayStore';
import { dateKeyInZone } from '../../../lib/dates';
import { useNow } from '../../../lib/useNow';
import { useTheme, useThemedStyles } from '../../../theme';
import type { Palette } from '../../../theme/palette';

export default function TabsLayout() {
  const styles = useThemedStyles(createTabsLayoutStyles);
  const { palette } = useTheme();
  const { t } = useTranslation();
  const pathname = usePathname();
  const now = useNow();
  const timeZone = useUserTimeZone();
  const upcomingDay = useUpcomingDay();
  const params = fabParamsFor(pathname, { today: dateKeyInZone(now, timeZone), upcomingDay });
  return (
    <View style={styles.fill}>
      <Tabs tabBar={(props) => <AppTabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: palette.bg } }}>
        {Object.values(TAB_DEFS).map((def) => (
          <Tabs.Screen key={def.key} name={def.route} options={{ title: def.title() }} />
        ))}
        {/* The pinned project / label / filter is not a fixed key, so it is not in TAB_DEFS. */}
        <Tabs.Screen name="pinned" options={{ title: t('settings.navigation.pin') }} />
      </Tabs>
      {/* One + for every tab (spec 9.2), 100 above the bottom edge = above the tab bar. */}
      <Fab label={t('views.addTask')} onPress={() => openQuickAdd(params)} testID="tab-fab" />
    </View>
  );
}

function createTabsLayoutStyles(palette: Palette) {
  return StyleSheet.create({ fill: { flex: 1, backgroundColor: palette.bg } });
}
