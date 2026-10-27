import { StyleSheet, Text, View } from 'react-native';
import { fonts, type, useTheme } from '../../theme';
import { orderedLabels } from './labelDisplay';
import { useLabelMap } from './useLabels';

/** `.tag` per label in a task row's meta line; requests labels only when the task has some (keeps M1 tests unchanged). */
export function TaskLabels({ labelIds, testID }: { labelIds: readonly string[] | undefined; testID?: string }) {
  const { palette } = useTheme();
  const hasLabels = (labelIds?.length ?? 0) > 0;
  const labels = useLabelMap(hasLabels);
  const shown = hasLabels ? orderedLabels(labelIds, labels) : [];
  if (shown.length === 0) return null;
  return (
    <View testID={testID} style={styles.row}>
      {shown.map((label) => (
        <View key={label.id} style={[styles.tag, { backgroundColor: palette.bg2, borderColor: palette.line }]}>
          <Text style={[styles.text, { color: palette.ink2 }]}>{label.name}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 1 },
  /** .tag: 12 / 600 — the 12 px token with the semibold family (no `fontWeight`, Android drops custom fonts then). */
  text: { ...type.caption, fontFamily: fonts.semibold },
});
