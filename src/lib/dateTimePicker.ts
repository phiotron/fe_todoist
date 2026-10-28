import { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';

/**
 * X5 — one entry point for the system date / time picker. On Android it is the native dialog
 * (`DateTimePickerAndroid.open`). That API does not exist on iOS (it only logs a warning), so on iOS the app mounts
 * IosDateTimePickerHost (src/components) at the root, which registers itself here and shows the picker in a dialog.
 * Same callback shape as the Android one, so callers only look at `event.type === 'set'` and the picked date.
 */
export interface DateTimePickerRequest {
  value: Date;
  mode: 'date' | 'time';
  is24Hour?: boolean;
  onChange: (event: DateTimePickerEvent, date?: Date) => void;
}

export interface DateTimePickerHost {
  open(request: DateTimePickerRequest): void;
}

let host: DateTimePickerHost | null = null;

/** Called by the iOS host on mount (and with null on unmount). */
export function setDateTimePickerHost(next: DateTimePickerHost | null): void {
  host = next;
}

export function openDateTimePicker(request: DateTimePickerRequest): void {
  if (host) {
    host.open(request);
    return;
  }
  DateTimePickerAndroid.open(request);
}
