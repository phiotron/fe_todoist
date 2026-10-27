import { Pressable, StyleSheet, View } from 'react-native';
import { palette } from '../theme';

interface ToggleProps {
  value: boolean;
  onChange: (next: boolean) => void;
  /** Accessible name: a switch must say what it controls. */
  label: string;
  disabled?: boolean;
  testID?: string;
}

/** .tog: 44×26 track (tog / acc), 20px white knob. */
export function Toggle({ value, onChange, label, disabled = false, testID }: ToggleProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      hitSlop={9}
      style={[styles.track, { backgroundColor: value ? palette.acc : palette.tog }, disabled && styles.disabled]}
    >
      <View style={[styles.knob, { left: value ? 21 : 3 }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: 44, height: 26, borderRadius: 13 },
  knob: { position: 'absolute', top: 3, width: 20, height: 20, borderRadius: 10, backgroundColor: palette.knob },
  disabled: { opacity: 0.5 },
});
