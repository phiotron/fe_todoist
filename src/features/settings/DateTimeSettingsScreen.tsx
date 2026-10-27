import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';
import { ErrorText } from '../../components/ErrorText';
import { formatDate, formatTime } from '../../lib/dates/displayFormat';
import { SettingsPage } from './SettingsPage';
import { describeSettingsSaveError } from './settingsErrors';
import { WEEKDAYS, type DateFormat, type SettingsPatch, type TimeFormat, type Weekday } from './settingsModel';
import { PickerRow, SettingsSection, useSettingsStyles, type Choice } from './ui';
import { useSettings } from './useSettings';

const WEEKDAY_KEYS = {
  1: 'settings.dateTime.weekdays.1',
  2: 'settings.dateTime.weekdays.2',
  3: 'settings.dateTime.weekdays.3',
  4: 'settings.dateTime.weekdays.4',
  5: 'settings.dateTime.weekdays.5',
  6: 'settings.dateTime.weekdays.6',
  7: 'settings.dateTime.weekdays.7',
} as const;

// A fixed sample (a Monday afternoon) so the line shows exactly what the chosen formats do.
const SAMPLE_DATE = '2026-10-26';
const SAMPLE_TIME = '14:30';

export function DateTimeSettingsScreen() {
  const { t } = useTranslation();
  const styles = useSettingsStyles();
  const { settings, update } = useSettings();
  const [error, setError] = useState<string>();

  const weekdayChoices: Choice<string>[] = WEEKDAYS.map((day) => ({ value: String(day), label: t(WEEKDAY_KEYS[day]) }));
  const weekdayLabel = (day: Weekday) => t(WEEKDAY_KEYS[day]);

  async function save(patch: SettingsPatch) {
    setError(undefined);
    try {
      await update(patch);
    } catch (saveError) {
      setError(describeSettingsSaveError(saveError));
    }
  }

  return (
    <SettingsPage testID="date-time-settings-screen" title={t('settings.pages.dateTime')}>
      <SettingsSection testID="settings-section-week" title={t('settings.pages.dateTime')}>
        <PickerRow
          testID="date-start-day"
          label={t('settings.dateTime.startDay')}
          valueLabel={weekdayLabel(settings.startDay)}
          options={weekdayChoices}
          selected={String(settings.startDay)}
          onSelect={(value) => {
            if (Number(value) !== settings.startDay) void save({ startDay: Number(value) as Weekday });
          }}
        />
        <PickerRow
          testID="date-next-week"
          label={t('settings.dateTime.nextWeek')}
          valueLabel={weekdayLabel(settings.nextWeek)}
          options={weekdayChoices}
          selected={String(settings.nextWeek)}
          onSelect={(value) => {
            if (Number(value) !== settings.nextWeek) void save({ nextWeek: Number(value) as Weekday });
          }}
        />
        <Text style={styles.hint}>{t('settings.dateTime.nextWeekHint')}</Text>
        <PickerRow
          testID="date-weekend"
          label={t('settings.dateTime.weekend')}
          valueLabel={weekdayLabel(settings.weekendStartDay)}
          options={weekdayChoices}
          selected={String(settings.weekendStartDay)}
          onSelect={(value) => {
            if (Number(value) !== settings.weekendStartDay) void save({ weekendStartDay: Number(value) as Weekday });
          }}
        />
        <Text style={styles.hint}>{t('settings.dateTime.weekendHint')}</Text>
      </SettingsSection>
      <SettingsSection testID="settings-section-formats">
        <PickerRow
          testID="date-format"
          label={t('settings.dateTime.dateFormat')}
          valueLabel={settings.dateFormat === 'DMY' ? t('settings.dateTime.dmy') : t('settings.dateTime.mdy')}
          options={[
            { value: 'DMY', label: t('settings.dateTime.dmy') },
            { value: 'MDY', label: t('settings.dateTime.mdy') },
          ]}
          selected={settings.dateFormat}
          onSelect={(value) => {
            if (value !== settings.dateFormat) void save({ dateFormat: value as DateFormat });
          }}
        />
        <PickerRow
          testID="time-format"
          label={t('settings.dateTime.timeFormat')}
          valueLabel={settings.timeFormat === 'H24' ? t('settings.dateTime.h24') : t('settings.dateTime.h12')}
          options={[
            { value: 'H24', label: t('settings.dateTime.h24') },
            { value: 'H12', label: t('settings.dateTime.h12') },
          ]}
          selected={settings.timeFormat}
          onSelect={(value) => {
            if (value !== settings.timeFormat) void save({ timeFormat: value as TimeFormat });
          }}
        />
        <Text testID="date-time-example" style={styles.hint}>
          {t('settings.dateTime.example', {
            date: formatDate(SAMPLE_DATE, true, settings.dateFormat),
            time: formatTime(SAMPLE_TIME, settings.timeFormat),
          })}
        </Text>
        <ErrorText testID="date-time-error" message={error} />
      </SettingsSection>
    </SettingsPage>
  );
}
