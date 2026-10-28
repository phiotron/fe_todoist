import { useTranslation } from 'react-i18next';
import { setDeviceSettings, useDeviceSettings } from '../../lib/device/deviceSettings';
import { supportsDynamicColor } from '../../lib/native/tasklyAndroid';
import { SettingsSection, SwitchRow } from './ui';

/** "Dynamic Color" (M12): shown only where the system provides the colours (Android 12+ with the native module). */
export function DynamicColorSection() {
  const { t } = useTranslation();
  const { dynamicColor } = useDeviceSettings();
  if (!supportsDynamicColor()) return null;
  return (
    <SettingsSection testID="settings-section-dynamicColor">
      <SwitchRow
        testID="dynamic-color"
        label={t('android.dynamicColor.title')}
        hint={t('android.dynamicColor.hint')}
        value={dynamicColor}
        onChange={(value) => void setDeviceSettings({ dynamicColor: value })}
      />
    </SettingsSection>
  );
}
