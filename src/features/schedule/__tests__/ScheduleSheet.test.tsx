import '../../../i18n';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { fireEvent, render, screen } from '@testing-library/react-native';
import viSchedule from '../../../i18n/locales/vi/schedule.json';
import { NO_DUE, type DueValue } from '../dueValue';
import { ScheduleSheet } from '../ScheduleSheet';

jest.mock('../../../lib/useNow', () => ({ useNow: () => new Date('2026-10-23T03:00:00Z') }));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

/** The next DateTimePickerAndroid.open() answers "set" with `value` (null = dismissed). */
function pickerAnswers(value: Date | null) {
  jest.mocked(DateTimePickerAndroid.open).mockImplementationOnce((params) => {
    params.onChange?.(
      { type: value ? 'set' : 'dismissed', nativeEvent: { timestamp: value?.getTime() ?? 0 } } as never,
      value ?? undefined,
    );
  });
}

async function open(value: DueValue = NO_DUE, extra: Partial<Parameters<typeof ScheduleSheet>[0]> = {}) {
  const onSelect = jest.fn();
  const onClose = jest.fn();
  await render(<ScheduleSheet visible value={value} onSelect={onSelect} onClose={onClose} {...extra} />);
  return { onSelect, onClose };
}

describe('ScheduleSheet', () => {
  it('a shortcut applies at once: Tomorrow → all-day due on 24/10', async () => {
    const { onSelect, onClose } = await open();
    expect(screen.getByText(viSchedule.schedule.title)).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('schedule-tomorrow'));

    expect(onSelect).toHaveBeenCalledWith({ dueDate: '2026-10-24', dueDatetime: null, durationMinutes: null });
    expect(onClose).toHaveBeenCalled();
  });

  it('shortcuts keep the time and the duration of a timed due (Next week = Monday 26/10)', async () => {
    const { onSelect } = await open({ dueDate: null, dueDatetime: '2026-10-23T09:30:00', durationMinutes: 30 });
    expect(screen.getByTestId('schedule-nextWeek')).toHaveTextContent(/26\/10/);

    await fireEvent.press(screen.getByTestId('schedule-nextWeek'));

    expect(onSelect).toHaveBeenCalledWith({ dueDate: null, dueDatetime: '2026-10-26T09:30:00', durationMinutes: 30 });
  });

  it('calendar day + time + duration are confirmed with "Xong"', async () => {
    const { onSelect } = await open();
    await fireEvent.press(screen.getByTestId('schedule-day-2026-10-25'));
    pickerAnswers(new Date(2026, 9, 25, 14, 0));
    await fireEvent.press(screen.getByTestId('schedule-time'));
    expect(screen.getByTestId('schedule-time')).toHaveTextContent(/14:00/);
    await fireEvent.press(screen.getByTestId('schedule-duration-30'));

    await fireEvent.press(screen.getByTestId('schedule-done'));

    expect(onSelect).toHaveBeenCalledWith({ dueDate: null, dueDatetime: '2026-10-25T14:00:00', durationMinutes: 30 });
  });

  it('a dismissed time picker changes nothing; "remove time" drops time and duration', async () => {
    const { onSelect } = await open({ dueDate: null, dueDatetime: '2026-10-24T09:30:00', durationMinutes: 60 });
    pickerAnswers(null);
    await fireEvent.press(screen.getByTestId('schedule-time'));
    expect(screen.getByTestId('schedule-time')).toHaveTextContent(/09:30/);

    await fireEvent.press(screen.getByTestId('schedule-remove-time'));
    expect(screen.queryByTestId('schedule-duration-30')).toBeNull();
    await fireEvent.press(screen.getByTestId('schedule-done'));

    expect(onSelect).toHaveBeenCalledWith({ dueDate: '2026-10-24', dueDatetime: null, durationMinutes: null });
  });

  it('"No date" clears the due; the month can be changed', async () => {
    const { onSelect } = await open({ dueDate: '2026-10-30', dueDatetime: null, durationMinutes: null });
    await fireEvent.press(screen.getByTestId('schedule-next-month'));
    expect(screen.getByText('Tháng 11, 2026')).toBeOnTheScreen();
    expect(screen.getByTestId('schedule-day-2026-11-05')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('schedule-noDate'));

    expect(onSelect).toHaveBeenCalledWith(NO_DUE);
  });

  it('date mode (reschedule / deadline / batch): no time rows; "no date" can be hidden', async () => {
    await open(NO_DUE, { mode: 'date', allowNoDate: false, title: 'Deadline' });
    expect(screen.getByText('Deadline')).toBeOnTheScreen();
    expect(screen.queryByTestId('schedule-time')).toBeNull();
    expect(screen.queryByTestId('schedule-noDate')).toBeNull();
  });

  it('"This weekend" is the next Saturday after today (Friday 23/10 → 24/10)', async () => {
    const { onSelect } = await open();
    await fireEvent.press(screen.getByTestId('schedule-thisWeekend'));
    expect(onSelect).toHaveBeenCalledWith({ dueDate: '2026-10-24', dueDatetime: null, durationMinutes: null });
  });

  it('minDate (Reschedule: today): earlier days are disabled and cannot be applied; later days can', async () => {
    const { onSelect } = await open(NO_DUE, { mode: 'date', allowNoDate: false, minDate: '2026-10-23' });
    expect(screen.getByTestId('schedule-day-2026-10-22')).toBeDisabled();
    expect(screen.getByTestId('schedule-day-2026-10-23')).not.toBeDisabled();

    // Nothing chosen yet and "no date" is not allowed: "Xong" does nothing.
    await fireEvent.press(screen.getByTestId('schedule-done'));
    expect(onSelect).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('schedule-day-2026-10-22')); // disabled: ignored
    await fireEvent.press(screen.getByTestId('schedule-done'));
    expect(onSelect).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('schedule-day-2026-10-24'));
    await fireEvent.press(screen.getByTestId('schedule-done'));
    expect(onSelect).toHaveBeenCalledWith({ dueDate: '2026-10-24', dueDatetime: null, durationMinutes: null });
  });

  it('without minDate past days stay selectable (a due date or a deadline may be in the past)', async () => {
    await open();
    expect(screen.getByTestId('schedule-day-2026-10-22')).not.toBeDisabled();
  });
});
