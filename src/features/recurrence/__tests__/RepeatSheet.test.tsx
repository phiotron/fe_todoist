import '../../../i18n';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { toRRule } from '../../../lib/recurrence/rrule';
import type { RecurrenceSpec } from '../../../lib/recurrence/types';
import { RepeatSheet, type RepeatSheetProps } from '../RepeatSheet';

// Fri 23/10/2026 10:00 in Vietnam; the task below is due on Wednesday 28/10/2026.
jest.mock('../../../lib/useNow', () => ({ useNow: () => new Date('2026-10-23T03:00:00Z') }));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

const DUE_DAY = '2026-10-28';

async function open(value: RecurrenceSpec | null = null, extra: Partial<RepeatSheetProps> = {}) {
  const onSelect = jest.fn();
  const onClose = jest.fn();
  await render(<RepeatSheet visible dueDay={DUE_DAY} value={value} onSelect={onSelect} onClose={onClose} {...extra} />);
  return { onSelect, onClose };
}

const chosen = (onSelect: jest.Mock): RecurrenceSpec | null => onSelect.mock.calls[0][0];

describe('RepeatSheet — presets', () => {
  it('lists every day / week on … / weekday / month on … / year on … for the due day, and Custom', async () => {
    await open();
    expect(screen.getByTestId('repeat-preset-daily')).toHaveTextContent('Mỗi ngày');
    expect(screen.getByTestId('repeat-preset-weekly')).toHaveTextContent('Mỗi tuần vào Thứ Tư');
    expect(screen.getByTestId('repeat-preset-weekdays')).toHaveTextContent('Mỗi ngày làm việc (T2–T6)');
    expect(screen.getByTestId('repeat-preset-monthly')).toHaveTextContent('Mỗi tháng vào ngày 28');
    expect(screen.getByTestId('repeat-preset-yearly')).toHaveTextContent('Mỗi năm vào 28/10');
    expect(screen.getByTestId('repeat-custom')).toHaveTextContent('Tùy chỉnh…');
    expect(screen.queryByTestId('repeat-clear')).toBeNull(); // nothing to clear
  });

  it('a preset applies at once and closes', async () => {
    const { onSelect, onClose } = await open();
    await fireEvent.press(screen.getByTestId('repeat-preset-weekly'));
    expect(toRRule(chosen(onSelect) as RecurrenceSpec)).toBe('FREQ=WEEKLY;BYDAY=WE');
    expect(chosen(onSelect)?.fromCompletion).toBe(false);
    expect(onClose).toHaveBeenCalled();
  });

  it('marks the current preset and offers "Clear repeat"', async () => {
    const { onSelect, onClose } = await open({ freq: 'DAILY', interval: 1, fromCompletion: false });
    expect(screen.getByTestId('repeat-preset-daily-check')).toBeOnTheScreen();
    expect(screen.queryByTestId('repeat-preset-weekly-check')).toBeNull();

    await fireEvent.press(screen.getByTestId('repeat-clear'));

    expect(onSelect).toHaveBeenCalledWith(null);
    expect(onClose).toHaveBeenCalled();
  });

  it('describes a rule that is no preset under "Custom…"', async () => {
    await open({ freq: 'WEEKLY', interval: 2, byDay: [{ weekday: 'MO' }], fromCompletion: false });
    expect(screen.getByTestId('repeat-custom-check')).toBeOnTheScreen();
    expect(screen.getByText('Mỗi 2 tuần vào Thứ Hai')).toBeOnTheScreen();
  });
});

describe('RepeatSheet — Custom', () => {
  async function openCustom(value: RecurrenceSpec | null = null) {
    const result = await open(value);
    await fireEvent.press(screen.getByTestId('repeat-custom'));
    return result;
  }

  it('has Based on, Every N + unit and Ends Never | On date — and no "after N times"', async () => {
    await openCustom();
    expect(screen.getByTestId('repeat-based-on-scheduled')).toBeOnTheScreen();
    expect(screen.getByTestId('repeat-based-on-completed')).toBeOnTheScreen();
    expect(screen.getByTestId('repeat-every').props.value).toBe('1');
    for (const unit of ['days', 'weeks', 'weekdays', 'months', 'years']) {
      expect(screen.getByTestId(`repeat-unit-${unit}`)).toBeOnTheScreen();
    }
    expect(screen.getByTestId('repeat-ends-never')).toBeOnTheScreen();
    expect(screen.getByTestId('repeat-ends-onDate')).toBeOnTheScreen();
    expect(screen.getByTestId('repeat-ends').children).toHaveLength(2); // exactly two choices
  });

  it('Completed date + every 2 weeks saves "every! 2 weeks" (no anchor, fromCompletion)', async () => {
    const { onSelect, onClose } = await openCustom();
    await fireEvent.press(screen.getByTestId('repeat-based-on-completed'));
    await fireEvent.changeText(screen.getByTestId('repeat-every'), '2');
    await fireEvent.press(screen.getByTestId('repeat-unit-weeks'));
    await fireEvent.press(screen.getByTestId('repeat-custom-done'));

    const spec = chosen(onSelect) as RecurrenceSpec;
    expect(toRRule(spec)).toBe('FREQ=WEEKLY;INTERVAL=2');
    expect(spec.fromCompletion).toBe(true);
    expect(onClose).toHaveBeenCalled();
  });

  it('Scheduled date anchors on the due day (every 3 months on the 28th)', async () => {
    const { onSelect } = await openCustom();
    await fireEvent.changeText(screen.getByTestId('repeat-every'), '3');
    await fireEvent.press(screen.getByTestId('repeat-unit-months'));
    await fireEvent.press(screen.getByTestId('repeat-custom-done'));
    expect(toRRule(chosen(onSelect) as RecurrenceSpec)).toBe('FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=28');
  });

  it('Ends On date saves UNTIL (the last day included) and cannot end before the due day', async () => {
    const { onSelect } = await openCustom();
    await fireEvent.press(screen.getByTestId('repeat-ends-onDate'));
    expect(screen.getByTestId('repeat-end-date')).toHaveTextContent('Ngày kết thúc: 28/10');
    // days before the due day are locked
    await fireEvent.press(screen.getByTestId('repeat-end-calendar-day-2026-10-20'));
    expect(screen.getByTestId('repeat-end-date')).toHaveTextContent('Ngày kết thúc: 28/10');
    await fireEvent.press(screen.getByTestId('repeat-end-calendar-next-month'));
    await fireEvent.press(screen.getByTestId('repeat-end-calendar-day-2026-11-15'));
    expect(screen.getByTestId('repeat-end-date')).toHaveTextContent('Ngày kết thúc: 15/11');

    await fireEvent.press(screen.getByTestId('repeat-custom-done'));
    expect(toRRule(chosen(onSelect) as RecurrenceSpec)).toBe('FREQ=DAILY;UNTIL=20261115');
  });

  it('Ends Never again drops the end date', async () => {
    const { onSelect } = await openCustom();
    await fireEvent.press(screen.getByTestId('repeat-ends-onDate'));
    await fireEvent.press(screen.getByTestId('repeat-ends-never'));
    expect(screen.queryByTestId('repeat-end-date')).toBeNull();
    await fireEvent.press(screen.getByTestId('repeat-custom-done'));
    expect(toRRule(chosen(onSelect) as RecurrenceSpec)).toBe('FREQ=DAILY');
  });

  it('refuses an interval outside 1–999: error shown, Done disabled', async () => {
    const { onSelect } = await openCustom();
    await fireEvent.changeText(screen.getByTestId('repeat-every'), '0');
    expect(screen.getByText('Nhập một số từ 1 đến 999')).toBeOnTheScreen();
    expect(screen.getByTestId('repeat-custom-done')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('repeat-custom-done'));
    expect(onSelect).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('repeat-every'), '');
    expect(screen.getByTestId('repeat-custom-done')).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('repeat-every'), '999');
    expect(screen.getByTestId('repeat-custom-done')).toBeEnabled();
  });

  it('shows the next occurrence as a preview (every 3 days from the due day → after today)', async () => {
    await openCustom();
    await fireEvent.changeText(screen.getByTestId('repeat-every'), '3');
    // due Wed 28/10, "today" Fri 23/10 → next after the due is Sat 31/10
    expect(screen.getByTestId('repeat-preview')).toHaveTextContent('Lần tiếp theo: 31/10');
  });

  it('starts from the current rule when it fits the form, and ◂ goes back to the list', async () => {
    await openCustom({ freq: 'MONTHLY', interval: 4, byMonthDay: [28], fromCompletion: true });
    expect(screen.getByTestId('repeat-every').props.value).toBe('4');
    expect(screen.getByTestId('repeat-unit-months').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('repeat-based-on-completed').props.accessibilityState).toMatchObject({ selected: true });

    await fireEvent.press(screen.getByTestId('repeat-custom-back'));
    expect(screen.getByTestId('repeat-preset-daily')).toBeOnTheScreen();
  });
});
