import { useMemo } from 'react';
import { useDeviceId } from '../../lib/device/deviceId';
import { LocationReminderRuntime } from '../locations/LocationReminderRuntime';
import { useSettings } from '../settings/useSettings';
import { ReminderRuntime } from './ReminderRuntime';
import { toReminderRuntimeSettings } from './reminderSettings';

/**
 * Feeds ReminderRuntime from me/settings; null (runtime idle) until the settings carry the reminder fields.
 * M12: `urgentHere` = this device is me/settings.urgentDeviceId; location reminders run beside the time ones.
 */
export function ReminderHost() {
  const { data } = useSettings();
  const deviceId = useDeviceId();
  const settings = useMemo(() => {
    const base = data ? toReminderRuntimeSettings(data) : null;
    if (!base) return null;
    return { ...base, urgentHere: deviceId !== null && base.urgentDeviceId === deviceId };
  }, [data, deviceId]);
  return (
    <>
      <ReminderRuntime settings={settings} />
      <LocationReminderRuntime enabled={settings?.enabled ?? false} />
    </>
  );
}
