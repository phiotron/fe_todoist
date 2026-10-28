import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AddButtonPlacement } from '../../api/navigationSettings';
import { ErrorText } from '../../components/ErrorText';
import { describeSettingsSaveError } from '../settings/settingsErrors';
import { ChoiceList, SettingsSection } from '../settings/ui';
import { useSettings } from '../settings/useSettings';
import { ADD_BUTTON_PLACEMENTS, readNavigationSettings } from './navMenuModel';

/** Settings › Navigation bar: position of the + button (Todoist Left / Center / Right), saved on the account at once. */
export function AddButtonPlacementSection() {
  const { t } = useTranslation();
  const { data, update } = useSettings();
  const [error, setError] = useState<string>();
  const current = readNavigationSettings(data).addButtonPlacement;

  async function onSelect(addButtonPlacement: AddButtonPlacement) {
    if (addButtonPlacement === current) return;
    setError(undefined);
    try {
      await update({ addButtonPlacement });
    } catch (saveError) {
      setError(describeSettingsSaveError(saveError));
    }
  }

  return (
    <SettingsSection testID="settings-section-addButton" title={t('navMenu.addButton.title')}>
      <ChoiceList
        testIDPrefix="add-button"
        choices={ADD_BUTTON_PLACEMENTS.map((value) => ({ value, label: t(`navMenu.addButton.${value}`) }))}
        selected={current}
        onSelect={(value) => void onSelect(value)}
      />
      <ErrorText testID="add-button-error" message={error} />
    </SettingsSection>
  );
}
