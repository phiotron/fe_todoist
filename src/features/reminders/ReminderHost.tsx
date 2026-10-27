import { useMemo } from 'react';
import { useSettings } from '../settings/useSettings';
import { ReminderRuntime } from './ReminderRuntime';
import { toReminderRuntimeSettings } from './reminderSettings';

/** Feeds ReminderRuntime from me/settings; null (runtime idle) until the settings carry the reminder fields. */
export function ReminderHost() {
  const { data } = useSettings();
  const settings = useMemo(() => (data ? toReminderRuntimeSettings(data) : null), [data]);
  return <ReminderRuntime settings={settings} />;
}
