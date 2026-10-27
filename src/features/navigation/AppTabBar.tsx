import { Feather } from '@expo/vector-icons';
import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { layout, palette, size, type } from '../../theme';
import { TAB_DEFS, useNavTabs } from './navTabs';

/**
 * Props of the `tabBar` render prop. expo-router 58 ships its own copy of bottom-tabs whose bar receives `emitter` and
 * `navigateToTab(routeKey)` instead of react-navigation's `navigation` (the plan's draft used `navigation`).
 */
export type AppTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/** `TabBar.dc.html`: top line, icon 24 over an 11/600 label, accent for the current tab, 48 high touch targets. */
export function AppTabBar({ state, emitter, navigateToTab }: AppTabBarProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const keys = useNavTabs();
  const activeRoute = state.routes[state.index]?.name;

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={t('nav.tabs')}
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, layout.tabBarBottom) }]}
    >
      {keys.map((key) => {
        const def = TAB_DEFS[key];
        const route = state.routes.find((candidate) => candidate.name === def.route);
        const selected = activeRoute === def.route;
        const color = selected ? palette.acc : palette.mute;
        return (
          <Pressable
            key={key}
            testID={`tab-${def.route}`}
            accessibilityRole="tab"
            accessibilityLabel={def.title()}
            accessibilityState={{ selected }}
            onPress={() => {
              if (!route && __DEV__) console.warn(`AppTabBar: tab '${def.route}' has no route in the navigator (missing screen file or name mismatch)`);
              const event = emitter.emit({ type: 'tabPress', target: route?.key, canPreventDefault: true });
              if (!selected && !event.defaultPrevented && route) navigateToTab(route.key);
            }}
            style={styles.item}
          >
            <Feather name={def.icon} size={size.iconLarge} color={color} />
            <Text style={[type.tab, { color }]}>{def.title()}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingTop: 6,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: palette.line,
    backgroundColor: palette.bg,
  },
  item: { flex: 1, minHeight: size.tabItem, alignItems: 'center', justifyContent: 'center', gap: 2 },
});
