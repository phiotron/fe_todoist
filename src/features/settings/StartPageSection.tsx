import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorText } from '../../components/ErrorText';
import { parsePin, pinKey, type PinTarget } from './navTabsModel';
import { describeSettingsSaveError } from './settingsErrors';
import { FIXED_TAB_LABEL_KEYS } from './tabLabels';
import { TargetPicker } from './TargetPicker';
import { PickerRow, SettingsSection } from './ui';
import { usePinTargets } from './usePinTargets';
import { useSettings } from './useSettings';

const PICK = 'PICK';
type FixedPage = 'INBOX' | 'TODAY' | 'UPCOMING';

export function StartPageSection() {
  const { t } = useTranslation();
  const { settings, update } = useSettings();
  const targets = usePinTargets();
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string>();

  const pin = parsePin(settings.startPage);
  const fixed: FixedPage | null = pin ? null : (settings.startPage as FixedPage);
  const valueLabel = pin
    ? (targets.nameOf(pin) ?? t('settings.startPage.unknown'))
    : t(FIXED_TAB_LABEL_KEYS[settings.startPage as FixedPage]);

  async function save(startPage: string) {
    setError(undefined);
    try {
      await update({ startPage });
    } catch (saveError) {
      setError(describeSettingsSaveError(saveError));
    }
  }

  function onSelect(value: string) {
    if (value === PICK) {
      setPicking(true);
      return;
    }
    if (value !== settings.startPage) void save(value);
  }

  function onPick(target: PinTarget) {
    setPicking(false);
    const next = pinKey(target);
    if (next !== settings.startPage) void save(next);
  }

  return (
    <SettingsSection testID="settings-section-startPage">
      <PickerRow
        testID="start-page"
        label={t('settings.startPage.title')}
        valueLabel={valueLabel}
        selected={fixed}
        onSelect={onSelect}
        options={[
          { value: 'INBOX', label: t(FIXED_TAB_LABEL_KEYS.INBOX) },
          { value: 'TODAY', label: t(FIXED_TAB_LABEL_KEYS.TODAY) },
          { value: 'UPCOMING', label: t(FIXED_TAB_LABEL_KEYS.UPCOMING) },
          { value: PICK, label: t('settings.startPage.choose') },
        ]}
      />
      <TargetPicker visible={picking} onClose={() => setPicking(false)} onSelect={onPick} selected={pin} />
      <ErrorText testID="start-page-error" message={error} />
    </SettingsSection>
  );
}
