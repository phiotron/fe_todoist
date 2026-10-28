import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';
import { radius, size, type, useThemedStyles, useTheme } from '../theme';
import type { Palette } from '../theme/palette';
import type { IconName } from './IconButton';

export interface ChipProps {
  label: string;
  icon?: IconName;
  /** Tone colour for text, icon and border (date tone, priority). */
  color?: string;
  /** .chip.on */
  selected?: boolean;
  /** 36 high in sheets and the task detail, 32 elsewhere. */
  large?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  /** M6b Quick Add "Show action labels" off: only the icon is drawn (the label stays the accessibility label). */
  iconOnly?: boolean;
}

/** .chip: secondary control (date, priority, project, deadline…). */
export function Chip({ label, icon, color, selected = false, large = false, onPress, disabled, testID, accessibilityLabel, iconOnly = false }: ChipProps) {
  const styles = useThemedStyles(createChipStyles);
  const { palette } = useTheme();
  const textColor = selected ? palette.acc2 : (color ?? palette.ink2);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled: !!disabled }}
      disabled={disabled || !onPress}
      onPress={onPress}
      hitSlop={6}
      style={[
        styles.chip,
        { height: large ? size.chipLarge : size.chip, borderColor: selected ? palette.acc : (color ?? palette.line2) },
        selected && styles.selected,
        disabled && styles.disabled,
      ]}
    >
      {icon ? <Feather name={icon} size={size.iconSmall} color={textColor} /> : null}
      {iconOnly && icon ? null : (
        <Text style={[type.chip, { color: textColor }]} numberOfLines={1}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function createChipStyles(palette: Palette) {
  return StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderRadius: radius.chip,
      backgroundColor: palette.bg,
    },
    selected: { backgroundColor: palette.soft },
    disabled: { opacity: 0.5 },
  });
}
