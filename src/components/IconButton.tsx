import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useIsOnline } from '../lib/useIsOnline';
import { palette, radius, size } from '../theme';

export type IconName = ComponentProps<typeof Feather>['name'];

export interface IconButtonProps {
  icon: IconName;
  /** Accessible name (screen readers, tests): icon-only buttons always need one. */
  label: string;
  onPress: () => void;
  testID?: string;
  disabled?: boolean;
  requiresOnline?: boolean;
  color?: string;
  iconSize?: number;
}

/** .ib: 44×44 touch target, 20px stroke icon in ink2. */
export function IconButton({
  icon,
  label,
  onPress,
  testID,
  disabled = false,
  requiresOnline = false,
  color = palette.ink2,
  iconSize = size.icon,
}: IconButtonProps) {
  const online = useIsOnline();
  const inactive = disabled || (requiresOnline && !online);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      style={[styles.button, inactive && styles.inactive]}
    >
      <Feather name={icon} size={iconSize} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: size.touch, height: size.touch, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center' },
  inactive: { opacity: 0.4 },
});
