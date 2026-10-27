import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import { layout, shadow, size, useThemedStyles, useTheme } from '../theme';
import type { Palette } from '../theme/palette';

/** .fab: 56 round accent button, 20 from the right and 100 from the bottom (above the tab bar). */
export function Fab({ label, onPress, bottom = layout.fabBottom, testID = 'fab' }: { label: string; onPress: () => void; bottom?: number; testID?: string }) {
  const styles = useThemedStyles(createFabStyles);
  const { palette } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.fab, { bottom }]}
    >
      <Feather name="plus" size={size.iconLarge} color={palette.onacc} />
    </Pressable>
  );
}

function createFabStyles(palette: Palette) {
  return StyleSheet.create({
    fab: {
      position: 'absolute',
      right: layout.fabRight,
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
