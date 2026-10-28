import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppButton } from '../../components/AppButton';
import { BottomSheet } from '../../components/BottomSheet';
import { Chip } from '../../components/Chip';
import { IconButton, type IconName } from '../../components/IconButton';
import { Segmented } from '../../components/Segmented';
import { addDays, combineDue, dateKeyInZone, dueTime, quickDates, taskDateKey } from '../../lib/dates';
import { formatTime, getDisplayPrefs, useDisplayPrefs } from '../../lib/dates/displayFormat';
import { formatDateKey, formatDuration, weekdayShort } from '../../lib/dates/format';
import { parseQuickAdd } from '../../lib/quickadd';
import { useNow } from '../../lib/useNow';
import { size, type, useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { useUserTimeZone } from '../auth/useUserTimeZone';
import { describeRecurrence } from '../../lib/recurrence/describe';
import { reanchor } from '../../lib/recurrence/presets';
import type { RecurrenceSpec } from '../../lib/recurrence/types';
import { RepeatSheet } from '../recurrence/RepeatSheet';
import { MonthCalendar } from '../schedule/MonthCalendar';
import {
  DURATION_OPTIONS,
  NO_DUE,
  localTime,
  withDate,
  withDuration,
  withTime,
  withoutTime,
  type DueValue,
} from '../schedule/dueValue';
import { useDateSettings } from '../settings/useDateSettings';
import { useDayCounts } from './useDayCounts';
import { openDateTimePicker } from '../../lib/dateTimePicker';

export interface DateSheetProps {
  visible: boolean;
  value: DueValue;
  /** M6c: `repeat` (2nd argument) is the rule to keep with the due: null = does not repeat; given only when the `repeat` prop is. */
  onSelect: (value: DueValue, repeat?: RecurrenceSpec | null) => void;
  /** M6c: the current rule (null = none). undefined = no Repeat row. */
  repeat?: RecurrenceSpec | null;
  onClose: () => void;
  testID?: string;
}

type PresetKey = 'today' | 'tomorrow' | 'laterThisWeek' | 'thisWeekend' | 'nextWeek';

interface Preset {
  key: PresetKey;
  icon: IconName;
  color: string;
  day: string;
}

/**
 * M6b Date sheet of Quick Add (Todoist): type a date, presets (Today / Tomorrow / Later this week / This weekend /
 * Next week / No date), a month calendar with the number of open tasks per day, Time and Duration tabs, Save.
 * Repeat arrives with M6c. Presets apply at once (keeping time and duration); the rest waits for Save.
 */
export function DateSheet({ visible, value, onSelect, repeat, onClose, testID = 'date-sheet' }: DateSheetProps) {
  const styles = useThemedStyles(createDateSheetStyles);
  const prefs = useDisplayPrefs();
  const { palette } = useTheme();
  const { t } = useTranslation();
  const now = useNow();
  const timeZone = useUserTimeZone();
  const settings = useDateSettings();
  const today = dateKeyInZone(now, timeZone);
  const [pending, setPending] = useState<DueValue>(value);
  const [month, setMonth] = useState(taskDateKey(value) ?? today);
  const [typed, setTyped] = useState('');
  const [tab, setTab] = useState<'time' | 'duration'>('time');
  const counts = useDayCounts(month, visible);
  const repeatEnabled = repeat !== undefined;
  const [pendingRepeat, setPendingRepeat] = useState<RecurrenceSpec | null>(repeat ?? null);
  // The day the rule was chosen for (it follows the day if that changes before Save); null = rule untouched.
  const [repeatBuiltFor, setRepeatBuiltFor] = useState<string | null>(null);
  const [repeatOpen, setRepeatOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setPending(value);
    setMonth(taskDateKey(value) ?? today);
    setTyped('');
    setTab('time');
    setPendingRepeat(repeat ?? null);
    setRepeatBuiltFor(null);
    setRepeatOpen(false);
    // Reset only when the sheet opens: the caller's object may change identity on every render.
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const typedDue = useMemo<DueValue | null>(() => {
    if (!typed.trim()) return null;
    const due = parseQuickAdd(typed, {
      today,
      dateSettings: settings,
      dateFormat: prefs.dateFormat,
      smartDate: true,
    }).due;
    return due ? { ...combineDue(due.date, due.time), durationMinutes: due.time ? due.durationMinutes : null } : null;
  }, [typed, today, settings, prefs.dateFormat]);

  const dates = quickDates(today, settings);
  const later = addDays(today, 2);
  const presets: Preset[] = [
    { key: 'today', icon: 'sun', color: palette.ok, day: dates.today },
    { key: 'tomorrow', icon: 'sunrise', color: palette.p2, day: dates.tomorrow },
    ...(later < dates.thisWeekend
      ? [{ key: 'laterThisWeek' as const, icon: 'arrow-right' as const, color: palette.vio, day: later }]
      : []),
    { key: 'thisWeekend', icon: 'coffee', color: palette.p3, day: dates.thisWeekend },
    { key: 'nextWeek', icon: 'calendar', color: palette.vio, day: dates.nextWeek },
  ];
  const day = taskDateKey(pending);
  const time = dueTime(pending);
  const dayCount = day ? (counts[day] ?? 0) : 0;

  function apply(next: DueValue) {
    if (repeatEnabled) {
      const nextDay = taskDateKey(next);
      let rule = nextDay === null ? null : pendingRepeat;
      if (rule && repeatBuiltFor && nextDay) rule = reanchor(rule, repeatBuiltFor, nextDay);
      onSelect(next, rule);
    } else {
      onSelect(next);
    }
    onClose();
  }

  function openRepeat() {
    // A rule needs a day: without one the sheet takes today.
    if (day === null) setPending((current) => withDate(current, today));
    setRepeatOpen(true);
  }

  function save() {
    if (typed.trim()) {
      if (typedDue) apply(typedDue);
      return;
    }
    apply(pending);
  }

  function pickTime() {
    const [hour, minute] = (time ?? '09:00').split(':').map(Number);
    const initial = new Date();
    initial.setHours(hour, minute, 0, 0);
    openDateTimePicker({
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
        {t('quickAdd.dateSheet.title')}
      </Text>
      <AppButton
        variant="ghost"
        color={palette.acc}
        label={t('quickAdd.dateSheet.save')}
        disabled={typed.trim().length > 0 && !typedDue}
        onPress={save}
        testID={`${testID}-save`}
      />
    </View>
  );

  return (
    <>
    <BottomSheet visible={visible} onClose={onClose} header={header} testID={`${testID}-sheet`}>
      <TextInput
        testID={`${testID}-input`}
        value={typed}
        onChangeText={setTyped}
        placeholder={t('quickAdd.dateSheet.inputPlaceholder')}
        placeholderTextColor={palette.mute}
        accessibilityLabel={t('quickAdd.dateSheet.inputLabel')}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={save}
        style={styles.input}
      />
      {typed.trim() ? (
        <Text testID={`${testID}-preview`} style={[styles.preview, !typedDue && styles.previewError]}>
          {typedDue ? describe(typedDue) : t('quickAdd.dateSheet.notRecognised')}
        </Text>
      ) : null}
      {presets.map((preset) => (
        <Pressable
          key={preset.key}
          testID={`${testID}-${preset.key}`}
          accessibilityRole="button"
          onPress={() => apply(withDate(pending, preset.day))}
          style={styles.row}
        >
          <Feather name={preset.icon} size={size.icon} color={preset.color} />
          <Text style={[type.bodyStrong, styles.rowLabel]}>{t(`quickAdd.dateSheet.${preset.key}`)}</Text>
          <Text style={styles.rowHint}>
            {time ? `${weekdayShort(preset.day)} ${formatTime(time)}` : weekdayShort(preset.day)}
          </Text>
        </Pressable>
      ))}
      <Pressable testID={`${testID}-noDate`} accessibilityRole="button" onPress={() => apply(NO_DUE)} style={styles.row}>
        <Feather name="slash" size={size.icon} color={palette.mute} />
        <Text style={[type.bodyStrong, styles.rowLabel]}>{t('quickAdd.dateSheet.noDate')}</Text>
      </Pressable>
      <MonthCalendar
        month={month}
        selected={day}
        today={today}
        startDay={settings.startDay}
        onSelectDay={(picked) => setPending((current) => withDate(current, picked))}
        onMonthChange={setMonth}
        dayCounts={counts}
        testID={testID}
      />
      {day ? (
        <Text testID={`${testID}-day-count`} style={styles.dayCount}>
          {t('quickAdd.dateSheet.tasksOnDay', { day: `${weekdayShort(day)} ${formatDateKey(day, false)}`, count: dayCount })}
        </Text>
      ) : null}
      <Segmented
        options={[
          { key: 'time', label: t('quickAdd.dateSheet.time') },
          { key: 'duration', label: t('quickAdd.dateSheet.duration') },
        ]}
        value={tab}
        onChange={setTab}
        testID={`${testID}-tabs`}
      />
      {tab === 'time' ? (
        <View style={styles.timeRow}>
          {time ? (
            <>
              <Chip large icon="clock" label={formatTime(time)} selected onPress={pickTime} testID={`${testID}-time`} />
              <IconButton
                icon="x"
                label={t('quickAdd.dateSheet.removeTime', { time: formatTime(time) })}
                onPress={() => setPending((current) => withoutTime(current))}
                testID={`${testID}-remove-time`}
              />
            </>
          ) : (
            <Chip large icon="clock" label={t('quickAdd.dateSheet.addTime')} onPress={pickTime} testID={`${testID}-time`} />
          )}
        </View>
      ) : time ? (
        <View style={styles.durations}>
          <Chip
            label={t('quickAdd.dateSheet.noDuration')}
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
      ) : (
        <Text style={styles.hint}>{t('quickAdd.dateSheet.needsTime')}</Text>
      )}
      {repeatEnabled ? (
        <Pressable testID={`${testID}-repeat`} accessibilityRole="button" onPress={openRepeat} style={styles.row}>
          <Feather name="repeat" size={size.icon} color={pendingRepeat ? palette.acc : palette.ink2} />
          <Text style={[type.bodyStrong, styles.rowLabel]}>{t('recurrence.row')}</Text>
          <Text style={styles.rowHint} numberOfLines={1} testID={`${testID}-repeat-value`}>
            {pendingRepeat ? describeRecurrence(pendingRepeat) : t('recurrence.none')}
          </Text>
        </Pressable>
      ) : null}
    </BottomSheet>
    {repeatEnabled ? (
      <RepeatSheet
        visible={visible && repeatOpen}
        dueDay={day ?? today}
        due={pending.dueDatetime ?? day ?? today}
        value={pendingRepeat}
        onSelect={(spec) => {
          setPendingRepeat(spec);
          setRepeatBuiltFor(spec ? (day ?? today) : null);
        }}
        onClose={() => setRepeatOpen(false)}
        testID={`${testID}-repeat-sheet`}
      />
    ) : null}
    </>
  );
}

/** "Fri 06/11 15:00 · 1h" — preview of the typed date. */
function describe(due: DueValue): string {
  const day = taskDateKey(due) ?? '';
  const time = dueTime(due);
  const parts = [`${weekdayShort(day)} ${formatDateKey(day, false)}`];
  if (time) parts.push(formatTime(time));
  if (due.durationMinutes) parts.push(`· ${formatDuration(due.durationMinutes)}`);
  return parts.join(' ');
}

function createDateSheetStyles(palette: Palette) {
  return StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    headerTitle: { flex: 1, textAlign: 'center', color: palette.ink },
    input: {
      ...type.body,
      color: palette.ink,
      borderWidth: 1,
      borderColor: palette.line2,
      borderRadius: 8,
      paddingHorizontal: 12,
      minHeight: size.input,
    },
    preview: { ...type.meta, color: palette.acc, marginTop: 4 },
    previewError: { color: palette.warn },
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
    dayCount: { ...type.meta, color: palette.ink2, marginVertical: 8 },
    timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
    durations: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    hint: { ...type.meta, color: palette.mute, marginTop: 10 },
  });
}
