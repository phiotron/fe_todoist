import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { ErrorText } from '../../components/ErrorText';
import { Segmented } from '../../components/Segmented';
import { useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { PALETTES } from '../../theme/themes';
import { THEME_NAMES, type Appearance, type ThemeName } from '../../theme/themeNames';
import { SettingsPage } from './SettingsPage';
import { describeSettingsSaveError } from './settingsErrors';
import { THEME_NAME_KEYS } from './themeLabels';
import { ChoiceList, SettingsSection, SwitchRow } from './ui';
import { useSettings } from './useSettings';

export function ThemeSettingsScreen() {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const { scheme } = useTheme();
  const { settings, update, syncTheme, setSyncTheme } = useSettings();
  const [error, setError] = useState<string>();

  async function save(patch: { theme?: ThemeName; appearance?: Appearance }) {
    setError(undefined);
    try {
      // Applied at once; the account keeps it (other devices) unless "Sync theme" is off.
      await update(patch);
    } catch (saveError) {
      setError(describeSettingsSaveError(saveError));
    }
  }

  return (
    <SettingsPage testID="theme-settings-screen" title={t('settings.pages.theme')}>
      <SettingsSection testID="settings-section-appearance" title={t('settings.appearance.title')}>
        <Segmented
          testID="appearance"
          value={settings.appearance}
          onChange={(appearance) => {
            if (appearance !== settings.appearance) void save({ appearance });
          }}
          options={[
            { key: 'LIGHT', label: t('settings.appearance.light') },
            { key: 'DARK', label: t('settings.appearance.dark') },
            { key: 'AUTO', label: t('settings.appearance.auto') },
          ]}
        />
      </SettingsSection>
      <SettingsSection testID="settings-section-themes" title={t('settings.appearance.themes')}>
        <ChoiceList
          testIDPrefix="theme-option"
          selected={settings.theme}
          onSelect={(theme) => {
            if (theme !== settings.theme) void save({ theme });
          }}
          choices={THEME_NAMES.map((name) => ({
            value: name,
            label: t(THEME_NAME_KEYS[name]),
            accessory: (
              <View
                testID={`theme-swatch-${name}`}
                style={[styles.swatch, { backgroundColor: PALETTES[name][scheme].acc }]}
              />
            ),
          }))}
        />
        <ErrorText testID="theme-error" message={error} />
      </SettingsSection>
      <SettingsSection testID="settings-section-themeSync">
        <SwitchRow
          testID="theme-sync"
          label={t('settings.appearance.sync')}
          hint={t('settings.appearance.syncHint')}
          value={syncTheme}
          onChange={(on) => void setSyncTheme(on)}
        />
      </SettingsSection>
    </SettingsPage>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    swatch: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: palette.line2 },
  });
}
