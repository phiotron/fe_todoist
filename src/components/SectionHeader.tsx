import { Feather } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { palette, size, type } from '../theme';

interface SectionHeaderProps {
  title: string;
  /** A number of tasks, or a ready text such as "1/3" (sub-task progress). */
  count?: number | string;
  /** danger = Overdue (warn colour). */
  tone?: 'danger' | 'muted';
  /** undefined = not collapsible; otherwise a chevron shows and the title toggles (M-Inbox). */
  collapsed?: boolean;
  onToggle?: () => void;
  /** Actions on the right (Dời lịch, ⋯ of a section…). */
  right?: ReactNode;
  testID?: string;
}

/** .sec: 14/700 title, muted count, line under it; collapsible with an arrow like the Inbox sections. */
export function SectionHeader({ title, count, tone, collapsed, onToggle, right, testID = 'section-header' }: SectionHeaderProps) {
  const { t } = useTranslation();
  const color = tone === 'danger' ? palette.warn : tone === 'muted' ? palette.mute : palette.ink;
  const collapsible = collapsed !== undefined && !!onToggle;
  const label = (
    <>
      {collapsible ? (
        <Feather name={collapsed ? 'chevron-right' : 'chevron-down'} size={size.iconSmall} color={palette.ink2} />
      ) : null}
      <Text style={[type.section, { color }]} numberOfLines={1}>
        {title}
      </Text>
      {count !== undefined ? <Text style={styles.count}>{count}</Text> : null}
    </>
  );
  return (
    <View style={styles.row} testID={testID}>
      {collapsible ? (
        <Pressable
          testID={`${testID}-toggle`}
          accessibilityRole="button"
          accessibilityLabel={collapsed ? t('common.expand', { name: title }) : t('common.collapse', { name: title })}
          accessibilityState={{ expanded: !collapsed }}
          onPress={onToggle}
          style={styles.label}
        >
          {label}
        </Pressable>
      ) : (
        <View style={styles.label}>{label}</View>
      )}
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: size.touch,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  label: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: size.touch },
  count: { ...type.metaStrong, color: palette.mute },
});
