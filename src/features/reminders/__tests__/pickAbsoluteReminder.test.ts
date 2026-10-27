import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { pickAbsoluteReminder } from '../pickAbsoluteReminder';

/** 10:00 on 23 Oct 2026 in Asia/Ho_Chi_Minh. */
const NOW = Date.parse('2026-10-23T03:00:00Z');
const OPTIONS = { timeZone: 'Asia/Ho_Chi_Minh', is24Hour: true, now: () => NOW };

type PickerOptions = Parameters<typeof DateTimePickerAndroid.open>[0];
const openCalls = () => jest.mocked(DateTimePickerAndroid.open).mock.calls.map(([options]) => options as PickerOptions);
const set = (date: Date) => ({ type: 'set' as const, nativeEvent: { timestamp: date.getTime(), utcOffset: 0 } });
const dismissed = { type: 'dismissed' as const, nativeEvent: { timestamp: 0, utcOffset: 0 } };

describe('pickAbsoluteReminder', () => {
  beforeEach(() => {
    jest.mocked(DateTimePickerAndroid.open).mockClear();
  });

  it('opens the date picker on the next whole hour, then a 24 h time picker', async () => {
    const pending = pickAbsoluteReminder(OPTIONS);
    const [dateOptions] = openCalls();
    expect(dateOptions.mode).toBe('date');
    expect([dateOptions.value.getDate(), dateOptions.value.getHours(), dateOptions.value.getMinutes()]).toEqual([23, 11, 0]);

    dateOptions.onChange?.(set(new Date(2026, 9, 24)), new Date(2026, 9, 24));
    const timeOptions = openCalls()[1];
    expect(timeOptions).toMatchObject({ mode: 'time', is24Hour: true });
    expect([timeOptions.value.getDate(), timeOptions.value.getHours()]).toEqual([24, 11]);

    timeOptions.onChange?.(dismissed, undefined);
    await expect(pending).resolves.toEqual({ kind: 'cancelled' });
  });

  it('returns the picked account time as a floating value', async () => {
    const pending = pickAbsoluteReminder(OPTIONS);
    openCalls()[0].onChange?.(set(new Date(2026, 9, 24)), new Date(2026, 9, 24));
    openCalls()[1].onChange?.(set(new Date(2026, 9, 24, 9, 30)), new Date(2026, 9, 24, 9, 30));

    await expect(pending).resolves.toEqual({ kind: 'picked', at: '2026-10-24T09:30' });
  });

  it('reports a time that has already passed instead of sending it', async () => {
    const pending = pickAbsoluteReminder(OPTIONS);
    openCalls()[0].onChange?.(set(new Date(2026, 9, 23)), new Date(2026, 9, 23));
    openCalls()[1].onChange?.(set(new Date(2026, 9, 23, 9, 0)), new Date(2026, 9, 23, 9, 0));

    await expect(pending).resolves.toEqual({ kind: 'past', at: '2026-10-23T09:00' });
  });

  it('is cancelled when the date picker is dismissed', async () => {
    const pending = pickAbsoluteReminder(OPTIONS);
    openCalls()[0].onChange?.(dismissed, undefined);

    await expect(pending).resolves.toEqual({ kind: 'cancelled' });
    expect(DateTimePickerAndroid.open).toHaveBeenCalledTimes(1);
  });

  it('uses a 12 h time picker when the account says so', async () => {
    void pickAbsoluteReminder({ ...OPTIONS, is24Hour: false });
    openCalls()[0].onChange?.(set(new Date(2026, 9, 24)), new Date(2026, 9, 24));

    expect(openCalls()[1]).toMatchObject({ mode: 'time', is24Hour: false });
  });
});
