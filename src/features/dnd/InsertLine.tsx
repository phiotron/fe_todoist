import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme';
import { useDragState } from './dnd';

/**
 * DND in lists: the accent line showing where the dragged task will land — above the row under the finger (upper
 * half) or below it (lower half). Drawn over the row (absolute), so rows never shift while measuring zones.
 */
export function InsertLine({ zoneId }: { zoneId: string }) {
  const { palette } = useTheme();
  const { overId, overAfter, payload } = useDragState();
  if (!payload || overId !== zoneId) return null;
  return (
    <View
      pointerEvents="none"
      testID={`insert-line-${zoneId}`}
      style={[styles.line, overAfter ? styles.after : styles.before, { backgroundColor: palette.acc }]}
    />
  );
}

const styles = StyleSheet.create({
  line: { position: 'absolute', left: 0, right: 0, height: 2 },
  before: { top: 0 },
  after: { bottom: 0 },
});
