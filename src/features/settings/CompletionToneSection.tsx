import { useTranslation } from 'react-i18next';
import { setDeviceSettings, useDeviceSettings } from '../../lib/device/deviceSettings';
import { isAndroid } from '../../lib/native/platform';
import { SettingsSection, SwitchRow } from './ui';

/** "Task complete tone" (M12): a device setting, on by default; the sound itself comes from the native module. */
export function CompletionToneSection() {
  const { t } = useTranslation();
  const { completionTone } = useDeviceSettings();
  // X5: the tone is played by the Android native module; nothing to switch on iOS.
  if (!isAndroid()) return null;
  return (
    <SettingsSection testID="settings-section-completionTone">
      <SwitchRow
        testID="completion-tone"
        label={t('android.tone.title')}
        hint={t('android.tone.hint')}
        value={completionTone}
        onChange={(value) => void setDeviceSettings({ completionTone: value })}
      />
    </SettingsSection>
  );
}
