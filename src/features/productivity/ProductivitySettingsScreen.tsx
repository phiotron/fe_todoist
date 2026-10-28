import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Chip } from '../../components/Chip';
import { addDays } from '../../lib/dates';
import { weekdayName } from '../../lib/dates/format';
import { type, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { PickerRow, SettingsSection, SwitchRow } from '../settings/ui';
import { SettingsPage } from '../settings/SettingsPage';
import { useSettings } from '../settings/useSettings';
import {
  DAILY_GOAL_CHOICES,
  DEFAULT_DAILY_GOAL,
  DEFAULT_DAYS_OFF,
  DEFAULT_WEEKLY_GOAL,
  WEEKLY_GOAL_CHOICES,
  withCurrent,
} from './productivityModel';
import { useGoalEditor } from './useGoalEditor';

/** Any Monday: weekday names of ISO day n come from this date + (n - 1) days, so they follow the app language. */
const SOME_MONDAY = '2026-11-02';
const ISO_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;
/** Server rule (DaysOff): at most 6 days off, otherwise no day would count for the streak. */
const MAX_DAYS_OFF = 6;

/** Settings → Productivity (M10, design M10-3): Karma, goals, days off, Vacation mode, goal celebrations. */
export function ProductivitySettingsScreen() {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const { data } = useSettings();
  const save = useGoalEditor();

  const dailyGoal = data?.dailyGoal ?? DEFAULT_DAILY_GOAL;
  const weeklyGoal = data?.weeklyGoal ?? DEFAULT_WEEKLY_GOAL;
  const daysOff = data?.daysOff ?? [...DEFAULT_DAYS_OFF];
  const goalOptions = (choices: readonly number[], current: number) =>
    withCurrent(choices, current).map((goal) => ({ value: String(goal), label: t('productivity.goal.tasks', { n: goal }) }));

  function toggleDay(day: number) {
    const next = daysOff.includes(day) ? daysOff.filter((d) => d !== day) : [...daysOff, day].sort((a, b) => a - b);
    if (next.length > MAX_DAYS_OFF) return;
    save({ daysOff: next });
  }

  return (
    <SettingsPage testID="productivity-settings" title={t('productivity.settings.title')}>
      <SettingsSection testID="productivity-settings-karma">
        <SwitchRow
          testID="productivity-karma-switch"
          label={t('productivity.settings.karma')}
          hint={t('productivity.settings.karmaHint')}
          value={data?.karmaEnabled !== false}
          onChange={(value) => save({ karmaEnabled: value })}
        />
      </SettingsSection>
      <SettingsSection testID="productivity-settings-goals">
        <PickerRow
          testID="productivity-daily-goal"
          label={t('productivity.settings.dailyGoal')}
          valueLabel={t('productivity.goal.tasks', { n: dailyGoal })}
          options={goalOptions(DAILY_GOAL_CHOICES, dailyGoal)}
          selected={String(dailyGoal)}
          onSelect={(value) => save({ dailyGoal: Number(value) })}
        />
        <PickerRow
          testID="productivity-weekly-goal"
          label={t('productivity.settings.weeklyGoal')}
          valueLabel={t('productivity.goal.tasks', { n: weeklyGoal })}
          options={goalOptions(WEEKLY_GOAL_CHOICES, weeklyGoal)}
          selected={String(weeklyGoal)}
          onSelect={(value) => save({ weeklyGoal: Number(value) })}
        />
      </SettingsSection>
      <SettingsSection testID="productivity-settings-days-off" title={t('productivity.settings.daysOff')}>
        <Text style={styles.hint}>{t('productivity.settings.daysOffHint')}</Text>
        <View style={styles.chips}>
          {ISO_DAYS.map((day) => {
            const selected = daysOff.includes(day);
            return (
              <Chip
                key={day}
                large
                testID={`productivity-day-off-${day}`}
                label={weekdayName(addDays(SOME_MONDAY, day - 1))}
                selected={selected}
                disabled={!selected && daysOff.length >= MAX_DAYS_OFF}
                onPress={() => toggleDay(day)}
              />
            );
          })}
        </View>
      </SettingsSection>
      <SettingsSection testID="productivity-settings-vacation">
        <SwitchRow
          testID="productivity-vacation-switch"
          label={t('productivity.settings.vacation')}
          hint={t('productivity.settings.vacationHint')}
          value={data?.vacationMode === true}
          onChange={(value) => save({ vacationMode: value })}
        />
        <SwitchRow
          testID="productivity-celebrations-switch"
          label={t('productivity.settings.celebrations')}
          value={data?.goalCelebrations !== false}
          onChange={(value) => save({ goalCelebrations: value })}
        />
      </SettingsSection>
    </SettingsPage>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    hint: { ...type.meta, color: palette.mute, marginBottom: 8 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  });
}
