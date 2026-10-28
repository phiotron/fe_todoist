import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../components/AppButton';
import { ErrorText } from '../../components/ErrorText';
import { getTasklyAndroid } from '../../lib/native/tasklyAndroid';
import { type, useTheme } from '../../theme';
import type { Palette } from '../../theme/palette';
import { useTask } from '../tasks/detail/useTask';
import { useCloseTask } from '../tasks/useTaskActions';
import { getReminderPlatform } from './platform';
import { SNOOZE_MINUTES, scheduleSnooze } from './snooze';
import { describeError } from '../../api/describeError';

export interface AlarmScreenProps {
  taskId: string;
  /** me/settings.snoozeMinutes (default 15). */
  snoozeMinutes?: number;
  pinReminders?: boolean;
  onDone: () => void;
  now?: () => number;
}

/**
 * Screen of an urgent reminder (M12): the native full-screen notification opens `taskly://alarm/<taskId>` over the lock
 * screen while the alarm rings. Stop silences it, Snooze rings again later (this device only), Complete closes the task.
 * Every button also stops the ringing.
 */
export function AlarmScreen({ taskId, snoozeMinutes = SNOOZE_MINUTES, pinReminders = false, onDone, now = Date.now }: AlarmScreenProps) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const task = useTask(taskId);
  const close = useCloseTask();

  const stopRinging = () => getTasklyAndroid()?.stopUrgentAlarm(taskId);

  const stop = () => {
    stopRinging();
    onDone();
  };

  const snooze = async () => {
    stopRinging();
    await scheduleSnooze(
      getReminderPlatform().scheduler,
      {
        taskId,
        title: task.data?.content ?? '',
        body: t('reminders.notification.snoozedBody', { count: snoozeMinutes }),
      },
      now(),
      snoozeMinutes,
      pinReminders,
    ).catch(() => undefined);
    onDone();
  };

  const complete = async () => {
    try {
      await close.mutateAsync(taskId);
    } catch {
      return; // shown below; the alarm keeps ringing so the user does not miss the task
    }
    stopRinging();
    onDone();
  };

  return (
    <View testID="alarm-screen" style={styles.root}>
      <Text style={styles.kicker}>{t('reminders.alarm.title')}</Text>
      <Text testID="alarm-title" style={styles.title}>
        {task.data ? task.data.content : task.isError ? t('reminders.alarm.missing') : ''}
      </Text>
      <View style={styles.actions}>
        <AppButton testID="alarm-stop" full label={t('reminders.alarm.stop')} onPress={stop} />
        <AppButton
          testID="alarm-snooze"
          full
          variant="outline"
          label={t('reminders.alarm.snooze', { count: snoozeMinutes })}
          onPress={() => void snooze()}
        />
        <AppButton
          testID="alarm-complete"
          full
          variant="outline"
          label={t('reminders.alarm.complete')}
          busy={close.isPending}
          disabled={!task.data}
          onPress={() => void complete()}
        />
        <ErrorText testID="alarm-error" message={close.error ? describeError(close.error).message : undefined} />
      </View>
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: palette.bg, padding: 24, justifyContent: 'center', gap: 16 },
    kicker: { ...type.label, color: palette.acc, textAlign: 'center' },
    title: { ...type.dialogTitle, color: palette.ink, textAlign: 'center', marginBottom: 24 },
    actions: { gap: 12 },
  });
}
