import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import { size, useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { priorityColor, prioritySoft } from './priority';

interface CheckboxProps {
  priority: number;
  checked: boolean;
  /** REVIEW: waiting for an admin's review — a clock ring in the review colour, still not done. */
  pending?: boolean;
  onPress: () => void;
  label: string;
  disabled?: boolean;
  /** 26 in the task detail, 22 in lists. */
  large?: boolean;
  testID?: string;
}

/** .chk: round, ring in the priority colour + matching soft fill; done = accent fill + white check; 44 touch area. */
export function Checkbox({ priority, checked, pending = false, onPress, label, disabled = false, large = false, testID }: CheckboxProps) {
  const styles = useThemedStyles(createCheckboxStyles);
  const { palette } = useTheme();
  const dimension = large ? size.checkboxLarge : size.checkbox;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={11}
      style={[
        styles.box,
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
          borderColor: checked ? palette.acc : pending ? palette.vio : priorityColor(priority, palette),
          backgroundColor: checked ? palette.acc : pending ? palette.bg : prioritySoft(priority, palette),
        },
        disabled && !checked && styles.disabled,
      ]}
    >
      {checked ? <Feather name="check" size={12} color={palette.onacc} /> : null}
      {pending && !checked ? <Feather testID={testID ? `${testID}-pending` : undefined} name="clock" size={12} color={palette.vio} /> : null}
    </Pressable>
  );
}

function createCheckboxStyles(palette: Palette) {
  return StyleSheet.create({
    box: { borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
    disabled: { opacity: 0.6 },
  });
}
