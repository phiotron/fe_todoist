import { Tabs, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Fab } from '../../../components/Fab';
import { useUserTimeZone } from '../../../features/auth/useUserTimeZone';
import { AppTabBar } from '../../../features/navigation/AppTabBar';
import { fabParamsFor } from '../../../features/navigation/fabTarget';
import { TAB_DEFS } from '../../../features/navigation/navTabs';
import { useAnySelectionActive } from '../../../features/tasks/selectionActiveStore';
import { openQuickAdd } from '../../../features/quickAdd/quickAddTarget';
import { useUpcomingDay } from '../../../features/views/upcomingDayStore';
import { dateKeyInZone } from '../../../lib/dates';
import { useNow } from '../../../lib/useNow';
import { palette } from '../../../theme';

/** The + button. It owns the clock / pathname / selected-day subscriptions, so their updates do not re-render the navigator. */
function TabsFab() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const now = useNow();
  const timeZone = useUserTimeZone();
  const upcomingDay = useUpcomingDay();
  const selecting = useAnySelectionActive();
  const params = fabParamsFor(pathname, { today: dateKeyInZone(now, timeZone), upcomingDay });
  if (selecting) return null; // multi-select: the + would cover the right end of the action bar
  // One + for every tab (spec 9.2), 100 above the bottom edge = above the tab bar.
  return <Fab label={t('views.addTask')} onPress={() => openQuickAdd(params)} testID="tab-fab" />;
}

export default function TabsLayout() {
  useTranslation(); // screen titles below are translated: re-render when the language changes (rare, unlike the clock).
  return (
    <View style={styles.fill}>
      <Tabs tabBar={(props) => <AppTabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: palette.bg } }}>
        {Object.values(TAB_DEFS).map((def) => (
          <Tabs.Screen key={def.key} name={def.route} options={{ title: def.title() }} />
        ))}
      </Tabs>
      <TabsFab />
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1, backgroundColor: palette.bg } });
