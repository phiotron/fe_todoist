import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import { palette, size } from '../../theme';
import { priorityColor, prioritySoft } from './priority';

interface CheckboxProps {
  priority: number;
  checked: boolean;
  onPress: () => void;
  label: string;
  disabled?: boolean;
  /** 26 in the task detail, 22 in lists. */
  large?: boolean;
  testID?: string;
}

/** .chk: round, ring in the priority colour + matching soft fill; done = accent fill + white check; 44 touch area. */
export function Checkbox({ priority, checked, onPress, label, disabled = false, large = false, testID }: CheckboxProps) {
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
          borderColor: checked ? palette.acc : priorityColor(priority),
          backgroundColor: checked ? palette.acc : prioritySoft(priority),
        },
        disabled && !checked && styles.disabled,
      ]}
    >
      {checked ? <Feather name="check" size={12} color={palette.onacc} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  disabled: { opacity: 0.6 },
});
