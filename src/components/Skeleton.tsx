import { StyleSheet, View, type DimensionValue } from 'react-native';
import { gutter, palette } from '../theme';

/** .skel block (static: the shimmer of the design is left out to keep tests and low-end devices simple). */
export function Skeleton({ width, height, round = false }: { width: DimensionValue; height: number; round?: boolean }) {
  return <View style={[styles.block, { width, height, borderRadius: round ? height / 2 : 6 }]} />;
}

const ROWS: readonly [DimensionValue, DimensionValue][] = [
  ['85%', '30%'],
  ['70%', '25%'],
  ['78%', '35%'],
  ['62%', '28%'],
  ['80%', '22%'],
];

/** M-Loading: section bar + task rows (circle + two bars). */
export function TaskSkeletonList({ testID = 'skeleton' }: { testID?: string }) {
  return (
    <View testID={testID} accessibilityRole="progressbar" accessibilityState={{ busy: true }} style={styles.list}>
      <View style={styles.section}>
        <Skeleton width={110} height={16} />
      </View>
      {ROWS.map(([title, meta], index) => (
        <View key={index} style={styles.row}>
          <Skeleton width={22} height={22} round />
          <View style={styles.text}>
            <Skeleton width={title} height={16} />
            <View style={styles.gap} />
            <Skeleton width={meta} height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: palette.line },
  list: { paddingHorizontal: gutter },
  section: { marginTop: 16, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 12 },
  text: { flex: 1 },
  gap: { height: 8 },
});
