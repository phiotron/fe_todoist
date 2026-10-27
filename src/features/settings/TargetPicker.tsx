import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '../../components/BottomSheet';
import { type, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import type { PinKind, PinTarget } from './navTabsModel';
import { ChoiceList } from './ui';
import { usePinTargets } from './usePinTargets';

interface TargetPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (target: PinTarget) => void;
  /** Defaults to all three kinds. */
  kinds?: readonly PinKind[];
  /** The current target, drawn checked. */
  selected?: PinTarget | null;
}

const ALL_KINDS: readonly PinKind[] = ['project', 'label', 'filter'];
const KIND_TITLE_KEYS = {
  project: 'settings.picker.projects',
  label: 'settings.picker.labels',
  filter: 'settings.picker.filters',
} as const;

/** Bottom sheet with the user's projects, labels and filters (spec 9.2: "một dự án / nhãn / bộ lọc"). */
export function TargetPicker({ visible, onClose, onSelect, kinds = ALL_KINDS, selected = null }: TargetPickerProps) {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const targets = usePinTargets(kinds);
  const loaded = kinds.every((kind) => targets.settled[kind]);
  const empty = loaded && kinds.every((kind) => targets.options[kind].length === 0);

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('settings.picker.title')} scroll testID="target-picker">
      {empty ? <Text style={styles.empty}>{t('settings.picker.empty')}</Text> : null}
      {kinds.map((kind) => {
        const options = targets.options[kind];
        if (options.length === 0) return null;
        return (
          <View key={kind}>
            <Text accessibilityRole="header" style={styles.heading}>
              {t(KIND_TITLE_KEYS[kind])}
            </Text>
            <ChoiceList
              testIDPrefix={`target-picker-${kind}`}
              selected={selected && selected.kind === kind ? selected.id : null}
              onSelect={(id) => onSelect({ kind, id })}
              choices={options.map((option) => ({ value: option.id, label: option.name }))}
            />
          </View>
        );
      })}
    </BottomSheet>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    heading: { ...type.section, color: palette.ink, paddingTop: 12, paddingBottom: 4 },
    empty: { ...type.body, color: palette.mute, paddingVertical: 16 },
  });
}
