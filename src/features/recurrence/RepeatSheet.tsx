import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../components/AppButton';
import { BottomSheet } from '../../components/BottomSheet';
import { Chip } from '../../components/Chip';
import { ErrorText } from '../../components/ErrorText';
import { IconButton } from '../../components/IconButton';
import { RadioRow } from '../../components/RadioRow';
import { Segmented } from '../../components/Segmented';
import { TextField } from '../../components/TextField';
import { dateKeyInZone, isoWeekday } from '../../lib/dates';
import { useDisplayPrefs } from '../../lib/dates/displayFormat';
import { formatDateKey } from '../../lib/dates/format';
import { describeRecurrence, weekdayName } from '../../lib/recurrence/describe';
import { nextDue } from '../../lib/recurrence/next';
import {
  PRESET_KEYS,
  REPEAT_UNITS,
  customToSpec,
  defaultCustom,
  isValidEvery,
  matchPreset,
  presetSpec,
  specToCustom,
  type CustomRepeat,
  type PresetKey,
  type RepeatUnit,
} from '../../lib/recurrence/presets';
import { WEEKDAY_CODES } from '../../lib/recurrence/rrule';
import type { RecurrenceSpec } from '../../lib/recurrence/types';
import { useNow } from '../../lib/useNow';
import { type, useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { useUserTimeZone } from '../auth/useUserTimeZone';
import { MonthCalendar } from '../schedule/MonthCalendar';
import { useDateSettings } from '../settings/useDateSettings';

export interface RepeatSheetProps {
  visible: boolean;
  /** The due day (yyyy-MM-dd) the rule is anchored on: "every week on <its weekday>", "every month on <its day>". */
  dueDay: string;
  /** The whole due ("yyyy-MM-dd" or floating "…THH:mm:ss") for the "next occurrence" preview; defaults to `dueDay`. */
  due?: string;
  /** Current rule (null = does not repeat). */
  value: RecurrenceSpec | null;
  /** The chosen rule, or null for "Clear repeat". The sheet closes itself afterwards. */
  onSelect: (spec: RecurrenceSpec | null) => void;
  onClose: () => void;
  testID?: string;
}

type View_ = 'list' | 'custom';

/**
 * Repeat sheet (M6c, spec 3.2): presets (every day / week on … / weekday / month on … / year on …), "Custom…" and "Clear".
 * Custom: Based on Scheduled | Completed date, Every N Days | Weeks | Weekdays | Months | Years, Ends Never | On date
 * (no "after N times" — Todoist has none, ADR 0006).
 */
export function RepeatSheet({ visible, dueDay, due, value, onSelect, onClose, testID = 'repeat' }: RepeatSheetProps) {
  const styles = useThemedStyles(createRepeatSheetStyles);
  useDisplayPrefs();
  const { palette } = useTheme();
  const { t } = useTranslation();
  const now = useNow();
  const timeZone = useUserTimeZone();
  const settings = useDateSettings();
  const [view, setView] = useState<View_>('list');
  const [custom, setCustom] = useState<CustomRepeat>(defaultCustom());
  const [everyText, setEveryText] = useState('1');
  const [month, setMonth] = useState(dueDay);

  useEffect(() => {
    if (!visible) return;
    const initial = (value ? specToCustom(value) : null) ?? defaultCustom();
    setView('list');
    setCustom(initial);
    setEveryText(String(initial.every));
    setMonth(initial.endsOn ?? dueDay);
    // Reset only when the sheet opens: the caller's `value` may change identity on every render.
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const dueWeekday = WEEKDAY_CODES[isoWeekday(dueDay) - 1];
  const dueMonthDay = Number(dueDay.slice(8, 10));
  const presetTitle = (key: PresetKey): string => {
    switch (key) {
      case 'daily':
        return t('recurrence.preset.daily');
      case 'weekly':
        return t('recurrence.preset.weekly', { day: weekdayName(dueWeekday) });
      case 'weekdays':
        return t('recurrence.preset.weekdays');
      case 'monthly':
        return t('recurrence.preset.monthly', { day: dueMonthDay });
      default:
        return t('recurrence.preset.yearly', { date: formatDateKey(dueDay, false) });
    }
  };
  const selectedPreset = value ? matchPreset(value, dueDay) : null;

  function choose(spec: RecurrenceSpec | null) {
    onSelect(spec);
    onClose();
  }

  if (view === 'custom') {
    const every = Number(everyText);
    const everyValid = /^[0-9]{1,3}$/.test(everyText) && isValidEvery(every);
    const endBeforeDue = custom.endsOn !== null && custom.endsOn < dueDay;
    const valid = everyValid && !endBeforeDue;
    const spec = valid ? customToSpec({ ...custom, every }, dueDay) : null;
    const next = spec ? nextDue(spec, due ?? dueDay, now, timeZone) : null;
    const nextDay = next ? next.slice(0, 10) : null;
    const today = dateKeyInZone(now, timeZone);

    const header = (
      <View style={styles.header}>
        <IconButton icon="chevron-left" label={t('recurrence.custom.back')} onPress={() => setView('list')} testID={`${testID}-custom-back`} />
        <Text style={[type.sheetTitle, styles.headerTitle]} accessibilityRole="header">
          {t('recurrence.custom.title')}
        </Text>
        <AppButton
          variant="ghost"
          color={palette.acc}
          label={t('recurrence.custom.done')}
          disabled={!valid}
          onPress={() => spec && choose(spec)}
          testID={`${testID}-custom-done`}
        />
      </View>
    );

    return (
      <BottomSheet visible={visible} onClose={onClose} header={header} testID={`${testID}-sheet`}>
        <Text style={styles.label}>{t('recurrence.custom.basedOn')}</Text>
        <Segmented
          testID={`${testID}-based-on`}
          value={custom.basedOn}
          onChange={(basedOn) => setCustom((current) => ({ ...current, basedOn }))}
          options={[
            { key: 'scheduled', label: t('recurrence.custom.scheduled') },
            { key: 'completed', label: t('recurrence.custom.completed') },
          ]}
        />
        <Text style={styles.label}>{t('recurrence.custom.every')}</Text>
        <TextField
          testID={`${testID}-every`}
          accessibilityLabel={t('recurrence.custom.everyInput')}
          value={everyText}
          onChangeText={(text) => {
            setEveryText(text.replace(/[^0-9]/g, '').slice(0, 3));
          }}
          keyboardType="number-pad"
          maxLength={3}
          error={everyValid ? undefined : t('recurrence.custom.invalidEvery')}
        />
        <View style={styles.units}>
          {REPEAT_UNITS.map((unit: RepeatUnit) => (
            <Chip
              key={unit}
              label={t(`recurrence.custom.unit.${unit}`)}
              selected={custom.unit === unit}
              onPress={() => setCustom((current) => ({ ...current, unit }))}
              testID={`${testID}-unit-${unit}`}
            />
          ))}
        </View>
        <Text style={styles.label}>{t('recurrence.custom.ends')}</Text>
        <Segmented
          testID={`${testID}-ends`}
          value={custom.endsOn === null ? 'never' : 'onDate'}
          onChange={(ends) => {
            setCustom((current) => ({ ...current, endsOn: ends === 'never' ? null : (current.endsOn ?? dueDay) }));
            if (ends === 'onDate') setMonth(custom.endsOn ?? dueDay);
          }}
          options={[
            { key: 'never', label: t('recurrence.custom.never') },
            { key: 'onDate', label: t('recurrence.custom.onDate') },
          ]}
        />
        {custom.endsOn !== null ? (
          <>
            <Text style={styles.hint} testID={`${testID}-end-date`}>
              {t('recurrence.custom.endDate', { date: formatDateKey(custom.endsOn, custom.endsOn.slice(0, 4) !== today.slice(0, 4)) })}
            </Text>
            <MonthCalendar
              month={month}
              selected={custom.endsOn}
              today={today}
              minDate={dueDay}
              startDay={settings.startDay}
              onSelectDay={(day) => setCustom((current) => ({ ...current, endsOn: day }))}
              onMonthChange={setMonth}
              testID={`${testID}-end-calendar`}
            />
            <ErrorText message={endBeforeDue ? t('recurrence.custom.endBeforeDue') : undefined} testID={`${testID}-end-error`} />
          </>
        ) : null}
        {spec ? (
          <Text style={styles.preview} testID={`${testID}-preview`}>
            {nextDay
              ? t('recurrence.custom.next', { date: formatDateKey(nextDay, nextDay.slice(0, 4) !== today.slice(0, 4)) })
              : t('recurrence.custom.noNext')}
          </Text>
        ) : null}
      </BottomSheet>
    );
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('recurrence.title')} testID={`${testID}-sheet`}>
      {PRESET_KEYS.map((key) => (
        <RadioRow
          key={key}
          testID={`${testID}-preset-${key}`}
          title={presetTitle(key)}
          selected={selectedPreset === key}
          onPress={() => choose(presetSpec(key, dueDay))}
        />
      ))}
      <RadioRow
        testID={`${testID}-custom`}
        title={t('recurrence.preset.custom')}
        subtitle={value && selectedPreset === null ? describeRecurrence(value) : undefined}
        selected={value !== null && selectedPreset === null}
        onPress={() => setView('custom')}
      />
      {value ? (
        <RadioRow testID={`${testID}-clear`} icon="x" title={t('recurrence.clear')} selected={false} onPress={() => choose(null)} />
      ) : null}
    </BottomSheet>
  );
}

function createRepeatSheetStyles(palette: Palette) {
  return StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    headerTitle: { flex: 1, textAlign: 'center', color: palette.ink },
    label: { ...type.label, color: palette.ink2, marginTop: 14, marginBottom: 6 },
    units: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    hint: { ...type.meta, color: palette.mute, marginTop: 8, marginBottom: 4 },
    preview: { ...type.meta, color: palette.mute, marginTop: 16, marginBottom: 8 },
  });
}
