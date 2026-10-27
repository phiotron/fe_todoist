import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorText } from '../../components/ErrorText';
import { SWIPE_CHOICES, type SwipeAction } from './settingsModel';
import { describeSettingsSaveError } from './settingsErrors';
import { PickerRow, SettingsSection, type Choice } from './ui';
import { useSettings } from './useSettings';

const SWIPE_LABEL_KEYS: Record<SwipeAction, string> = {
  COMPLETE: 'settings.swipe.actions.COMPLETE',
  SCHEDULE: 'settings.swipe.actions.SCHEDULE',
  DELETE: 'settings.swipe.actions.DELETE',
  REMINDERS: 'settings.swipe.actions.REMINDERS',
  SELECT: 'settings.swipe.actions.SELECT',
  NONE: 'settings.swipe.actions.NONE',
};

export function SwipeSection() {
  const { t } = useTranslation();
  const { settings, update } = useSettings();
  const [error, setError] = useState<string>();

  async function save(patch: { swipeLeft?: SwipeAction; swipeRight?: SwipeAction }) {
    setError(undefined);
    try {
      await update(patch);
    } catch (saveError) {
      setError(describeSettingsSaveError(saveError));
    }
  }

  // A value the account already has but this build does not offer (REMINDERS before M4) stays selectable.
  function optionsFor(current: SwipeAction): Choice<string>[] {
    const actions = SWIPE_CHOICES.includes(current) ? SWIPE_CHOICES : [...SWIPE_CHOICES, current];
    return actions.map((action) => ({ value: action, label: t(SWIPE_LABEL_KEYS[action]) }));
  }

  return (
    <SettingsSection testID="settings-section-swipe" title={t('settings.swipe.title')}>
      <PickerRow
        testID="swipe-right"
        label={t('settings.swipe.right')}
        valueLabel={t(SWIPE_LABEL_KEYS[settings.swipeRight])}
        options={optionsFor(settings.swipeRight)}
        selected={settings.swipeRight}
        onSelect={(value) => {
          if (value !== settings.swipeRight) void save({ swipeRight: value as SwipeAction });
        }}
      />
      <PickerRow
        testID="swipe-left"
        label={t('settings.swipe.left')}
        valueLabel={t(SWIPE_LABEL_KEYS[settings.swipeLeft])}
        options={optionsFor(settings.swipeLeft)}
        selected={settings.swipeLeft}
        onSelect={(value) => {
          if (value !== settings.swipeLeft) void save({ swipeLeft: value as SwipeAction });
        }}
      />
      <ErrorText testID="swipe-error" message={error} />
    </SettingsSection>
  );
}
