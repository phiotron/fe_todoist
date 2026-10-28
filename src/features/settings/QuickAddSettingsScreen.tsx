import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { ErrorText } from '../../components/ErrorText';
import { ListRow } from '../../components/ListRow';
import { ReorderModal } from '../../components/ReorderModal';
import { Chip } from '../../components/Chip';
import {
  ALL_CHIPS,
  AVAILABLE_CHIPS,
  CHIP_META,
  readQuickAddPrefs,
  toggleChip,
  type QuickAddChip,
} from '../quickAdd/quickAddChips';
import { SettingsPage } from './SettingsPage';
import { describeSettingsSaveError } from './settingsErrors';
import { SettingsSection, SwitchRow } from './ui';
import { useSettings } from './useSettings';
import { StyleSheet } from 'react-native';
import { type, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';

function createPreviewStyles(palette: Palette) {
  return StyleSheet.create({
    previewName: { ...type.composerTitle, color: palette.mute },
    previewHint: { ...type.body, color: palette.mute },
    previewChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  });
}

/** Order after "put `id` right after `afterId` (null = first)". */
function placeAfter(chips: readonly QuickAddChip[], id: QuickAddChip, afterId: string | null): QuickAddChip[] {
  const rest = chips.filter((chip) => chip !== id);
  const at = afterId === null ? 0 : rest.indexOf(afterId as QuickAddChip) + 1;
  return [...rest.slice(0, at), id, ...rest.slice(at)];
}

/**
 * M-SettingsQuickAdd (spec 3.2 M6b): which chips Quick Add shows and in what order (Show / Hide switch + drag or ↑ / ↓),
 * "Show action labels", "Show description", and a preview. Saved at once through me/settings (kept if the save fails).
 */
export function QuickAddSettingsScreen() {
  const { t } = useTranslation();
  const styles = useThemedStyles(createPreviewStyles);
  const { data, update } = useSettings();
  const prefs = readQuickAddPrefs(data as Record<string, unknown> | undefined);
  const [error, setError] = useState<string>();
  const [ordering, setOrdering] = useState(false);

  async function save(patch: Parameters<typeof update>[0]) {
    setError(undefined);
    try {
      await update(patch);
    } catch (saveError) {
      setError(describeSettingsSaveError(saveError));
    }
  }

  const chipName = (chip: QuickAddChip) => t(`quickAdd.chips.${CHIP_META[chip].key}`);
  const reorderItems = prefs.chips.map((chip) => ({ id: chip, label: chipName(chip) }));

  return (
    <SettingsPage testID="quick-add-settings" title={t('quickAdd.settings.title')}>
      <SettingsSection testID="quick-add-settings-chips" title={t('quickAdd.settings.shown')}>
        {ALL_CHIPS.map((chip) => {
          const shown = prefs.chips.includes(chip);
          const required = chip === 'PROJECT';
          const hint = required
            ? t('quickAdd.settings.alwaysShown')
            : AVAILABLE_CHIPS.has(chip)
              ? undefined
              : t('quickAdd.settings.notYet');
          return (
            <SwitchRow
              key={chip}
              testID={`quick-add-chip-${chip}`}
              label={chipName(chip)}
              hint={hint}
              value={shown}
              disabled={required}
              onChange={() => void save({ quickAddChips: toggleChip(prefs.chips, chip) })}
            />
          );
        })}
        <ListRow
          testID="quick-add-reorder"
          title={t('quickAdd.settings.reorder')}
          icon="menu"
          iconBox
          chevron
          onPress={() => setOrdering(true)}
        />
      </SettingsSection>
      <SettingsSection testID="quick-add-settings-options">
        <SwitchRow
          testID="quick-add-show-labels"
          label={t('quickAdd.settings.showActionLabels')}
          value={prefs.showActionLabels}
          onChange={(value) => void save({ quickAddShowActionLabels: value })}
        />
        <SwitchRow
          testID="quick-add-show-description"
          label={t('quickAdd.settings.showDescription')}
          value={prefs.showDescription}
          onChange={(value) => void save({ quickAddShowDescription: value })}
        />
      </SettingsSection>
      <SettingsSection testID="quick-add-settings-preview" title={t('quickAdd.settings.preview')}>
        <View testID="quick-add-preview">
          <Text style={styles.previewName}>{t('quickAdd.placeholder')}</Text>
          {prefs.showDescription ? <Text style={styles.previewHint}>{t('quickAdd.description')}</Text> : null}
          <View style={styles.previewChips}>
            {prefs.chips.map((chip) => (
              <Chip
                key={chip}
                large
                icon={CHIP_META[chip].icon}
                label={chipName(chip)}
                iconOnly={!prefs.showActionLabels && chip !== 'PROJECT'}
                testID={`quick-add-preview-${chip}`}
              />
            ))}
          </View>
        </View>
      </SettingsSection>
      <ErrorText testID="quick-add-settings-error" message={error} />
      <ReorderModal
        visible={ordering}
        title={t('quickAdd.settings.shown')}
        items={reorderItems}
        onMove={(id, afterId) => void save({ quickAddChips: placeAfter(prefs.chips, id as QuickAddChip, afterId) })}
        onClose={() => setOrdering(false)}
        testID="quick-add-reorder-modal"
      />
    </SettingsPage>
  );
}
