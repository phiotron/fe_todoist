import { Feather } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { palette, radius, size, type } from '../theme';
import type { IconName } from './IconButton';

interface ListRowProps {
  title: string;
  icon?: IconName;
  iconColor?: string;
  /** .lrow .ico: the icon sits in a 36×36 side-coloured box (Browse shortcuts). */
  iconBox?: boolean;
  /** Text (e.g. a count) or a node shown on the right. */
  right?: ReactNode;
  chevron?: boolean;
  bold?: boolean;
  /** Indent for tree rows (sub-projects). */
  indent?: number;
  onPress?: () => void;
  onLongPress?: () => void;
  testID?: string;
  accessibilityLabel?: string;
}

/** .lrow: ≥52 high, line under it. */
export function ListRow({
  title,
  icon,
  iconColor = palette.ink2,
  iconBox = false,
  right,
  chevron = false,
  bold = false,
  indent = 0,
  onPress,
  onLongPress,
  testID,
  accessibilityLabel,
}: ListRowProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      disabled={!onPress && !onLongPress}
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.row, { paddingLeft: indent }]}
    >
      {icon ? (
        iconBox ? (
          <View style={styles.iconBox}>
            <Feather name={icon} size={size.icon} color={iconColor} />
          </View>
        ) : (
          <Feather name={icon} size={size.icon} color={iconColor} />
        )
      ) : null}
      <Text style={[bold ? type.bodyStrong : type.body, styles.title]} numberOfLines={1}>
        {title}
      </Text>
      {typeof right === 'string' || typeof right === 'number' ? <Text style={styles.right}>{right}</Text> : right}
      {chevron ? <Feather name="chevron-right" size={size.iconSmall} color={palette.mute} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: size.listRow,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.control,
    backgroundColor: palette.side,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, color: palette.ink },
  right: { ...type.meta, color: palette.mute },
});
