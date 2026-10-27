import { Feather } from '@expo/vector-icons';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../components/AppButton';
import { BottomSheet } from '../../components/BottomSheet';
import { Chip } from '../../components/Chip';
import { IconButton, type IconName } from '../../components/IconButton';
import { dateKeyInZone, dueTime, quickDates, taskDateKey } from '../../lib/dates';
import { getDisplayPrefs, useDisplayPrefs } from '../../lib/dates/displayFormat';
import { formatDateKey, formatDuration, weekdayShort } from '../../lib/dates/format';
import { useNow } from '../../lib/useNow';
import { size, type, useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { useUserTimeZone } from '../auth/useUserTimeZone';
import { useDateSettings } from '../settings/useDateSettings';
import {
  DURATION_OPTIONS,
  NO_DUE,
  localTime,
  withDate,
  withDuration,
  withTime,
  withoutTime,
  type DueValue,
} from './dueValue';
import { MonthCalendar } from './MonthCalendar';

export interface ScheduleSheetProps {
  visible: boolean;
  value: DueValue;
  onSelect: (value: DueValue) => void;
  onClose: () => void;
  /** due = date + time + duration (task due); date = day only (reschedule, deadline, multi-select). */
  mode?: 'due' | 'date';
  title?: string;
  allowNoDate?: boolean;
  noDateLabel?: string;
  /**
   * yyyy-MM-dd: earlier days are shown muted and disabled and "Xong" will not apply them. Reschedule passes today
   * (the server answers 400 for an earlier date, spec 12.5). Undefined = any day (due date, deadline, multi-select).
   */
  minDate?: string;
  testID?: string;
}

interface Shortcut {
  key: 'today' | 'tomorrow' | 'thisWeekend' | 'nextWeek';
  icon: IconName;
  color: string;
  label: string;
  day: string;
}

/**
 * M-Schedule: ✕ · title · Xong; shortcuts apply at once (keeping time and duration); calendar day, time and duration
 * are confirmed with "Xong". Repeat is M6. Shared by the date chip, swipe "Schedule", multi-select and Reschedule.
 */
export function ScheduleSheet({
  visible,
  value,
  onSelect,
  onClose,
  mode = 'due',
  title,
  allowNoDate = true,
  noDateLabel,
  minDate,
  testID = 'schedule',
}: ScheduleSheetProps) {
  const styles = useThemedStyles(createScheduleSheetStyles);
  // Redraw when the user changes the date / time format (the formatting functions read the same store).
  useDisplayPrefs();
  const { palette } = useTheme();
  const { t } = useTranslation();
  const now = useNow();
  const timeZone = useUserTimeZone();
  const settings = useDateSettings();
  const today = dateKeyInZone(now, timeZone);
  const [pending, setPending] = useState<DueValue>(value);
  const [month, setMonth] = useState(taskDateKey(value) ?? today);

  useEffect(() => {
    if (!visible) return;
    setPending(value);
    setMonth(taskDateKey(value) ?? today);
    // Reset only when the sheet opens: the caller's object may change identity on every render.
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const dates = quickDates(today, settings);
  const shortcuts: Shortcut[] = [
    { key: 'today', icon: 'sun', color: palette.ok, label: t('schedule.today'), day: dates.today },
    { key: 'tomorrow', icon: 'sunrise', color: palette.p2, label: t('schedule.tomorrow'), day: dates.tomorrow },
    { key: 'thisWeekend', icon: 'coffee', color: palette.vio, label: t('schedule.thisWeekend'), day: dates.thisWeekend },
    { key: 'nextWeek', icon: 'calendar', color: palette.vio, label: t('schedule.nextWeek'), day: dates.nextWeek },
  ];
  const day = taskDateKey(pending);
  const time = dueTime(pending);
  // "Xong" is blocked while the chosen day is earlier than minDate, or while no day is chosen and "no date" is not allowed.
  const doneBlocked = (day === null && !allowNoDate) || (day !== null && minDate !== undefined && day < minDate);

  function apply(next: DueValue) {
    const nextDay = taskDateKey(next);
    if (nextDay !== null && minDate !== undefined && nextDay < minDate) return;
    if (nextDay === null && !allowNoDate) return;
    onSelect(mode === 'date' ? { ...next, dueDatetime: null, durationMinutes: null, dueDate: nextDay } : next);
    onClose();
  }

  function pickTime() {
    const [hour, minute] = (time ?? '09:00').split(':').map(Number);
    const initial = new Date();
    initial.setHours(hour, minute, 0, 0);
    DateTimePickerAndroid.open({
      value: initial,
      mode: 'time',
      is24Hour: getDisplayPrefs().timeFormat === 'H24',
      onChange: (event, picked) => {
        if (event.type === 'set' && picked) setPending((current) => withTime(current, localTime(picked), today));
      },
    });
  }

  const header = (
    <View style={styles.header}>
      <IconButton icon="x" label={t('common.close')} onPress={onClose} testID={`${testID}-close`} />
      <Text style={[type.sheetTitle, styles.headerTitle]} accessibilityRole="header">
        {title ?? t('schedule.title')}
      </Text>
      <AppButton
        variant="ghost"
        color={palette.acc}
        label={t('common.done')}
        disabled={doneBlocked}
        onPress={() => apply(pending)}
        testID={`${testID}-done`}
      />
    </View>
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} header={header} testID={`${testID}-sheet`}>
      {shortcuts.map((shortcut) => (
        <Pressable
          key={shortcut.key}
          testID={`${testID}-${shortcut.key}`}
          accessibilityRole="button"
          onPress={() => apply(withDate(pending, shortcut.day))}
          style={styles.row}
        >
          <Feather name={shortcut.icon} size={size.icon} color={shortcut.color} />
          <Text style={[type.bodyStrong, styles.rowLabel]}>{shortcut.label}</Text>
          <Text style={styles.rowHint}>
            {shortcut.key === 'nextWeek'
              ? `${weekdayShort(shortcut.day)} ${formatDateKey(shortcut.day, false)}`
              : weekdayShort(shortcut.day)}
          </Text>
        </Pressable>
      ))}
      {allowNoDate ? (
        <Pressable testID={`${testID}-noDate`} accessibilityRole="button" onPress={() => apply(NO_DUE)} style={styles.row}>
          <Feather name="slash" size={size.icon} color={palette.mute} />
          <Text style={[type.bodyStrong, styles.rowLabel]}>{noDateLabel ?? t('schedule.noDate')}</Text>
        </Pressable>
      ) : null}
      <MonthCalendar
        month={month}
        selected={day}
        today={today}
        minDate={minDate}
        startDay={settings.startDay}
        onSelectDay={(picked) => setPending((current) => withDate(current, picked))}
        onMonthChange={setMonth}
        testID={testID}
      />
      {mode === 'due' ? (
        <>
          <Pressable testID={`${testID}-time`} accessibilityRole="button" onPress={pickTime} style={styles.row}>
            <Feather name="clock" size={size.icon} color={palette.ink2} />
            <Text style={[type.body, styles.rowLabel]}>{t('schedule.time')}</Text>
            <Text style={styles.rowHint}>{time ?? t('schedule.none')}</Text>
          </Pressable>
          {time ? (
            <>
              <AppButton
                variant="ghost"
                size="sm"
                label={t('schedule.removeTime')}
                onPress={() => setPending((current) => withoutTime(current))}
                testID={`${testID}-remove-time`}
              />
              <Text style={styles.durationLabel}>{t('schedule.duration')}</Text>
              <View style={styles.durations}>
                <Chip
                  label={t('schedule.none')}
                  selected={pending.durationMinutes === null}
                  onPress={() => setPending((current) => withDuration(current, null))}
                  testID={`${testID}-duration-none`}
                />
                {DURATION_OPTIONS.map((minutes) => (
                  <Chip
                    key={minutes}
                    label={formatDuration(minutes)}
                    selected={pending.durationMinutes === minutes}
                    onPress={() => setPending((current) => withDuration(current, minutes))}
                    testID={`${testID}-duration-${minutes}`}
                  />
                ))}
              </View>
            </>
          ) : null}
        </>
      ) : null}
    </BottomSheet>
  );
}

function createScheduleSheetStyles(palette: Palette) {
  return StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    headerTitle: { flex: 1, textAlign: 'center', color: palette.ink },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      minHeight: size.shortcutRow,
      borderBottomWidth: 1,
      borderBottomColor: palette.line,
    },
    rowLabel: { flex: 1, color: palette.ink },
    rowHint: { ...type.meta, color: palette.mute },
    durationLabel: { ...type.label, color: palette.ink2, marginTop: 8, marginBottom: 6 },
    durations: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  });
}
