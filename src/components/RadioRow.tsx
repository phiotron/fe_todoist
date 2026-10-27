import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { size, type, useThemedStyles, useTheme } from '../theme';
import type { Palette } from '../theme/palette';
import type { IconName } from './IconButton';

interface RadioRowProps {
  title: string;
  /** Muted second line (e.g. "Mặc định"). */
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
  testID?: string;
}

/** Single-choice row (reminder lead time, duration, language…): same metrics as `.lrow`, a check mark on the right when chosen. */
export function RadioRow({ title, subtitle, selected, onPress, icon, disabled = false, testID }: RadioRowProps) {
  const styles = useThemedStyles(createRadioRowStyles);
  const { palette } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityLabel={title}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.row, disabled && styles.disabled]}
    >
      {icon ? <Feather name={icon} size={size.icon} color={palette.ink2} /> : null}
      <View style={styles.texts}>
        <Text style={[selected ? type.bodyStrong : type.body, { color: palette.ink }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {selected ? <Feather testID={testID ? `${testID}-check` : undefined} name="check" size={size.icon} color={palette.acc} /> : null}
    </Pressable>
  );
}

function createRadioRowStyles(palette: Palette) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      minHeight: size.listRow,
      borderBottomWidth: 1,
      borderBottomColor: palette.line,
    },
    texts: { flex: 1 },
    subtitle: { ...type.meta, color: palette.mute },
    disabled: { opacity: 0.5 },
  });
}
