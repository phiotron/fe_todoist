import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../components/AppButton';
import { ListRow } from '../../components/ListRow';
import { RadioRow } from '../../components/RadioRow';
import { SubHeader } from '../../components/SubHeader';
import { Toggle } from '../../components/Toggle';
import { AUTO_REMINDER_MINUTES, DEFAULT_AUTO_REMINDER_MINUTES } from '../../lib/reminders';
import { gutter, radius, type, useTheme } from '../../theme';
import type { Palette } from '../../theme/palette';
import { getReminderPlatform } from './platform';
import { offsetLabel } from './reminderLabel';
import { requestReminderSync } from './syncSignal';
import { useReminderPermission } from './useReminderPermission';

/** Off first, then the 10 values of spec 12.1.1; `null` = automatic reminders off. */
const AUTO_CHOICES: readonly (number | null)[] = [null, ...AUTO_REMINDER_MINUTES];

/** The reminder fields of me/settings (spec 12.1.1). Fields the server did not send yet are undefined. */
export interface ReminderSettingsValues {
  remindersEnabled?: boolean;
  /** null = automatic reminders off. */
  autoReminderMinutes?: number | null;
}

export interface ReminderSettingsScreenProps {
  /** null while me/settings is loading. */
  settings: ReminderSettingsValues | null;
  /**
   * Saves a PATCH of me/settings and resolves once the server stored it (rejects on failure). The server computes the
   * fire times from autoReminderMinutes, so the reminder sync runs only after this resolves (spec 12.8).
   */
  onSave: (patch: ReminderSettingsValues) => Promise<unknown> | void;
  onBack: () => void;
  /** Android 14+: show how to allow exact alarms (decision 13). Defaults to what the platform says. */
  showExactAlarmHint?: boolean;
}

/**
 * Settings → Reminders (spec 9.1, 5.8; layout of the notification part of design M-Settings). Presentational: the
 * settings source and the route belong to the Settings feature (M3), which passes `settings` / `onSave`.
 */
export function ReminderSettingsScreen({
  settings,
  onSave,
  onBack,
  showExactAlarmHint = getReminderPlatform().needsExactAlarmGrant(),
}: ReminderSettingsScreenProps) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const permission = useReminderPermission();

  if (!settings) return null;

  const enabled = settings.remindersEnabled !== false;
  const currentAuto =
    settings.autoReminderMinutes === undefined ? DEFAULT_AUTO_REMINDER_MINUTES : settings.autoReminderMinutes;
  const blocked = enabled && permission.state !== null && !permission.state.granted;

  const save = async (patch: ReminderSettingsValues) => {
    try {
      await onSave(patch);
    } catch {
      return; // the caller shows its own error; nothing changed on the server, so no sync
    }
    requestReminderSync();
  };

  const allow = async () => {
    const next = await permission.request();
    if (next?.granted) requestReminderSync();
  };

  return (
    <View testID="reminder-settings" style={styles.root}>
      <SubHeader title={t('reminders.settings.title')} onBack={onBack} testID="reminder-settings-header" />
      <ScrollView contentContainerStyle={styles.content}>
        {blocked && permission.state ? (
          <View testID="reminder-permission-banner" style={styles.banner}>
            <Text style={styles.bannerText}>{t('reminders.settings.permissionMissing')}</Text>
            {permission.state.canAskAgain ? (
              <AppButton
                testID="reminder-permission-allow"
                variant="outline"
                size="sm"
                label={t('reminders.settings.allowNotifications')}
                onPress={() => void allow()}
              />
            ) : (
              <AppButton
                testID="reminder-permission-open-settings"
                variant="outline"
                size="sm"
                label={t('reminders.settings.openSystemSettings')}
                onPress={() => void Linking.openSettings().catch(() => undefined)}
              />
            )}
          </View>
        ) : null}

        <ListRow
          title={t('reminders.settings.enabled')}
          right={
            <Toggle
              testID="reminder-enabled-switch"
              label={t('reminders.settings.enabled')}
              value={enabled}
              onChange={(value) => void save({ remindersEnabled: value })}
            />
          }
        />

        <Text accessibilityRole="header" style={styles.heading}>
          {t('reminders.settings.autoTitle')}
        </Text>
        <Text style={styles.hint}>{t('reminders.settings.autoHint')}</Text>
        <View accessibilityRole="radiogroup">
          {AUTO_CHOICES.map((minutes) => (
            <RadioRow
              key={minutes === null ? 'off' : minutes}
              testID={`auto-reminder-${minutes === null ? 'off' : minutes}`}
              title={minutes === null ? t('reminders.settings.autoOff') : offsetLabel(minutes, t)}
              selected={currentAuto === minutes}
              onPress={() => void save({ autoReminderMinutes: minutes })}
            />
          ))}
        </View>

        {enabled && showExactAlarmHint ? (
          <View testID="reminder-exact-alarm" style={styles.exact}>
            <Text style={styles.hint}>{t('reminders.settings.exactAlarmHint')}</Text>
            <AppButton
              testID="reminder-exact-alarm-open"
              variant="outline"
              size="sm"
              label={t('reminders.settings.exactAlarmOpen')}
              onPress={() => void getReminderPlatform().openExactAlarmSettings()}
            />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: palette.bg },
    content: { paddingHorizontal: gutter, paddingBottom: 32 },
    banner: { backgroundColor: palette.p2s, borderRadius: radius.control, padding: 12, gap: 8, marginVertical: 8 },
    bannerText: { ...type.meta, color: palette.ink },
    heading: { ...type.label, color: palette.ink2, marginTop: 20, marginBottom: 4 },
    hint: { ...type.meta, color: palette.mute, marginBottom: 4 },
    exact: { gap: 8, marginTop: 20 },
  });
}
