import { Feather } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { layout, shadow, size, useThemedStyles, useTheme } from '../theme';
import type { Palette } from '../theme/palette';
import { fabBottomAboveTabBar } from './tabBarMetrics';

/** Horizontal position of the + button (M3x, Settings › Navigation bar); same values as me/settings.addButtonPlacement. */
export type FabPlacement = 'LEFT' | 'CENTER' | 'RIGHT';

interface FabProps {
  label: string;
  onPress: () => void;
  bottom?: number;
  /** The tab layout's +: sit a fixed gap above the REAL tab bar (it grows with the system navigation bar). */
  aboveTabBar?: boolean;
  placement?: FabPlacement;
  testID?: string;
}

/** .fab: 56 round accent button, 100 from the bottom (above the tab bar); 20 from the right by default (M3x: left / centre). */
export const Fab = memo(function Fab({ label, onPress, bottom, aboveTabBar = false, placement = 'RIGHT', testID = 'fab' }: FabProps) {
  const styles = useThemedStyles(createFabStyles);
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const at = bottom ?? (aboveTabBar ? fabBottomAboveTabBar(insets.bottom) : layout.fabBottom);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.fab, PLACEMENT_STYLES[placement], { bottom: at }]}
    >
      <Feather name="plus" size={size.iconLarge} color={palette.onacc} />
    </Pressable>
  );
});

const PLACEMENT_STYLES = StyleSheet.create({
  LEFT: { left: layout.fabRight },
  CENTER: { left: '50%', marginLeft: -size.fab / 2 },
  RIGHT: { right: layout.fabRight },
});

function createFabStyles(palette: Palette) {
  return StyleSheet.create({
    fab: {
      position: 'absolute',
      width: size.fab,
      height: size.fab,
      borderRadius: size.fab / 2,
      backgroundColor: palette.acc,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow,
    },
  });
}
