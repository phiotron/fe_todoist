import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../components/AppButton';
import { BottomSheet } from '../../components/BottomSheet';
import { Chip } from '../../components/Chip';
import { ErrorText } from '../../components/ErrorText';
import { ListRow } from '../../components/ListRow';
import { Toggle } from '../../components/Toggle';
import { RELATIVE_REMINDER_MINUTES, type ReminderDraft, type TimeFormat } from '../../lib/reminders';
import { useIsOnline } from '../../lib/useIsOnline';
import { size, type, useTheme } from '../../theme';
import type { Palette } from '../../theme/palette';
import { pickAbsoluteReminder } from './pickAbsoluteReminder';
import { offsetLabel } from './reminderLabel';

export interface ReminderListItem {
  id: string;
  label: string;
}

export interface ReminderEditorModalProps {
  visible: boolean;
  onClose: () => void;
  items: readonly ReminderListItem[];
  onAdd: (draft: ReminderDraft) => void;
  onRemove: (id: string) => void;
  /** RELATIVE needs a due time (spec 5.8). */
  hasTime: boolean;
  timeZone: string;
  timeFormat: TimeFormat;
  /** Completed task / archived project or section: list only. */
  readOnly?: boolean;
  busy?: boolean;
  /** Error of the last add / remove, already a sentence. */
  error?: string;
  /** Adding / removing is a server write (task detail); Quick Add drafts are not. */
  requiresOnline?: boolean;
  now?: () => number;
  /** M12: saved places for "when arriving / leaving"; the section is hidden when omitted. */
  places?: readonly { id: string; name: string }[];
}

/**
 * Reminders of one task (task detail) or of a task being created (Quick Add): list, remove, add (spec 9.2, 12.8).
 * Bottom sheet of the approved design (design-mobile: .sheet, .lrow, .chip).
 */
export function ReminderEditorModal({
  visible,
  onClose,
  items,
  onAdd,
  onRemove,
  hasTime,
  timeZone,
  timeFormat,
  readOnly = false,
  busy = false,
  error,
  requiresOnline = false,
  now = Date.now,
  places,
}: ReminderEditorModalProps) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const online = useIsOnline();
  const [pickError, setPickError] = useState<string | undefined>();
  // M12: the next time reminder added is an urgent one (a full-screen alarm on the chosen device).
  const [urgent, setUrgent] = useState(false);
  const locked = busy || (requiresOnline && !online);

  const addAbsolute = async () => {
    setPickError(undefined);
    const result = await pickAbsoluteReminder({ timeZone, is24Hour: timeFormat === 'H24', now });
    if (result.kind === 'picked') onAdd(urgent ? { type: 'ABSOLUTE', at: result.at, urgent: true } : { type: 'ABSOLUTE', at: result.at });
    else if (result.kind === 'past') setPickError(t('reminders.editor.pastTime'));
  };

  const addRelative = (minuteOffset: number) => {
    setPickError(undefined);
    onAdd(urgent ? { type: 'RELATIVE', minuteOffset, urgent: true } : { type: 'RELATIVE', minuteOffset });
  };

  const addLocation = (place: { id: string; name: string }, trigger: 'ON_ENTER' | 'ON_LEAVE') => {
    setPickError(undefined);
    onAdd({ type: 'LOCATION', locationId: place.id, trigger, locationName: place.name });
  };

  return (
    // scroll={false}: the content below scrolls itself; BottomSheet's own ScrollView would nest a second one.
    <BottomSheet visible={visible} onClose={onClose} title={t('reminders.editor.title')} scroll={false} testID="reminder-editor">
      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        {items.length === 0 ? <Text style={styles.empty}>{t('reminders.editor.empty')}</Text> : null}
        {items.map((item) => (
          <ListRow
            key={item.id}
            icon="bell"
            title={item.label}
            right={
              readOnly ? undefined : (
                <Pressable
                  testID={`reminder-remove-${item.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={t('reminders.editor.remove', { label: item.label })}
                  accessibilityState={{ disabled: locked }}
                  disabled={locked}
                  onPress={() => onRemove(item.id)}
                  style={styles.remove}
                >
                  <Feather name="x" size={size.icon} color={palette.mute} />
                </Pressable>
              )
            }
          />
        ))}

        {readOnly ? null : (
          <View style={styles.add}>
            <ListRow
              title={t('reminders.editor.urgentToggle')}
              right={
                <Toggle
                  testID="reminder-urgent-switch"
                  label={t('reminders.editor.urgentToggle')}
                  value={urgent}
                  onChange={setUrgent}
                />
              }
            />
            <Text style={styles.hint}>{t('reminders.editor.urgentHint')}</Text>
            <AppButton
              testID="reminder-add-absolute"
              variant="outline"
              full
              label={t('reminders.editor.addAbsolute')}
              disabled={busy}
              requiresOnline={requiresOnline}
              onPress={() => void addAbsolute()}
            />
            <Text accessibilityRole="header" style={styles.heading}>
              {t('reminders.editor.relativeTitle')}
            </Text>
            {hasTime ? (
              <View style={styles.chips}>
                {RELATIVE_REMINDER_MINUTES.map((minutes) => (
                  <Chip
                    key={minutes}
                    large
                    testID={`reminder-add-relative-${minutes}`}
                    label={offsetLabel(minutes, t)}
                    disabled={locked}
                    onPress={() => addRelative(minutes)}
                  />
                ))}
              </View>
            ) : (
              <Text testID="reminder-relative-needs-time" style={styles.hint}>
                {t('reminders.editor.relativeNeedsTime')}
              </Text>
            )}
            {places ? (
              <>
                <Text accessibilityRole="header" style={styles.heading}>
                  {t('reminders.editor.locationTitle')}
                </Text>
                {places.length === 0 ? (
                  <Text testID="reminder-location-none" style={styles.hint}>
                    {t('reminders.editor.locationNone')}
                  </Text>
                ) : (
                  <View style={styles.chips}>
                    {places.flatMap((place) => [
                      <Chip
                        key={`${place.id}-enter`}
                        large
                        testID={`reminder-add-location-${place.id}-ON_ENTER`}
                        label={t('reminders.editor.locationEnter', { place: place.name })}
                        disabled={locked}
                        onPress={() => addLocation(place, 'ON_ENTER')}
                      />,
                      <Chip
                        key={`${place.id}-leave`}
                        large
                        testID={`reminder-add-location-${place.id}-ON_LEAVE`}
                        label={t('reminders.editor.locationLeave', { place: place.name })}
                        disabled={locked}
                        onPress={() => addLocation(place, 'ON_LEAVE')}
                      />,
                    ])}
                  </View>
                )}
              </>
            ) : null}
          </View>
        )}

        <ErrorText testID="reminder-editor-error" message={pickError ?? error} />
      </ScrollView>
      <AppButton testID="reminder-editor-close" variant="ghost" label={t('reminders.editor.close')} onPress={onClose} />
    </BottomSheet>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    scroll: { flexGrow: 0 },
    empty: { ...type.body, color: palette.mute, paddingVertical: 12 },
    remove: { width: size.touch, height: size.touch, alignItems: 'center', justifyContent: 'center' },
    add: { gap: 12, marginTop: 12 },
    heading: { ...type.label, color: palette.ink2 },
    hint: { ...type.meta, color: palette.mute },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  });
}
