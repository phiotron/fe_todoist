import { useMemo } from 'react';
import { useDeviceId } from '../../lib/device/deviceId';
import { LocationReminderRuntime } from '../locations/LocationReminderRuntime';
import { useSettings } from '../settings/useSettings';
import { ReminderRuntime } from './ReminderRuntime';
import { toReminderRuntimeSettings } from './reminderSettings';

/**
 * Feeds ReminderRuntime from me/settings; null (runtime idle) until the settings carry the reminder fields.
 * PERF3: until `settled` (the first screen is drawn) the first re-plan of the device reminders (a request plus a native
 * call per notification) and the geofence set-up wait; the notification-response listeners are live at once.
 * M12: `urgentHere` = this device is me/settings.urgentDeviceId; location reminders run beside the time ones.
 */
export function ReminderHost({ settled = true }: { settled?: boolean } = {}) {
  const { data } = useSettings();
  const deviceId = useDeviceId();
  const settings = useMemo(() => {
    const base = data ? toReminderRuntimeSettings(data) : null;
    if (!base) return null;
    return { ...base, urgentHere: deviceId !== null && base.urgentDeviceId === deviceId };
  }, [data, deviceId]);
  return (
    <>
      <ReminderRuntime settings={settings} syncReady={settled} />
      {settled ? <LocationReminderRuntime enabled={settings?.enabled ?? false} /> : null}
    </>
  );
}
