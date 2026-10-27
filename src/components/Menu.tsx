import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, shadow, size, type, useThemedStyles, useTheme } from '../theme';
import type { Palette } from '../theme/palette';
import type { IconName } from './IconButton';

export interface MenuItem {
  key: string;
  label: string;
  icon?: IconName;
  iconColor?: string;
  selected?: boolean;
}

interface MenuProps {
  visible: boolean;
  onClose: () => void;
  items: readonly MenuItem[];
  onSelect: (key: string) => void;
  /** Distance from the bottom edge (M-AddTask: the priority menu floats above the chip row). */
  bottom?: number;
  left?: number;
  testID?: string;
}

/** .menu / .mi: small floating card; the current item carries an accent check. Rows are 44 for touch. */
export function Menu({ visible, onClose, items, onSelect, bottom = 220, left = 20, testID = 'menu' }: MenuProps) {
  const styles = useThemedStyles(createMenuStyles);
  const { palette } = useTheme();
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
        testID={`${testID}-backdrop`}
      />
      <View style={[styles.card, { bottom, left }]} accessibilityRole="menu" testID={testID}>
        {items.map((item) => (
          <Pressable
            key={item.key}
            testID={`${testID}-${item.key}`}
            accessibilityRole="menuitem"
            accessibilityState={{ selected: !!item.selected }}
            onPress={() => {
              onClose();
              onSelect(item.key);
            }}
            style={[styles.item, item.selected && styles.itemOn]}
          >
            {item.icon ? <Feather name={item.icon} size={size.icon} color={item.iconColor ?? palette.ink2} /> : null}
            <Text style={[type.menuItem, styles.label]}>{item.label}</Text>
            {item.selected ? <Feather name="check" size={size.iconSmall} color={palette.acc} /> : null}
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

function createMenuStyles(palette: Palette) {
  return StyleSheet.create({
    card: {
      position: 'absolute',
      width: 220,
      padding: 6,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.bg,
      ...shadow,
    },
    item: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: size.touch, paddingHorizontal: 10, borderRadius: radius.chip },
    itemOn: { backgroundColor: palette.bg2 },
    label: { flex: 1, color: palette.ink },
  });
}
