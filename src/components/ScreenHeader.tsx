import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { gutter, layout, palette, type } from '../theme';
import { useTopInset } from './useTopInset';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Before the title (Browse avatar). */
  left?: ReactNode;
  /** Icon buttons on the right (⋯…). */
  right?: ReactNode;
  /** Smaller title (Browse: 22). */
  compact?: boolean;
  testID?: string;
}

/** .mh: tab screen header, 26/700 title + 13px muted subtitle, under the status bar. */
export function ScreenHeader({ title, subtitle, left, right, compact = false, testID }: ScreenHeaderProps) {
  const top = useTopInset();
  return (
    <View testID={testID} style={[styles.row, { paddingTop: top + layout.headerGap }]}>
      {left}
      <View style={styles.titles}>
        <Text style={[compact ? type.browseTitle : type.screenTitle, styles.title]} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: gutter, paddingBottom: 8, backgroundColor: palette.bg },
  titles: { flex: 1 },
  title: { color: palette.ink },
  subtitle: { ...type.meta, color: palette.mute, marginTop: 2 },
});
