import {
  formatFloating,
  isFloatingInFuture,
  nextWholeHour,
  pickerDateToWallClock,
  wallClockToPickerDate,
} from '../../lib/reminders';
import { openDateTimePicker } from '../../lib/dateTimePicker';

export type AbsolutePick = { kind: 'picked'; at: string } | { kind: 'past'; at: string } | { kind: 'cancelled' };

export interface AbsolutePickOptions {
  /** Account time zone: the picked wall clock means this zone (spec 5.2). */
  timeZone: string;
  is24Hour: boolean;
  now: () => number;
}

/**
 * Android date picker, then time picker, starting at the next whole hour. Resolves with a floating
 * "yyyy-MM-ddTHH:mm" for POST tasks/{id}/reminders; a past time is reported instead (the server would say 400).
 */
export function pickAbsoluteReminder(options: AbsolutePickOptions): Promise<AbsolutePick> {
  return new Promise((resolve) => {
    const initial = nextWholeHour(options.now(), options.timeZone);
    openDateTimePicker({
      value: wallClockToPickerDate(initial),
      mode: 'date',
      onChange: (dateEvent, pickedDate) => {
        if (dateEvent.type !== 'set' || !pickedDate) {
          resolve({ kind: 'cancelled' });
          return;
        }
        const day = pickerDateToWallClock(pickedDate);
        openDateTimePicker({
          value: wallClockToPickerDate({ ...day, hour: initial.hour, minute: initial.minute }),
          mode: 'time',
          is24Hour: options.is24Hour,
          onChange: (timeEvent, pickedTime) => {
            if (timeEvent.type !== 'set' || !pickedTime) {
              resolve({ kind: 'cancelled' });
              return;
            }
            const time = pickerDateToWallClock(pickedTime);
            const at = formatFloating({ ...day, hour: time.hour, minute: time.minute });
            resolve(isFloatingInFuture(at, options.timeZone, options.now()) ? { kind: 'picked', at } : { kind: 'past', at });
          },
        });
      },
    });
  });
}
