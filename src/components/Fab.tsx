import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import { layout, palette, shadow, size } from '../theme';

/** .fab: 56 round accent button, 20 from the right and 100 from the bottom (above the tab bar). */
export function Fab({ label, onPress, bottom = layout.fabBottom, testID = 'fab' }: { label: string; onPress: () => void; bottom?: number; testID?: string }) {
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

const styles = StyleSheet.create({
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
