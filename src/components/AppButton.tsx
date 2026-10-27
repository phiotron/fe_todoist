import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { useIsOnline } from '../lib/useIsOnline';
import { radius, size, type, useTheme, useThemedStyles } from '../theme';
import type { Palette } from '../theme/palette';
import type { IconName } from './IconButton';

/** .btn variants: primary = .pri, danger = .dng, ghost = .gh, outline = plain .btn. */
export type AppButtonVariant = 'primary' | 'danger' | 'outline' | 'ghost';

export interface AppButtonProps {
  label: string;
  onPress: () => void;
  testID?: string;
  variant?: AppButtonVariant;
  /** sm = .btn.sm (32 high, radius 8) — a secondary control; md = 44. */
  size?: 'md' | 'sm';
  /** .btn.full */
  full?: boolean;
  icon?: IconName;
  /** Text colour of ghost / outline buttons (e.g. accent for "Dời lịch"). */
  color?: string;
  disabled?: boolean;
  busy?: boolean;
  /** Write action: disabled while offline (spec 5.6). */
  requiresOnline?: boolean;
}

function fillFor(palette: Palette): Record<AppButtonVariant, { bg: string; border: string; text: string }> {
  return {
    primary: { bg: palette.acc, border: palette.acc, text: palette.onacc },
    danger: { bg: palette.warn, border: palette.warn, text: palette.onwarn },
    outline: { bg: palette.bg, border: palette.line2, text: palette.ink },
    ghost: { bg: 'transparent', border: 'transparent', text: palette.ink2 },
  };
}

export function AppButton({
  label,
  onPress,
  testID,
  variant = 'primary',
  size: buttonSize = 'md',
  full = false,
  icon,
  color,
  disabled = false,
  busy = false,
  requiresOnline = false,
}: AppButtonProps) {
  const styles = useThemedStyles(createAppButtonStyles);
  const { palette } = useTheme();
  const online = useIsOnline();
  const inactive = disabled || busy || (requiresOnline && !online);
  const fill = fillFor(palette)[variant];
  const textColor = color ?? fill.text;
  const small = buttonSize === 'sm';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      hitSlop={small ? 6 : 0}
      style={[
        styles.base,
        {
          backgroundColor: fill.bg,
          borderColor: fill.border,
          height: small ? size.buttonSmall : size.button,
          borderRadius: small ? radius.chip : radius.control,
          paddingHorizontal: small ? 12 : 16,
        },
        full && styles.full,
        inactive && styles.inactive,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon ? <Feather name={icon} size={size.iconSmall} color={textColor} /> : null}
          <Text style={[small ? type.buttonSmall : type.button, { color: textColor }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

function createAppButtonStyles(palette: Palette) {
  return StyleSheet.create({
    base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1 },
    full: { alignSelf: 'stretch' },
    inactive: { opacity: 0.5 },
  });
}
