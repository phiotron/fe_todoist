import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { AppButton } from '../../components/AppButton';
import { ErrorText } from '../../components/ErrorText';
import { TextField } from '../../components/TextField';
import { describeSettingsSaveError } from './settingsErrors';
import { filterTimeZones, timeZoneOptions } from './timeZones';
import { ChoiceList, SettingsSection, useSettingsStyles } from './ui';
import { useSettings } from './useSettings';

export function TimeZoneSection() {
  const { t } = useTranslation();
  const styles = useSettingsStyles();
  const { settings, update, deviceTimeZone } = useSettings();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string>();

  const options = useMemo(
    () => filterTimeZones(timeZoneOptions(settings.timeZone, deviceTimeZone), query),
    [settings.timeZone, deviceTimeZone, query],
  );

  async function choose(zone: string) {
    setOpen(false);
    setQuery('');
    setError(undefined);
    if (zone === settings.timeZone) return;
    try {
      await update({ timeZone: zone });
    } catch (saveError) {
      setError(describeSettingsSaveError(saveError));
    }
  }

  return (
    <SettingsSection testID="settings-section-timeZone" title={t('settings.timeZone.title')}>
      <Text testID="timezone-current" style={styles.body}>
        {t('settings.timeZone.current', { zone: settings.timeZone })}
      </Text>
      {deviceTimeZone ? (
        <Text testID="timezone-device" style={styles.hint}>
          {t('settings.timeZone.device', { zone: deviceTimeZone })}
        </Text>
      ) : null}
      <View style={styles.actions}>
        {deviceTimeZone && deviceTimeZone !== settings.timeZone ? (
          <AppButton
            testID="timezone-use-device"
            variant="outline"
            label={t('settings.timeZone.useDevice')}
            onPress={() => void choose(deviceTimeZone)}
          />
        ) : null}
        <AppButton
          testID="timezone-toggle"
          variant="ghost"
          label={open ? t('settings.timeZone.close') : t('settings.timeZone.change')}
          onPress={() => setOpen((value) => !value)}
        />
      </View>
      {open ? (
        <View>
          <TextField
            testID="timezone-search"
            placeholder={t('settings.timeZone.search')}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {options.length === 0 ? (
            <Text testID="timezone-empty" style={styles.hint}>
              {t('settings.timeZone.noResults')}
            </Text>
          ) : (
            <ChoiceList
              testIDPrefix="timezone-option"
              selected={settings.timeZone}
              onSelect={(zone) => void choose(zone)}
              choices={options.map((zone) => ({ value: zone, label: zone }))}
            />
          )}
        </View>
      ) : null}
      <ErrorText testID="timezone-error" message={error} />
    </SettingsSection>
  );
}
