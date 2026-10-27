import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useIsOnline } from '../lib/useIsOnline';
import { size, type, useThemedStyles, useTheme } from '../theme';
import type { Palette } from '../theme/palette';

interface AddRowProps {
  label: string;
  onPress: () => void;
  /** accent = "Thêm section" of M-Inbox (accent text, 600). */
  accent?: boolean;
  requiresOnline?: boolean;
  testID?: string;
}

/** .addrow: "+ Thêm công việc" / "Thêm sub-task" / "Thêm section". */
export function AddRow({ label, onPress, accent = false, requiresOnline = false, testID }: AddRowProps) {
  const styles = useThemedStyles(createAddRowStyles);
  const { palette } = useTheme();
  const online = useIsOnline();
  const inactive = requiresOnline && !online;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      style={[styles.row, inactive && styles.inactive]}
    >
      <Feather name="plus" size={size.icon} color={palette.acc} />
      <Text style={[accent ? type.buttonSmall : type.menuItem, { color: accent ? palette.acc : palette.mute }]}>{label}</Text>
    </Pressable>
  );
}

function createAddRowStyles(palette: Palette) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: size.touch },
    inactive: { opacity: 0.4 },
  });
}
