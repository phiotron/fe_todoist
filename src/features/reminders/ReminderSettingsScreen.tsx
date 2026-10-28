import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../components/AppButton';
import { ListRow } from '../../components/ListRow';
import { RadioRow } from '../../components/RadioRow';
import { SubHeader } from '../../components/SubHeader';
import { Toggle } from '../../components/Toggle';
import { AUTO_REMINDER_MINUTES, DEFAULT_AUTO_REMINDER_MINUTES } from '../../lib/reminders';
import { useDeviceId } from '../../lib/device/deviceId';
import { getTasklyAndroid } from '../../lib/native/tasklyAndroid';
import { gutter, radius, type, useTheme } from '../../theme';
import type { Palette } from '../../theme/palette';
import { DEFAULT_SNOOZE_MINUTES, SNOOZE_MINUTE_CHOICES } from './reminderSettings';
import { offsetLabel } from './reminderLabel';
import { requestReminderSync } from './syncSignal';
import { useExactAlarmGrant } from './useExactAlarmGrant';
import { useReminderPermission } from './useReminderPermission';

/** Off first, then the 10 values of spec 12.1.1; `null` = automatic reminders off. */
const AUTO_CHOICES: readonly (number | null)[] = [null, ...AUTO_REMINDER_MINUTES];

/** The reminder fields of me/settings (spec 12.1.1). Fields the server did not send yet are undefined. */
export type ReminderSettingsValues = {
  remindersEnabled?: boolean;
  /** null = automatic reminders off. */
  autoReminderMinutes?: number | null;
  /** M12: minutes of the Snooze button. */
  snoozeMinutes?: number;
  /** M12: reminder notifications stay in the tray. */
  pinReminders?: boolean;
  /** M12: install id of the device that rings urgent reminders; null = none. */
  urgentDeviceId?: string | null;
};

function snoozeLabel(minutes: number, t: (key: string, options?: Record<string, unknown>) => string): string {
  return minutes >= 60 && minutes % 60 === 0
    ? t('reminders.settings.snoozeHours', { count: minutes / 60 })
    : t('reminders.settings.snoozeOption', { count: minutes });
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
  /** M12: opens Settings › Reminders › Places; the row is hidden when absent. */
  onOpenPlaces?: () => void;
  /** Show how to allow exact alarms (decision 13). Defaults to what the platform says (re-read when the app returns). */
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
  onOpenPlaces,
  showExactAlarmHint,
}: ReminderSettingsScreenProps) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const permission = useReminderPermission();
  const exactAlarm = useExactAlarmGrant();
  const exactAlarmHint = showExactAlarmHint ?? exactAlarm.needed;
  const deviceId = useDeviceId();

  if (!settings) return null;

  const currentSnooze = settings.snoozeMinutes ?? DEFAULT_SNOOZE_MINUTES;
  const urgentDeviceId = settings.urgentDeviceId ?? null;
  const urgentHere = urgentDeviceId !== null && urgentDeviceId === deviceId;
  const native = getTasklyAndroid();
  const fullScreenMissing = urgentHere && native !== null && !native.canUseFullScreenIntent();
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

        <Text accessibilityRole="header" style={styles.heading}>
          {t('reminders.settings.snoozeTitle')}
        </Text>
        <Text style={styles.hint}>{t('reminders.settings.snoozeHint')}</Text>
        <View accessibilityRole="radiogroup">
          {SNOOZE_MINUTE_CHOICES.map((minutes) => (
            <RadioRow
              key={minutes}
              testID={`snooze-${minutes}`}
              title={snoozeLabel(minutes, t)}
              selected={currentSnooze === minutes}
              onPress={() => void save({ snoozeMinutes: minutes })}
            />
          ))}
        </View>

        <ListRow
          title={t('reminders.settings.pinTitle')}
          right={
            <Toggle
              testID="reminder-pin-switch"
              label={t('reminders.settings.pinTitle')}
              value={settings.pinReminders === true}
              onChange={(value) => void save({ pinReminders: value })}
            />
          }
        />
        <Text style={styles.hint}>{t('reminders.settings.pinHint')}</Text>

        <Text accessibilityRole="header" style={styles.heading}>
          {t('reminders.urgent.title')}
        </Text>
        <Text style={styles.hint}>{t('reminders.urgent.hint')}</Text>
        <Text testID="urgent-device-status" style={styles.status}>
          {urgentDeviceId === null
            ? t('reminders.urgent.none')
            : urgentHere
              ? t('reminders.urgent.thisDevice')
              : t('reminders.urgent.otherDevice')}
        </Text>
        <View style={styles.row}>
          {urgentHere ? null : (
            <AppButton
              testID="urgent-use-this-device"
              variant="outline"
              size="sm"
              label={t('reminders.urgent.useThisDevice')}
              disabled={deviceId === null}
              onPress={() => deviceId !== null && void save({ urgentDeviceId: deviceId })}
            />
          )}
          {urgentDeviceId === null ? null : (
            <AppButton
              testID="urgent-clear"
              variant="ghost"
              size="sm"
              label={t('reminders.urgent.clear')}
              onPress={() => void save({ urgentDeviceId: null })}
            />
          )}
        </View>
        {fullScreenMissing ? (
          <View testID="urgent-full-screen" style={styles.exact}>
            <Text style={styles.hint}>{t('reminders.urgent.fullScreenHint')}</Text>
            <AppButton
              testID="urgent-full-screen-open"
              variant="outline"
              size="sm"
              label={t('reminders.urgent.fullScreenOpen')}
              onPress={() => void native?.openFullScreenIntentSettings()}
            />
          </View>
        ) : null}

        {onOpenPlaces ? (
          <ListRow
            testID="reminder-places-row"
            icon="map-pin"
            title={t('reminders.settings.placesRow')}
            chevron
            onPress={onOpenPlaces}
          />
        ) : null}

        {enabled && exactAlarmHint ? (
          <View testID="reminder-exact-alarm" style={styles.exact}>
            <Text style={styles.hint}>{t('reminders.settings.exactAlarmHint')}</Text>
            <AppButton
              testID="reminder-exact-alarm-open"
              variant="outline"
              size="sm"
              label={t('reminders.settings.exactAlarmOpen')}
              onPress={() => void exactAlarm.openSettings()}
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
    status: { ...type.body, color: palette.ink, marginBottom: 8 },
    row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  });
}
