import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useIsOnline } from '../lib/useIsOnline';
import { size, type, useThemedStyles, useTheme } from '../theme';
import type { Palette } from '../theme/palette';
import { BottomSheet } from './BottomSheet';
import type { IconName } from './IconButton';

export interface ActionMenuItem {
  key: string;
  label: string;
  icon?: IconName;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
  /** Write action: disabled while offline (spec 5.6). */
  requiresOnline?: boolean;
}

interface ActionMenuProps {
  visible: boolean;
  onClose: () => void;
  items: readonly ActionMenuItem[];
  title?: string;
  testID?: string;
}

/** M-Confirm task actions: a bottom sheet of 48px rows with an icon; choosing one closes the sheet first. */
export function ActionMenu({ visible, onClose, items, title, testID = 'action-menu' }: ActionMenuProps) {
  const styles = useThemedStyles(createActionMenuStyles);
  const { palette } = useTheme();
  const online = useIsOnline();
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} testID={testID}>
      {items.map((item, index) => {
        const inactive = item.disabled === true || (item.requiresOnline === true && !online);
        const color = item.destructive ? palette.warn : palette.ink;
        return (
          <Pressable
            key={item.key}
            testID={`${testID}-${item.key}`}
            accessibilityRole="menuitem"
            accessibilityState={{ disabled: inactive }}
            disabled={inactive}
            onPress={() => {
              onClose();
              item.onPress();
            }}
            style={[styles.row, index === items.length - 1 && styles.last, inactive && styles.inactive]}
          >
            {item.icon ? <Feather name={item.icon} size={size.icon} color={color} /> : null}
            <Text style={[type.body, { color }]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </BottomSheet>
  );
}

function createActionMenuStyles(palette: Palette) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      minHeight: size.menuRow,
      borderBottomWidth: 1,
      borderBottomColor: palette.line,
    },
    last: { borderBottomWidth: 0 },
    inactive: { opacity: 0.4 },
  });
}
