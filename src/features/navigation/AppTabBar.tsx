import { Feather } from '@expo/vector-icons';
import { router, type Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { layout, size, type, useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { useTabBarItems } from './useTabBarItems';

/**
 * Props of the `tabBar` render prop. expo-router 58 ships its own copy of bottom-tabs whose bar receives `emitter` and
 * `navigateToTab(routeKey)` instead of react-navigation's `navigation` (the plan's draft used `navigation`).
 */
export type AppTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/** `TabBar.dc.html`: top line, icon 24 over an 11/600 label, accent for the current tab, 48 high touch targets. */
export function AppTabBar({ state, emitter, navigateToTab }: AppTabBarProps) {
  const styles = useThemedStyles(createAppTabBarStyles);
  const { palette } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const items = useTabBarItems();
  const activeRoute = state.routes[state.index]?.name;

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={t('nav.tabs')}
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, layout.tabBarBottom) }]}
    >
      {items.map((item) => {
        const route = state.routes.find((candidate) => candidate.name === item.route);
        const selected = activeRoute === item.route;
        const color = selected ? palette.acc : palette.mute;
        return (
          <Pressable
            key={item.key}
            testID={`tab-${item.route}`}
            accessibilityRole="tab"
            accessibilityLabel={item.title}
            accessibilityHint={t('settings.navigation.editTabBar')}
            accessibilityState={{ selected }}
            onPress={() => {
              if (!route && __DEV__) console.warn(`AppTabBar: tab '${def.route}' has no route in the navigator (missing screen file or name mismatch)`);
              const event = emitter.emit({ type: 'tabPress', target: route?.key, canPreventDefault: true });
              if (!selected && !event.defaultPrevented && route) navigateToTab(route.key);
            }}
            onLongPress={() => router.push('/settings/navigation')}
            style={styles.item}
          >
            <Feather name={item.icon} size={size.iconLarge} color={color} />
            <Text style={[type.tab, { color }]}>{item.title}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createAppTabBarStyles(palette: Palette) {
  return StyleSheet.create({
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
}
